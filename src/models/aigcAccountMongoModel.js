"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");


function collection(name) {
  if (
    mongoose.connection.readyState !== 1 ||
    !mongoose.connection.db
  ) {
    throw new Error("MongoDB 尚未连接");
  }

  return mongoose.connection.db.collection(name);
}

function toRecord(document) {
  if (!document) return null;

  const { _id, platformPasswordHash, allocatedTokens, quotaRevision, providerUnbindReset, activeQuotaOperations, ...record } = document;

  for (const field of ["createdAt", "updatedAt"]) {
    if (record[field] instanceof Date) {
      record[field] = record[field].toISOString();
    }
  }

  // 保持与原 CSV Model 一致的字段类型
  const csvStringFields = [
    "totalCredits",
    "usedCredits",
    "tokenLimit",
    "warningThreshold",
    "creditCost"
  ];

  for (const field of csvStringFields) {
    if (
      record[field] !== undefined &&
      record[field] !== null
    ) {
      record[field] = String(record[field]);
    }
  }

  return record;
}

async function listMasterAccounts() {
  const rows = await collection("aigc_master_accounts")
    .find({})
    .toArray();

  return rows.map(toRecord);
}

async function listSubAccounts() {
  const rows = await collection("aigc_sub_accounts")
    .find({})
    .toArray();

  return rows.map(toRecord);
}

async function getMasterAccountById(masterAccountId) {
  const id = String(masterAccountId || "").trim();
  if (!id) return null;

  return toRecord(
    await collection("aigc_master_accounts").findOne({id})
  );
}

async function getSubAccountById(subAccountId) {
  const id = String(subAccountId || "").trim();
  if (!id) return null;

  return toRecord(
    await collection("aigc_sub_accounts").findOne({id})
  );
}


async function ensureMasterIndexes() {
  const col = collection("aigc_master_accounts");

  let indexes;

  try {
    indexes = await col.indexes();
  } catch (error) {
    if (
      error.code === 26 ||
      error.codeName === "NamespaceNotFound"
    ) {
      indexes = [];
    } else {
      throw error;
    }
  }

  for (const field of ["id", "platformLogin"]) {
    const existing = indexes.find(index =>
      Object.keys(index.key || {}).length === 1 &&
      index.key[field] === 1
    );

    if (existing) {
      if (
        existing.unique !== true ||
        existing.partialFilterExpression ||
        existing.sparse === true
      ) {
        throw new Error(
          `${field} 存在不兼容索引，需要人工检查`
        );
      }

      continue;
    }

    await col.createIndex(
      {[field]: 1},
      {
        name: `uniq_master_${field}`,
        unique: true
      }
    );
  }
}

async function createMaster({
  enterpriseName,
  platformName,
  platformLogin,
  platformPassword,
  totalCredits
}) {
  const enterprise = String(enterpriseName || "").trim();
  const name = String(platformName || "").trim();
  const login = String(platformLogin || "")
    .trim().toLowerCase();

  if (!enterprise || !name || !login || !platformPassword) {
    throw new Error("企业主账号信息不能为空");
  }

  const credits = Number(totalCredits ?? 0);

  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error("总 Token 点数必须是非负有效数字");
  }

  await ensureMasterIndexes();

  const col = collection("aigc_master_accounts");

  if (await col.findOne({platformLogin: login})) {
    throw new Error("该 AIGC 主账号登录邮箱已存在");
  }

  const timestamp = new Date().toISOString();

  const record = {
    id: nanoid(16),
    enterpriseName: enterprise,
    platformName: name,
    platformLogin: login,
    platformPasswordHash: await bcrypt.hash(
      platformPassword,
      12
    ),
    totalCredits: String(credits),
    usedCredits: "0",
    allocatedTokens: 0,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await col.insertOne(record);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "该 AIGC 主账号登录邮箱已存在或业务 ID 重复"
      );
    }
    throw error;
  }

  return toRecord(record);
}


async function ensureSubIndexes() {
  const col = collection("aigc_sub_accounts");

  let indexes;

  try {
    indexes = await col.indexes();
  } catch (error) {
    if (
      error.code === 26 ||
      error.codeName === "NamespaceNotFound"
    ) {
      indexes = [];
    } else {
      throw error;
    }
  }

  for (const field of ["id", "platformLogin"]) {
    const existing = indexes.find(index =>
      Object.keys(index.key || {}).length === 1 &&
      index.key[field] === 1
    );

    if (existing) {
      if (
        existing.unique !== true ||
        existing.partialFilterExpression ||
        existing.sparse === true
      ) {
        throw new Error(
          `${field} 存在不兼容索引，需要人工检查`
        );
      }
      continue;
    }

    await col.createIndex(
      { [field]: 1 },
      {
        name: `uniq_sub_${field}`,
        unique: true
      }
    );
  }
}

