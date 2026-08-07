"use strict";

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

const MASTER_PROVIDER_FILE =
  path.join(
    DATA_DIR,
    "aigc_master_provider_accounts.secure.csv"
  );

const MASTER_PROVIDER_HEADERS = [
  "masterAccountId",
  "providerAccount",

  "encryptionVersion",
  "encryptedPassword",
  "passwordIv",
  "passwordAuthTag",

  "pointsField",
  "syncedTotalCredits",
  "providerCompanyId",
  "providerCompanyName",
  "providerMemberId",
  "providerMemberName",

  "status",
  "lastSyncedAt",
  "createdAt",
  "updatedAt"
];

const ALLOWED_POINTS_FIELDS =
  new Set([
    "balance",
    "companyBalance",
    "mpoint",
    "companyMpoint"
  ]);


function now() {
  return new Date().toISOString();
}

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

function normalizePointsField(
  value
) {
  const normalizedValue =
    String(
      value ||
      "balance"
    ).trim();

  if (
    !ALLOWED_POINTS_FIELDS.has(
      normalizedValue
    )
  ) {
    throw new Error(
      "YiBai点数字段只能是 balance、companyBalance、mpoint 或 companyMpoint"
    );
  }

  return normalizedValue;
}


function normalizeCredits(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    throw new Error(
      "YiBai同步点数必须是非负数字"
    );
  }

  return numericValue;
}

function readRows() {
  return readCsv(
    MASTER_PROVIDER_FILE,
    MASTER_PROVIDER_HEADERS
  );
}

function writeRows(rows) {
  writeCsv(
    MASTER_PROVIDER_FILE,
    rows,
    MASTER_PROVIDER_HEADERS
  );
}

function hasCompleteCredential(
  record
) {
  return Boolean(
    String(
      record?.encryptionVersion ||
      ""
    ).trim() &&
    String(
      record?.encryptedPassword ||
      ""
    ).trim() &&
    String(
      record?.passwordIv ||
      ""
    ).trim() &&
    String(
      record?.passwordAuthTag ||
      ""
    ).trim()
  );
}

function normalizeCredential(
  credential
) {
  const normalizedCredential = {
    encryptionVersion:
      String(
        credential
          ?.encryptionVersion ||
        ""
      ).trim(),

    encryptedPassword:
      String(
        credential
          ?.encryptedPassword ||
        ""
      ).trim(),

    passwordIv:
      String(
        credential
          ?.passwordIv ||
        ""
      ).trim(),

    passwordAuthTag:
      String(
        credential
          ?.passwordAuthTag ||
        ""
      ).trim()
  };

  const suppliedFieldCount =
    Object.values(
      normalizedCredential
    ).filter(Boolean).length;

  if (suppliedFieldCount === 0) {
    return null;
  }

  if (suppliedFieldCount !== 4) {
    throw new Error(
      "YiBai加密密码数据不完整"
    );
  }

  if (
    normalizedCredential
      .encryptionVersion !== "v1"
  ) {
    throw new Error(
      "不支持的 YiBai 密码加密版本"
    );
  }

  return normalizedCredential;
}

/**
 * 只返回可以发送给管理员前端的字段。
 *
 * encryptedPassword、IV 和 authTag
 * 永远不能进入 API 响应。
 */
function toSafeRecord(
  record
) {
  if (!record) {
    return null;
  }

  return {
    masterAccountId:
      record.masterAccountId,

    providerAccount:
      record.providerAccount,

    pointsField:
      record.pointsField ||
      "balance",

    syncedTotalCredits:
      normalizeCredits(
        record.syncedTotalCredits
      ),

    providerCompanyId:
      record.providerCompanyId ||
      "",

    providerCompanyName:
      record.providerCompanyName ||
      "",

    providerMemberId:
      record.providerMemberId ||
      "",

    providerMemberName:
      record.providerMemberName ||
      "",

    status:
      record.status,

    lastSyncedAt:
      record.lastSyncedAt ||
      "",

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,

    credentialConfigured:
      hasCompleteCredential(
        record
      )
  };
}

