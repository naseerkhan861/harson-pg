"use strict";

const mongoose = require("mongoose");

const masterCache = require(
  "../models/aigcMasterTokenCacheMongoModel"
);
const userCache = require(
  "../models/aigcUserTokenCacheMongoModel"
);
const subCache = require(
  "../models/aigcSubTokenCacheMongoModel"
);
const activeSessions = require(
  "../models/aigcActiveSessionMongoModel"
);
const providerClient = require(
  "./yibaiAigcClient"
);

/**
 * 企业解绑期间撤销所有已缓存的共享 Token。
 * 必须先完成 MongoDB 额度清零并进入 credits_reset。
 */
async function revokeEnterpriseSessionsForUnbind(
  masterAccountId
) {
  const id = String(masterAccountId || "").trim();

  if (!id) {
    throw new Error("企业主账号 ID 不能为空");
  }

  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB 尚未连接");
  }

  const master = await db
    .collection("aigc_master_accounts")
    .findOne({id, status: "active"});

  if (
    master?.providerUnbindReset?.phase !== "credits_reset"
  ) {
    throw new Error(
      "企业尚未进入解绑清零状态，拒绝注销 Session"
    );
  }

  const subs = await db
    .collection("aigc_sub_accounts")
    .find({masterAccountId: id})
    .toArray();

  const sessions = await activeSessions
    .listActiveSessionsByMasterAccountId(id);

  const management = await masterCache.getTokenCache(id);
  const user = await userCache.getTokenCache(id);

  const subTokens = new Map();

  for (const sub of subs) {
    const cached = await subCache.getTokenCache(sub.id);
    subTokens.set(String(sub.id), cached);
  }

  // 活跃 Session 必须能找到对应缓存，否则不能确认已注销。
  for (const session of sessions) {
    const subId = String(
      session.aigcSubAccountId || ""
    );

    if (subId.startsWith("master-owner:")) {
      if (!management?.token && !user?.token) {
        throw new Error(
          "企业主账号存在无 Token 缓存的活跃 Session，需要人工检查"
        );
      }
    } else if (!subTokens.get(subId)?.token) {
      throw new Error(
        "子账号存在无 Token 缓存的活跃 Session，需要人工检查"
      );
    }
  }

  const tokens = new Set();

  for (const cached of [
    management,
    user,
    ...subTokens.values()
  ]) {
    if (cached?.token) {
      tokens.add(cached.token);
    }
  }

  // 去重后逐个调用外部注销接口。
  for (const token of tokens) {
    let result;

    try {
      result = await providerClient.logout(token);
    } catch {
      throw new Error(
        "外部 Session 注销请求失败，已保留本地缓存"
      );
    }

    if (
      result?.success !== true ||
      Number(result.code) !== 200
    ) {
      throw new Error(
        "外部 Session 注销未确认成功，已保留本地缓存"
      );
    }
  }

  // 只有全部外部注销成功后，才清理本地数据。
  if (management) {
    await masterCache.removeTokenCache(id);
  }

  if (user) {
    await userCache.removeTokenCache(id);
  }

  let removedSubCaches = 0;

  for (const [subId, cached] of subTokens) {
    if (cached) {
      await subCache.removeTokenCache(subId);
      removedSubCaches += 1;
    }
  }

  const removedSessions = await activeSessions
    .removeSessionsByMasterAccountId(id);

  const remaining = await activeSessions
    .listActiveSessionsByMasterAccountId(id);

  if (remaining.length !== 0) {
    throw new Error(
      "本地共享 Session 清理未完成，需要人工检查"
    );
  }

  return {
    masterAccountId: id,
    revokedTokenCount: tokens.size,
    removedSubCaches,
    removedSessions,
    completed: true
  };
}

module.exports = {
  revokeEnterpriseSessionsForUnbind
};
