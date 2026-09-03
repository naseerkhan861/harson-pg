"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const ENCRYPTION_VERSION = "v1";

const KEY_ENV_NAME =
  "YIBAI_AIGC_CREDENTIAL_ENCRYPTION_KEY";

function requireText(
  value,
  fieldName
) {
  const normalizedValue =
    String(value || "").trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

/**
 * 获取用于加密 YiBai 密码的服务器密钥。
 *
 * 该密钥必须：
 * 1. 只保存在服务器环境变量中；
 * 2. 不能提交到 Git；
 * 3. 不能发送给前端；
 * 4. 不能随意更换，否则旧密码无法解密。
 */
function getEncryptionKey() {
  const keyHex = String(
    process.env[KEY_ENV_NAME] || ""
  ).trim();

  if (
    !/^[a-fA-F0-9]{64}$/.test(
      keyHex
    )
  ) {
    throw new Error(
      `${KEY_ENV_NAME} 必须是 64 个十六进制字符`
    );
  }

  return Buffer.from(
    keyHex,
    "hex"
  );
}

/**
 * 使用主账号 ID 和 YiBai 账号构造附加认证数据。
 *
 * 这样可以防止某个账号的加密密码
 * 被复制到另一个账号记录中继续使用。
 */
function buildAssociatedData({
  masterAccountId,
  providerAccount
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

  return Buffer.from(
    [
      ENCRYPTION_VERSION,
      normalizedMasterAccountId,
      normalizedProviderAccount
    ].join(":"),
    "utf8"
  );
}

/**
 * 加密管理员在网页中提交的 YiBai 密码。
 *
 * 返回值可以保存到安全 CSV。
 * 原始密码不会包含在返回结果中。
 */
function encryptProviderPassword({
  masterAccountId,
  providerAccount,
  password
}) {
  const normalizedPassword =
    requireText(
      password,
      "YiBai登录密码"
    );

  const key =
    getEncryptionKey();

  const iv =
    crypto.randomBytes(
      IV_LENGTH_BYTES
    );

  const associatedData =
    buildAssociatedData({
      masterAccountId,
      providerAccount
    });

  const cipher =
    crypto.createCipheriv(
      ALGORITHM,
      key,
      iv
    );

  cipher.setAAD(
    associatedData
  );

  const encryptedPassword =
    Buffer.concat([
      cipher.update(
        normalizedPassword,
        "utf8"
      ),
      cipher.final()
    ]);

  const authTag =
    cipher.getAuthTag();

  return {
    encryptionVersion:
      ENCRYPTION_VERSION,

    encryptedPassword:
      encryptedPassword.toString(
        "base64"
      ),

    passwordIv:
      iv.toString("base64"),

    passwordAuthTag:
      authTag.toString("base64")
  };
}

/**
 * 解密已保存的 YiBai 密码。
 *
 * 只允许后端 Service 调用。
 * 解密后的密码不能写日志或发送给前端。
 */
function decryptProviderPassword({
  masterAccountId,
  providerAccount,
  encryptionVersion,
  encryptedPassword,
  passwordIv,
  passwordAuthTag
}) {
  if (
    encryptionVersion !==
    ENCRYPTION_VERSION
  ) {
    throw new Error(
      "不支持的 YiBai 密码加密版本"
    );
  }

  const normalizedEncryptedPassword =
    requireText(
      encryptedPassword,
      "加密密码"
    );

  const normalizedPasswordIv =
    requireText(
      passwordIv,
      "密码加密IV"
    );

  const normalizedPasswordAuthTag =
    requireText(
      passwordAuthTag,
      "密码认证标签"
    );

  const key =
    getEncryptionKey();

  const associatedData =
    buildAssociatedData({
      masterAccountId,
      providerAccount
    });

  try {
    const decipher =
      crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(
          normalizedPasswordIv,
          "base64"
        )
      );

    decipher.setAAD(
      associatedData
    );

    decipher.setAuthTag(
      Buffer.from(
        normalizedPasswordAuthTag,
        "base64"
      )
    );

    const decryptedPassword =
      Buffer.concat([
        decipher.update(
          Buffer.from(
            normalizedEncryptedPassword,
            "base64"
          )
        ),
        decipher.final()
      ]);

    return decryptedPassword.toString(
      "utf8"
    );
  } catch (error) {
    throw new Error(
      "YiBai 密码解密失败，请检查加密密钥或账号绑定数据"
    );
  }
}

module.exports = {
  encryptProviderPassword,
  decryptProviderPassword
};