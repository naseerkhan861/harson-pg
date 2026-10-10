"use strict";

// 从真实本地 MongoDB 只读对比迁移后的 210 条任务与原 CSV。
// 不写 MongoDB、CSV，也不会请求外部平台。
require("dotenv").config();
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");
const { readCsv } = require("../src/utils/csvStore");
const CsvModel = require("../src/models/aigcTaskSnapshotCsvModel");
const MongoModel = require("../src/models/aigcTaskSnapshotMongoModel");
const Task = require("../src/models/aigcTaskSnapshot");

const fields = [
  "masterAccountId", "providerTaskId", "memberId", "memberName",
  "companyId", "companyName", "object", "objectName", "status",
  "point", "refundedPoint", "netPoint", "imageUrl", "imageWidth",
  "imageHeight", "dateCreate", "dateEnd", "syncedAt"
];
const numbers = new Set(["point", "refundedPoint", "netPoint", "imageWidth", "imageHeight"]);
const dates = new Set(["dateCreate", "dateEnd", "syncedAt"]);
const normalize = row => Object.fromEntries(fields.map(field => [
  field,
  dates.has(field)
    ? (row[field] ? new Date(row[field]).getTime() : null)
    : numbers.has(field)
      ? Number(row[field] ?? 0)
      : String(row[field] ?? "")
]));

async function main() {
  assert.ok(process.env.MONGODB_URI, "缺少 MONGODB_URI");
  const file = path.join(
    process.env.HARSON_DATA_DIR || path.join(process.cwd(), "data"),
    "aigc_task_snapshots.secure.csv"
  );
  const csvRows = readCsv(file, fields);
  assert.equal(csvRows.length, 210, "CSV 数量已偏离迁移时的 210 条，请停止切换并复核");
  const masters = [...new Set(csvRows.map(row => row.masterAccountId))];

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const mongoCount = await Task.countDocuments();
    assert.equal(mongoCount, 210, "MongoDB 数量已偏离迁移时的 210 条，请停止切换并复核");

    let compared = 0;
    for (const masterAccountId of masters) {
      const legacy = CsvModel.listTasksByMasterAccountId(masterAccountId);
      const current = await MongoModel.listTasksByMasterAccountId(masterAccountId);
      assert.equal(current.length, legacy.length, "企业任务数量不一致");
      assert.deepEqual(
        current.map(task => task.providerTaskId),
        legacy.map(task => task.providerTaskId),
        "企业任务排序不一致"
      );
      for (let index = 0; index < current.length; index++) {
        assert.deepEqual(normalize(current[index]), normalize(legacy[index]), "任务字段不一致");
        compared++;
      }
      const members = [...new Set(legacy.map(task => task.memberId).filter(Boolean))];
      for (const memberId of members) {
        const args = { masterAccountId, memberId };
        assert.deepEqual(
          (await MongoModel.listTasksByMemberId(args)).map(task => task.providerTaskId),
          CsvModel.listTasksByMemberId(args).map(task => task.providerTaskId),
          "成员任务隔离不一致"
        );
      }
      const identities = [[], ["__absent_user_test__"],
        ...[...new Set(legacy.map(task => task.memberName).filter(Boolean))].map(name => [name])];
      for (const names of identities) {
        const args = { masterAccountId, identities: names };
        const oldResult = CsvModel.listTaskSnapshotByIdentity(args);
        const newResult = await MongoModel.listTaskSnapshotByIdentity(args);
        assert.equal(newResult.status, oldResult.status, "身份匹配状态不一致");
        assert.deepEqual(newResult.summary, oldResult.summary, "Token 和任务统计不一致");
        assert.deepEqual(
          newResult.tasks.map(task => task.providerTaskId),
          oldResult.tasks.map(task => task.providerTaskId),
          "身份匹配任务不一致"
        );
      }
    }
    assert.equal(compared, 210);
    console.log("MongoDB live read-only regression: PASSED");
    console.log(`Verified task count: ${compared}`);
    console.log("Sort, 18 business fields, members, identity, Token totals: MATCHED");
    console.log("Real MongoDB write operations: 0");
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(error => {
  console.error("MongoDB read-only check FAILED:", error.message);
  process.exitCode = 1;
});
