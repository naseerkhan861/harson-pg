"use strict";

const path = require("path");
const { readCsv, writeCsv } = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR || path.join(__dirname, "../../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_sub_provider_accounts.secure.csv"
);

const HEADERS = [
  "subAccountId",
  "masterAccountId",
  "providerAccount",
  "encryptionVersion",
  "encryptedPassword",
  "passwordIv",
  "passwordAuthTag",
  "pointsField",
  "syncedTokenBalance",
  "providerMemberId",
  "providerMemberName",
  "providerCompanyId",
  "providerCompanyName",
  "status",
  "lastSyncedAt",
  "createdAt",
  "updatedAt"
];

const ALLOWED_POINTS_FIELDS = new Set([
  "balance",
  "companyBalance",
  "mpoint",
  "companyMpoint"
]);

function now() {
  return new Date().toISOString();
}

function requireText(value, fieldName) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    throw new Error(`${fieldName}不能为空`);
  }
  return normalizedValue;
}

function normalizePointsField(value) {
  const normalizedValue = String(value || "balance").trim();
  if (!ALLOWED_POINTS_FIELDS.has(normalizedValue)) {
    throw new Error(
      "外部子账号点数字段只能是 balance、companyBalance、mpoint 或 companyMpoint"
    );
  }
  return normalizedValue;
}

function normalizeBalance(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("外部子账号同步点数必须是非负数字");
  }
  return numericValue;
}

function readRows() {
  return readCsv(FILE, HEADERS);
}

function writeRows(rows) {
  writeCsv(FILE, rows, HEADERS);
}

function hasCompleteCredential(record) {
  return Boolean(
    record &&
      record.encryptionVersion &&
      record.encryptedPassword &&
      record.passwordIv &&
      record.passwordAuthTag
  );
}

function toSafeRecord(record) {
  if (!record) return null;
  return {
    subAccountId: record.subAccountId,
    masterAccountId: record.masterAccountId,
    providerAccount: record.providerAccount,
    pointsField: record.pointsField || "balance",
    syncedTokenBalance: normalizeBalance(record.syncedTokenBalance),
    providerMemberId: record.providerMemberId || "",
    providerMemberName: record.providerMemberName || "",
    providerCompanyId: record.providerCompanyId || "",
    providerCompanyName: record.providerCompanyName || "",
    status: record.status,
    lastSyncedAt: record.lastSyncedAt || "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    credentialConfigured: hasCompleteCredential(record)
  };
}

function listSubProviderConfigs() {
  return readRows()
    .filter(item => item.status === "active")
    .map(toSafeRecord);
}

function getProviderConfigBySubAccountId(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  return (
    readRows().find(
      item =>
        item.subAccountId === normalizedSubAccountId &&
        item.status === "active"
    ) || null
  );
}

function upsertSubProviderConfig({
  subAccountId,
  masterAccountId,
  providerAccount,
  encryptionVersion,
  encryptedPassword,
  passwordIv,
  passwordAuthTag,
  pointsField
}) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const normalizedMasterAccountId = requireText(
    masterAccountId,
    "AIGC企业主账号ID"
  );
  const normalizedProviderAccount = requireText(
    providerAccount,
    "外部子账号"
  );
  const normalizedPointsField = normalizePointsField(pointsField);

  const rows = readRows();
  const duplicate = rows.find(
    item =>
      item.providerAccount.toLowerCase() ===
        normalizedProviderAccount.toLowerCase() &&
      item.subAccountId !== normalizedSubAccountId &&
      item.status === "active"
  );

  if (duplicate) {
    throw new Error("该外部子账号已经绑定到其他 AIGC 子账号");
  }

  const index = rows.findIndex(
    item => item.subAccountId === normalizedSubAccountId
  );
  const existing = index >= 0 ? rows[index] : null;
  const providerChanged = Boolean(
    existing &&
      existing.providerAccount.toLowerCase() !==
        normalizedProviderAccount.toLowerCase()
  );

  const suppliedCredential = {
    encryptionVersion: String(encryptionVersion || "").trim(),
    encryptedPassword: String(encryptedPassword || "").trim(),
    passwordIv: String(passwordIv || "").trim(),
    passwordAuthTag: String(passwordAuthTag || "").trim()
  };
  const suppliedCount = Object.values(suppliedCredential).filter(Boolean).length;

  let credentialToSave = null;
  if (suppliedCount === 4) {
    credentialToSave = suppliedCredential;
  } else if (suppliedCount !== 0) {
    throw new Error("外部子账号加密密码数据不完整");
  } else if (existing && !providerChanged && hasCompleteCredential(existing)) {
    credentialToSave = {
      encryptionVersion: existing.encryptionVersion,
      encryptedPassword: existing.encryptedPassword,
      passwordIv: existing.passwordIv,
      passwordAuthTag: existing.passwordAuthTag
    };
  } else {
    throw new Error("新建或更换外部子账号时必须提供登录密码");
  }

  const timestamp = now();
  const record = {
    ...(existing || {}),
    subAccountId: normalizedSubAccountId,
    masterAccountId: normalizedMasterAccountId,
    providerAccount: normalizedProviderAccount,
    ...credentialToSave,
    pointsField: normalizedPointsField,
    syncedTokenBalance: providerChanged
      ? "0"
      : String(normalizeBalance(existing?.syncedTokenBalance || 0)),
    providerMemberId: providerChanged ? "" : existing?.providerMemberId || "",
    providerMemberName: providerChanged
      ? ""
      : existing?.providerMemberName || "",
    providerCompanyId: providerChanged ? "" : existing?.providerCompanyId || "",
    providerCompanyName: providerChanged
      ? ""
      : existing?.providerCompanyName || "",
    status: "active",
    lastSyncedAt: providerChanged ? "" : existing?.lastSyncedAt || "",
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };

  if (index >= 0) {
    rows[index] = record;
  } else {
    rows.push(record);
  }
  writeRows(rows);
  return toSafeRecord(record);
}

function updateProviderSyncSnapshot({
  subAccountId,
  syncedTokenBalance,
  providerMemberId,
  providerMemberName,
  providerCompanyId,
  providerCompanyName
}) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const rows = readRows();
  const index = rows.findIndex(
    item =>
      item.subAccountId === normalizedSubAccountId &&
      item.status === "active"
  );

  if (index < 0) {
    throw new Error("未找到有效的外部子账号绑定");
  }

  const timestamp = now();
  rows[index] = {
    ...rows[index],
    syncedTokenBalance: String(normalizeBalance(syncedTokenBalance)),
    providerMemberId: String(providerMemberId || "").trim(),
    providerMemberName: String(providerMemberName || "").trim(),
    providerCompanyId: String(providerCompanyId || "").trim(),
    providerCompanyName: String(providerCompanyName || "").trim(),
    lastSyncedAt: timestamp,
    updatedAt: timestamp
  };
  writeRows(rows);
  return toSafeRecord(rows[index]);
}

function removeSubProviderConfig(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const rows = readRows();
  const remainingRows = rows.filter(
    item => item.subAccountId !== normalizedSubAccountId
  );
  if (remainingRows.length === rows.length) return false;
  writeRows(remainingRows);
  return true;
}

module.exports = {
  listSubProviderConfigs,
  getProviderConfigBySubAccountId,
  upsertSubProviderConfig,
  updateProviderSyncSnapshot,
  removeSubProviderConfig
};
