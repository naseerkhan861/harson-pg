"use strict";

const crypto = require("crypto");
const path = require("path");
const { readCsv, writeCsv } = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR || path.join(__dirname, "../../data");

const FILE = path.join(DATA_DIR, "aigc_sub_login_tokens.secure.csv");
const HEADERS = [
  "subAccountId",
  "providerAccount",
  "encryptedToken",
  "iv",
  "authTag",
  "status",
  "lastValidatedAt",
  "createdAt",
  "updatedAt"
];

function now() {
  return new Date().toISOString();
}

function requireText(value, fieldName) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) throw new Error(`${fieldName}不能为空`);
  return normalizedValue;
}

function getEncryptionKey() {
  const keyHex = String(
    process.env.YIBAI_AIGC_TOKEN_ENCRYPTION_KEY || ""
  ).trim();
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error(
      "YIBAI_AIGC_TOKEN_ENCRYPTION_KEY 必须是 64 个十六进制字符"
    );
  }
  return Buffer.from(keyHex, "hex");
}

function readRows() {
  return readCsv(FILE, HEADERS);
}

function writeRows(rows) {
  writeCsv(FILE, rows, HEADERS);
}

function buildAad(subAccountId, providerAccount) {
  return Buffer.from(
    `sub-token:${subAccountId}:${providerAccount}`,
    "utf8"
  );
}

function encryptToken({ subAccountId, providerAccount, token }) {
  const normalizedToken = requireText(token, "外部子账号Token");
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(buildAad(subAccountId, providerAccount));
  const encrypted = Buffer.concat([
    cipher.update(normalizedToken, "utf8"),
    cipher.final()
  ]);
  return {
    encryptedToken: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
}

function decryptToken(row) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(row.iv, "base64")
  );
  decipher.setAAD(buildAad(row.subAccountId, row.providerAccount));
  decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encryptedToken, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function getTokenCache(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const row = readRows().find(
    item =>
      item.subAccountId === normalizedSubAccountId &&
      item.status === "active"
  );
  if (!row) return null;
  try {
    return {
      subAccountId: row.subAccountId,
      providerAccount: row.providerAccount,
      token: decryptToken(row),
      status: row.status,
      lastValidatedAt: row.lastValidatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  } catch {
    throw new Error("外部子账号 Token 缓存无法解密，请检查加密密钥");
  }
}

function upsertTokenCache({ subAccountId, providerAccount, token }) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const normalizedProviderAccount = requireText(
    providerAccount,
    "外部子账号"
  );
  const encryptedFields = encryptToken({
    subAccountId: normalizedSubAccountId,
    providerAccount: normalizedProviderAccount,
    token
  });
  const rows = readRows();
  const index = rows.findIndex(
    item => item.subAccountId === normalizedSubAccountId
  );
  const timestamp = now();
  const record = {
    subAccountId: normalizedSubAccountId,
    providerAccount: normalizedProviderAccount,
    ...encryptedFields,
    status: "active",
    lastValidatedAt: timestamp,
    createdAt: index >= 0 ? rows[index].createdAt || timestamp : timestamp,
    updatedAt: timestamp
  };
  if (index >= 0) rows[index] = record;
  else rows.push(record);
  writeRows(rows);
  return {
    subAccountId: record.subAccountId,
    providerAccount: record.providerAccount,
    status: record.status,
    lastValidatedAt: record.lastValidatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function touchTokenCache(subAccountId) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const rows = readRows();
  const index = rows.findIndex(
    item =>
      item.subAccountId === normalizedSubAccountId &&
      item.status === "active"
  );
  if (index < 0) return false;
  const timestamp = now();
  rows[index].lastValidatedAt = timestamp;
  rows[index].updatedAt = timestamp;
  writeRows(rows);
  return true;
}

function removeTokenCache(subAccountId) {
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
  getTokenCache,
  upsertTokenCache,
  touchTokenCache,
  removeTokenCache
};
