"use strict";

const aigcAccountModel = require("../models/aigcAccountCsvModel");
const masterProviderConfigModel = require(
  "../models/aigcMasterProviderConfigCsvModel"
);
const subProviderConfigModel = require(
  "../models/aigcSubProviderConfigCsvModel"
);
const subTokenCacheModel = require(
  "../models/aigcSubTokenCacheCsvModel"
);
const credentialCrypto = require(
  "../utils/aigcSubCredentialCrypto"
);
const yibaiAigcClient = require("./yibaiAigcClient");

const locks = new Map();
const ALLOWED_POINTS_FIELDS = new Set([
  "balance",
  "companyBalance",
  "mpoint",
  "companyMpoint"
]);

function requireText(value, fieldName) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) throw new Error(`${fieldName}不能为空`);
  return normalizedValue;
}

function normalizePointsField(value) {
  const normalizedValue = String(value || "balance").trim();
  if (!ALLOWED_POINTS_FIELDS.has(normalizedValue)) {
    throw new Error(
      "点数字段只能是 balance、companyBalance、mpoint 或 companyMpoint"
    );
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

function getResponseMessage(response, fallbackMessage) {
  return String(response?.message || fallbackMessage);
}

function withLock(subAccountId, task) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const previous = locks.get(normalizedSubAccountId) || Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (locks.get(normalizedSubAccountId) === current) {
        locks.delete(normalizedSubAccountId);
      }
    });
  locks.set(normalizedSubAccountId, current);
  return current;
}

function getSubContext(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const data = aigcAccountModel.listAdminData();
  const subAccount = data.subs.find(
    item =>
      item.id === normalizedSubAccountId &&
      item.status === "active"
  );
  if (!subAccount) {
    throw new Error("未找到可用的 AIGC 子账号");
  }
  const masterAccount = data.masters.find(
    item =>
      item.id === subAccount.masterAccountId &&
      item.status === "active"
  );
  if (!masterAccount) {
    throw new Error("AIGC 子账号所属主账号不存在或已停用");
  }
  const masterProvider =
    masterProviderConfigModel.getProviderConfigByMasterAccountId(
      masterAccount.id
    );
  if (!masterProvider) {
    throw new Error("请先为所属 AIGC 主账号绑定外部主账号");
  }
  return {
    subAccount,
    masterAccount,
    masterProvider
  };
}

function extractProviderSession(loginResponse, pointsField) {
  const result = loginResponse?.result || {};
  const requestedPointsField = normalizePointsField(pointsField);
  const candidateFields = Array.from(
    new Set([
      requestedPointsField,
      "balance",
      "mpoint",
      "companyBalance",
      "companyMpoint"
    ])
  );

  const matchedField = candidateFields.find(field => {
    const value = result[field];
    if (value === undefined || value === null || value === "") {
      return false;
    }
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0;
  });

  if (!matchedField) {
    throw new Error("外部账号响应中没有可用的点数字段");
  }

  const syncedTokenBalance = Number(result[matchedField]);
  const token = requireText(result.token, "外部账号登录Token");
  return {
    token,
    pointsField: matchedField,
    syncedTokenBalance,
    providerMemberId: String(result.memberId || result.id || "").trim(),
    providerMemberName: String(result.memberName || "").trim(),
    providerCompanyId: String(result.companyId || "").trim(),
    providerCompanyName: String(result.companyName || "").trim()
  };
}

function validateCompanyRelationship(masterProvider, subSession) {
  const masterCompanyId = String(
    masterProvider?.providerCompanyId || ""
  ).trim();
  const subCompanyId = String(subSession?.providerCompanyId || "").trim();
  if (masterCompanyId && subCompanyId && masterCompanyId !== subCompanyId) {
    throw new Error("该外部子账号不属于当前主账号对应的企业");
  }
}

function validateProviderUniqueness({
  providerAccount,
  subAccountId,
  masterProvider
}) {
  const normalizedProviderAccount = requireText(
    providerAccount,
    "外部子账号"
  ).toLowerCase();
  if (
    String(masterProvider?.providerAccount || "").trim().toLowerCase() ===
    normalizedProviderAccount
  ) {
    throw new Error("外部子账号不能与所属外部主账号使用同一个登录账号");
  }
  const duplicate = subProviderConfigModel
    .listSubProviderConfigs()
    .find(
      item =>
        item.subAccountId !== subAccountId &&
        String(item.providerAccount || "").trim().toLowerCase() ===
          normalizedProviderAccount
    );
  if (duplicate) {
    throw new Error("该外部子账号已经绑定到其他 AIGC 子账号");
  }
}

function listSubProviderBindings() {
  const data = aigcAccountModel.listAdminData();
  return subProviderConfigModel.listSubProviderConfigs().map(binding => {
    const subAccount = data.subs.find(
      item => item.id === binding.subAccountId
    );
    const masterAccount = data.masters.find(
      item => item.id === binding.masterAccountId
    );
    return {
      ...binding,
      subAccountName: subAccount?.subAccountName || "",
      enterpriseName: masterAccount?.enterpriseName || "",
      masterAccountName: masterAccount?.platformName || ""
    };
  });
}

