"use strict";

let installed = false;

function install() {
  if (installed) {
    return;
  }

  const sessionService = require("./aigcSessionService");
  const accountModel = require("../models/aigcAccountCsvModel");
  const masterOwnerModel = require("../models/aigcMasterOwnerCsvModel");
  const activeSessionModel = require("../models/aigcActiveSessionCsvModel");
  const taskSnapshotModel = require("../models/aigcTaskSnapshotCsvModel");
  const subProviderConfigModel = require(
    "../models/aigcSubProviderConfigCsvModel"
  );
  const subTokenCacheModel = require(
    "../models/aigcSubTokenCacheCsvModel"
  );
  const subCredentialCrypto = require(
    "../utils/aigcSubCredentialCrypto"
  );
  const yibaiAigcClient = require("./yibaiAigcClient");

  /*
   * 先保存原有主账号 Session 方法。
   * 后续只让子账号改走独立外部子账号，
   * 企业主账号负责人仍完全沿用原逻辑。
   */
  const legacySession = {
    getValidTokenForUser:
      sessionService.getValidTokenForUser.bind(sessionService),
    refreshTokenForUser:
      sessionService.refreshTokenForUser.bind(sessionService),
    getCachedTokenBalanceForUser:
      sessionService.getCachedTokenBalanceForUser.bind(sessionService),
    logoutUserAigcSession:
      sessionService.logoutUserAigcSession.bind(sessionService)
  };

  const originalListTaskSnapshotByIdentity =
    taskSnapshotModel.listTaskSnapshotByIdentity.bind(taskSnapshotModel);

  const subLocks = new Map();

  function requireText(value, fieldName) {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      throw new Error(`${fieldName}不能为空`);
    }

    return normalizedValue;
  }

  function isSuccessfulResponse(response) {
    return Boolean(
      response &&
      response.success === true &&
      Number(response.code) === 200
    );
  }

  function responseMessage(response, fallbackMessage) {
    return String(response?.message || fallbackMessage);
  }

  function withSubLock(subAccountId, task) {
    const normalizedSubAccountId = requireText(
      subAccountId,
      "AIGC子账号ID"
    );

    const previous =
      subLocks.get(normalizedSubAccountId) || Promise.resolve();

    const current = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (subLocks.get(normalizedSubAccountId) === current) {
          subLocks.delete(normalizedSubAccountId);
        }
      });

    subLocks.set(normalizedSubAccountId, current);
    return current;
  }

  function readTokenBalance(memberResult, providerConfig) {
    const configuredField = String(
      providerConfig?.pointsField || "balance"
    ).trim();

    const candidateFields = Array.from(
      new Set([
        configuredField,
        "balance",
        "companyBalance",
        "mpoint",
        "companyMpoint"
      ])
    );

    let selectedField = null;
    let accountBalance = null;

    for (const field of candidateFields) {
      const rawValue = memberResult?.[field];

      if (
        rawValue === null ||
        rawValue === undefined ||
        rawValue === ""
      ) {
        continue;
      }

      const numericValue = Number(rawValue);

      if (Number.isFinite(numericValue) && numericValue >= 0) {
        selectedField = field;
        accountBalance = numericValue;
        break;
      }
    }

    if (!selectedField) {
      return {
        pointsField: null,
        tokenBalance: null,
        accountTokenBalance: null,
        bonusTokenBalance: null
      };
    }

    const rawRightBalance = memberResult?.rightBalance;
    const rightBalance =
      rawRightBalance === null ||
      rawRightBalance === undefined ||
      rawRightBalance === ""
        ? 0
        : Number(rawRightBalance);

    const includeBonus =
      (selectedField === "balance" ||
        selectedField === "companyBalance") &&
      Number.isFinite(rightBalance) &&
      rightBalance >= 0;

    return {
      pointsField: includeBonus
        ? `${selectedField}+rightBalance`
        : selectedField,
      tokenBalance:
        accountBalance + (includeBonus ? rightBalance : 0),
      accountTokenBalance: accountBalance,
      bonusTokenBalance: includeBonus ? rightBalance : 0
    };
  }

  function resolveRole(clBaseUserId, { allowSessionFallback = false } = {}) {
    const normalizedUserId = requireText(
      clBaseUserId,
      "Harson-Base用户ID"
    );

    const subMapping = accountModel.getMyMapping(normalizedUserId);
    const ownerMapping = masterOwnerModel.getActiveMappingByUserId(
      normalizedUserId
    );

    if (subMapping?.mapping && ownerMapping) {
      throw new Error(
        "当前 Harson-Base 用户同时绑定了主账号和子账号，请管理员修复映射"
      );
    }

    if (ownerMapping) {
      return {
        accountType: "master_owner",
        normalizedUserId,
        ownerMapping
      };
    }

    if (subMapping?.mapping) {
      return {
        accountType: "sub_account",
        normalizedUserId,
        subMapping
      };
    }

    if (allowSessionFallback) {
      const existingSession =
        activeSessionModel.getSessionByUserId(normalizedUserId);

      if (
        existingSession?.aigcSubAccountId &&
        !String(existingSession.aigcSubAccountId).startsWith(
          "master-owner:"
        )
      ) {
        const data = accountModel.listAdminData();
        const subAccount = data.subs.find(
          item =>
            String(item.id) ===
            String(existingSession.aigcSubAccountId)
        );
        const masterAccount = data.masters.find(
          item =>
            String(item.id) ===
            String(existingSession.masterAccountId)
        );

        if (subAccount && masterAccount) {
          return {
            accountType: "sub_account",
            normalizedUserId,
            subMapping: {
              mapping: {
                clBaseUserId: normalizedUserId,
                aigcSubAccountId: subAccount.id,
                masterAccountId: masterAccount.id
              },
              aigcSubAccount: subAccount,
              masterAccount
            }
          };
        }
      }
    }

    throw new Error("当前 Harson-Base 账号尚未绑定 AIGC 账号");
  }

  function resolveSubContext(roleContext) {
    const subAccount = roleContext.subMapping?.aigcSubAccount;
    const masterAccount = roleContext.subMapping?.masterAccount;
    const mapping = roleContext.subMapping?.mapping;

    if (!subAccount || subAccount.status !== "active") {
      throw new Error("当前映射的 AIGC 子账号不存在或已停用");
    }

    if (!masterAccount || masterAccount.status !== "active") {
      throw new Error("AIGC 子账号所属主账号不存在或已停用");
    }

    if (
      String(subAccount.masterAccountId) !== String(masterAccount.id) ||
      String(mapping?.masterAccountId) !== String(masterAccount.id)
    ) {
      throw new Error("AIGC 子账号、主账号和用户映射关系不一致");
    }

    const providerConfig =
      subProviderConfigModel.getProviderConfigBySubAccountId(
        subAccount.id
      );

    if (!providerConfig) {
      throw new Error("当前 AIGC 子账号尚未绑定外部子账号");
    }

    return {
      clBaseUserId: roleContext.normalizedUserId,
      mapping,
      subAccount,
      masterAccount,
      providerConfig
    };
  }

  function decryptSubPassword(context) {
    return subCredentialCrypto.decryptProviderPassword({
      subAccountId: context.subAccount.id,
      providerAccount: context.providerConfig.providerAccount,
      encryptionVersion: context.providerConfig.encryptionVersion,
      encryptedPassword: context.providerConfig.encryptedPassword,
      passwordIv: context.providerConfig.passwordIv,
      passwordAuthTag: context.providerConfig.passwordAuthTag
    });
  }

  function markSubSessionActive(context) {
    activeSessionModel.markSessionActive({
      clBaseUserId: context.clBaseUserId,
      aigcSubAccountId: context.subAccount.id,
      masterAccountId: context.masterAccount.id
    });
  }

  function buildSubSessionResult(context, token, source, memberResult) {
    const balanceData = readTokenBalance(
      memberResult,
      context.providerConfig
    );

    markSubSessionActive(context);

    return {
      token,
      source,
      tokenBalance: balanceData.tokenBalance,
      accountTokenBalance: balanceData.accountTokenBalance,
      bonusTokenBalance: balanceData.bonusTokenBalance,
      pointsField: balanceData.pointsField,
      aigcSubAccountId: context.subAccount.id,
      masterAccountId: context.masterAccount.id,
      providerAccount: context.providerConfig.providerAccount,
      accountType: "sub_account"
    };
  }

  async function loginAndCacheSubToken(context) {
    const password = decryptSubPassword(context);
    const loginResult = await yibaiAigcClient.login(
      context.providerConfig.providerAccount,
      password
    );

    if (!isSuccessfulResponse(loginResult)) {
      throw new Error(
        responseMessage(loginResult, "AIGC 子账号登录失败")
      );
    }

    const token = requireText(
      loginResult.result?.token,
      "AIGC子账号Token"
    );

    subTokenCacheModel.upsertTokenCache({
      subAccountId: context.subAccount.id,
      providerAccount: context.providerConfig.providerAccount,
      token
    });

    return buildSubSessionResult(
      context,
      token,
      "sub_login",
      loginResult.result
    );
  }

  async function getSubToken(roleContext) {
    const context = resolveSubContext(roleContext);

    return withSubLock(context.subAccount.id, async () => {
      let cachedToken = null;

      try {
        cachedToken = subTokenCacheModel.getTokenCache(
          context.subAccount.id
        );
      } catch (error) {
        console.warn(
          "AIGC 子账号 Token 缓存读取失败，将重新登录：",
          error.message
        );
        subTokenCacheModel.removeTokenCache(context.subAccount.id);
      }

      if (
        cachedToken &&
        cachedToken.providerAccount !==
          context.providerConfig.providerAccount
      ) {
        subTokenCacheModel.removeTokenCache(context.subAccount.id);
        cachedToken = null;
      }

      if (cachedToken?.token) {
        const validationResult = await yibaiAigcClient.loginByToken(
          cachedToken.token
        );

        if (isSuccessfulResponse(validationResult)) {
          const validatedToken = String(
            validationResult.result?.token || cachedToken.token
          ).trim();

          if (!validatedToken) {
            throw new Error(
              "AIGC 子账号 Token 验证成功，但没有返回可用 Token"
            );
          }

          if (validatedToken !== cachedToken.token) {
            subTokenCacheModel.upsertTokenCache({
              subAccountId: context.subAccount.id,
              providerAccount: context.providerConfig.providerAccount,
              token: validatedToken
            });
          } else {
            subTokenCacheModel.touchTokenCache(context.subAccount.id);
          }

          return buildSubSessionResult(
            context,
            validatedToken,
            "sub_cache",
            validationResult.result
          );
        }

        subTokenCacheModel.removeTokenCache(context.subAccount.id);
      }

      return loginAndCacheSubToken(context);
    });
  }

  async function getValidTokenForUser(clBaseUserId) {
    const roleContext = resolveRole(clBaseUserId);

    if (roleContext.accountType === "master_owner") {
      const result = await legacySession.getValidTokenForUser(
        roleContext.normalizedUserId
      );

      return {
        ...result,
        accountType: "master_owner"
      };
    }

    return getSubToken(roleContext);
  }

  async function refreshTokenForUser(clBaseUserId) {
    return getValidTokenForUser(clBaseUserId);
  }

  async function getCachedTokenBalanceForUser(clBaseUserId) {
    const roleContext = resolveRole(clBaseUserId);

    if (roleContext.accountType === "master_owner") {
      return legacySession.getCachedTokenBalanceForUser(
        roleContext.normalizedUserId
      );
    }

    const context = resolveSubContext(roleContext);

    return withSubLock(context.subAccount.id, async () => {
      function toBalanceResult(session) {
        return {
          success: true,
          available: true,
          tokenBalance: session.tokenBalance,
          accountTokenBalance: session.accountTokenBalance,
          bonusTokenBalance: session.bonusTokenBalance,
          pointsField: session.pointsField,
          masterAccountId: context.masterAccount.id,
          aigcSubAccountId: context.subAccount.id,
          accountType: "sub_account",
          sessionInitialized:
            session.source === "sub_login"
        };
      }

      async function loginForBalance() {
        const session =
          await loginAndCacheSubToken(context);

        return toBalanceResult(session);
      }

      let cachedToken = null;

      try {
        cachedToken = subTokenCacheModel.getTokenCache(
          context.subAccount.id
        );
      } catch (error) {
        console.warn(
          "AIGC 子账号 Token 缓存读取失败，将重新建立登录状态：",
          error.message
        );

        subTokenCacheModel.removeTokenCache(
          context.subAccount.id
        );

        return loginForBalance();
      }

      /*
       * 普通用户进入“我的 AIGC 账号”页面时，
       * 即使尚未打开 Workspace，也应能直接看到
       * 当前子账号的真实 Token 余额。
       *
       * 因此子账号没有缓存时，使用管理员已加密保存的
       * 外部子账号凭据建立 Session；主账号负责人仍保留
       * 原有只读缓存逻辑，不受此补丁影响。
       */
      if (!cachedToken?.token) {
        return loginForBalance();
      }

      if (
        cachedToken.providerAccount !==
        context.providerConfig.providerAccount
      ) {
        subTokenCacheModel.removeTokenCache(
          context.subAccount.id
        );

        return loginForBalance();
      }

      const validationResult = await yibaiAigcClient.loginByToken(
        cachedToken.token
      );

      if (!isSuccessfulResponse(validationResult)) {
        subTokenCacheModel.removeTokenCache(
          context.subAccount.id
        );

        return loginForBalance();
      }

      const validatedToken = String(
        validationResult.result?.token ||
        cachedToken.token
      ).trim();

      if (validatedToken !== cachedToken.token) {
        subTokenCacheModel.upsertTokenCache({
          subAccountId: context.subAccount.id,
          providerAccount:
            context.providerConfig.providerAccount,
          token: validatedToken
        });
      } else {
        subTokenCacheModel.touchTokenCache(
          context.subAccount.id
        );
      }

      const balanceData = readTokenBalance(
        validationResult.result,
        context.providerConfig
      );

      activeSessionModel.touchSession(
        context.clBaseUserId
      );

      return toBalanceResult({
        ...balanceData,
        source: "sub_cache"
      });
    });
  }

  async function logoutUserAigcSession(clBaseUserId) {
    let roleContext;

    try {
      roleContext = resolveRole(clBaseUserId, {
        allowSessionFallback: true
      });
    } catch (error) {
      return {
        success: true,
        action: "no_session",
        message: "当前用户没有 AIGC 活跃登录记录"
      };
    }

    if (roleContext.accountType === "master_owner") {
      return legacySession.logoutUserAigcSession(
        roleContext.normalizedUserId
      );
    }

    const context = resolveSubContext(roleContext);

    return withSubLock(context.subAccount.id, async () => {
      activeSessionModel.markSessionLoggedOut(context.clBaseUserId);

      const remainingActiveUsers = activeSessionModel
        .listSessions()
        .filter(
          session =>
            session.status === "active" &&
            String(session.aigcSubAccountId) ===
              String(context.subAccount.id)
        );

      if (remainingActiveUsers.length > 0) {
        return {
          success: true,
          action: "token_retained",
          remainingActiveUsers: remainingActiveUsers.length,
          message:
            "仍有其他 Harson-Base 用户使用该 AIGC 子账号，已保留共享 Token"
        };
      }

      let cachedToken = null;

      try {
        cachedToken = subTokenCacheModel.getTokenCache(
          context.subAccount.id
        );
      } catch {
        subTokenCacheModel.removeTokenCache(context.subAccount.id);
        return {
          success: true,
          action: "local_cache_removed",
          message: "AIGC 子账号本地登录缓存已清理"
        };
      }

      if (!cachedToken?.token) {
        return {
          success: true,
          action: "no_token",
          message: "当前 AIGC 子账号没有需要注销的 Token"
        };
      }

      const logoutResult = await yibaiAigcClient.logout(
        cachedToken.token
      );

      if (!isSuccessfulResponse(logoutResult)) {
        return {
          success: false,
          action: "provider_logout_failed",
          message: responseMessage(
            logoutResult,
            "AIGC 子账号注销失败"
          )
        };
      }

      subTokenCacheModel.removeTokenCache(context.subAccount.id);

      return {
        success: true,
        action: "provider_logged_out",
        remainingActiveUsers: 0,
        message: "AIGC 子账号登录状态已注销"
      };
    });
  }

  function normalizeIdentity(value) {
    return String(value || "").trim().toLowerCase();
  }

  function addIdentity(set, value) {
    const normalizedValue = normalizeIdentity(value);

    if (!normalizedValue) {
      return;
    }

    set.add(normalizedValue);

    const atIndex = normalizedValue.indexOf("@");
    if (atIndex > 0) {
      set.add(normalizedValue.slice(0, atIndex));
    }
  }

  function identitiesIntersect(leftValues, rightValues) {
    const leftSet = new Set();
    const rightSet = new Set();

    leftValues.forEach(value => addIdentity(leftSet, value));
    rightValues.forEach(value => addIdentity(rightSet, value));

    return Array.from(leftSet).some(value => rightSet.has(value));
  }

  function summarizeTasks(tasks) {
    const deductedTokens = tasks.reduce(
      (total, task) => total + Math.max(Number(task.point || 0), 0),
      0
    );
    const refundedTokens = tasks.reduce(
      (total, task) =>
        total + Math.max(Number(task.refundedPoint || 0), 0),
      0
    );

    return {
      totalTasks: tasks.length,
      successfulTasks: tasks.filter(task => task.status === "O").length,
      failedTasks: tasks.filter(task => task.status === "R").length,
      processingTasks: tasks.filter(
        task => task.status !== "O" && task.status !== "R"
      ).length,
      deductedTokens,
      refundedTokens,
      netUsedTokens: Math.max(deductedTokens - refundedTokens, 0)
    };
  }

  function latestSyncedAt(tasks) {
    return (
      tasks.reduce(
        (latest, task) =>
          String(task.syncedAt || "") > latest
            ? String(task.syncedAt || "")
            : latest,
        ""
      ) || null
    );
  }

  function resolveBoundSubAccount(masterAccountId, identities) {
    const data = accountModel.listAdminData();
    const activeMappings = (data.mappings || []).filter(
      mapping => mapping.mappingStatus === "active"
    );

    const matchingSubs = (data.subs || []).filter(subAccount => {
      if (
        subAccount.status !== "active" ||
        String(subAccount.masterAccountId) !== String(masterAccountId)
      ) {
        return false;
      }

      const mappedEmails = activeMappings
        .filter(
          mapping =>
            String(mapping.aigcSubAccountId) === String(subAccount.id)
        )
        .map(mapping => mapping.clBaseEmail);

      return identitiesIntersect(identities || [], [
        subAccount.platformLogin,
        subAccount.subAccountName,
        ...mappedEmails
      ]);
    });

    if (matchingSubs.length !== 1) {
      return null;
    }

    const subAccount = matchingSubs[0];
    const binding =
      subProviderConfigModel.getProviderConfigBySubAccountId(
        subAccount.id
      );

    if (!binding?.providerMemberId) {
      return null;
    }

    return {
      subAccount,
      binding
    };
  }

  taskSnapshotModel.listTaskSnapshotByIdentity = function patchedList(
    args
  ) {
    const masterAccountId = String(args?.masterAccountId || "").trim();
    const identities = Array.isArray(args?.identities)
      ? args.identities
      : [];

    if (masterAccountId) {
      const resolved = resolveBoundSubAccount(
        masterAccountId,
        identities
      );

      if (resolved) {
        const companyTasks =
          taskSnapshotModel.listTasksByMasterAccountId(masterAccountId);
        const tasks = taskSnapshotModel.listTasksByMemberId({
          masterAccountId,
          memberId: resolved.binding.providerMemberId
        });

        return {
          status: "resolved",
          memberId: resolved.binding.providerMemberId,
          tasks,
          summary: summarizeTasks(tasks),
          latestSyncedAt:
            latestSyncedAt(tasks) || latestSyncedAt(companyTasks)
        };
      }
    }

    return originalListTaskSnapshotByIdentity(args);
  };

  sessionService.getValidTokenForUser = getValidTokenForUser;
  sessionService.refreshTokenForUser = refreshTokenForUser;
  sessionService.getCachedTokenBalanceForUser =
    getCachedTokenBalanceForUser;
  sessionService.logoutUserAigcSession = logoutUserAigcSession;

  installed = true;
}

module.exports = {
  install
};
