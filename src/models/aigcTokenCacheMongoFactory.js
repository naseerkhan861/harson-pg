"use strict";
const crypto = require("crypto");
const { requireText, dateFieldsToStrings, TOKEN_DATES } = require("./aigcMongoCompatUtils");

module.exports = function createTokenCache({ Model, idField, idName, accountName, keyNames, encryptionError, aadPrefix }) {
  const now = () => new Date();
  function key() {
    const keyHex = keyNames.map(name => process.env[name]).find(Boolean) || "";
    if (!/^[a-fA-F0-9]{64}$/.test(String(keyHex).trim())) {
      throw new Error(encryptionError);
    }
    return Buffer.from(String(keyHex).trim(), "hex");
  }
  function aad(id, account) {
    return aadPrefix ? Buffer.from(`${aadPrefix}:${id}:${account}`, "utf8") : null;
  }
  function encrypt({ id, account, token }) {
    const clear = requireText(token, idField === "subAccountId" ? "外部子账号Token" : "YiBai token");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const associatedData = aad(id, account);
    if (associatedData) cipher.setAAD(associatedData);
    return {
      encryptedToken: Buffer.concat([cipher.update(clear, "utf8"), cipher.final()]).toString("base64"),
      iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64")
    };
  }
  function decrypt(record) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(record.iv, "base64"));
    const associatedData = aad(record[idField], record.providerAccount);
    if (associatedData) decipher.setAAD(associatedData);
    decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(record.encryptedToken, "base64")),
      decipher.final()
    ]).toString("utf8");
  }
  function publicRecord(row) {
    const r = dateFieldsToStrings(row, TOKEN_DATES);
    return {
      [idField]: r[idField], providerAccount: r.providerAccount,
      status: r.status, lastValidatedAt: r.lastValidatedAt,
      createdAt: r.createdAt, updatedAt: r.updatedAt
    };
  }
  async function getTokenCache(value) {
    const id = requireText(value, idName);
    const row = await Model.findOne({ [idField]: id, status: "active" }).lean();
    if (!row) return null;
    try { return { ...publicRecord(row), token: decrypt(row) }; }
    catch { throw new Error(decryptionError()); }
  }
  function decryptionError() {
    if (idField === "subAccountId") return "外部子账号 Token 缓存无法解密，请检查加密密钥";
    if (keyNames[0] === "YIBAI_USER_DATA_TOKEN_ENCRYPTION_KEY") return "YiBai 用户端 Token 缓存无法解密，请检查加密密钥";
    return "YiBai token 缓存无法解密，请检查加密密钥是否发生变化";
  }
  async function upsertTokenCache(args) {
    const id = requireText(args[idField], idName);
    const account = requireText(args.providerAccount, accountName);
    const encrypted = encrypt({ id, account, token: args.token });
    const timestamp = now();
    await Model.updateOne({ [idField]: id }, {
      $set: { providerAccount: account, ...encrypted, status: "active", lastValidatedAt: timestamp, updatedAt: timestamp },
      $setOnInsert: { createdAt: timestamp }
    }, { upsert: true, runValidators: true });
    const record = await Model.findOne({ [idField]: id }).lean();
    return publicRecord(record);
  }
  async function touchTokenCache(value) {
    const id = requireText(value, idName);
    const timestamp = now();
    const result = await Model.updateOne({ [idField]: id, status: "active" }, {
      $set: { lastValidatedAt: timestamp, updatedAt: timestamp }
    });
    return result.matchedCount === 1;
  }
  async function removeTokenCache(value) {
    const id = requireText(value, idName);
    const result = await Model.deleteOne({ [idField]: id });
    return result.deletedCount > 0;
  }
  return { getTokenCache, upsertTokenCache, touchTokenCache, removeTokenCache };
};
