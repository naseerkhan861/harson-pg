"use strict";

const crypto = require("crypto");
const path = require("path");

const {
  readCsv,
  writeCsv
} = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../../data");

const TOKEN_CACHE_FILE = path.join(
  DATA_DIR,
  "aigc_master_login_tokens.secure.csv"
);

const TOKEN_CACHE_HEADERS = [
  "masterAccountId",
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
  const normalizedValue =
    String(value || "").trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

function readTokenRows() {
  return readCsv(
    TOKEN_CACHE_FILE,
    TOKEN_CACHE_HEADERS
  );
}

function writeTokenRows(rows) {
  writeCsv(
    TOKEN_CACHE_FILE,
    rows,
    TOKEN_CACHE_HEADERS
  );
}

/**
 * 读取 AES-256-GCM 加密密钥。
 *
 * 必须为 64 个十六进制字符，
 * 即 32 字节。
 */
function getEncryptionKey() {
  const keyHex = String(
    process.env
      .YIBAI_AIGC_TOKEN_ENCRYPTION_KEY ||
      ""
  ).trim();

  if (
    !/^[a-fA-F0-9]{64}$/.test(
      keyHex
    )
  ) {
    throw new Error(
      "YIBAI_AIGC_TOKEN_ENCRYPTION_KEY 必须是 64 个十六进制字符"
    );
  }

  return Buffer.from(
    keyHex,
    "hex"
  );
}

/**
 * 加密 YiBai token。
 *
 * 原始 token 不会写入 CSV。
 */
function encryptToken(token) {
  const normalizedToken =
    requireText(
      token,
      "YiBai token"
    );

  const key =
    getEncryptionKey();

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        normalizedToken,
        "utf8"
      ),
      cipher.final()
    ]);

  const authTag =
    cipher.getAuthTag();

  return {
    encryptedToken:
      encrypted.toString("base64"),

    iv:
      iv.toString("base64"),

    authTag:
      authTag.toString("base64")
  };
}

/**
 * 解密 YiBai token。
 */
function decryptToken(row) {
  const key =
    getEncryptionKey();

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(
        row.iv,
        "base64"
      )
    );

  decipher.setAuthTag(
    Buffer.from(
      row.authTag,
      "base64"
    )
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          row.encryptedToken,
          "base64"
        )
      ),
      decipher.final()
    ]);

  return decrypted.toString("utf8");
}

/**
 * 查询某个内部企业主账号对应的
 * 有效 YiBai token。
 */
function getTokenCache(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const row =
    readTokenRows().find(
      item =>
        item.masterAccountId ===
          normalizedMasterAccountId &&
        item.status === "active"
    );

  if (!row) {
    return null;
  }

  try {
    return {
      masterAccountId:
        row.masterAccountId,

      providerAccount:
        row.providerAccount,

      token:
        decryptToken(row),

      status:
        row.status,

      lastValidatedAt:
        row.lastValidatedAt,

      createdAt:
        row.createdAt,

      updatedAt:
        row.updatedAt
    };
  } catch (error) {
    throw new Error(
      "YiBai token 缓存无法解密，请检查加密密钥是否发生变化"
    );
  }
}

/**
 * 新增或更新企业主账号级 token。
 *
 * 一个内部企业主账号只保留一条
 * 当前有效的 YiBai token。
 */
function upsertTokenCache({
  masterAccountId,
  providerAccount,
  token
}) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const normalizedProviderAccount =
    requireText(
      providerAccount,
      "YiBai外部账号"
    );

  const encryptedFields =
    encryptToken(token);

  const rows =
    readTokenRows();

  const existingIndex =
    rows.findIndex(
      item =>
        item.masterAccountId ===
        normalizedMasterAccountId
    );

  const timestamp = now();

  const record = {
    masterAccountId:
      normalizedMasterAccountId,

    providerAccount:
      normalizedProviderAccount,

    encryptedToken:
      encryptedFields.encryptedToken,

    iv:
      encryptedFields.iv,

    authTag:
      encryptedFields.authTag,

    status: "active",

    lastValidatedAt:
      timestamp,

    createdAt:
      existingIndex >= 0
        ? rows[existingIndex]
            .createdAt ||
          timestamp
        : timestamp,

    updatedAt:
      timestamp
  };

  if (existingIndex >= 0) {
    rows[existingIndex] =
      record;
  } else {
    rows.push(record);
  }

  writeTokenRows(rows);

  return {
    masterAccountId:
      record.masterAccountId,

    providerAccount:
      record.providerAccount,

    status:
      record.status,

    lastValidatedAt:
      record.lastValidatedAt,

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt
  };
}

/**
 * loginByToken 验证成功后，
 * 更新最后验证时间。
 */
function touchTokenCache(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const rows =
    readTokenRows();

  const index =
    rows.findIndex(
      item =>
        item.masterAccountId ===
          normalizedMasterAccountId &&
        item.status === "active"
    );

  if (index < 0) {
    return false;
  }

  const timestamp = now();

  rows[index].lastValidatedAt =
    timestamp;

  rows[index].updatedAt =
    timestamp;

  writeTokenRows(rows);

  return true;
}

/**
 * token 失效、绑定被修改或
 * 外部账号注销后，移除缓存。
 */
function removeTokenCache(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const rows =
    readTokenRows();

  const remainingRows =
    rows.filter(
      item =>
        item.masterAccountId !==
        normalizedMasterAccountId
    );

  if (
    remainingRows.length ===
    rows.length
  ) {
    return false;
  }

  writeTokenRows(
    remainingRows
  );

  return true;
}

module.exports = {
  getTokenCache,
  upsertTokenCache,
  touchTokenCache,
  removeTokenCache
};