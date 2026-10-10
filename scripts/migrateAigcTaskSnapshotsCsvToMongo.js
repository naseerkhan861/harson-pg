require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");

const { readCsv } = require(
  "../src/utils/csvStore"
);

const AigcMasterAccount = require(
  "../src/models/aigcMasterAccount"
);

const AigcTaskSnapshot = require(
  "../src/models/aigcTaskSnapshot"
);

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../data");

const FILE = path.join(
  DATA_DIR,
  "aigc_task_snapshots.secure.csv"
);

const HEADERS = [
  "masterAccountId",
  "providerTaskId",
  "memberId",
  "memberName",
  "companyId",
  "companyName",
  "object",
  "objectName",
  "status",
  "point",
  "refundedPoint",
  "netPoint",
  "imageUrl",
  "imageWidth",
  "imageHeight",
  "dateCreate",
  "dateEnd",
  "syncedAt"
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
  const normalized =
    String(value ?? "").trim();

  if (!normalized) {
    return 0;
  }

  const number =
    Number(normalized);

  if (!Number.isFinite(number)) {
    throw new Error(
      `第 ${index + 1} 条任务快照的 ${fieldName} 不是有效数字`
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
    `[Migration] CSV task snapshots: ${csvRows.length}`
  );

  /*
   * 业务唯一键：
   *
   * masterAccountId
   * +
   * providerTaskId
   */
  const seenKeys =
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

    const providerTaskId =
      String(
        row.providerTaskId || ""
      ).trim();

    if (
      !masterAccountId ||
      !providerTaskId
    ) {
      throw new Error(
        `第 ${index + 1} 条任务快照缺少 masterAccountId 或 providerTaskId`
      );
    }

    /*
     * 确认对应企业主账号已迁入 MongoDB。
     */
    const masterExists =
      await AigcMasterAccount.exists({
        id: masterAccountId
      });

    if (!masterExists) {
      throw new Error(
        `第 ${index + 1} 条任务快照引用的企业主账号不存在`
      );
    }

    const uniqueKey =
      `${masterAccountId}::${providerTaskId}`;

    if (
      seenKeys.has(uniqueKey)
    ) {
      throw new Error(
        `发现重复任务快照：同一个 masterAccountId + providerTaskId 出现多次`
      );
    }

    seenKeys.add(uniqueKey);

    documents.push({
      masterAccountId,
      providerTaskId,

      memberId:
        String(
          row.memberId || ""
        ).trim(),

      memberName:
        String(
          row.memberName || ""
        ).trim(),

      companyId:
        String(
          row.companyId || ""
        ).trim(),

      companyName:
        String(
          row.companyName || ""
        ).trim(),

      object:
        String(
          row.object || ""
        ).trim(),

      objectName:
        String(
          row.objectName || ""
        ).trim(),

      status:
        String(
          row.status || ""
        ).trim(),

      point:
        parseNumber(
          row.point,
          "point",
          index
        ),

      refundedPoint:
        parseNumber(
          row.refundedPoint,
          "refundedPoint",
          index
        ),

      netPoint:
        parseNumber(
          row.netPoint,
          "netPoint",
          index
        ),

      imageUrl:
        String(
          row.imageUrl || ""
        ).trim(),

      imageWidth:
        parseNumber(
          row.imageWidth,
          "imageWidth",
          index
        ),

      imageHeight:
        parseNumber(
          row.imageHeight,
          "imageHeight",
          index
        ),

      dateCreate:
        parseDate(
          row.dateCreate
        ),

      dateEnd:
        parseDate(
          row.dateEnd
        ),

      syncedAt:
        parseDate(
          row.syncedAt
        )
    });
  }

  console.log(
    `[Migration] Valid task snapshots: ${documents.length}`
  );

  const existingCount =
    await AigcTaskSnapshot.countDocuments();

  console.log(
    `[Migration] Existing Mongo task snapshots: ${existingCount}`
  );

  const businessFields = [
    "memberId",
    "memberName",
    "companyId",
    "companyName",
    "object",
    "objectName",
    "status",
    "point",
    "refundedPoint",
    "netPoint",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "dateCreate",
    "dateEnd"
  ];

  const numberFields = new Set([
    "point",
    "refundedPoint",
    "netPoint",
    "imageWidth",
    "imageHeight"
  ]);

  const dateFields = new Set([
    "dateCreate",
    "dateEnd"
  ]);

  function comparable(field, value) {
    if (dateFields.has(field)) {
      return value
        ? new Date(value).getTime()
        : null;
    }

    if (numberFields.has(field)) {
      return Number(value ?? 0);
    }

    return String(value ?? "").trim();
  }

  const plannedInserts = [];
  const plannedTimeUpdates = [];
  let unchangedCount = 0;

  for (const document of documents) {
    const key = {
      masterAccountId: document.masterAccountId,
      providerTaskId: document.providerTaskId
    };

    const existing =
      await AigcTaskSnapshot.findOne(key).lean();

    if (!existing) {
      plannedInserts.push({ key, document });
      continue;
    }

    const differentFields =
      businessFields.filter(
        field =>
          comparable(field, document[field]) !==
          comparable(field, existing[field])
      );

    if (differentFields.length > 0) {
      throw new Error(
        `发现已有任务业务字段不一致：${differentFields.join(", ")}，停止迁移`
      );
    }

    const csvTime = document.syncedAt
      ? new Date(document.syncedAt).getTime()
      : null;

    const mongoTime = existing.syncedAt
      ? new Date(existing.syncedAt).getTime()
      : null;

    if (csvTime === null || mongoTime === null) {
      throw new Error(
        "发现任务同步时间缺失，停止迁移"
      );
    }

    if (csvTime > mongoTime) {
      plannedTimeUpdates.push({
        key,
        syncedAt: document.syncedAt,
        previousSyncedAt: existing.syncedAt
      });
    } else {
      unchangedCount += 1;
    }
  }

  console.log(
    `[Migration] Planned inserts: ${plannedInserts.length}`
  );

  console.log(
    `[Migration] Planned sync-time updates: ${plannedTimeUpdates.length}`
  );

  console.log(
    `[Migration] Unchanged tasks: ${unchangedCount}`
  );

  if (isDryRun) {
    console.log(
      "[Migration] DRY RUN passed - no data written"
    );
    return;
  }

  // 仅插入不存在的任务，不覆盖已有记录。
  for (const item of plannedInserts) {
    await AigcTaskSnapshot.updateOne(
      item.key,
      { $setOnInsert: item.document },
      { upsert: true }
    );
  }

  // 仅在同步时间未被其他进程修改时更新。
  for (const item of plannedTimeUpdates) {
    const result =
      await AigcTaskSnapshot.updateOne(
        {
          ...item.key,
          syncedAt: item.previousSyncedAt
        },
        {
          $set: {
            syncedAt: item.syncedAt
          }
        }
      );

    if (result.matchedCount !== 1) {
      throw new Error(
        "任务同步时间已发生变化，停止迁移，请重新检查"
      );
    }
  }

  const finalCount =
    await AigcTaskSnapshot
      .countDocuments();

  console.log(
    `[Migration] Mongo task snapshots after migration: ${finalCount}`
  );

  console.log(
    "[Migration] Task snapshot migration completed"
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