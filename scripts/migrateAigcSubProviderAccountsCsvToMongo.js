require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const AigcMasterAccount = require(
  "../src/models/aigcMasterAccount"
);

const AigcSubAccount = require(
  "../src/models/aigcSubAccount"
);

const AigcSubProviderAccount = require(
  "../src/models/aigcSubProviderAccount"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_sub_provider_accounts.secure.csv"
);

const HEADERS = [
  "subAccountId",
  "masterAccountId",
  "providerAccount",
  "encryptionVersion",
  "encryptedPassword",
  "passwordIv",
  "passwordAuthTag",
  "pointsField",
  "syncedTokenBalance",
  "providerMemberId",
  "providerMemberName",
  "providerCompanyId",
  "providerCompanyName",
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
      `第 ${index + 1} 条子账号外部配置的 ${fieldName} 不是有效的非负数字`
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
    `[Migration] CSV sub provider accounts: ${csvRows.length}`
  );

  const seenSubIds =
    new Set();

  const documents = [];

  for (
    let index = 0;
    index < csvRows.length;
    index += 1
  ) {
    const row =
      csvRows[index];

    const subAccountId =
      String(
        row.subAccountId || ""
      ).trim();

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
      !subAccountId ||
      !masterAccountId ||
      !providerAccount ||
      !encryptedPassword ||
      !passwordIv ||
      !passwordAuthTag
    ) {
      throw new Error(
        `第 ${index + 1} 条子账号外部配置存在必填字段缺失`
      );
    }

    if (
      seenSubIds.has(
        subAccountId
      )
    ) {
      throw new Error(
        "发现同一个 subAccountId 存在多条子账号外部配置"
      );
    }

    /*
     * 验证子账号存在。
     */
    const sub =
      await AigcSubAccount
        .findOne({
          id: subAccountId
        })
        .lean();

    if (!sub) {
      throw new Error(
        `第 ${index + 1} 条配置引用的 AIGC 子账号不存在`
      );
    }

    /*
     * 验证企业主账号存在。
     */
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

    /*
     * 验证该子账号确实属于这个主账号。
     */
    if (
      String(
        sub.masterAccountId
      ) !== masterAccountId
    ) {
      throw new Error(
        `第 ${index + 1} 条配置的 masterAccountId 与子账号所属主账号不一致`
      );
    }

    seenSubIds.add(
      subAccountId
    );

    documents.push({
      subAccountId,
      masterAccountId,
      providerAccount,

      /*
       * 加密字段全部原样迁移。
       * 不解密、不重算、不打印。
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

      syncedTokenBalance:
        parseNonNegativeNumber(
          row.syncedTokenBalance,
          "syncedTokenBalance",
          index
        ),

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
    `[Migration] Valid sub provider accounts: ${documents.length}`
  );

  const existingCount =
    await AigcSubProviderAccount
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo sub provider accounts: ${existingCount}`
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
    await AigcSubProviderAccount
      .updateOne(
        {
          subAccountId:
            document.subAccountId
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
    await AigcSubProviderAccount
      .countDocuments();

  console.log(
    `[Migration] Mongo sub provider accounts after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Sub provider account migration completed"
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