"use strict";

const crypto = require("crypto");
const path = require("path");

const {
  readCsv,
  writeCsv
} = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(
    __dirname,
    "../../data"
  );

const USER_TOKEN_CACHE_FILE =
  path.join(
    DATA_DIR,
    "aigc_user_data_tokens.secure.csv"
  );

const USER_TOKEN_CACHE_HEADERS = [
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

function requireText(
  value,
  fieldName
) {
  const normalizedValue =
    String(
      value || ""
    ).trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

function readTokenRows() {
  return readCsv(
    USER_TOKEN_CACHE_FILE,
    USER_TOKEN_CACHE_HEADERS
  );
}

function writeTokenRows(rows) {
  writeCsv(
    USER_TOKEN_CACHE_FILE,
    rows,
    USER_TOKEN_CACHE_HEADERS
  );
}

/**
 * 用户端 Token 优先使用独立密钥。
 *
 * 当前未配置独立密钥时，
 * 兼容使用现有管理端 Token 加密密钥。
 *
 * 两类 Token 仍保存在不同 CSV 中，
 * 不会互相覆盖。
 */
function getEncryptionKey() {
  const keyHex =
    String(
      process.env
        .YIBAI_USER_DATA_TOKEN_ENCRYPTION_KEY ||
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
      "用户端 Token 加密密钥必须是 64 个十六进制字符"
    );
  }

  return Buffer.from(
    keyHex,
    "hex"
  );
}

function encryptToken(token) {
  const normalizedToken =
    requireText(
      token,
      "YiBai 用户端 Token"
    );

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
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
      encrypted.toString(
        "base64"
      ),

    iv:
      iv.toString(
        "base64"
      ),

    authTag:
      authTag.toString(
        "base64"
      )
  };
}

function decryptToken(row) {
  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),

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

  return decrypted.toString(
    "utf8"
  );
}

/**
 * 读取企业主账号对应的
 * Access-Token-User。
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
        item.status ===
          "active"
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
  } catch {
    throw new Error(
      "YiBai 用户端 Token 缓存无法解密，请检查加密密钥"
    );
  }
}

/**
 * 新增或更新企业主账号级
 * Access-Token-User。
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

    ...encryptedFields,

    status:
      "active",

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

  const row =
    rows.find(
      item =>
        item.masterAccountId ===
          normalizedMasterAccountId &&
        item.status ===
          "active"
    );

  if (!row) {
    return false;
  }

  const timestamp = now();

  row.lastValidatedAt =
    timestamp;

  row.updatedAt =
    timestamp;

  writeTokenRows(rows);

  return true;
}

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
