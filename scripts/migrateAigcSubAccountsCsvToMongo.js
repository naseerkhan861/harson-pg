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

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const SUB_FILE = path.join(
  DATA_DIR,
  "aigc_sub_accounts.secure.csv"
);

const SUB_HEADERS = [
  "id",
  "masterAccountId",
  "subAccountName",
  "platformLogin",
  "platformPasswordHash",
  "tokenLimit",
  "warningThreshold",
  "status",
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

function parseNumber(
  value,
  fieldName,
  index
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `第 ${index + 1} 条子账号的 ${fieldName} 不是有效数字`
    );
  }

  return number;
}

async function main() {
  const isDryRun =
    process.argv.includes(
      "--dry-run"
    );

  await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log(
    "[Migration] MongoDB connected"
  );

  const csvSubs = readCsv(
    SUB_FILE,
    SUB_HEADERS
  );

  console.log(
    `[Migration] CSV sub accounts: ${csvSubs.length}`
  );

  const seenIds =
    new Set();

  const seenLogins =
    new Set();

  const documents = [];

  for (
    let index = 0;
    index < csvSubs.length;
    index += 1
  ) {
    const sub =
      csvSubs[index];

    const id =
      String(
        sub.id || ""
      ).trim();

    const masterAccountId =
      String(
        sub.masterAccountId || ""
      ).trim();

    const subAccountName =
      String(
        sub.subAccountName || ""
      ).trim();

    const platformLogin =
      String(
        sub.platformLogin || ""
      )
        .trim()
        .toLowerCase();

    const platformPasswordHash =
      String(
        sub.platformPasswordHash ||
        ""
      ).trim();

    if (
      !id ||
      !masterAccountId ||
      !subAccountName ||
      !platformLogin ||
      !platformPasswordHash
    ) {
      throw new Error(
        `第 ${index + 1} 条子账号存在必填字段缺失`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        "发现重复子账号 id"
      );
    }

    if (
      seenLogins.has(
        platformLogin
      )
    ) {
      throw new Error(
        "发现重复子账号 platformLogin"
      );
    }

    const masterExists =
      await AigcMasterAccount.exists({
        id: masterAccountId
      });

    if (!masterExists) {
      throw new Error(
        `第 ${index + 1} 条子账号引用的 masterAccountId 在 MongoDB 中不存在`
      );
    }

    const tokenLimit =
      parseNumber(
        sub.tokenLimit || 0,
        "tokenLimit",
        index
      );

    const warningThreshold =
      parseNumber(
        sub.warningThreshold || 10,
        "warningThreshold",
        index
      );

    if (tokenLimit < 0) {
      throw new Error(
        `第 ${index + 1} 条子账号 tokenLimit 不能为负数`
      );
    }

    if (
      warningThreshold <= 0 ||
      warningThreshold > 100
    ) {
      throw new Error(
        `第 ${index + 1} 条子账号 warningThreshold 必须在 1 到 100 之间`
      );
    }

    seenIds.add(id);
    seenLogins.add(
      platformLogin
    );

    documents.push({
      id,
      masterAccountId,
      subAccountName,
      platformLogin,
      platformPasswordHash,
      tokenLimit,
      warningThreshold,

      status:
        String(
          sub.status || "active"
        ).trim(),

      createdAt:
        parseDate(
          sub.createdAt
        ) ||
        new Date(),

      updatedAt:
        parseDate(
          sub.updatedAt
        ) ||
        new Date()
    });
  }

  console.log(
    `[Migration] Valid sub accounts: ${documents.length}`
  );

  const existingCount =
    await AigcSubAccount
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo sub accounts: ${existingCount}`
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
    const conflictingLogin =
      await AigcSubAccount
        .findOne({
          platformLogin:
            document.platformLogin,

          id: {
            $ne: document.id
          }
        });

    if (conflictingLogin) {
      throw new Error(
        "MongoDB 中存在 platformLogin 相同但 Harson 子账号 id 不同的数据，迁移已停止"
      );
    }

    await AigcSubAccount
      .updateOne(
        {
          id: document.id
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
    await AigcSubAccount
      .countDocuments();

  console.log(
    `[Migration] Mongo sub accounts after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Sub account migration completed"
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