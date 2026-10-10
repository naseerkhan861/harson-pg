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

const AigcActiveSession = require(
  "../src/models/aigcActiveSession"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_active_sessions.secure.csv"
);

const HEADERS = [
  "clBaseUserId",
  "aigcSubAccountId",
  "masterAccountId",
  "status",
  "loggedInAt",
  "lastActiveAt",
  "loggedOutAt"
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
    `[Migration] CSV active sessions: ${csvRows.length}`
  );

  const seenUserIds =
    new Set();

  const documents = [];

  for (
    let index = 0;
    index < csvRows.length;
    index += 1
  ) {
    const row =
      csvRows[index];

    const clBaseUserId =
      String(
        row.clBaseUserId || ""
      ).trim();

    const aigcSubAccountId =
      String(
        row.aigcSubAccountId || ""
      ).trim();

    const masterAccountId =
      String(
        row.masterAccountId || ""
      ).trim();

    const status =
      String(
        row.status || "active"
      ).trim();

    if (
      !clBaseUserId ||
      !aigcSubAccountId ||
      !masterAccountId
    ) {
      throw new Error(
        `第 ${index + 1} 条共享会话存在必填字段缺失`
      );
    }

    if (
      seenUserIds.has(
        clBaseUserId
      )
    ) {
      throw new Error(
        "发现同一个 Harson-Base 用户存在多条当前会话记录"
      );
    }

    /*
     * 验证 Harson-Base 用户存在。
     */
    const userExists =
      await User.exists({
        id: clBaseUserId
      });

    if (!userExists) {
      throw new Error(
        `第 ${index + 1} 条会话引用的 Harson-Base 用户不存在`
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
        `第 ${index + 1} 条会话引用的 AIGC 子账号不存在`
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
        `第 ${index + 1} 条会话引用的企业主账号不存在`
      );
    }

    /*
     * 子账号所属主账号
     * 必须和 Session 中记录的一致。
     */
    if (
      String(
        sub.masterAccountId
      ) !== masterAccountId
    ) {
      throw new Error(
        `第 ${index + 1} 条会话的 masterAccountId 与子账号所属主账号不一致`
      );
    }

    seenUserIds.add(
      clBaseUserId
    );

    documents.push({
      clBaseUserId,
      aigcSubAccountId,
      masterAccountId,
      status,

      loggedInAt:
        parseDate(
          row.loggedInAt
        ),

      lastActiveAt:
        parseDate(
          row.lastActiveAt
        ),

      loggedOutAt:
        parseDate(
          row.loggedOutAt
        )
    });
  }

  console.log(
    `[Migration] Valid active sessions: ${documents.length}`
  );

  const existingCount =
    await AigcActiveSession
      .countDocuments();

  console.log(
    `[Migration] Existing Mongo active sessions: ${existingCount}`
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
    await AigcActiveSession
      .updateOne(
        {
          clBaseUserId:
            document.clBaseUserId
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
    await AigcActiveSession
      .countDocuments();

  console.log(
    `[Migration] Mongo active sessions after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Active session migration completed"
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