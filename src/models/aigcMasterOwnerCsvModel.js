"use strict";

const path = require("path");
const { nanoid } = require("nanoid");
const {
  readCsv,
  writeCsv
} = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../../data");

const MASTER_OWNER_FILE = path.join(
  DATA_DIR,
  "aigc_master_owner_mappings.secure.csv"
);

const MASTER_OWNER_HEADERS = [
  "id",
  "masterAccountId",
  "clBaseUserId",
  "clBaseEmail",
  "mappingStatus",
  "createdAt",
  "updatedAt"
];

function now() {
  return new Date().toISOString();
}

function requireText(value, fieldName) {
  const normalizedValue = String(
    value || ""
  ).trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName}不能为空`);
  }

  return normalizedValue;
}

function readMappings() {
  return readCsv(
    MASTER_OWNER_FILE,
    MASTER_OWNER_HEADERS
  );
}

function writeMappings(rows) {
  writeCsv(
    MASTER_OWNER_FILE,
    rows,
    MASTER_OWNER_HEADERS
  );
}

function listActiveMappings() {
  return readMappings().filter(
    mapping =>
      mapping.mappingStatus === "active"
  );
}

function getActiveMappingByUserId(
  clBaseUserId
) {
  const normalizedUserId = requireText(
    clBaseUserId,
    "Harson-Base 用户 ID"
  );

  return (
    listActiveMappings().find(
      mapping =>
        mapping.clBaseUserId ===
        normalizedUserId
    ) || null
  );
}

function getActiveMappingByMasterAccountId(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "企业主账号 ID"
    );

  return (
    listActiveMappings().find(
      mapping =>
        mapping.masterAccountId ===
        normalizedMasterAccountId
    ) || null
  );
}

function createMapping({
  masterAccountId,
  clBaseUserId,
  clBaseEmail
}) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "企业主账号 ID"
    );

  const normalizedUserId = requireText(
    clBaseUserId,
    "Harson-Base 用户 ID"
  );

  const normalizedEmail = requireText(
    clBaseEmail,
    "Harson-Base 登录邮箱"
  ).toLowerCase();

  const mappings = readMappings();

  const existingMasterOwner =
    mappings.find(
      mapping =>
        mapping.masterAccountId ===
          normalizedMasterAccountId &&
        mapping.mappingStatus === "active"
    );

  if (existingMasterOwner) {
    throw new Error(
      "该企业主账号已经绑定了负责人"
    );
  }

  const existingUserOwnerMapping =
    mappings.find(
      mapping =>
        mapping.clBaseUserId ===
          normalizedUserId &&
        mapping.mappingStatus === "active"
    );

  if (existingUserOwnerMapping) {
    throw new Error(
      "该 Harson-Base 用户已经是其他企业主账号的负责人"
    );
  }

  const timestamp = now();

  const record = {
    id: nanoid(16),
    masterAccountId:
      normalizedMasterAccountId,
    clBaseUserId:
      normalizedUserId,
    clBaseEmail:
      normalizedEmail,
    mappingStatus: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  mappings.push(record);
  writeMappings(mappings);

  return { ...record };
}

function unbindMapping(mappingId) {
  const normalizedMappingId = requireText(
    mappingId,
    "负责人绑定 ID"
  );

  const mappings = readMappings();

  const mapping = mappings.find(
    item =>
      item.id === normalizedMappingId &&
      item.mappingStatus === "active"
  );

  if (!mapping) {
    throw new Error(
      "未找到有效的企业主账号负责人绑定"
    );
  }

  mapping.mappingStatus = "disabled";
  mapping.updatedAt = now();

  writeMappings(mappings);

  return { ...mapping };
}

module.exports = {
  listActiveMappings,
  getActiveMappingByUserId,
  getActiveMappingByMasterAccountId,
  createMapping,
  unbindMapping
};
