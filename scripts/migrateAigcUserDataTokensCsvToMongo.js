require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const AigcMasterAccount = require(
  "../src/models/aigcMasterAccount"
);

const AigcUserDataToken = require(
  "../src/models/aigcUserDataToken"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_user_data_tokens.secure.csv"
);

const HEADERS = [
  "masterAccountId",
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
    `[Migration] CSV user data tokens: ${csvRows.length}`
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
      !masterAccountId ||
      !providerAccount ||
      !encryptedToken ||
      !iv ||
      !authTag
    ) {
      throw new Error(
        `第 ${index + 1} 条用户数据 Token 记录存在必填字段缺失`
      );
    }

    if (
      seenMasterIds.has(
        masterAccountId
      )
    ) {
      throw new Error(
        "发现同一个 masterAccountId 存在多条用户数据 Token 记录"
      );
    }

    const masterExists =
      await AigcMasterAccount.exists({
        id: masterAccountId
      });

    if (!masterExists) {
      throw new Error(
        `第 ${index + 1} 条用户数据 Token 引用的企业主账号不存在`
      );
    }

    seenMasterIds.add(
      masterAccountId
    );

    documents.push({
      masterAccountId,
      providerAccount,

      /*
       * 加密 Token 原样迁移。
       * 不解密、不重算、不打印。
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
    `[Migration] Valid user data tokens: ${documents.length}`
  );

  const existingCount =
    await AigcUserDataToken
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo user data tokens: ${existingCount}`
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
    await AigcUserDataToken
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
    await AigcUserDataToken
      .countDocuments();

  console.log(
    `[Migration] Mongo user data tokens after migration: ${finalCount}`
  );

  console.log(
    "[Migration] User data token migration completed"
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