async function bindSubProviderAndSync({
  subAccountId,
  providerAccount,
  providerPassword,
  pointsField
}) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const normalizedProviderAccount = requireText(
    providerAccount,
    "外部子账号"
  );
  const normalizedPassword = requireText(
    providerPassword,
    "外部子账号登录密码"
  );
  const normalizedPointsField = normalizePointsField(pointsField);

  return withLock(normalizedSubAccountId, async () => {
    const context = getSubContext(normalizedSubAccountId);
    validateProviderUniqueness({
      providerAccount: normalizedProviderAccount,
      subAccountId: normalizedSubAccountId,
      masterProvider: context.masterProvider
    });

    const loginResponse = await yibaiAigcClient.login(
      normalizedProviderAccount,
      normalizedPassword
    );
    if (!isSuccessfulResponse(loginResponse)) {
      throw new Error(
        getResponseMessage(loginResponse, "外部子账号或密码验证失败")
      );
    }

    const providerSession = extractProviderSession(
      loginResponse,
      normalizedPointsField
    );
    validateCompanyRelationship(context.masterProvider, providerSession);

    const encryptedCredential = credentialCrypto.encryptProviderPassword({
      subAccountId: normalizedSubAccountId,
      providerAccount: normalizedProviderAccount,
      password: normalizedPassword
    });

    subProviderConfigModel.upsertSubProviderConfig({
      subAccountId: normalizedSubAccountId,
      masterAccountId: context.masterAccount.id,
      providerAccount: normalizedProviderAccount,
      pointsField: providerSession.pointsField,
      ...encryptedCredential
    });

    subTokenCacheModel.upsertTokenCache({
      subAccountId: normalizedSubAccountId,
      providerAccount: normalizedProviderAccount,
      token: providerSession.token
    });

    const binding = subProviderConfigModel.updateProviderSyncSnapshot({
      subAccountId: normalizedSubAccountId,
      syncedTokenBalance: providerSession.syncedTokenBalance,
      providerMemberId: providerSession.providerMemberId,
      providerMemberName: providerSession.providerMemberName,
      providerCompanyId: providerSession.providerCompanyId,
      providerCompanyName: providerSession.providerCompanyName
    });

    return {
      binding,
      tokenReceived: true
    };
  });
}

async function syncBoundSubProvider(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  return withLock(normalizedSubAccountId, async () => {
    const context = getSubContext(normalizedSubAccountId);
    const providerConfig =
      subProviderConfigModel.getProviderConfigBySubAccountId(
        normalizedSubAccountId
      );
    if (!providerConfig) {
      throw new Error("当前 AIGC 子账号尚未绑定外部子账号");
    }
    validateProviderUniqueness({
      providerAccount: providerConfig.providerAccount,
      subAccountId: normalizedSubAccountId,
      masterProvider: context.masterProvider
    });

    const providerPassword = credentialCrypto.decryptProviderPassword({
      subAccountId: normalizedSubAccountId,
      providerAccount: providerConfig.providerAccount,
      encryptionVersion: providerConfig.encryptionVersion,
      encryptedPassword: providerConfig.encryptedPassword,
      passwordIv: providerConfig.passwordIv,
      passwordAuthTag: providerConfig.passwordAuthTag
    });

    const loginResponse = await yibaiAigcClient.login(
      providerConfig.providerAccount,
      providerPassword
    );
    if (!isSuccessfulResponse(loginResponse)) {
      throw new Error(
        getResponseMessage(loginResponse, "外部子账号重新登录失败")
      );
    }

    const providerSession = extractProviderSession(
      loginResponse,
      providerConfig.pointsField
    );
    validateCompanyRelationship(context.masterProvider, providerSession);

    subTokenCacheModel.upsertTokenCache({
      subAccountId: normalizedSubAccountId,
      providerAccount: providerConfig.providerAccount,
      token: providerSession.token
    });

    const binding = subProviderConfigModel.updateProviderSyncSnapshot({
      subAccountId: normalizedSubAccountId,
      syncedTokenBalance: providerSession.syncedTokenBalance,
      providerMemberId: providerSession.providerMemberId,
      providerMemberName: providerSession.providerMemberName,
      providerCompanyId: providerSession.providerCompanyId,
      providerCompanyName: providerSession.providerCompanyName
    });

    return {
      binding,
      tokenReceived: true
    };
  });
}

async function unbindSubProvider(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  return withLock(normalizedSubAccountId, async () => {
    let providerLogout = "not_required";
    try {
      const cachedToken = subTokenCacheModel.getTokenCache(
        normalizedSubAccountId
      );
      if (cachedToken?.token) {
        const logoutResponse = await yibaiAigcClient.logout(cachedToken.token);
        providerLogout = isSuccessfulResponse(logoutResponse)
          ? "success"
          : "failed";
      }
    } catch {
      providerLogout = "failed";
    }

    subTokenCacheModel.removeTokenCache(normalizedSubAccountId);
    const removed = subProviderConfigModel.removeSubProviderConfig(
      normalizedSubAccountId
    );

    return {
      subAccountId: normalizedSubAccountId,
      removed,
      providerLogout,
      internalSubAccountRetained: true,
      harsonUserMappingRetained: true
    };
  });
}

module.exports = {
  listSubProviderBindings,
  bindSubProviderAndSync,
  syncBoundSubProvider,
  unbindSubProvider
};
