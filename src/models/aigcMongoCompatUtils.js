"use strict";

function requireText(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${fieldName}不能为空`);
  return text;
}
function dateText(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function safeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateFieldsToStrings(row, dateFields) {
  if (!row) return null;
  const copy = { ...row };
  delete copy._id;
  delete copy.__v;
  for (const field of dateFields) copy[field] = dateText(copy[field]);
  return copy;
}
function validNonnegativeNumber(value, message) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num < 0) throw new Error(message);
  return num;
}
function nonemptyCredential(record) {
  return Boolean(record && [
    "encryptionVersion", "encryptedPassword", "passwordIv", "passwordAuthTag"
  ].every(field => String(record[field] || "").trim()));
}
const CREDENTIAL_FIELDS = [
  "encryptionVersion", "encryptedPassword", "passwordIv", "passwordAuthTag"
];
const TOKEN_DATES = ["lastValidatedAt", "createdAt", "updatedAt"];
const CONFIG_DATES = ["lastSyncedAt", "createdAt", "updatedAt"];
const SESSION_DATES = ["loggedInAt", "lastActiveAt", "loggedOutAt"];
module.exports = {
  requireText, dateText, safeDate, dateFieldsToStrings,
  validNonnegativeNumber, nonemptyCredential, CREDENTIAL_FIELDS,
  TOKEN_DATES, CONFIG_DATES, SESSION_DATES
};