async function createSubAccountUnprotected({
  masterAccountId,
  subAccountName,
  platformLogin,
  platformPassword,
  tokenLimit,
  warningThreshold
}) {
  const masterId = String(masterAccountId || "").trim();
  const name = String(subAccountName || "").trim();
  const login = String(platformLogin || "")
    .trim().toLowerCase();

  if (!masterId || !name || !login || !platformPassword) {
    throw new Error("AIGC 子账号信息不能为空");
  }

  const limit = Number(tokenLimit ?? 0);
  const threshold = Number(warningThreshold ?? 10);

  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error("token 配额不能为负数或无效数字");
  }

  if (
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    threshold > 100
  ) {
    throw new Error("剩余预警阈值必须在 1 到 100 之间");
  }

  const masters = collection("aigc_master_accounts");
  const subs = collection("aigc_sub_accounts");

  const master = await masters.findOne({
    id: masterId,
    status: "active"
  });

  if (!master) {
    throw new Error("未找到可用的 AIGC 企业主账号");
  }

  const totalCredits = Number(master.totalCredits);

  if (!Number.isFinite(totalCredits) || totalCredits < 0) {
    throw new Error("企业主账号总 Token 点数无效");
  }

  await ensureSubIndexes();

  if (await subs.findOne({platformLogin: login})) {
    throw new Error("该 AIGC 子账号登录邮箱已存在");
  }

  // 使用与原 CSV 逻辑相同的密码加密强度
  const passwordHash = await bcrypt.hash(platformPassword, 12);

  /*
   * 第一次使用 MongoDB 配额计数器时，
   * 根据已存在的所有子账号初始化。
   *
   * 与原 CSV 规则一致：
   * 停用子账号的已分配配额仍计入总额。
   */
  const existingSubs = await subs
    .find({masterAccountId: masterId})
    .toArray();

  const initialAllocation = existingSubs.reduce(
    (sum, sub) => {
      const value = Number(sub.tokenLimit || 0);

      if (!Number.isFinite(value) || value < 0) {
        throw new Error("现有子账号 Token 配额数据无效");
      }

      return sum + value;
    },
    0
  );

  await masters.updateOne(
    {
      id: masterId,
      status: "active",
      allocatedTokens: {$exists: false}
    },
    {
      $set: {
        allocatedTokens: initialAllocation
      }
    }
  );

  /*
   * 原子预留 Token：
   * 如果配额不足，updateOne 不会匹配到记录。
   */
  const reservation = await masters.updateOne(
    {
      id: masterId,
      status: "active",
      totalCredits: master.totalCredits,
      allocatedTokens: {
        $lte: totalCredits - limit
      }
    },
    {
      $inc: {
        allocatedTokens: limit
      }
    }
  );

  if (reservation.matchedCount !== 1) {
    throw new Error(
      "Token 配额分配失败：当前企业剩余可分配点数不足，或总点数已变化"
    );
  }

  const timestamp = new Date().toISOString();

  const record = {
    id: nanoid(16),
    masterAccountId: masterId,
    subAccountName: name,
    platformLogin: login,
    platformPasswordHash: passwordHash,
    tokenLimit: String(limit),
    warningThreshold: String(threshold),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await subs.insertOne(record);
  } catch (error) {
    // 插入失败时补偿释放本次预留配额
    try {
      const rollback = await masters.updateOne(
        {id: masterId},
        {
          $inc: {
            allocatedTokens: -limit
          }
        }
      );

      if (rollback.matchedCount !== 1) {
        throw new Error("找不到需要恢复配额的企业主账号");
      }
    } catch (rollbackError) {
      throw new Error(
        "子账号保存失败，且 Token 配额回滚失败，请检查数据库",
        {cause: rollbackError}
      );
    }

    if (error.code === 11000) {
      throw new Error(
        "该 AIGC 子账号登录邮箱已存在或业务 ID 重复"
      );
    }

    throw error;
  }

  return {
    ...toRecord(record),
    usedTokens: 0,
    remainingTokens: limit,
    usageRate: 0,
    remainingRate: 100,
    warningStatus: "normal"
  };
}


