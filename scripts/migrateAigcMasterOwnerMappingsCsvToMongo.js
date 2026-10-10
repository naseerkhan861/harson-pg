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

const AigcMasterOwnerMapping = require(
  "../src/models/aigcMasterOwnerMapping"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const OWNER_MAPPING_FILE = path.join(
  DATA_DIR,
  "aigc_master_owner_mappings.secure.csv"
);

const OWNER_MAPPING_HEADERS = [
  "id",
  "masterAccountId",
  "clBaseUserId",
  "clBaseEmail",
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

  const csvMappings = readCsv(
    OWNER_MAPPING_FILE,
    OWNER_MAPPING_HEADERS
  );

  console.log(
    `[Migration] CSV master owner mappings: ${csvMappings.length}`
  );

  const seenIds = new Set();
  const activeMasterIds = new Set();
  const activeUserIds = new Set();

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

    const masterAccountId =
      String(
        mapping.masterAccountId || ""
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

    const mappingStatus =
      String(
        mapping.mappingStatus ||
        "active"
      ).trim();

    if (
      !id ||
      !masterAccountId ||
      !clBaseUserId ||
      !clBaseEmail
    ) {
      throw new Error(
        `第 ${index + 1} 条负责人映射存在必填字段缺失`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        "发现重复负责人映射 id"
      );
    }

    const masterExists =
      await AigcMasterAccount.exists({
        id: masterAccountId
      });

    if (!masterExists) {
      throw new Error(
        `第 ${index + 1} 条负责人映射引用的企业主账号不存在`
      );
    }

    const user =
      await User.findOne({
        id: clBaseUserId
      }).lean();

    if (!user) {
      throw new Error(
        `第 ${index + 1} 条负责人映射引用的 Harson-Base 用户不存在`
      );
    }

    if (
      String(user.email)
        .toLowerCase() !==
      clBaseEmail
    ) {
      throw new Error(
        `第 ${index + 1} 条负责人映射的 clBaseEmail 与 MongoDB 用户邮箱不一致`
      );
    }

    if (
      mappingStatus === "active"
    ) {
      if (
        activeMasterIds.has(
          masterAccountId
        )
      ) {
        throw new Error(
          "发现同一个企业主账号存在多个 active 负责人"
        );
      }

      if (
        activeUserIds.has(
          clBaseUserId
        )
      ) {
        throw new Error(
          "发现同一个 Harson-Base 用户负责多个 active 企业主账号"
        );
      }

      activeMasterIds.add(
        masterAccountId
      );

      activeUserIds.add(
        clBaseUserId
      );
    }

    seenIds.add(id);

    documents.push({
      id,
      masterAccountId,
      clBaseUserId,
      clBaseEmail,
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
    `[Migration] Valid master owner mappings: ${documents.length}`
  );

  const existingCount =
    await AigcMasterOwnerMapping
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo master owner mappings: ${existingCount}`
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
    await AigcMasterOwnerMapping
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
    await AigcMasterOwnerMapping
      .countDocuments();

  console.log(
    `[Migration] Mongo master owner mappings after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Master owner mapping migration completed"
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