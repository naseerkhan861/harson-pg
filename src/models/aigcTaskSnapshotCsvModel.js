"use strict";

const path = require("path");

const {
  readCsv,
  writeCsv
} = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(
    __dirname,
    "../../data"
  );

const TASK_SNAPSHOT_FILE =
  path.join(
    DATA_DIR,
    "aigc_task_snapshots.secure.csv"
  );

const TASK_SNAPSHOT_HEADERS = [
  "masterAccountId",
  "providerTaskId",
  "memberId",
  "memberName",
  "companyId",
  "companyName",
  "object",
  "objectName",
  "status",
  "point",
  "refundedPoint",
  "netPoint",
  "imageUrl",
  "imageWidth",
  "imageHeight",
  "dateCreate",
  "dateEnd",
  "syncedAt"
];

function now() {
  return new Date().toISOString();
}

function requireText(
  value,
  fieldName
) {
  const normalizedValue =
    String(
      value || ""
    ).trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

function toNonNegativeNumber(
  value
) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    return 0;
  }

  return numericValue;
}

function readRows() {
  return readCsv(
    TASK_SNAPSHOT_FILE,
    TASK_SNAPSHOT_HEADERS
  );
}

function writeRows(rows) {
  writeCsv(
    TASK_SNAPSHOT_FILE,
    rows,
    TASK_SNAPSHOT_HEADERS
  );
}

function normalizeTask({
  masterAccountId,
  task,
  syncedAt
}) {
  const point =
    toNonNegativeNumber(
      task?.point
    );

  const refundedPoint =
    toNonNegativeNumber(
      task?.rpoint ??
      task?.refundedPoint
    );

  return {
    masterAccountId:
      requireText(
        masterAccountId,
        "AIGC企业主账号ID"
      ),

    providerTaskId:
      requireText(
        task?.id ??
        task?.providerTaskId,
        "YiBai任务ID"
      ),

    memberId:
      String(
        task?.memberId || ""
      ).trim(),

    memberName:
      String(
        task?.memberName || ""
      ).trim(),

    companyId:
      String(
        task?.companyId || ""
      ).trim(),

    companyName:
      String(
        task?.companyName || ""
      ).trim(),

    object:
      String(
        task?.object || ""
      ).trim(),

    objectName:
      String(
        task?.objectName ||
        "AIGC 创作任务"
      ).trim(),

    status:
      String(
        task?.status || ""
      ).trim(),

    point:
      String(point),

    refundedPoint:
      String(refundedPoint),

    netPoint:
      String(
        point - refundedPoint
      ),

    imageUrl:
      String(
        task?.imageUrl || ""
      ).trim(),

    imageWidth:
      String(
        toNonNegativeNumber(
          task?.imageWidth
        )
      ),

    imageHeight:
      String(
        toNonNegativeNumber(
          task?.imageHeight
        )
      ),

    dateCreate:
      String(
        task?.dateCreate ||
        task?.createdAt ||
        ""
      ).trim(),

    dateEnd:
      String(
        task?.dateEnd || ""
      ).trim(),

    syncedAt:
      String(
        syncedAt || now()
      )
  };
}

/**
 * 按企业主账号 ID + YiBai 任务 ID 更新。
 *
 * 同一任务再次同步时覆盖旧数据，
 * 避免重复任务记录。
 */
function upsertTasks({
  masterAccountId,
  tasks,
  syncedAt = now()
}) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  if (!Array.isArray(tasks)) {
    throw new Error(
      "YiBai任务数据必须是数组"
    );
  }

  const rows =
    readRows();

  let insertedCount = 0;
  let updatedCount = 0;

  tasks.forEach(task => {
    const record =
      normalizeTask({
        masterAccountId:
          normalizedMasterAccountId,

        task,
        syncedAt
      });

    const existingIndex =
      rows.findIndex(
        item =>
          item.masterAccountId ===
            normalizedMasterAccountId &&
          item.providerTaskId ===
            record.providerTaskId
      );

    if (existingIndex >= 0) {
      rows[existingIndex] =
        record;

      updatedCount += 1;
    } else {
      rows.push(record);
      insertedCount += 1;
    }
  });

  writeRows(rows);

  return {
    insertedCount,
    updatedCount,
    totalProcessed:
      insertedCount +
      updatedCount
  };
}