async function updateSubAccountTokenSettingsUnprotected({
  subAccountId,
  tokenLimit,
  warningThreshold
}) {
  const subId = String(subAccountId || "").trim();

  if (!subId) {
    throw new Error("子账号 ID 不能为空");
  }

  const limit = Number(tokenLimit ?? 0);
  const threshold = Number(warningThreshold ?? 10);

  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error("token 配额不能为负数");
  }

  if (
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    threshold > 100
  ) {
    throw new Error("剩余预警阈值必须在 1 到 100 之间");
  }

  const subs = collection("aigc_sub_accounts");
  const masters = collection("aigc_master_accounts");
  const works = collection("creative_works");

  const sub = await subs.findOne({id: subId});

  if (!sub) {
    throw new Error("未找到对应的 AIGC 子账号");
  }

  const master = await masters.findOne({
    id: sub.masterAccountId,
    status: "active"
  });

  if (!master) {
    throw new Error("未找到可用的 AIGC 主账号");
  }

  const total = Number(master.totalCredits);
  const previousLimit = Number(sub.tokenLimit);

  if (
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isFinite(previousLimit) ||
    previousLimit < 0
  ) {
    throw new Error("现有 Token 配额数据无效");
  }

  const workRows = await works.find({
    aigcSubAccountId: subId
  }).toArray();

  const usedTokens = workRows.reduce((sum, work) => {
    const cost = Number(work.creditCost || 0);

    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error("创作记录 Token 消耗数据无效");
    }

    return sum + cost;
  }, 0);

  if (limit < usedTokens) {
    throw new Error(
      "Token 配额不能低于当前已使用 Token 数"
    );
  }

  // 初始化从 CSV 迁移来的主账号配额计数器
  const allSubs = await subs.find({
    masterAccountId: sub.masterAccountId
  }).toArray();

  const allocated = allSubs.reduce((sum, item) => {
    const value = Number(item.tokenLimit);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error("现有子账号配额数据无效");
    }

    return sum + value;
  }, 0);

  await masters.updateOne(
    {
      id: master.id,
      status: "active",
      allocatedTokens: {$exists: false}
    },
    {
      $set: {allocatedTokens: allocated}
    }
  );

  const currentMaster = await masters.findOne({
    id: master.id,
    status: "active"
  });

  if (
    !currentMaster ||
    !Number.isFinite(currentMaster.allocatedTokens) ||
    Math.abs(currentMaster.allocatedTokens - allocated) > 1e-8
  ) {
    throw new Error(
      "Token 配额计数与子账号合计不一致，请先对账"
    );
  }

  const delta = limit - previousLimit;

  // 使用版本号防止同一子账号的并发更新被覆盖
  const revision = Number(sub.quotaRevision || 0);

  const filter = {
    id: subId,
    quotaRevision: sub.quotaRevision === undefined
      ? {$exists: false}
      : sub.quotaRevision
  };

  const update = {
    $set: {
      tokenLimit: String(limit),
      warningThreshold: String(threshold),
      updatedAt: new Date().toISOString()
    },
    $inc: {quotaRevision: 1}
  };

  if (delta > 0) {
    // 增加配额：先原子预留，再修改子账号
    const reserved = await masters.updateOne(
      {
        id: master.id,
        status: "active",
        totalCredits: master.totalCredits,
        allocatedTokens: {$lte: total - delta}
      },
      {$inc: {allocatedTokens: delta}}
    );

    if (reserved.matchedCount !== 1) {
      throw new Error(
        "Token 配额分配失败：剩余可分配点数不足"
      );
    }

    let updated;

    try {
      updated = await subs.updateOne(filter, update);

      if (updated.matchedCount !== 1) {
        throw new Error("子账号配额已被其他操作修改");
      }
    } catch (error) {
      const rollback = await masters.updateOne(
        {
          id: master.id,
          allocatedTokens: {$gte: delta}
        },
        {$inc: {allocatedTokens: -delta}}
      );

      if (rollback.matchedCount !== 1) {
        throw new Error(
          "Token 配额回滚失败，需要人工对账",
          {cause: error}
        );
      }

      throw error;
    }

  } else {
    // 减少配额：先修改子账号，再释放额度
    const updated = await subs.updateOne(filter, update);

    if (updated.matchedCount !== 1) {
      throw new Error("子账号配额已被其他操作修改");
    }

    if (delta < 0) {
      const released = await masters.updateOne(
        {
          id: master.id,
          allocatedTokens: {$gte: -delta}
        },
        {$inc: {allocatedTokens: delta}}
      );

      if (released.matchedCount !== 1) {
        // 尝试恢复原配额，避免无声的数据不一致
        const rollback = await subs.updateOne(
          {
            id: subId,
            quotaRevision: revision + 1
          },
          {
            $set: {
              tokenLimit: sub.tokenLimit,
              warningThreshold: sub.warningThreshold,
              updatedAt: sub.updatedAt
            },
            $inc: {quotaRevision: 1}
          }
        );

        if (rollback.matchedCount !== 1) {
          throw new Error(
            "子账号配额恢复失败，需要人工对账"
          );
        }

        throw new Error("释放 Token 配额失败");
      }
    }
  }

  const updatedSub = await subs.findOne({id: subId});

  const remainingTokens = Math.max(
    Number(updatedSub.tokenLimit) - usedTokens,
    0
  );

  const currentLimit = Number(updatedSub.tokenLimit);
  const currentThreshold = Number(updatedSub.warningThreshold);

  const usageRate = currentLimit > 0
    ? Math.round(usedTokens / currentLimit * 100)
    : 0;

  const remainingRate = currentLimit > 0
    ? Math.round(remainingTokens / currentLimit * 100)
    : 100;

  let warningStatus = "normal";

  if (currentLimit > 0 && usedTokens >= currentLimit) {
    warningStatus = "exceeded";
  } else if (
    currentLimit > 0 &&
    remainingRate <= currentThreshold
  ) {
    warningStatus = "warning";
  }

  return {
    ...toRecord(updatedSub),
    tokenLimit: currentLimit,
    warningThreshold: currentThreshold,
    usedTokens,
    remainingTokens,
    usageRate,
    remainingRate,
    warningStatus
  };
}


