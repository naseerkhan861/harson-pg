require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const AigcMasterAccount = require(
  "../src/models/aigcMasterAccount"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const MASTER_FILE = path.join(
  DATA_DIR,
  "aigc_master_accounts.secure.csv"
);

const MASTER_HEADERS = [
  "id",
  "enterpriseName",
  "platformName",
  "platformLogin",
  "platformPasswordHash",
  "totalCredits",
  "usedCredits",
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
      `第 ${index + 1} 条企业主账号的 ${fieldName} 不是有效的非负数字`
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

  const csvMasters = readCsv(
    MASTER_FILE,
    MASTER_HEADERS
  );

  console.log(
    `[Migration] CSV master accounts: ${csvMasters.length}`
  );

  const seenIds = new Set();
  const seenLogins = new Set();

  const documents =
    csvMasters.map(
      (master, index) => {
        const id =
          String(
            master.id || ""
          ).trim();

        const enterpriseName =
          String(
            master.enterpriseName || ""
          ).trim();

        const platformName =
          String(
            master.platformName || ""
          ).trim();

        const platformLogin =
          String(
            master.platformLogin || ""
          )
            .trim()
            .toLowerCase();

        const platformPasswordHash =
          String(
            master.platformPasswordHash ||
            ""
          ).trim();

        if (!id) {
          throw new Error(
            `第 ${index + 1} 条企业主账号缺少 id`
          );
        }

        if (!enterpriseName) {
          throw new Error(
            `第 ${index + 1} 条企业主账号缺少 enterpriseName`
          );
        }

        if (!platformName) {
          throw new Error(
            `第 ${index + 1} 条企业主账号缺少 platformName`
          );
        }

        if (!platformLogin) {
          throw new Error(
            `第 ${index + 1} 条企业主账号缺少 platformLogin`
          );
        }

        if (!platformPasswordHash) {
          throw new Error(
            `第 ${index + 1} 条企业主账号缺少 platformPasswordHash`
          );
        }

        if (seenIds.has(id)) {
          throw new Error(
            "发现重复企业主账号 id"
          );
        }

        if (
          seenLogins.has(
            platformLogin
          )
        ) {
          throw new Error(
            "发现重复企业主账号 platformLogin"
          );
        }

        seenIds.add(id);
        seenLogins.add(
          platformLogin
        );

        return {
          id,
          enterpriseName,
          platformName,
          platformLogin,

          /*
           * 原 bcrypt hash 原样迁移。
           */
          platformPasswordHash,

          totalCredits:
            parseNonNegativeNumber(
              master.totalCredits,
              "totalCredits",
              index
            ),

          usedCredits:
            parseNonNegativeNumber(
              master.usedCredits,
              "usedCredits",
              index
            ),

          status:
            String(
              master.status ||
              "active"
            ).trim(),

          createdAt:
            parseDate(
              master.createdAt
            ) ||
            new Date(),

          updatedAt:
            parseDate(
              master.updatedAt
            ) ||
            new Date()
        };
      }
    );

  console.log(
    `[Migration] Valid master accounts: ${documents.length}`
  );

  const existingCount =
    await AigcMasterAccount
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo master accounts: ${existingCount}`
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
      await AigcMasterAccount
        .findOne({
          platformLogin:
            document.platformLogin,

          id: {
            $ne: document.id
          }
        });

    if (conflictingLogin) {
      throw new Error(
        "MongoDB 中存在 platformLogin 相同但 Harson 主账号 id 不同的数据，迁移已停止"
      );
    }

    await AigcMasterAccount
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
    await AigcMasterAccount
      .countDocuments();

  console.log(
    `[Migration] Mongo master accounts after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Master account migration completed"
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