"use strict";
const Model = require("./aigcActiveSession");
const { requireText, dateFieldsToStrings, SESSION_DATES } = require("./aigcMongoCompatUtils");
const now = () => new Date();
const safe = r => dateFieldsToStrings(r, SESSION_DATES);
async function markSessionActive({ clBaseUserId, aigcSubAccountId, masterAccountId }) {
  const userId = requireText(clBaseUserId, "Harson-Base 用户 ID");
  const subId = requireText(aigcSubAccountId, "AIGC 子账号 ID");
  const masterId = requireText(masterAccountId, "企业主账号 ID");
  const timestamp = now();
  const previous = await Model.findOne({ clBaseUserId: userId }).lean();
  // Match CSV: preserve nonempty first-login time, initialize legacy empty time.
  await Model.updateOne({ clBaseUserId: userId }, {
    $set: { aigcSubAccountId: subId, masterAccountId: masterId,
      status: "active", lastActiveAt: timestamp, loggedOutAt: null,
      loggedInAt: previous?.loggedInAt || timestamp }
  }, { upsert: true, runValidators: true });
  return safe(await Model.findOne({ clBaseUserId: userId }).lean());
}
async function touchSession(clBaseUserId) {
  const userId = requireText(clBaseUserId, "Harson-Base 用户 ID");
  const result = await Model.updateOne({ clBaseUserId: userId, status: "active" }, { $set: { lastActiveAt: now() } });
  if (result.matchedCount !== 1) return null;
  return safe(await Model.findOne({ clBaseUserId: userId }).lean());
}
async function markSessionLoggedOut(clBaseUserId) {
  const userId = requireText(clBaseUserId, "Harson-Base 用户 ID");
  const row = await Model.findOne({ clBaseUserId: userId }).lean();
  if (!row) return null;
  await Model.updateOne({ clBaseUserId: userId }, {
    $set: { status: "logged_out", loggedOutAt: now(), lastActiveAt: row.lastActiveAt || now() }
  });
  return safe(await Model.findOne({ clBaseUserId: userId }).lean());
}
async function listActiveSessionsByMasterAccountId(masterAccountId) {
  const id = requireText(masterAccountId, "企业主账号 ID");
  return (await Model.find({ masterAccountId: id, status: "active" }).lean()).map(safe);
}
async function getSessionByUserId(clBaseUserId) {
  const id = requireText(clBaseUserId, "Harson-Base 用户 ID");
  return safe(await Model.findOne({ clBaseUserId: id }).lean());
}
async function removeSessionsByMasterAccountId(masterAccountId) {
  const id = requireText(masterAccountId, "企业主账号 ID");
  const result = await Model.deleteMany({ masterAccountId: id });
  return result.deletedCount;
}
async function listSessions() {
  return (await Model.find({}).lean()).map(safe);
}
module.exports = {
  markSessionActive, touchSession, markSessionLoggedOut,
  listActiveSessionsByMasterAccountId, getSessionByUserId,
  removeSessionsByMasterAccountId, listSessions
};
