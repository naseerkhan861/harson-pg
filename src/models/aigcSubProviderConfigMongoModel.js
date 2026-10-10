"use strict";
const Model = require("./aigcSubProviderAccount");
const {
  requireText, dateFieldsToStrings, validNonnegativeNumber,
  nonemptyCredential, CREDENTIAL_FIELDS, CONFIG_DATES
} = require("./aigcMongoCompatUtils");
const ALLOWED = new Set(["balance", "companyBalance", "mpoint", "companyMpoint"]);
const now = () => new Date();
function pointsField(value) {
  const x = String(value || "balance").trim();
  if (!ALLOWED.has(x)) throw new Error("外部子账号点数字段只能是 balance、companyBalance、mpoint 或 companyMpoint");
  return x;
}
function balance(value) {
  return validNonnegativeNumber(value, "外部子账号同步点数必须是非负数字");
}
function publicRecord(record) {
  if (!record) return null;
  const r = dateFieldsToStrings(record, CONFIG_DATES);
  return {
    subAccountId: r.subAccountId, masterAccountId: r.masterAccountId,
    providerAccount: r.providerAccount, pointsField: r.pointsField || "balance",
    syncedTokenBalance: balance(r.syncedTokenBalance),
    providerMemberId: r.providerMemberId || "", providerMemberName: r.providerMemberName || "",
    providerCompanyId: r.providerCompanyId || "", providerCompanyName: r.providerCompanyName || "",
    status: r.status, lastSyncedAt: r.lastSyncedAt || "",
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    credentialConfigured: nonemptyCredential(r)
  };
}
async function listSubProviderConfigs() {
  return (await Model.find({ status: "active" }).lean()).map(publicRecord);
}
async function getProviderConfigBySubAccountId(subAccountId) {
  const id = requireText(subAccountId, "AIGC子账号ID");
  return dateFieldsToStrings(await Model.findOne({ subAccountId: id, status: "active" }).lean(), CONFIG_DATES);
}
async function upsertSubProviderConfig(args) {
  const subAccountId = requireText(args.subAccountId, "AIGC子账号ID");
  const masterAccountId = requireText(args.masterAccountId, "AIGC企业主账号ID");
  const providerAccount = requireText(args.providerAccount, "外部子账号");
  const normalizedPointsField = pointsField(args.pointsField);
  const supplied = Object.fromEntries(CREDENTIAL_FIELDS.map(k => [k, String(args[k] || "").trim()]));
  const suppliedCount = Object.values(supplied).filter(Boolean).length;
  const rows = await Model.find({ status: "active" }).lean();
  if (rows.some(r => r.subAccountId !== subAccountId && String(r.providerAccount).toLowerCase() === providerAccount.toLowerCase())) {
    throw new Error("该外部子账号已经绑定到其他 AIGC 子账号");
  }
  const existing = await Model.findOne({ subAccountId }).lean();
  const providerChanged = Boolean(existing && String(existing.providerAccount).toLowerCase() !== providerAccount.toLowerCase());
  let credential;
  if (suppliedCount === 4) credential = supplied;
  else if (suppliedCount > 0) throw new Error("外部子账号加密密码数据不完整");
  else if (existing && !providerChanged && nonemptyCredential(existing)) {
    credential = Object.fromEntries(CREDENTIAL_FIELDS.map(k => [k, existing[k]]));
  } else throw new Error("新建或更换外部子账号时必须提供登录密码");
  const timestamp = now();
  const record = {
    subAccountId, masterAccountId, providerAccount, ...credential, pointsField: normalizedPointsField,
    syncedTokenBalance: providerChanged ? 0 : balance(existing?.syncedTokenBalance),
    providerMemberId: providerChanged ? "" : existing?.providerMemberId || "",
    providerMemberName: providerChanged ? "" : existing?.providerMemberName || "",
    providerCompanyId: providerChanged ? "" : existing?.providerCompanyId || "",
    providerCompanyName: providerChanged ? "" : existing?.providerCompanyName || "",
    status: "active", lastSyncedAt: providerChanged ? null : existing?.lastSyncedAt || null,
    createdAt: existing?.createdAt || timestamp, updatedAt: timestamp
  };
  await Model.updateOne({ subAccountId }, { $set: record }, { upsert: true, runValidators: true });
  return publicRecord(record);
}
async function updateProviderSyncSnapshot(args) {
  const id = requireText(args.subAccountId, "AIGC子账号ID");
  const timestamp = now();
  const update = {
    syncedTokenBalance: balance(args.syncedTokenBalance),
    providerMemberId: String(args.providerMemberId || "").trim(),
    providerMemberName: String(args.providerMemberName || "").trim(),
    providerCompanyId: String(args.providerCompanyId || "").trim(),
    providerCompanyName: String(args.providerCompanyName || "").trim(),
    lastSyncedAt: timestamp, updatedAt: timestamp
  };
  const result = await Model.updateOne({ subAccountId: id, status: "active" }, { $set: update }, { runValidators: true });
  if (result.matchedCount !== 1) throw new Error("未找到有效的外部子账号绑定");
  return publicRecord(await Model.findOne({ subAccountId: id }).lean());
}
async function removeSubProviderConfig(subAccountId) {
  const id = requireText(subAccountId, "AIGC子账号ID");
  const result = await Model.deleteOne({ subAccountId: id });
  return result.deletedCount > 0;
}
module.exports = {
  listSubProviderConfigs, getProviderConfigBySubAccountId,
  upsertSubProviderConfig, updateProviderSyncSnapshot, removeSubProviderConfig
};