async function syncMasterTotalCreditsUnprotected({
  masterAccountId,
  totalCredits
}) {
  const id = String(masterAccountId || "").trim();

  if (!id) {
    throw new Error("企业主账号 ID 不能为空");
  }

  if (
    totalCredits === null ||
    totalCredits === undefined ||
    String(totalCredits).trim() === ""
  ) {
    throw new Error("同步总点数不能为空");
  }

  const credits = Number(totalCredits);

  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error("同步总点数必须是非负有效数字");
  }

  const masters = collection("aigc_master_accounts");
  const subs = collection("aigc_sub_accounts");

  const master = await masters.findOne({
    id,
    status: "active"
  });

  if (!master) {
    throw new Error("未找到可用的 AIGC 企业主账号");
  }

  const allocatedTokens = master.allocatedTokens;

  if (
    typeof allocatedTokens !== "number" ||
    !Number.isFinite(allocatedTokens) ||
    allocatedTokens < 0
  ) {
    throw new Error(
      "企业配额计数器未初始化或数据无效"
    );
  }

  // 同步前检查配额计数器与实际子账号是否一致
  const existingSubs = await subs.find({
    masterAccountId: id
  }).toArray();

  const actualAllocation = existingSubs.reduce(
    (sum, sub) => {
      const limit = Number(sub.tokenLimit);

      if (!Number.isFinite(limit) || limit < 0) {
        throw new Error("现有子账号 Token 配额无效");
      }

      return sum + limit;
    },
    0
  );

  if (
    Math.abs(actualAllocation - allocatedTokens) > 1e-8
  ) {
    throw new Error(
      "企业 Token 配额计数不一致，请先对账"
    );
  }

  if (credits < allocatedTokens) {
    throw new Error(
      "外部点数同步失败：总额不能低于子账号已分配配额"
    );
  }

  const previousTotalCredits = Number(master.totalCredits);

  if (
    !Number.isFinite(previousTotalCredits) ||
    previousTotalCredits < 0
  ) {
    throw new Error("当前企业 Token 总额无效");
  }

  /*
   * 原子条件更新：
   * 如果其他操作改变了总额或已分配配额，
   * 只有新总额仍能覆盖当前配额时才允许更新。
   */
  const result = await masters.findOneAndUpdate(
    {
      id,
      status: "active",
      totalCredits: master.totalCredits,
      allocatedTokens: {
        $gte: 0,
        $lte: credits
      }
    },
    {
      $set: {
        totalCredits: String(credits),
        updatedAt: new Date().toISOString()
      }
    },
    {
      returnDocument: "after"
    }
  );

  // 兼容不同版本 MongoDB Driver 返回结构
  const updated = result &&
    Object.prototype.hasOwnProperty.call(result, "value")
      ? result.value
      : result;

  if (!updated) {
    throw new Error(
      "企业 Token 总额或配额已变化，请重新同步"
    );
  }

  return {
    ...toRecord(updated),
    previousTotalCredits,
    syncedTotalCredits: credits,
    allocatedTokens: updated.allocatedTokens,
    availableForAllocation: Math.max(
      credits - updated.allocatedTokens,
      0
    )
  };
}


