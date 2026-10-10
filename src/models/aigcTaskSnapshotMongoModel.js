"use strict";

const Task = require("./aigcTaskSnapshot");

function requireText(value, fieldName) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error(`${fieldName}不能为空`);
  }

  return text;
}

function toNonNegativeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : 0;
}

function toDateString(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString();
}

function toSafeTask(row) {
  return {
    masterAccountId: row.masterAccountId,
    providerTaskId: row.providerTaskId,
    memberId: row.memberId,
    memberName: row.memberName,
    companyId: row.companyId,
    companyName: row.companyName,
    object: row.object,
    objectName: row.objectName,
    status: row.status,

    point: toNonNegativeNumber(row.point),
    refundedPoint: toNonNegativeNumber(row.refundedPoint),
    netPoint: Number(row.netPoint || 0),

    imageUrl: row.imageUrl,
    imageWidth: toNonNegativeNumber(row.imageWidth),
    imageHeight: toNonNegativeNumber(row.imageHeight),

    dateCreate: toDateString(row.dateCreate),
    dateEnd: toDateString(row.dateEnd),
    syncedAt: toDateString(row.syncedAt)
  };
}

function taskTime(task) {
  return (
    task.dateEnd ||
    task.dateCreate ||
    task.syncedAt ||
    ""
  );
}

async function listTasksByMasterAccountId(masterAccountId) {
  const id = requireText(
    masterAccountId,
    "AIGC企业主账号ID"
  );

  const rows = await Task.find({
    masterAccountId: id
  }).lean();

  return rows
    .map(toSafeTask)
    .sort((left, right) =>
      taskTime(right).localeCompare(taskTime(left))
    );
}

async function listTasksByMemberId({
  masterAccountId,
  memberId
}) {
  const normalizedMemberId = requireText(
    memberId,
    "YiBai成员ID"
  );

  const tasks = await listTasksByMasterAccountId(
    masterAccountId
  );

  return tasks.filter(
    task => task.memberId === normalizedMemberId
  );
}

function normalizeIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function addIdentity(identitySet, value) {
  const normalized = normalizeIdentity(value);

  if (!normalized) return;

  identitySet.add(normalized);

  const atIndex = normalized.indexOf("@");

  if (atIndex > 0) {
    identitySet.add(normalized.slice(0, atIndex));
  }
}

function memberMatchesIdentity(memberName, identitySet) {
  const memberIdentities = new Set();

  addIdentity(memberIdentities, memberName);

  return Array.from(memberIdentities).some(
    identity => identitySet.has(identity)
  );
}

function summarizeTasks(tasks) {
  const deductedTokens = tasks.reduce(
    (total, task) =>
      total + toNonNegativeNumber(task.point),
    0
  );

  const refundedTokens = tasks.reduce(
    (total, task) =>
      total + toNonNegativeNumber(task.refundedPoint),
    0
  );

  return {
    totalTasks: tasks.length,

    successfulTasks: tasks.filter(
      task => task.status === "O"
    ).length,

    failedTasks: tasks.filter(
      task => task.status === "R"
    ).length,

    processingTasks: tasks.filter(
      task => task.status !== "O" &&
              task.status !== "R"
    ).length,

    deductedTokens,
    refundedTokens,

    netUsedTokens: Math.max(
      deductedTokens - refundedTokens,
      0
    )
  };
}

function latestSyncedAt(tasks) {
  return tasks.reduce(
    (latest, task) =>
      String(task.syncedAt || "") > latest
        ? String(task.syncedAt || "")
        : latest,
    ""
  ) || null;
}

async function listTaskSnapshotByIdentity({
  masterAccountId,
  identities
}) {
  const companyTasks =
    await listTasksByMasterAccountId(masterAccountId);

  const identitySet = new Set();

  (Array.isArray(identities) ? identities : [])
    .forEach(value => addIdentity(identitySet, value));

  function emptyResult(status) {
    return {
      status,
      memberId: null,
      tasks: [],
      summary: summarizeTasks([]),
      latestSyncedAt: latestSyncedAt(companyTasks)
    };
  }

  if (identitySet.size === 0) {
    return emptyResult("identity_missing");
  }

  const matchingMemberIds = Array.from(
    new Set(
      companyTasks
        .filter(task =>
          task.memberId &&
          memberMatchesIdentity(
            task.memberName,
            identitySet
          )
        )
        .map(task => task.memberId)
    )
  );

  if (matchingMemberIds.length === 0) {
    return emptyResult("member_unresolved");
  }

  if (matchingMemberIds.length > 1) {
    return emptyResult("member_ambiguous");
  }

  const memberId = matchingMemberIds[0];

  const tasks = companyTasks.filter(
    task => task.memberId === memberId
  );

  return {
    status: "resolved",
    memberId,
    tasks,
    summary: summarizeTasks(tasks),
    latestSyncedAt: latestSyncedAt(tasks)
  };
}