/**
 * 管理员页面使用的安全绑定列表。
 *
 * 不返回任何密码或密码加密字段。
 */
function listMasterProviderConfigs() {
  return readRows()
    .filter(
      item =>
        item.status === "active"
    )
    .map(toSafeRecord);
}

/**
 * 后端 Service 使用的完整绑定记录。
 *
 * 此函数返回加密字段，因此只能在后端使用，
 * 不能直接作为 Controller 的响应数据。
 */
function getProviderConfigByMasterAccountId(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  return (
    readRows().find(
      item =>
        item.masterAccountId ===
          normalizedMasterAccountId &&
        item.status === "active"
    ) || null
  );
}

/**
 * 创建或更新：
 *
 * 内部企业主账号
 * → YiBai 外部账号
 *
 * 新绑定必须提交完整的加密密码。
 *
 * 更新同一个 YiBai 账号时：
 * 未提交新密码可以保留旧密码。
 *
 * 更换 YiBai 账号时：
 * 必须提交新密码，因为加密认证数据与
 * providerAccount 绑定，旧密码密文不能复制使用。
 */
function upsertMasterProviderConfig({
  masterAccountId,
  providerAccount,

  encryptionVersion,
  encryptedPassword,
  passwordIv,
  passwordAuthTag,

  pointsField
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

  const normalizedPointsField =
    normalizePointsField(
      pointsField
    );

  const suppliedCredential =
    normalizeCredential({
      encryptionVersion,
      encryptedPassword,
      passwordIv,
      passwordAuthTag
    });

  const rows =
    readRows();

  const existingIndex =
    rows.findIndex(
      item =>
        item.masterAccountId ===
        normalizedMasterAccountId
    );

  const duplicatedProvider =
    rows.find(
      item =>
        item.providerAccount ===
          normalizedProviderAccount &&
        item.masterAccountId !==
          normalizedMasterAccountId &&
        item.status === "active"
    );

  if (duplicatedProvider) {
    throw new Error(
      "该 YiBai 外部账号已经绑定到其他 AIGC 企业主账号"
    );
  }

  const timestamp = now();

  if (existingIndex < 0) {
    if (!suppliedCredential) {
      throw new Error(
        "新建 YiBai 绑定必须提供登录密码"
      );
    }

    const record = {
      masterAccountId:
        normalizedMasterAccountId,

      providerAccount:
        normalizedProviderAccount,

      ...suppliedCredential,

      pointsField:
        normalizedPointsField,

      syncedTotalCredits: 0,

      providerCompanyId: "",

      providerCompanyName: "",

      providerMemberId: "",

      providerMemberName: "",

      status: "active",

      lastSyncedAt: "",

      createdAt:
        timestamp,

      updatedAt:
        timestamp
    };

    rows.push(record);
    writeRows(rows);

    return toSafeRecord(
      record
    );
  }

  const existing =
    rows[existingIndex];

  const providerChanged =
    existing.providerAccount !==
    normalizedProviderAccount;

  if (
    providerChanged &&
    !suppliedCredential
  ) {
    throw new Error(
      "更换 YiBai 外部账号时必须提供该账号的新密码"
    );
  }

  let credentialToSave =
    suppliedCredential;

  if (!credentialToSave) {
    if (
      !hasCompleteCredential(
        existing
      )
    ) {
      throw new Error(
        "现有绑定没有可用的加密密码，请重新填写 YiBai 密码"
      );
    }

    credentialToSave = {
      encryptionVersion:
        existing.encryptionVersion,

      encryptedPassword:
        existing.encryptedPassword,

      passwordIv:
        existing.passwordIv,

      passwordAuthTag:
        existing.passwordAuthTag
    };
  }

  const updatedRecord = {
    ...existing,

    masterAccountId:
      normalizedMasterAccountId,

    providerAccount:
      normalizedProviderAccount,

    ...credentialToSave,

    pointsField:
      normalizedPointsField,

    /*
     * 更换 YiBai 账号后，
     * 旧账号同步出来的企业信息和点数
     * 不能继续显示。
     */
    syncedTotalCredits:
      providerChanged
        ? 0
        : normalizeCredits(
            existing
              .syncedTotalCredits
          ),

    providerCompanyId:
      providerChanged
        ? ""
        : existing
            .providerCompanyId ||
          "",

    providerCompanyName:
      providerChanged
        ? ""
        : existing
            .providerCompanyName ||
          "",

    providerMemberId:
      providerChanged
        ? ""
        : existing
            .providerMemberId ||
          "",

    providerMemberName:
      providerChanged
        ? ""
        : existing
            .providerMemberName ||
          "",

    status: "active",

    lastSyncedAt:
      providerChanged
        ? ""
        : existing
            .lastSyncedAt ||
          "",

    createdAt:
      existing.createdAt ||
      timestamp,

    updatedAt:
      timestamp
  };

  rows[existingIndex] =
    updatedRecord;

  writeRows(rows);

  return toSafeRecord(
    updatedRecord
  );
}

/**
 * 登录 YiBai 成功并同步点数后，
 * 更新外部企业和点数快照。
 */
function updateProviderSyncSnapshot({
  masterAccountId,
  syncedTotalCredits,
  providerCompanyId,
  providerCompanyName,
  providerMemberId,
  providerMemberName
}) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const normalizedCredits =
    normalizeCredits(
      syncedTotalCredits
    );

  const rows =
    readRows();

  const index =
    rows.findIndex(
      item =>
        item.masterAccountId ===
          normalizedMasterAccountId &&
        item.status === "active"
    );

  if (index < 0) {
    throw new Error(
      "未找到有效的 YiBai 主账号绑定"
    );
  }

  const timestamp = now();

  rows[index] = {
    ...rows[index],

    syncedTotalCredits:
      normalizedCredits,

    providerCompanyId:
      String(
        providerCompanyId ||
        ""
      ).trim(),

    providerCompanyName:
      String(
        providerCompanyName ||
        ""
      ).trim(),

    providerMemberId:
      String(
        providerMemberId ||
        ""
      ).trim(),

    providerMemberName:
      String(
        providerMemberName ||
        ""
      ).trim(),

    lastSyncedAt:
      timestamp,

    updatedAt:
      timestamp
  };

  writeRows(rows);

  return toSafeRecord(
    rows[index]
  );
}

/**
 * 停用绑定。
 *
 * 暂时保留密文，便于审计或恢复。
 * 最终正式删除账号时应另做安全删除接口。
 */
function disableMasterProviderConfig(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const rows =
    readRows();

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

  rows[index].status =
    "disabled";

  rows[index].updatedAt =
    now();

  writeRows(rows);

  return true;
}


/**
 * 正式删除 YiBai 外部账号绑定。
 *
 * 删除内容包括：
 * - YiBai 外部账号
 * - 加密密码
 * - 点数字段配置
 * - 外部企业信息
 * - 最近同步快照
 *
 * 不删除 Harson-Base 企业主账号。
 */
function removeMasterProviderConfig(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const rows =
    readRows();

  const remainingRows =
    rows.filter(
      item =>
        item.masterAccountId !==
        normalizedMasterAccountId
    );

  const removed =
    remainingRows.length !==
    rows.length;

  if (removed) {
    writeRows(
      remainingRows
    );
  }

  return removed;
}


module.exports = {
  listMasterProviderConfigs,
  getProviderConfigByMasterAccountId,
  upsertMasterProviderConfig,
  updateProviderSyncSnapshot,
  disableMasterProviderConfig,
  removeMasterProviderConfig
};