function toSafeTask(row) {
  return {
    masterAccountId:
      row.masterAccountId,

    providerTaskId:
      row.providerTaskId,

    memberId:
      row.memberId,

    memberName:
      row.memberName,

    companyId:
      row.companyId,

    companyName:
      row.companyName,

    object:
      row.object,

    objectName:
      row.objectName,

    status:
      row.status,

    point:
      toNonNegativeNumber(
        row.point
      ),

    refundedPoint:
      toNonNegativeNumber(
        row.refundedPoint
      ),

    netPoint:
      Number(
        row.netPoint || 0
      ),

    imageUrl:
      row.imageUrl,

    imageWidth:
      toNonNegativeNumber(
        row.imageWidth
      ),

    imageHeight:
      toNonNegativeNumber(
        row.imageHeight
      ),

    dateCreate:
      row.dateCreate,

    dateEnd:
      row.dateEnd,

    syncedAt:
      row.syncedAt
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

function listTasksByMasterAccountId(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  return readRows()
    .filter(
      row =>
        row.masterAccountId ===
        normalizedMasterAccountId
    )
    .map(toSafeTask)
    .sort(
      (left, right) =>
        taskTime(right)
          .localeCompare(
            taskTime(left)
          )
    );
}

function listTasksByMemberId({
  masterAccountId,
  memberId
}) {
  const normalizedMemberId =
    requireText(
      memberId,
      "YiBai成员ID"
    );

  return listTasksByMasterAccountId(
    masterAccountId
  ).filter(
    task =>
      task.memberId ===
      normalizedMemberId
  );
}


function normalizeIdentity(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function addIdentity(
  identitySet,
  value
) {
  const normalizedValue =
    normalizeIdentity(value);

  if (!normalizedValue) {
    return;
  }

  identitySet.add(
    normalizedValue
  );

  const atIndex =
    normalizedValue.indexOf(
      "@"
    );

  if (atIndex > 0) {
    identitySet.add(
      normalizedValue.slice(
        0,
        atIndex
      )
    );
  }
}

function buildIdentitySet(
  identities
) {
  const identitySet =
    new Set();

  (
    Array.isArray(identities)
      ? identities
      : []
  ).forEach(value => {
    addIdentity(
      identitySet,
      value
    );
  });

  return identitySet;
}

function memberMatchesIdentity(
  memberName,
  identitySet
) {
  const memberIdentities =
    new Set();

  addIdentity(
    memberIdentities,
    memberName
  );

  return Array.from(
    memberIdentities
  ).some(identity =>
    identitySet.has(identity)
  );
}

function summarizeTasks(
  tasks
) {
  const deductedTokens =
    tasks.reduce(
      (
        total,
        task
      ) =>
        total +
        toNonNegativeNumber(
          task.point
        ),
      0
    );

  const refundedTokens =
    tasks.reduce(
      (
        total,
        task
      ) =>
        total +
        toNonNegativeNumber(
          task.refundedPoint
        ),
      0
    );

  return {
    totalTasks:
      tasks.length,

    successfulTasks:
      tasks.filter(
        task =>
          task.status === "O"
      ).length,

    failedTasks:
      tasks.filter(
        task =>
          task.status === "R"
      ).length,

    processingTasks:
      tasks.filter(
        task =>
          task.status !== "O" &&
          task.status !== "R"
      ).length,

    deductedTokens,

    refundedTokens,

    netUsedTokens:
      Math.max(
        deductedTokens -
        refundedTokens,
        0
      )
  };
}

function latestSyncedAt(
  tasks
) {
  return tasks.reduce(
    (
      latest,
      task
    ) =>
      String(
        task.syncedAt || ""
      ) > latest
        ? String(
            task.syncedAt || ""
          )
        : latest,
    ""
  ) || null;
}

/**
 * 根据 Harson-Base 已保存的
 * 子账号名称和登录邮箱，
 * 安全匹配 YiBai memberId。
 *
 * 匹配不到或匹配多个成员时，
 * 不返回任何任务，避免数据泄露。
 */
function listTaskSnapshotByIdentity({
  masterAccountId,
  identities
}) {
  const companyTasks =
    listTasksByMasterAccountId(
      masterAccountId
    );

  const identitySet =
    buildIdentitySet(
      identities
    );

  if (identitySet.size === 0) {
    return {
      status:
        "identity_missing",

      memberId:
        null,

      tasks: [],

      summary:
        summarizeTasks([]),

      latestSyncedAt:
        latestSyncedAt(
          companyTasks
        )
    };
  }

  const matchingMemberIds =
    Array.from(
      new Set(
        companyTasks
          .filter(task =>
            task.memberId &&
            memberMatchesIdentity(
              task.memberName,
              identitySet
            )
          )
          .map(task =>
            task.memberId
          )
      )
    );

  if (
    matchingMemberIds.length === 0
  ) {
    return {
      status:
        "member_unresolved",

      memberId:
        null,

      tasks: [],

      summary:
        summarizeTasks([]),

      latestSyncedAt:
        latestSyncedAt(
          companyTasks
        )
    };
  }

  if (
    matchingMemberIds.length > 1
  ) {
    return {
      status:
        "member_ambiguous",

      memberId:
        null,

      tasks: [],

      summary:
        summarizeTasks([]),

      latestSyncedAt:
        latestSyncedAt(
          companyTasks
        )
    };
  }

  const memberId =
    matchingMemberIds[0];

  const tasks =
    companyTasks.filter(
      task =>
        task.memberId ===
        memberId
    );

  return {
    status:
      "resolved",

    memberId,

    tasks,

    summary:
      summarizeTasks(
        tasks
      ),

    latestSyncedAt:
      latestSyncedAt(
        tasks
      )
  };
}



/**
 * 删除指定 Harson-Base 企业主账号
 * 对应的全部 YiBai 真实任务快照。
 *
 * 只删除目标企业的数据，
 * 不影响其他企业任务。
 */
function deleteTasksByMasterAccountId(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const rows =
    readRows();

  const remainingRows =
    rows.filter(
      task =>
        task.masterAccountId !==
        normalizedMasterAccountId
    );

  const deletedCount =
    rows.length -
    remainingRows.length;

  if (deletedCount > 0) {
    writeRows(
      remainingRows
    );
  }

  return deletedCount;
}


module.exports = {
  upsertTasks,
  listTasksByMasterAccountId,
  listTasksByMemberId,
  listTaskSnapshotByIdentity,
  deleteTasksByMasterAccountId
};
