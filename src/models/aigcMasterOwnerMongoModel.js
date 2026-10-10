"use strict";

const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const COLLECTION_NAME = "aigc_master_owner_mappings";

function collection() {
  if (
    mongoose.connection.readyState !== 1 ||
    !mongoose.connection.db
  ) {
    throw new Error("MongoDB 尚未连接");
  }

  return mongoose.connection.db.collection(COLLECTION_NAME);
}



let indexesPromise = null;

async function ensureActiveMappingIndexes() {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const col = collection();

      const definitions = [
        {
          field: "masterAccountId",
          name: "uniq_active_master_owner"
        },
        {
          field: "clBaseUserId",
          name: "uniq_active_owner_user"
        }
      ];

      let indexes = await col.indexes();

      for (const definition of definitions) {
        const sameKey = indexes.filter(index =>
          Object.keys(index.key || {}).length === 1 &&
          index.key[definition.field] === 1
        );

        const valid = sameKey.some(index =>
          index.unique === true &&
          index.partialFilterExpression?.mappingStatus === "active" &&
          Object.keys(index.partialFilterExpression).length === 1
        );

        if (valid) {
          continue;
        }

        if (sameKey.length > 0) {
          throw new Error(
            `${definition.field} 已存在不兼容索引，需要人工检查`
          );
        }

        await col.createIndex(
          { [definition.field]: 1 },
          {
            name: definition.name,
            unique: true,
            partialFilterExpression: {
              mappingStatus: "active"
            }
          }
        );

        indexes = await col.indexes();
      }
    })().catch(error => {
      indexesPromise = null;
      throw error;
    });
  }

  return indexesPromise;
}

function requireText(value, fieldName) {
  const result = String(value || "").trim();

  if (!result) {
    throw new Error(`${fieldName}不能为空`);
  }

  return result;
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

async function listActiveMappings() {
  const rows = await collection()
    .find({ mappingStatus: "active" })
    .toArray();

  return rows.map(toRecord);
}

async function getActiveMappingByUserId(clBaseUserId) {
  const id = requireText(
    clBaseUserId,
    "Harson-Base 用户 ID"
  );

  return toRecord(
    await collection().findOne({
      clBaseUserId: id,
      mappingStatus: "active"
    })
  );
}

async function getActiveMappingByMasterAccountId(masterAccountId) {
  const id = requireText(
    masterAccountId,
    "企业主账号 ID"
  );

  return toRecord(
    await collection().findOne({
      masterAccountId: id,
      mappingStatus: "active"
    })
  );
}

async function createMapping({
  masterAccountId,
  clBaseUserId,
  clBaseEmail
}) {
  const masterId = requireText(
    masterAccountId,
    "企业主账号 ID"
  );

  const userId = requireText(
    clBaseUserId,
    "Harson-Base 用户 ID"
  );

  const email = requireText(
    clBaseEmail,
    "Harson-Base 登录邮箱"
  ).toLowerCase();

  await ensureActiveMappingIndexes();

  if (await getActiveMappingByMasterAccountId(masterId)) {
    throw new Error("该企业主账号已经绑定了负责人");
  }

  if (await getActiveMappingByUserId(userId)) {
    throw new Error(
      "该 Harson-Base 用户已经是其他企业主账号的负责人"
    );
  }

  const timestamp = new Date().toISOString();

  const record = {
    id: nanoid(16),
    masterAccountId: masterId,
    clBaseUserId: userId,
    clBaseEmail: email,
    mappingStatus: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await collection().insertOne(record);
  } catch (error) {
    if (error?.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      const message = String(error.message || "");

      if (
        key === "masterAccountId" ||
        message.includes("uniq_active_master_owner")
      ) {
        throw new Error("该企业主账号已经绑定了负责人");
      }

      if (
        key === "clBaseUserId" ||
        message.includes("uniq_active_owner_user")
      ) {
        throw new Error(
          "该 Harson-Base 用户已经是其他企业主账号的负责人"
        );
      }

      throw new Error("企业负责人绑定已存在");
    }

    throw error;
  }

  return toRecord(record);
}

async function unbindMapping(mappingId) {
  const id = requireText(
    mappingId,
    "负责人绑定 ID"
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
    {
      returnDocument: "after"
    }
  );

  const document =
    result && Object.prototype.hasOwnProperty.call(result, "value")
      ? result.value
      : result;

  if (!document) {
    throw new Error(
      "未找到有效的企业主账号负责人绑定"
    );
  }

  return toRecord(document);
}

module.exports = {
  ensureActiveMappingIndexes,
  listActiveMappings,
  getActiveMappingByUserId,
  getActiveMappingByMasterAccountId,
  createMapping,
  unbindMapping
};