async function resetMasterTotalCreditsAfterProviderUnbind(
  masterAccountId
) {
  const id = String(masterAccountId || "").trim();

  if (!id) {
    throw new Error("企业主账号 ID 不能为空");
  }

  const masters = collection("aigc_master_accounts");
  const subs = collection("aigc_sub_accounts");
  const works = collection("creative_works");

  const master = await masters.findOne({
    id,
    status: "active"
  });

  if (!master) {
    throw new Error("未找到可用的 AIGC 企业主账号");
  }

  let reset = master.providerUnbindReset;

  if (!reset) {
    const total = Number(master.totalCredits);
    const used = Number(master.usedCredits || 0);
    const allocated = master.allocatedTokens;

    if (
      !Number.isFinite(total) ||
      total < 0 ||
      !Number.isFinite(used) ||
      used < 0 ||
      typeof allocated !== "number" ||
      !Number.isFinite(allocated) ||
      allocated < 0 ||
      allocated > total
    ) {
      throw new Error("企业 Token 数据不一致，禁止解绑清零");
    }

    const relatedSubs = await subs.find({
      masterAccountId: id
    }).toArray();

    let subAllocation = 0;

    for (const sub of relatedSubs) {
      const limit = Number(sub.tokenLimit);

      if (!Number.isFinite(limit) || limit < 0) {
        throw new Error("子账号 Token 配额无效");
      }

      subAllocation += limit;
    }

    if (Math.abs(subAllocation - allocated) > 1e-8) {
      throw new Error(
        "配额计数器与子账号合计不一致，禁止解绑清零"
      );
    }

    const subAccountIds = relatedSubs
      .map(sub => sub.id)
      .sort();

    const workFilter = {
      $or: [
        {aigcSubAccountId: {$in: subAccountIds}},
        {clBaseUserId: id}
      ]
    };

    const legacyWorkCount =
      await works.countDocuments(workFilter);

    reset = {
      phase: "started",
      startedAt: new Date().toISOString(),
      previousTotalCredits: total,
      previousUsedCredits: used,
      resetSubAccountCount: subAccountIds.length,
      removedLegacyWorkCount: legacyWorkCount,
      subAccountIds
    };

    // 保存可恢复标记；如果其他请求已建立标记，则采用已有标记
    const locked = await masters.updateOne(
      {
        _id: master._id,
        status: "active",
        totalCredits: master.totalCredits,
        usedCredits: master.usedCredits,
        allocatedTokens: allocated,
        activeQuotaOperations: {$in: [null, 0]},
        providerUnbindReset: {$exists: false}
      },
      {
        $set: {providerUnbindReset: reset}
      }
    );

    if (locked.matchedCount !== 1) {
      const latest = await masters.findOne({
        _id: master._id,
        status: "active"
      });

      if (!latest?.providerUnbindReset) {
        throw new Error("企业状态发生变化，请重新检查");
      }

      reset = latest.providerUnbindReset;
    }
  }

  if (
    !["started", "credits_reset"].includes(reset.phase) ||
    !Array.isArray(reset.subAccountIds) ||
    !reset.startedAt
  ) {
    throw new Error("解绑恢复标记无效，需要人工检查");
  }

  // 不允许清零过程中产生新的子账号
  const currentSubs = await subs.find({
    masterAccountId: id
  }).toArray();

  const currentIds = currentSubs
    .map(sub => sub.id)
    .sort();

  if (
    JSON.stringify(currentIds) !==
    JSON.stringify(reset.subAccountIds)
  ) {
    throw new Error(
      "解绑期间子账号列表发生变化，停止清零"
    );
  }

  // 以下操作均可重复执行
  await subs.updateMany(
    {
      masterAccountId: id,
      id: {$in: reset.subAccountIds}
    },
    {
      $set: {
        tokenLimit: "0",
        updatedAt: new Date().toISOString()
      }
    }
  );

  // 只清理旧模拟创作记录，不涉及真实任务快照集合
  await works.deleteMany({
    $or: [
      {
        aigcSubAccountId: {
          $in: reset.subAccountIds
        }
      },
      {clBaseUserId: id}
    ]
  });

  const completed = await masters.updateOne(
    {
      _id: master._id,
      "providerUnbindReset.startedAt": reset.startedAt
    },
    {
      $set: {
        totalCredits: "0",
        usedCredits: "0",
        allocatedTokens: 0,
        updatedAt: new Date().toISOString(),
        "providerUnbindReset.phase": "credits_reset"
      }
    }
  );

  if (completed.matchedCount !== 1) {
    throw new Error("企业清零状态更新失败，需要重新执行");
  }

  // 结果核对
  const verified = await masters.findOne({_id: master._id});
  const verifiedSubs = await subs.find({
    masterAccountId: id
  }).toArray();

  const remainingWorks = await works.countDocuments({
    $or: [
      {
        aigcSubAccountId: {
          $in: reset.subAccountIds
        }
      },
      {clBaseUserId: id}
    ]
  });

  if (
    verified.totalCredits !== "0" ||
    verified.usedCredits !== "0" ||
    verified.allocatedTokens !== 0 ||
    verified.providerUnbindReset?.phase !== "credits_reset" ||
    verifiedSubs.some(sub => Number(sub.tokenLimit) !== 0) ||
    remainingWorks !== 0
  ) {
    throw new Error(
      "解绑清零核对失败，需要重新执行恢复"
    );
  }

  return {
    masterAccountId: id,
    previousTotalCredits: reset.previousTotalCredits,
    previousUsedCredits: reset.previousUsedCredits,
    resetTotalCredits: 0,
    resetUsedCredits: 0,
    resetSubAccountCount: reset.resetSubAccountCount,
    removedLegacyWorkCount: reset.removedLegacyWorkCount,
    pendingProviderCleanup: true
  };
}


async function withMasterQuotaOperation(masterAccountId, task) {
  const id = String(masterAccountId || "").trim();

  if (!id) {
    throw new Error("企业主账号 ID 不能为空");
  }

  const masters = collection("aigc_master_accounts");

  // 原子登记操作，解绑标记存在时无法进入
  const acquired = await masters.updateOne(
    {
      id,
      status: "active",
      providerUnbindReset: {$exists: false}
    },
    {
      $inc: {activeQuotaOperations: 1}
    }
  );

  if (acquired.matchedCount !== 1) {
    throw new Error(
      "企业主账号正在解绑或不可用，禁止修改账号及 Token 配额"
    );
  }

  try {
    return await task();
  } finally {
    const released = await masters.updateOne(
      {
        id,
        activeQuotaOperations: {$gte: 1}
      },
      {
        $inc: {activeQuotaOperations: -1}
      }
    );

    if (released.matchedCount !== 1) {
      throw new Error(
        "企业操作计数器释放失败，需要人工检查"
      );
    }
  }
}

async function createSubAccount(payload) {
  return withMasterQuotaOperation(
    payload?.masterAccountId,
    () => createSubAccountUnprotected(payload)
  );
}

async function updateSubAccountTokenSettings(payload) {
  const subId = String(payload?.subAccountId || "").trim();

  if (!subId) {
    throw new Error("子账号 ID 不能为空");
  }

  const sub = await collection("aigc_sub_accounts")
    .findOne({id: subId});

  if (!sub) {
    throw new Error("未找到对应的 AIGC 子账号");
  }

  return withMasterQuotaOperation(
    sub.masterAccountId,
    () => withSubWorkWriteLock(
      subId,
      () => updateSubAccountTokenSettingsUnprotected(payload)
    )
  );
}

async function syncMasterTotalCredits(payload) {
  return withMasterQuotaOperation(
    payload?.masterAccountId,
    () => syncMasterTotalCreditsUnprotected(payload)
  );
}


function calculateSubTokenUsage(sub, works) {
  const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const tokenLimit = toNumber(sub.tokenLimit, 0);
  const warningThreshold = toNumber(
    sub.warningThreshold,
    10
  );

  const usedTokens = works
    .filter(work => work.aigcSubAccountId === sub.id)
    .reduce(
      (sum, work) => sum + toNumber(work.creditCost, 0),
      0
    );

  const remainingTokens = Math.max(
    tokenLimit - usedTokens,
    0
  );

  const usageRate = tokenLimit > 0
    ? Math.round(usedTokens / tokenLimit * 100)
    : 0;

  const remainingRate = tokenLimit > 0
    ? Math.round(remainingTokens / tokenLimit * 100)
    : 100;

  let warningStatus = "normal";

  if (tokenLimit > 0 && usedTokens >= tokenLimit) {
    warningStatus = "exceeded";
  } else if (
    tokenLimit > 0 &&
    remainingRate <= warningThreshold
  ) {
    warningStatus = "warning";
  }

  return {
    tokenLimit,
    warningThreshold,
    usedTokens,
    remainingTokens,
    usageRate,
    remainingRate,
    warningStatus
  };
}

function buildCreditSummary(masters, works, mappings) {
  return masters.map(master => {
    const masterWorks = works.filter(work => {
      const mapping = mappings.find(
        item => item.aigcSubAccountId === work.aigcSubAccountId
      );

      return mapping &&
        mapping.masterAccountId === master.id;
    });

    const usedFromWorks = masterWorks.reduce(
      (sum, work) => sum + Number(work.creditCost || 0),
      0
    );

    const totalCredits = Number(master.totalCredits || 0);

    return {
      masterAccountId: master.id,
      enterpriseName: master.enterpriseName,
      totalCredits,
      usedCredits: usedFromWorks,
      remainingCredits: Math.max(
        totalCredits - usedFromWorks,
        0
      )
    };
  });
}

async function listAdminData() {
  const [
    masters,
    subRows,
    mappings,
    workDocuments
  ] = await Promise.all([
    listMasterAccounts(),
    listSubAccounts(),
    require("./aigcUserMappingMongoModel").listMappings(),
    collection("creative_works").find({}).toArray()
  ]);

  const works = workDocuments.map(toRecord);

  const subs = subRows.map(sub => ({
    ...sub,
    ...calculateSubTokenUsage(sub, works)
  }));

  return {
    masters,
    subs,
    mappings,
    works,
    creditSummary: buildCreditSummary(
      masters,
      works,
      mappings
    )
  };
}


async function getMyMapping(clBaseUserId) {
  const userId = String(clBaseUserId || "").trim();

  if (!userId) {
    return null;
  }

  const mappingModel = require(
    "./aigcUserMappingMongoModel"
  );

  // 通过 Harson-Base 原始业务 ID 查询
  const mapping =
    await mappingModel.getActiveMappingByUserId(userId);

  if (!mapping) {
    return null;
  }

  const [sub, master, workDocuments] = await Promise.all([
    getSubAccountById(mapping.aigcSubAccountId),
    getMasterAccountById(mapping.masterAccountId),
    collection("creative_works").find({}).toArray()
  ]);

  const works = workDocuments.map(toRecord);

  return {
    mapping,

    aigcSubAccount: sub
      ? {
          ...sub,
          ...calculateSubTokenUsage(sub, works)
        }
      : null,

    masterAccount: master || null
  };
}


async function listAigcCenterData() {
  const data = await listAdminData();

  const documents = await collection("token_purchases")
    .find({})
    .toArray();

  const purchases = documents.map(document => {
    const record = toRecord(document);

    return {
      ...record,
      tokens: String(record.tokens ?? ""),
      amount: String(record.amount ?? "")
    };
  });

  return {
    masters: data.masters,
    subs: data.subs,
    purchases,
    creditSummary: data.creditSummary
  };
}


/**
 * Token 充值登记。
 *
 * 当前阶段仅保存登记记录。
 * 企业实际 Token 总额由外部平台同步，不在此处增加。
 */
