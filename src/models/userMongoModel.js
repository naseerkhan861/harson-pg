const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const User = require("./User");

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    /*
     * 必须返回 Harson-Base 原有业务 ID，
     * 不能返回 MongoDB _id。
     */
    id: user.id,

    name: user.name,
    email: user.email,
    role: user.role,

    gender: user.gender || "",
    ageGroup: user.ageGroup || "",

    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,

    isActive:
      user.isActive === true
  };
}

async function findByEmail(email) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const user = await User.findOne({
    email: normalizedEmail
  });

  return user
    ? sanitizeUser(user)
    : null;
}

async function findById(id) {
  const normalizedId =
    String(id || "").trim();

  if (!normalizedId) {
    return null;
  }

  /*
   * 注意：
   * 这里查询的是 Harson-Base 的业务 id，
   * 不是 MongoDB _id。
   */
  const user = await User.findOne({
    id: normalizedId
  });

  return user
    ? sanitizeUser(user)
    : null;
}

async function listUsers() {
  const users = await User.find()
    .sort({
      createdAt: -1
    });

  return users.map(
    sanitizeUser
  );
}

async function createUser({
  name,
  email,
  password,
  role = "user",
  gender = "",
  ageGroup = ""
}) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const existingUser =
    await User.findOne({
      email: normalizedEmail
    });

  if (existingUser) {
    throw new Error(
      "This email is already registered."
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );

  const newUser =
    await User.create({
      /*
       * 与 CSV 版本保持一致，
       * 新用户继续使用 nanoid(16)。
       */
      id: nanoid(16),

      name,
      email:
        normalizedEmail,

      passwordHash,
      role,

      gender,
      ageGroup,

      createdAt:
        new Date(),

      lastLoginAt:
        null,

      isActive:
        true
    });

  return sanitizeUser(
    newUser
  );
}

async function verifyUser(
  email,
  password
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const user =
    await User.findOne({
      email:
        normalizedEmail
    });

  if (
    !user ||
    user.isActive !== true
  ) {
    return null;
  }

  const isValid =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!isValid) {
    return null;
  }

  user.lastLoginAt =
    new Date();

  await user.save();

  return sanitizeUser(
    user
  );
}

module.exports = {
  findByEmail,
  findById,
  listUsers,
  createUser,
  verifyUser,
  sanitizeUser
};