/**
 * 与旧 CSV normalizeTask 保持相同的基础字段、默认值和消耗计算。
 * 入库前集中验证，避免任务数组后段异常导致前段数据已被修改。
 */
function normalizeTask({ masterAccountId, task, syncedAt }) {
  const point = toNonNegativeNumber(task?.point);
  const refundedPoint = toNonNegativeNumber(
    task?.rpoint ?? task?.refundedPoint
  );

  const normalizeDate = (value, fieldName) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${fieldName}不是有效日期`);
    }
    return parsed;
  };

  return {
    masterAccountId: requireText(
      masterAccountId, "AIGC企业主账号ID"
    ),
    providerTaskId: requireText(
      task?.id ?? task?.providerTaskId, "AIGC任务ID"
    ),
    memberId: String(task?.memberId || "").trim(),
    memberName: String(task?.memberName || "").trim(),
    companyId: String(task?.companyId || "").trim(),
    companyName: String(task?.companyName || "").trim(),
    object: String(task?.object || "").trim(),
    objectName: String(
      task?.objectName || "AIGC 创作任务"
    ).trim(),
    status: String(task?.status || "").trim(),
    point,
    refundedPoint,
    netPoint: point - refundedPoint,
    imageUrl: String(task?.imageUrl || "").trim(),
    imageWidth: toNonNegativeNumber(task?.imageWidth),
    imageHeight: toNonNegativeNumber(task?.imageHeight),
    dateCreate: normalizeDate(
      task?.dateCreate || task?.createdAt, "dateCreate"
    ),
    dateEnd: normalizeDate(task?.dateEnd, "dateEnd"),
    syncedAt: normalizeDate(syncedAt, "syncedAt")
  };
}

/**
 * 旧版 CSV 接口原样迁移：按主账号 + 外部任务 ID upsert。
 * 同一批次有重复任务时，首条计新增，之后计更新。
 * 数据库唯一索引防止并发创建重复任务。
 */
async function upsertTasks({
  masterAccountId,
  tasks,
  syncedAt = new Date().toISOString()
}) {
  const masterId = requireText(
    masterAccountId, "AIGC企业主账号ID"
  );

  if (!Array.isArray(tasks)) {
    throw new Error("YiBai任务数据必须是数组");
  }

  // 与 CSV 相同，调用方显式传入空同步时间时也使用当前时间。
  const effectiveSyncedAt = syncedAt || new Date().toISOString();

  // 在开始写入前先验证所有行；不接受无法存入 Date 字段的日期。
  const documents = tasks.map(task => normalizeTask({
    masterAccountId: masterId,
    task,
    syncedAt: effectiveSyncedAt
  }));

  let insertedCount = 0;
  let updatedCount = 0;

  // 依次 upsert，确保同一批内重复任务的计数与旧 CSV 保持一致。
  for (const document of documents) {
    const filter = {
      masterAccountId: document.masterAccountId,
      providerTaskId: document.providerTaskId
    };

    let result;
    try {
      result = await Task.updateOne(
        filter,
        { $set: document },
        { upsert: true, runValidators: true }
      );
    } catch (error) {
      // 两个进程同时新建同一任务时，由唯一索引保证只有一条。
      // 已被其他进程插入则转为普通更新，不掩盖其他数据库错误。
      if (error?.code !== 11000) throw error;
      result = await Task.updateOne(
        filter,
        { $set: document },
        { runValidators: true }
      );
    }

    if (result.upsertedCount === 1) {
      insertedCount += 1;
    } else if (result.matchedCount === 1) {
      updatedCount += 1;
    } else {
      throw new Error("任务写入状态异常，请检查 MongoDB 数据");
    }
  }

  return {
    insertedCount,
    updatedCount,
    totalProcessed: insertedCount + updatedCount
  };
}

/** 解绑企业时只删除对应企业的历史快照，并返回删除条数。 */
async function deleteTasksByMasterAccountId(masterAccountId) {
  const masterId = requireText(
    masterAccountId, "AIGC企业主账号ID"
  );
  const result = await Task.deleteMany({ masterAccountId: masterId });
  return result.deletedCount;
}

module.exports = {
  upsertTasks,
  listTasksByMasterAccountId,
  listTasksByMemberId,
  listTaskSnapshotByIdentity,
  deleteTasksByMasterAccountId
};