async function purchaseTokens({
  masterAccountId,
  packageName,
  tokens,
  amount
}) {
  const id = String(masterAccountId || "").trim();
  const name = String(packageName || "").trim();

  if (!id) {
    throw new Error("请选择 AIGC 企业主账号");
  }

  if (!name) {
    throw new Error("请输入 Token 套餐名称");
  }

  const tokenCount = Number(tokens);
  const numericAmount = Number(amount ?? 0);

  if (!Number.isSafeInteger(tokenCount) || tokenCount <= 0) {
    throw new Error("Token 数量必须是正整数");
  }

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error("套餐金额必须是非负有效数字");
  }

  const master = await collection("aigc_master_accounts")
    .findOne({
      id,
      status: "active"
    });

  if (!master) {
    throw new Error("未找到可用的 AIGC 企业主账号");
  }

  const record = {
    id: nanoid(16),
    masterAccountId: id,
    packageName: name,
    tokens: String(tokenCount),
    amount: String(numericAmount),
    paymentStatus: "recorded",
    createdAt: new Date().toISOString()
  };

  // 单次插入一条登记记录，不更新主账号 Token 总额。
  await collection("token_purchases").insertOne(record);

  return {
    purchase: toRecord(record),
    master: toRecord(master)
  };
}


/**
 * 保存手动作品记录。
 *
 * Token 消耗由真实任务数据统计。
 * 此接口不允许客户端手动增加 Token 消耗。
 */
/**
 * 使用 MongoDB 原子操作串行化同一子账号的作品保存。
 *
 * 不改变原有 Token 配额和 API 业务规则。
 * 锁记录独立存储，不影响子账号返回字段。
 */
async function withSubWorkWriteLock(subAccountId, task) {
  const id = String(subAccountId || "").trim();

  if (!id || typeof task !== "function") {
    throw new Error("作品写入锁参数无效");
  }

  const locks = collection("aigc_work_write_locks");
  const owner = nanoid(16);
  const deadline = Date.now() + 10000;

  let acquired = false;

  while (Date.now() < deadline) {
    try {
      const result = await locks.updateOne(
        {
          _id: id,
          $or: [
            {expiresAt: {$exists: false}},
            {expiresAt: {$lte: new Date()}}
          ]
        },
        {
          $set: {
            owner,
            expiresAt: new Date(Date.now() + 120000)
          }
        },
        {upsert: true}
      );

      acquired =
        result.matchedCount === 1 ||
        result.upsertedCount === 1;
    } catch (error) {
      // 已有请求持有锁：重复键冲突属于正常竞争。
      if (error.code !== 11000) {
        throw error;
      }
    }

    if (acquired) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 30));
  }

  if (!acquired) {
    throw new Error("作品保存繁忙，请稍后重试");
  }

  try {
    return await task();
  } finally {
    // 仅允许锁持有者释放自己的锁。
    const released = await locks.deleteOne({
      _id: id,
      owner
    });

    if (released.deletedCount !== 1) {
      throw new Error(
        "作品保存锁释放失败，需要检查数据库"
      );
    }
  }
}

async function addMyWork({
  clBaseUserId,
  title,
  workType,
  promptSummary = "",
  creditCost = 0
} = {}) {
  const userId = String(clBaseUserId || "").trim();
  const workTitle = String(title || "").trim();
  const type = String(workType || "").trim();

  if (!userId) {
    throw new Error("Harson-Base 用户 ID 不能为空");
  }

  if (!workTitle || !type) {
    throw new Error("作品标题和作品类型不能为空");
  }

  // 保持与原 CSV 版本相同的 Token 转换规则
  const parsedCost = Number(creditCost);
  const cost = Number.isFinite(parsedCost)
    ? parsedCost
    : 0;

  if (cost < 0) {
    throw new Error("消耗 token 不能为负数");
  }

  const mappingModel = require(
    "./aigcUserMappingMongoModel"
  );

  const initialMapping =
    await mappingModel.getActiveMappingByUserId(userId);

  if (!initialMapping) {
    throw new Error(
      "当前 Harson-Base 账号尚未绑定可用的 AIGC 子账号"
    );
  }

  return withMasterQuotaOperation(
    initialMapping.masterAccountId,
    () => withSubWorkWriteLock(
      initialMapping.aigcSubAccountId,
      async () => {
        // 在受保护操作内部重新检查映射状态
        const current = await getMyMapping(userId);

        if (
          !current?.mapping ||
          current.mapping.id !== initialMapping.id ||
          current.aigcSubAccount?.status !== "active" ||
          current.masterAccount?.status !== "active" ||
          String(current.aigcSubAccount.masterAccountId) !==
            String(current.masterAccount.id) ||
          String(current.mapping.masterAccountId) !==
            String(current.masterAccount.id)
        ) {
          throw new Error(
            "当前 Harson-Base 账号映射已失效，无法保存作品"
          );
        }

        const sub = current.aigcSubAccount;

        const tokenLimit = Number(sub.tokenLimit) || 0;
        const currentUsedTokens = Number(sub.usedTokens) || 0;
        const nextUsedTokens = currentUsedTokens + cost;

        // 保留原 CSV 版本的配额判断
        if (
          tokenLimit > 0 &&
          nextUsedTokens > tokenLimit
        ) {
          const remainingTokens = Math.max(
            tokenLimit - currentUsedTokens,
            0
          );

          throw new Error(
            `本次创作需要 ${cost} tokens，但当前 AIGC 子账号仅剩 ${remainingTokens} tokens，已超出 token 配额，无法生成，请联系管理员增加配额`
          );
        }

        const record = {
          id: nanoid(16),
          clBaseUserId: userId,
          aigcSubAccountId: sub.id,
          title: workTitle,
          workType: type,
          promptSummary: String(promptSummary || ""),
          creditCost: String(cost),
          createdAt: new Date().toISOString()
        };

        await collection("creative_works").insertOne(record);

        const workDocuments =
          await collection("creative_works")
            .find({aigcSubAccountId: sub.id})
            .toArray();

        const tokenUsage = calculateSubTokenUsage(
          sub,
          workDocuments.map(toRecord)
        );

        return {
          work: toRecord(record),
          tokenUsage
        };
      }
    )
  );
}


