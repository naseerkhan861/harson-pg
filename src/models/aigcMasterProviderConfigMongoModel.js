"use strict";
const Model = require("./aigcMasterProviderAccount");
const {
  requireText, dateText, safeDate, dateFieldsToStrings,
  validNonnegativeNumber, nonemptyCredential, CREDENTIAL_FIELDS, CONFIG_DATES
} = require("./aigcMongoCompatUtils");
const ALLOWED = new Set(["balance", "companyBalance", "mpoint", "companyMpoint"]);
const now = () => new Date();
function pointsField(value) {
  const result = String(value || "balance").trim();
  if (!ALLOWED.has(result)) throw new Error("YiBai点数字段只能是 balance、companyBalance、mpoint 或 companyMpoint");
  return result;
}
function credits(value) {
  return validNonnegativeNumber(value, "YiBai同步点数必须是非负数字");
}
function normalizeCredential(args) {
  const record = Object.fromEntries(CREDENTIAL_FIELDS.map(key => [key, String(args[key] || "").trim()]));
  const count = Object.values(record).filter(Boolean).length;
  if (!count) return null;
  if (count !== 4) throw new Error("YiBai加密密码数据不完整");
  if (record.encryptionVersion !== "v1") throw new Error("不支持的 YiBai 密码加密版本");
  return record;
}
function publicRecord(record) {
  if (!record) return null;
  const r = dateFieldsToStrings(record, CONFIG_DATES);
  return {
    masterAccountId: r.masterAccountId,
    providerAccount: r.providerAccount,
    pointsField: r.pointsField || "balance",
    syncedTotalCredits: credits(r.syncedTotalCredits),
    providerCompanyId: r.providerCompanyId || "",
    providerCompanyName: r.providerCompanyName || "",
    providerMemberId: r.providerMemberId || "",
    providerMemberName: r.providerMemberName || "",
    status: r.status,
    lastSyncedAt: r.lastSyncedAt || "",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    credentialConfigured: nonemptyCredential(r)
  };
}
async function listMasterProviderConfigs() {
  const rows = await Model.find({ status: "active" }).lean();
  return rows.map(publicRecord);
}
async function getProviderConfigByMasterAccountId(masterAccountId) {
  const id = requireText(masterAccountId, "AIGC企业主账号ID");
  const row = await Model.findOne({ masterAccountId: id, status: "active" }).lean();
  return dateFieldsToStrings(row, CONFIG_DATES);
}
async function upsertMasterProviderConfig(args) {
  const masterAccountId = requireText(args.masterAccountId, "AIGC企业主账号ID");
  const providerAccount = requireText(args.providerAccount, "YiBai外部账号");
  const normalizedPointsField = pointsField(args.pointsField);
  const supplied = normalizeCredential(args);
  const duplicate = await Model.findOne({
    providerAccount, status: "active", masterAccountId: { $ne: masterAccountId }
  }).lean();
  if (duplicate) throw new Error("该 YiBai 外部账号已经绑定到其他 AIGC 企业主账号");
  const existing = await Model.findOne({ masterAccountId }).lean();
  const providerChanged = Boolean(existing && existing.providerAccount !== providerAccount);
  if (!existing && !supplied) throw new Error("新建 YiBai 绑定必须提供登录密码");
  if (providerChanged && !supplied) throw new Error("更换 YiBai 外部账号时必须提供该账号的新密码");
  if (!supplied && !nonemptyCredential(existing)) throw new Error("现有绑定没有可用的加密密码，请重新填写 YiBai 密码");
  const credential = supplied || Object.fromEntries(CREDENTIAL_FIELDS.map(k => [k, existing[k]]));
  const timestamp = now();
  const record = {
    masterAccountId, providerAccount, ...credential, pointsField: normalizedPointsField,
    syncedTotalCredits: providerChanged ? 0 : credits(existing?.syncedTotalCredits),
    providerCompanyId: providerChanged ? "" : existing?.providerCompanyId || "",
    providerCompanyName: providerChanged ? "" : existing?.providerCompanyName || "",
    providerMemberId: providerChanged ? "" : existing?.providerMemberId || "",
    providerMemberName: providerChanged ? "" : existing?.providerMemberName || "",
    status: "active", lastSyncedAt: providerChanged ? null : existing?.lastSyncedAt || null,
    createdAt: existing?.createdAt || timestamp, updatedAt: timestamp
  };
  await Model.updateOne({ masterAccountId }, { $set: record }, { upsert: true, runValidators: true });
  return publicRecord(record);
}
async function updateProviderSyncSnapshot(args) {
  const id = requireText(args.masterAccountId, "AIGC企业主账号ID");
  const timestamp = now();
  const update = {
    syncedTotalCredits: credits(args.syncedTotalCredits),
    providerCompanyId: String(args.providerCompanyId || "").trim(),
    providerCompanyName: String(args.providerCompanyName || "").trim(),
    providerMemberId: String(args.providerMemberId || "").trim(),
    providerMemberName: String(args.providerMemberName || "").trim(),
    lastSyncedAt: timestamp, updatedAt: timestamp
  };
  const result = await Model.updateOne({ masterAccountId: id, status: "active" }, { $set: update }, { runValidators: true });
  if (result.matchedCount !== 1) throw new Error("未找到有效的 YiBai 主账号绑定");
  return publicRecord(await Model.findOne({ masterAccountId: id }).lean());
}
async function disableMasterProviderConfig(masterAccountId) {
  const id = requireText(masterAccountId, "AIGC企业主账号ID");
  const result = await Model.updateOne({ masterAccountId: id, status: "active" }, { $set: { status: "disabled", updatedAt: now() } });
  return result.matchedCount === 1;
}
async function removeMasterProviderConfig(masterAccountId) {
  const id = requireText(masterAccountId, "AIGC企业主账号ID");
  const result = await Model.deleteOne({ masterAccountId: id });
  return result.deletedCount > 0;
}
module.exports = {
  listMasterProviderConfigs, getProviderConfigByMasterAccountId,
  upsertMasterProviderConfig, updateProviderSyncSnapshot,
  disableMasterProviderConfig, removeMasterProviderConfig
};
