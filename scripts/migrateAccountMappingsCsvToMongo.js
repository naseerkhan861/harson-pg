require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const User = require(
  "../src/models/User"
);

const AigcMasterAccount = require(
  "../src/models/aigcMasterAccount"
);

const AigcSubAccount = require(
  "../src/models/aigcSubAccount"
);

const AccountMapping = require(
  "../src/models/accountMapping"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const MAPPING_FILE = path.join(
  DATA_DIR,
  "account_mappings.secure.csv"
);

const MAPPING_HEADERS = [
  "id",
  "clBaseUserId",
  "clBaseEmail",
  "aigcSubAccountId",
  "masterAccountId",
  "mappingStatus",
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

  await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log(
    "[Migration] MongoDB connected"
  );

  const csvMappings = readCsv(
    MAPPING_FILE,
    MAPPING_HEADERS
  );

  console.log(
    `[Migration] CSV account mappings: ${csvMappings.length}`
  );

  const seenIds =
    new Set();

  const activeUserIds =
    new Set();

  const documents = [];

  for (
    let index = 0;
    index < csvMappings.length;
    index += 1
  ) {
    const mapping =
      csvMappings[index];

    const id =
      String(
        mapping.id || ""
      ).trim();

    const clBaseUserId =
      String(
        mapping.clBaseUserId || ""
      ).trim();

    const clBaseEmail =
      String(
        mapping.clBaseEmail || ""
      )
        .trim()
        .toLowerCase();

    const aigcSubAccountId =
      String(
        mapping.aigcSubAccountId || ""
      ).trim();

    const masterAccountId =
      String(
        mapping.masterAccountId || ""
      ).trim();

    const mappingStatus =
      String(
        mapping.mappingStatus ||
        "active"
      ).trim();

    if (
      !id ||
      !clBaseUserId ||
      !clBaseEmail ||
      !aigcSubAccountId ||
      !masterAccountId
    ) {
      throw new Error(
        `第 ${index + 1} 条账号映射存在必填字段缺失`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        "发现重复账号映射 id"
      );
    }

    /*
     * 验证 Harson-Base 用户存在。
     */
    const user =
      await User.findOne({
        id: clBaseUserId
      }).lean();

    if (!user) {
      throw new Error(
        `第 ${index + 1} 条映射引用的 Harson-Base 用户不存在`
      );
    }

    /*
     * 验证保存的邮箱仍然属于该用户。
     */
    if (
      String(user.email)
        .toLowerCase() !==
      clBaseEmail
    ) {
      throw new Error(
        `第 ${index + 1} 条映射的 clBaseEmail 与 MongoDB 用户邮箱不一致`
      );
    }

    /*
     * 验证子账号存在。
     */
    const sub =
      await AigcSubAccount
        .findOne({
          id: aigcSubAccountId
        })
        .lean();

    if (!sub) {
      throw new Error(
        `第 ${index + 1} 条映射引用的 AIGC 子账号不存在`
      );
    }

    /*
     * 验证主账号存在。
     */
    const masterExists =
      await AigcMasterAccount
        .exists({
          id: masterAccountId
        });

    if (!masterExists) {
      throw new Error(
        `第 ${index + 1} 条映射引用的企业主账号不存在`
      );
    }

    /*
     * 子账号所属主账号
     * 必须与 Mapping 中的 masterAccountId 一致。
     */
    if (
      String(
        sub.masterAccountId
      ) !== masterAccountId
    ) {
      throw new Error(
        `第 ${index + 1} 条映射的主账号与子账号所属主账号不一致`
      );
    }

    /*
     * 一个 Harson-Base 用户
     * 只能有一个 active 子账号映射。
     */
    if (
      mappingStatus ===
      "active"
    ) {
      if (
        activeUserIds.has(
          clBaseUserId
        )
      ) {
        throw new Error(
          "发现同一个 Harson-Base 用户存在多个 active 子账号映射"
        );
      }

      activeUserIds.add(
        clBaseUserId
      );
    }

    seenIds.add(id);

    documents.push({
      id,
      clBaseUserId,
      clBaseEmail,
      aigcSubAccountId,
      masterAccountId,
      mappingStatus,

      createdAt:
        parseDate(
          mapping.createdAt
        ) ||
        new Date(),

      updatedAt:
        parseDate(
          mapping.updatedAt
        ) ||
        new Date()
    });
  }

  console.log(
    `[Migration] Valid account mappings: ${documents.length}`
  );

  const existingCount =
    await AccountMapping
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo account mappings: ${existingCount}`
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
    await AccountMapping.updateOne(
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
    await AccountMapping
      .countDocuments();

  console.log(
    `[Migration] Mongo account mappings after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Account mapping migration completed"
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