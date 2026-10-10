require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const AigcSubAccount = require(
  "../src/models/aigcSubAccount"
);

const AigcSubLoginToken = require(
  "../src/models/aigcSubLoginToken"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_sub_login_tokens.secure.csv"
);

const HEADERS = [
  "subAccountId",
  "providerAccount",
  "encryptedToken",
  "iv",
  "authTag",
  "status",
  "lastValidatedAt",
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
    `[Migration] CSV sub login tokens: ${csvRows.length}`
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

    const providerAccount =
      String(
        row.providerAccount || ""
      ).trim();

    const encryptedToken =
      String(
        row.encryptedToken || ""
      ).trim();

    const iv =
      String(
        row.iv || ""
      ).trim();

    const authTag =
      String(
        row.authTag || ""
      ).trim();

    if (
      !subAccountId ||
      !providerAccount ||
      !encryptedToken ||
      !iv ||
      !authTag
    ) {
      throw new Error(
        `第 ${index + 1} 条子账号 Token 记录存在必填字段缺失`
      );
    }

    if (
      seenSubIds.has(
        subAccountId
      )
    ) {
      throw new Error(
        "发现同一个 subAccountId 存在多条子账号 Token 记录"
      );
    }

    const subExists =
      await AigcSubAccount.exists({
        id: subAccountId
      });

    if (!subExists) {
      throw new Error(
        `第 ${index + 1} 条 Token 记录引用的 AIGC 子账号不存在`
      );
    }

    seenSubIds.add(
      subAccountId
    );

    documents.push({
      /*
       * 这两个字段不能修改。
       * 现有 Token 解密 AAD 依赖：
       *
       * sub-token:${subAccountId}:${providerAccount}
       */
      subAccountId,
      providerAccount,

      /*
       * 加密数据原样迁移。
       */
      encryptedToken,
      iv,
      authTag,

      status:
        String(
          row.status || "active"
        ).trim(),

      lastValidatedAt:
        parseDate(
          row.lastValidatedAt
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
    `[Migration] Valid sub login tokens: ${documents.length}`
  );

  const existingCount =
    await AigcSubLoginToken
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo sub login tokens: ${existingCount}`
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
    await AigcSubLoginToken
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
    await AigcSubLoginToken
      .countDocuments();

  console.log(
    `[Migration] Mongo sub login tokens after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Sub login token migration completed"
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