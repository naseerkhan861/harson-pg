"use strict";

// 不连接 MongoDB、不调用外部平台，只验证运行时契约与模型读写行为。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const projectRoot = path.resolve(__dirname, "..");
const mongoModelPath = path.join(projectRoot, "src/models/aigcTaskSnapshotMongoModel.js");
const csvModelPath = path.join(projectRoot, "src/models/aigcTaskSnapshotCsvModel.js");
const savedTasks = [];
let writes = 0;
let deletes = 0;
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  if (row[key] instanceof Date && value instanceof Date) {
    return row[key].getTime() === value.getTime();
  }
  return row[key] === value;
});

const Task = {
  find(filter) {
    return {
      async lean() {
        return savedTasks.filter(row => matches(row, filter))
          .map(row => ({ ...row }));
      }
    };
  },
  async updateOne(filter, update, options = {}) {
    writes++;
    const index = savedTasks.findIndex(row => matches(row, filter));
    if (index >= 0) {
      savedTasks[index] = { ...savedTasks[index], ...update.$set };
      return { matchedCount: 1, upsertedCount: 0 };
    }
    if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
    savedTasks.push({ ...update.$set });
    return { matchedCount: 0, upsertedCount: 1 };
  },
  async deleteMany(filter) {
    deletes++;
    const keep = savedTasks.filter(row => !matches(row, filter));
    const count = savedTasks.length - keep.length;
    savedTasks.splice(0, savedTasks.length, ...keep);
    return { deletedCount: count };
  }
};

let csvRows = [];
const csvStore = {
  readCsv() { return csvRows.map(row => ({ ...row })); },
  writeCsv(file, rows) { csvRows = rows.map(row => ({ ...row })); }
};

const originalLoad = Module._load;
let mongo;
let csv;
try {
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === mongoModelPath && request === "./aigcTaskSnapshot") {
      return Task;
    }
    if (parent?.filename === csvModelPath && request === "../utils/csvStore") {
      return csvStore;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  mongo = require(mongoModelPath);
  csv = require(csvModelPath);
} finally {
  Module._load = originalLoad;
}

function normalized(task) {
  const dateFields = new Set(["dateCreate", "dateEnd", "syncedAt"]);
  return Object.fromEntries(Object.entries(task).map(([key, value]) => [
    key,
    dateFields.has(key) ? (value ? new Date(value).getTime() : null) : value
  ]));
}

