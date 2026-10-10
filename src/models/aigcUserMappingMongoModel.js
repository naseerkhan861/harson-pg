"use strict";

const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const COLLECTION_NAME = "account_mappings";

function database() {
  if (
    mongoose.connection.readyState !== 1 ||
    !mongoose.connection.db
  ) {
    throw new Error("MongoDB 尚未连接");
  }
  return mongoose.connection.db;
}

function collection() {
  return database().collection(COLLECTION_NAME);
}

function requireText(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${fieldName}不能为空`);
  }
  return text;
}

function toRecord(document) {
  if (!document) return null;

  const { _id, ...record } = document;

  for (const field of ["createdAt", "updatedAt"]) {
    if (record[field] instanceof Date) {
      record[field] = record[field].toISOString();
    }
  }

  return record;
}

async function ensureIndex(field, name, partial = null) {
  const col = collection();
  let indexes;

  try {
    indexes = await col.indexes();
  } catch (error) {
    if (
      error.code === 26 ||
      error.codeName === "NamespaceNotFound"
    ) {
      indexes = [];
    } else {
      throw error;
    }
  }

  const existing = indexes.find(index =>
    Object.keys(index.key || {}).length === 1 &&
    index.key[field] === 1
  );

  if (existing) {
    const validPartial = partial
      ? existing.partialFilterExpression?.mappingStatus ===
          "active" &&
        Object.keys(
          existing.partialFilterExpression || {}
        ).length === 1
      : !existing.partialFilterExpression;

    if (existing.unique !== true || !validPartial) {
      throw new Error(
        `${field} 已存在不兼容索引，请先人工检查`
      );
    }

    return existing.name;
  }

  return col.createIndex(
    { [field]: 1 },
    {
      name,
      unique: true,
      ...(partial
        ? { partialFilterExpression: partial }
        : {})
    }
  );
}

async function ensureMappingIndexes() {
  // 保留已有的 id 唯一索引
  await ensureIndex(
    "id",
    "uniq_mapping_business_id"
  );

  const col = collection();
  const indexes = await col.indexes();

  // 不覆盖旧的 clBaseUserId_1 普通索引
  const existing = indexes.find(index => {
    const keys = Object.keys(index.key || {});

    return (
      keys.length === 2 &&
      keys[0] === "clBaseUserId" &&
      keys[1] === "mappingStatus" &&
      index.key.clBaseUserId === 1 &&
      index.key.mappingStatus === 1
    );
  });

  if (existing) {
    const partial = existing.partialFilterExpression || {};

    if (
      existing.unique !== true ||
      partial.mappingStatus !== "active" ||
      Object.keys(partial).length !== 1
    ) {
      throw new Error(
        "现有复合索引配置不兼容，需要人工检查"
      );
    }

    return;
  }

  await col.createIndex(
    {
      clBaseUserId: 1,
      mappingStatus: 1
    },
    {
      name: "uniq_active_user_mapping_compound",
      unique: true,
      partialFilterExpression: {
        mappingStatus: "active"
      }
    }
  );
}

async function listMappings() {
  const rows = await collection().find({}).toArray();
  return rows.map(toRecord);
}

async function listActiveMappings() {
  const rows = await collection()
    .find({ mappingStatus: "active" })
    .toArray();

  return rows.map(toRecord);
}

async function getActiveMappingByUserId(clBaseUserId) {
  const userId = String(clBaseUserId || "").trim();
  if (!userId) return null;

  return toRecord(
    await collection().findOne({
      clBaseUserId: userId,
      mappingStatus: "active"
    })
  );
}

async function createMapping({
  clBaseUserId,
  clBaseEmail,
  aigcSubAccountId
}) {
  const userId = requireText(
    clBaseUserId,
    "Harson-Base 用户 ID"
  );

  const email = requireText(
    clBaseEmail,
    "Harson-Base 登录邮箱"
  ).toLowerCase();

  const subId = requireText(
    aigcSubAccountId,
    "AIGC 子账号 ID"
  );

  const db = database();

  const user = await db.collection("users").findOne({
    id: userId
  });

  if (!user || user.isActive !== true) {
    throw new Error("未找到可用的 Harson-Base 用户");
  }

  if (user.role === "admin") {
    throw new Error("管理员不能绑定 AIGC 子账号");
  }

  if (
    String(user.email || "").trim().toLowerCase() !== email
  ) {
    throw new Error("Harson-Base 用户邮箱不匹配");
  }

  const sub = await db
    .collection("aigc_sub_accounts")
    .findOne({
      id: subId,
      status: "active"
    });

  if (!sub) {
    throw new Error("未找到可用的 AIGC 子账号");
  }

  const owner = await db
    .collection("aigc_master_owner_mappings")
    .findOne({
      clBaseUserId: userId,
      mappingStatus: "active"
    });

  if (owner) {
    throw new Error(
      "该 Harson-Base 用户已经是企业主账号负责人"
    );
  }

  await ensureMappingIndexes();

  if (await getActiveMappingByUserId(userId)) {
    throw new Error(
      "该 Harson-Base 账号已经绑定了一个 AIGC 子账号"
    );
  }

  const timestamp = new Date().toISOString();

  const record = {
    id: nanoid(16),
    clBaseUserId: userId,
    clBaseEmail: email,
    aigcSubAccountId: subId,
    masterAccountId: sub.masterAccountId,
    mappingStatus: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await collection().insertOne(record);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "该 Harson-Base 账号已经绑定了一个 AIGC 子账号，或映射 ID 重复"
      );
    }
    throw error;
  }

  return toRecord(record);
}

async function unbindMapping(mappingId) {
  const id = requireText(
    mappingId,
    "账号映射 ID"
  );

  const result = await collection().findOneAndUpdate(
    {
      id,
      mappingStatus: "active"
    },
    {
      $set: {
        mappingStatus: "disabled",
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: "after" }
  );

  const document =
    result &&
    Object.prototype.hasOwnProperty.call(result, "value")
      ? result.value
      : result;

  if (!document) {
    throw new Error(
      "未找到有效的 Harson-Base 账号映射"
    );
  }

  return toRecord(document);
}

module.exports = {
  ensureMappingIndexes,
  listMappings,
  listActiveMappings,
  getActiveMappingByUserId,
  createMapping,
  unbindMapping
};
