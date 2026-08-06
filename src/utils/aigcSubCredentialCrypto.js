"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const ENCRYPTION_VERSION = "v1";
const KEY_ENV_NAME = "YIBAI_AIGC_CREDENTIAL_ENCRYPTION_KEY";

function requireText(value, fieldName) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    throw new Error(`${fieldName}不能为空`);
  }
  return normalizedValue;
}

function getEncryptionKey() {
  const keyHex = String(process.env[KEY_ENV_NAME] || "").trim();
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error(`${KEY_ENV_NAME} 必须是 64 个十六进制字符`);
  }
  return Buffer.from(keyHex, "hex");
}

function buildAssociatedData({ subAccountId, providerAccount }) {
  const normalizedSubAccountId = requireText(subAccountId, "AIGC子账号ID");
  const normalizedProviderAccount = requireText(providerAccount, "外部子账号");
  return Buffer.from(
    [ENCRYPTION_VERSION, "sub", normalizedSubAccountId, normalizedProviderAccount].join(":"),
    "utf8"
  );
}

function encryptProviderPassword({ subAccountId, providerAccount, password }) {
  const normalizedPassword = requireText(password, "外部子账号登录密码");
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(buildAssociatedData({ subAccountId, providerAccount }));

  const encryptedPassword = Buffer.concat([
    cipher.update(normalizedPassword, "utf8"),
    cipher.final()
  ]);

  return {
    encryptionVersion: ENCRYPTION_VERSION,
    encryptedPassword: encryptedPassword.toString("base64"),
    passwordIv: iv.toString("base64"),
    passwordAuthTag: cipher.getAuthTag().toString("base64")
  };
}

function decryptProviderPassword({
  subAccountId,
  providerAccount,
  encryptionVersion,
  encryptedPassword,
  passwordIv,
  passwordAuthTag
}) {
  if (encryptionVersion !== ENCRYPTION_VERSION) {
    throw new Error("不支持的外部子账号密码加密版本");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(requireText(passwordIv, "密码加密IV"), "base64")
  );

  decipher.setAAD(buildAssociatedData({ subAccountId, providerAccount }));
  decipher.setAuthTag(
    Buffer.from(requireText(passwordAuthTag, "密码认证标签"), "base64")
  );

  try {
    const decryptedPassword = Buffer.concat([
      decipher.update(
        Buffer.from(requireText(encryptedPassword, "加密密码"), "base64")
      ),
      decipher.final()
    ]);
    return decryptedPassword.toString("utf8");
  } catch {
    throw new Error("外部子账号密码解密失败，请检查加密密钥或绑定数据");
  }
}

module.exports = {
  encryptProviderPassword,
  decryptProviderPassword
};