/**
 * 完成企业主账号解绑。
 *
 * 必须由 Service 在外部绑定删除成功后调用。
 * verifyBindingRemoved 应重新查询外部绑定，
 * 只有确认绑定不存在时才返回 true。
 */
async function finalizeMasterProviderUnbind(
  masterAccountId,
  verifyBindingRemoved
) {
  const id = String(masterAccountId || "").trim();

  if (!id) {
    throw new Error("企业主账号 ID 不能为空");
  }

  if (typeof verifyBindingRemoved !== "function") {
    throw new Error("缺少外部账号解绑验证方法");
  }

  const masters = collection("aigc_master_accounts");
  const subs = collection("aigc_sub_accounts");
  const works = collection("creative_works");

  const master = await masters.findOne({
    id,
    status: "active"
  });

  if (
    !master ||
    master.providerUnbindReset?.phase !== "credits_reset"
  ) {
    throw new Error("企业主账号尚未完成解绑清零");
  }

  const reset = master.providerUnbindReset;

  if (
    !reset.startedAt ||
    !Array.isArray(reset.subAccountIds)
  ) {
    throw new Error("解绑恢复标记不完整");
  }

  if (
    master.totalCredits !== "0" ||
    master.usedCredits !== "0" ||
    master.allocatedTokens !== 0 ||
    Number(master.activeQuotaOperations || 0) !== 0
  ) {
    throw new Error("企业 Token 尚未完成清零");
  }

  const currentSubs = await subs.find({
    masterAccountId: id
  }).toArray();

  const currentIds = currentSubs
    .map(sub => sub.id)
    .sort();

  if (
    JSON.stringify(currentIds) !==
    JSON.stringify([...reset.subAccountIds].sort()) ||
    currentSubs.some(sub => Number(sub.tokenLimit) !== 0)
  ) {
    throw new Error("企业子账号配额尚未完成清零");
  }

  const remainingWorks = await works.countDocuments({
    $or: [
      {
        aigcSubAccountId: {
          $in: reset.subAccountIds
        }
      },
      {clBaseUserId: id}
    ]
  });

  if (remainingWorks !== 0) {
    throw new Error("企业历史作品尚未清理完成");
  }

  // 最重要：再次确认外部账号绑定已经删除。
  const bindingRemoved = await verifyBindingRemoved(id);

  if (bindingRemoved !== true) {
    throw new Error(
      "外部账号绑定仍存在，不能结束解绑保护"
    );
  }

  const result = await masters.updateOne(
    {
      _id: master._id,
      status: "active",
      totalCredits: "0",
      usedCredits: "0",
      allocatedTokens: 0,
      activeQuotaOperations: {$in: [null, 0]},
      "providerUnbindReset.phase": "credits_reset",
      "providerUnbindReset.startedAt": reset.startedAt
    },
    {
      $unset: {
        providerUnbindReset: ""
      },
      $set: {
        updatedAt: new Date().toISOString()
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      "解绑完成状态更新失败，请检查企业数据"
    );
  }

  return {
    masterAccountId: id,
    finalized: true
  };
}


/**
 * 企业级 Session 操作保护。
 *
 * 在获取或刷新共享 Token 的整个异步过程
 * 中持有企业操作计数器。
 *
 * 解绑清零只能在没有进行中操作时开始；
 * 一旦进入解绑状态，新的 Session 操作会被拒绝。
 */
async function withMasterSessionOperation(
  masterAccountId,
  task
) {
  if (typeof task !== "function") {
    throw new Error("Session 操作必须是函数");
  }

  return withMasterQuotaOperation(
    masterAccountId,
    task
  );
}

module.exports = {
  withMasterSessionOperation,
  finalizeMasterProviderUnbind,
  addMyWork,
  purchaseTokens,
  getMyMapping,
  listAdminData,
  listAigcCenterData,
  resetMasterTotalCreditsAfterProviderUnbind,
  syncMasterTotalCredits,
  updateSubAccountTokenSettings,
  createSubAccount,
  ensureSubIndexes,
  createMaster,
  ensureMasterIndexes,
  listMasterAccounts,
  listSubAccounts,
  getMasterAccountById,
  getSubAccountById
};