async function main() {
  // 保证五处入口全部切换，并保留对同一个导出对象的运行时补丁。
  const files = [
    "src/controllers/aigcAccountController.js",
    "src/services/aigcDashboardService.js",
    "src/services/aigcUserDataService.js",
    "src/services/aigcMasterProviderService.js",
    "src/services/aigcSubProviderRuntimePatch.js"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
    assert.match(source, /require\s*\(\s*["']\.\.\/models\/aigcTaskSnapshotMongoModel["']\s*\)/);
    assert.doesNotMatch(source, /aigcTaskSnapshotCsvModel/);
  }
  assert.match(
    fs.readFileSync(path.join(projectRoot, files[4]), "utf8"),
    /taskSnapshotModel\.listTaskSnapshotByIdentity\s*=\s*async function/
  );
  console.log("Runtime import switch: PASSED (5 files)");

  const fixedTime = "2026-10-10T08:00:00.000Z";
  const masterAccountId = "test-enterprise-A";
  const tasks = [
    { id: "task-1", memberId: "member-1", memberName: "alpha@example.com", status: "O", point: 10, rpoint: 2, objectName: "第一条", dateCreate: "2026-10-08T10:00:00Z", dateEnd: "2026-10-08T10:01:00Z" },
    { id: "task-2", memberId: "member-2", memberName: "beta@example.com", status: "R", point: 1, rpoint: 4, dateCreate: "2026-10-09T10:00:00Z" },
    { id: "task-3", memberId: "member-1", memberName: "alpha@example.com", status: "P", point: -7, rpoint: "not-a-number", imageWidth: -1, dateCreate: "2026-10-07T10:00:00Z" }
  ];
  let args = { masterAccountId, tasks, syncedAt: fixedTime };
  const legacy = csv.upsertTasks(args);
  const result = await mongo.upsertTasks(args);
  assert.deepEqual(result, legacy);
  assert.deepEqual(result, { insertedCount: 3, updatedCount: 0, totalProcessed: 3 });

  const before = await mongo.listTasksByMasterAccountId(masterAccountId);
  const oldBefore = csv.listTasksByMasterAccountId(masterAccountId);
  assert.deepEqual(before.map(normalized), oldBefore.map(normalized));
  assert.deepEqual(before.map(t => t.providerTaskId), ["task-2", "task-1", "task-3"]);

  // 同批次重复 ID：旧 CSV 和新 MongoDB 均先计新增、后计更新。
  args = {
    masterAccountId, syncedAt: "2026-10-10T08:10:00.000Z",
    tasks: [
      { id: "task-1", memberId: "member-1", memberName: "alpha@example.com", status: "O", point: 15 },
      { id: "task-4", memberId: "member-1", memberName: "alpha@example.com", status: "O", point: 5 },
      { id: "task-4", memberId: "member-1", memberName: "alpha@example.com", status: "R", point: 5, rpoint: 5 }
    ]
  };
  assert.deepEqual(await mongo.upsertTasks(args), csv.upsertTasks(args));
  const after = await mongo.listTasksByMasterAccountId(masterAccountId);
  assert.deepEqual(after.map(normalized), csv.listTasksByMasterAccountId(masterAccountId).map(normalized));
  assert.equal(after.length, 4);

  const memberArgs = { masterAccountId, memberId: "member-1" };
  assert.deepEqual(
    (await mongo.listTasksByMemberId(memberArgs)).map(normalized),
    csv.listTasksByMemberId(memberArgs).map(normalized)
  );
  assert.deepEqual(await mongo.listTasksByMemberId({ masterAccountId, memberId: "absent" }), []);

  const cases = [
    [], ["not-existing"], ["alpha@example.com"], ["ALPHA"],
    ["beta@example.com"], ["alpha", "beta"]
  ];
  for (const identities of cases) {
    const inputs = { masterAccountId, identities };
    const got = await mongo.listTaskSnapshotByIdentity(inputs);
    const expected = csv.listTaskSnapshotByIdentity(inputs);
    assert.deepEqual(
      { ...got, tasks: got.tasks.map(normalized), latestSyncedAt: got.latestSyncedAt ? new Date(got.latestSyncedAt).getTime() : null },
      { ...expected, tasks: expected.tasks.map(normalized), latestSyncedAt: expected.latestSyncedAt ? new Date(expected.latestSyncedAt).getTime() : null }
    );
  }
  assert.equal((await mongo.listTaskSnapshotByIdentity({ masterAccountId, identities: ["alpha", "beta"] })).status, "member_ambiguous");
  assert.equal((await mongo.listTaskSnapshotByIdentity({ masterAccountId, identities: [] })).status, "identity_missing");
  console.log("Read, member isolation, identity, refunds, update parity: PASSED");

  // 整批入参预检：第二条无效时不能先写入第一条。
  const writesBefore = writes;
  await assert.rejects(
    mongo.upsertTasks({ masterAccountId, tasks: [{ id: "safe" }, { id: "" }], syncedAt: fixedTime }),
    /任务ID不能为空/
  );
  assert.equal(writes, writesBefore);
  await assert.rejects(
    mongo.upsertTasks({ masterAccountId, tasks: [{ id: "safe", dateCreate: "not-a-date" }], syncedAt: fixedTime }),
    /不是有效日期/
  );
  assert.equal(writes, writesBefore);
  await assert.rejects(mongo.upsertTasks({ masterAccountId, tasks: null }), /必须是数组/);
  assert.equal(writes, writesBefore);
  console.log("Input validation before database writes: PASSED");

  // 两家企业隔离；删除返回准确条数，重复删除等于 0。
  await mongo.upsertTasks({ masterAccountId: "test-enterprise-B", tasks: [{ id: "task-1", memberId: "member-X" }], syncedAt: fixedTime });
  assert.equal((await mongo.listTasksByMasterAccountId("test-enterprise-B")).length, 1);
  assert.equal(await mongo.deleteTasksByMasterAccountId(masterAccountId), 4);
  assert.equal(await mongo.deleteTasksByMasterAccountId(masterAccountId), 0);
  assert.equal((await mongo.listTasksByMasterAccountId("test-enterprise-B")).length, 1);
  assert.equal(deletes, 2);
  console.log("Enterprise-scoped delete / cross-tenant isolation: PASSED");
  console.log("Mock regression: PASSED - no real MongoDB or external provider used");
}

main().catch(error => {
  console.error("Task runtime regression FAILED:", error.stack || error.message);
  process.exitCode = 1;
});
