require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const AigcMasterAccount = require(
  "../src/models/aigcMasterAccount"
);

const AigcMasterProviderAccount = require(
  "../src/models/aigcMasterProviderAccount"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_master_provider_accounts.secure.csv"
);

const HEADERS = [
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

function parseDate(value) {
  const normalized =
    String(value || "").trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function parseNonNegativeNumber(
  value,
  fieldName,
  index
) {
  const number = Number(value || 0);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw new Error(
      `第 ${index + 1} 条主账号外部配置的 ${fieldName} 不是有效的非负数字`
    );
  }

  return number;
}

async function main() {
  const isDryRun =
    process.argv.includes(
      "--dry-run"
    );

  if (!process.env.MONGODB_URI) {
    throw new Error(
      "缺少 MONGODB_URI"
    );
  }

  await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log(
    "[Migration] MongoDB connected"
  );

  const csvRows = readCsv(
    FILE,
    HEADERS
  );

  console.log(
    `[Migration] CSV master provider accounts: ${csvRows.length}`
  );

  const seenMasterIds =
    new Set();

  const documents = [];

  for (
    let index = 0;
    index < csvRows.length;
    index += 1
  ) {
    const row =
      csvRows[index];

    const masterAccountId =
      String(
        row.masterAccountId || ""
      ).trim();

    const providerAccount =
      String(
        row.providerAccount || ""
      ).trim();

    const encryptedPassword =
      String(
        row.encryptedPassword || ""
      ).trim();

    const passwordIv =
      String(
        row.passwordIv || ""
      ).trim();

    const passwordAuthTag =
      String(
        row.passwordAuthTag || ""
      ).trim();

    if (
      !masterAccountId ||
      !providerAccount ||
      !encryptedPassword ||
      !passwordIv ||
      !passwordAuthTag
    ) {
      throw new Error(
        `第 ${index + 1} 条主账号外部配置存在必填字段缺失`
      );
    }

    if (
      seenMasterIds.has(
        masterAccountId
      )
    ) {
      throw new Error(
        "发现同一个 masterAccountId 存在多条主账号外部配置"
      );
    }

    const masterExists =
      await AigcMasterAccount
        .exists({
          id: masterAccountId
        });

    if (!masterExists) {
      throw new Error(
        `第 ${index + 1} 条配置引用的企业主账号不存在`
      );
    }

    seenMasterIds.add(
      masterAccountId
    );

    documents.push({
      masterAccountId,
      providerAccount,

      /*
       * 加密相关字段全部原样迁移。
       * 不解密、不重算、不输出。
       */
      encryptionVersion:
        String(
          row.encryptionVersion ||
          ""
        ).trim(),

      encryptedPassword,
      passwordIv,
      passwordAuthTag,

      pointsField:
        String(
          row.pointsField ||
          ""
        ).trim(),

      syncedTotalCredits:
        parseNonNegativeNumber(
          row.syncedTotalCredits,
          "syncedTotalCredits",
          index
        ),

      providerCompanyId:
        String(
          row.providerCompanyId ||
          ""
        ).trim(),

      providerCompanyName:
        String(
          row.providerCompanyName ||
          ""
        ).trim(),

      providerMemberId:
        String(
          row.providerMemberId ||
          ""
        ).trim(),

      providerMemberName:
        String(
          row.providerMemberName ||
          ""
        ).trim(),

      status:
        String(
          row.status ||
          "active"
        ).trim(),

      lastSyncedAt:
        parseDate(
          row.lastSyncedAt
        ),

      createdAt:
        parseDate(
          row.createdAt
        ) ||
        new Date(),

      updatedAt:
        parseDate(
          row.updatedAt
        ) ||
        new Date()
    });
  }

  console.log(
    `[Migration] Valid master provider accounts: ${documents.length}`
  );

  const existingCount =
    await AigcMasterProviderAccount
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo master provider accounts: ${existingCount}`
  );

  if (isDryRun) {
    console.log(
      "[Migration] DRY RUN passed - no data written"
    );

    return;
  }

  for (
    const document of documents
  ) {
    await AigcMasterProviderAccount
      .updateOne(
        {
          masterAccountId:
            document.masterAccountId
        },
        {
          $set: document
        },
        {
          upsert: true
        }
      );
  }

  const finalCount =
    await AigcMasterProviderAccount
      .countDocuments();

  console.log(
    `[Migration] Mongo master provider accounts after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Master provider account migration completed"
  );
}

main()
  .catch(error => {
    console.error(
      "[Migration] FAILED:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });