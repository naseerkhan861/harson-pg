require("dotenv").config();

const mongoose = require("mongoose");

const User = require(
  "../src/models/User"
);

const userCsvModel = require(
  "../src/models/userCsvModel"
);

function parseDate(value) {
  const normalized =
    String(value || "").trim();

  if (!normalized) {
    return null;
  }

  const date =
    new Date(normalized);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function parseBoolean(value) {
  return (
    String(value)
      .trim()
      .toLowerCase() ===
    "true"
  );
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

  const csvUsers =
    userCsvModel.readUsers();

  console.log(
    `[Migration] CSV users: ${csvUsers.length}`
  );

  const seenIds =
    new Set();

  const seenEmails =
    new Set();

  const documents =
    csvUsers.map(
      (user, index) => {
        const id =
          String(
            user.id || ""
          ).trim();

        const email =
          String(
            user.email || ""
          )
            .trim()
            .toLowerCase();

        const passwordHash =
          String(
            user.passwordHash || ""
          ).trim();

        if (!id) {
          throw new Error(
            `第 ${index + 1} 条用户缺少 id`
          );
        }

        if (!email) {
          throw new Error(
            `第 ${index + 1} 条用户缺少 email`
          );
        }

        if (!passwordHash) {
          throw new Error(
            `第 ${index + 1} 条用户缺少 passwordHash`
          );
        }

        if (seenIds.has(id)) {
          throw new Error(
            `发现重复 Harson-Base 用户 id`
          );
        }

        if (
          seenEmails.has(email)
        ) {
          throw new Error(
            `发现重复 Harson-Base 用户 email`
          );
        }

        seenIds.add(id);
        seenEmails.add(email);

        return {
          id,

          name:
            String(
              user.name || ""
            ).trim(),

          email,

          /*
           * 直接迁移现有 bcrypt hash，
           * 绝不重新 hash。
           */
          passwordHash,

          role:
            String(
              user.role || "user"
            ).trim(),

          gender:
            String(
              user.gender || ""
            ).trim(),

          ageGroup:
            String(
              user.ageGroup || ""
            ).trim(),

          createdAt:
            parseDate(
              user.createdAt
            ) ||
            new Date(),

          lastLoginAt:
            parseDate(
              user.lastLoginAt
            ),

          isActive:
            parseBoolean(
              user.isActive
            )
        };
      }
    );

  console.log(
    `[Migration] Valid users: ${documents.length}`
  );

  const existingCount =
    await User.countDocuments();

  console.log(
    `[Migration] Existing Mongo users: ${existingCount}`
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
    const conflictingUser =
      await User.findOne({
        email: document.email,
        id: {
          $ne: document.id
        }
      });

    if (conflictingUser) {
      throw new Error(
        "MongoDB 中存在 email 相同但 Harson-Base id 不同的用户，迁移已停止"
      );
    }

    await User.updateOne(
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
    await User.countDocuments();

  console.log(
    `[Migration] Mongo users after migration: ${finalCount}`
  );

  console.log(
    "[Migration] User migration completed"
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