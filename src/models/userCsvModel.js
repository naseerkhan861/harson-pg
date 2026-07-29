"use strict";

const path = require("path");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");

const {
  ALLOWED_USER_ROLES,
  LEGACY_USER_ROLES
} = require("../constants/userRoles");

const {
  readCsv,
  writeCsv
} = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../../data");

const USER_FILE = path.join(
  DATA_DIR,
  "users.secure.csv"
);

console.log("[HARSON] USER_FILE =", USER_FILE);

const USER_HEADERS = [
  "id",
  "name",
  "email",
  "passwordHash",
  "role",
  "masterAccountId",
  "subAccountId",
  "gender",
  "ageGroup",
  "createdAt",
  "lastLoginAt",
  "isActive"
];

function normalizeOptionalId(value) {
  return String(value || "").trim();
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function validateRole(role) {
  const normalizedRole = String(
    role || LEGACY_USER_ROLES.USER
  ).trim();

  if (!ALLOWED_USER_ROLES.includes(normalizedRole)) {
    throw new Error("Invalid user role.");
  }

  return normalizedRole;
}

function readUsers() {
  return readCsv(USER_FILE, USER_HEADERS);
}

function writeUsers(users) {
  writeCsv(USER_FILE, users, USER_HEADERS);
}

async function findByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();

  return (
    users.find(
      user =>
        normalizeEmail(user.email) ===
        normalizedEmail
    ) || null
  );
}

async function findById(id) {
  const users = readUsers();

  const user = users.find(
    item =>
      String(item.id || "") ===
      String(id || "")
  );

  return user ? sanitizeUser(user) : null;
}

async function listUsers() {
  return readUsers().map(sanitizeUser);
}

async function createUser({
  name,
  email,
  password,
  role = LEGACY_USER_ROLES.USER,
  masterAccountId = "",
  subAccountId = "",
  gender = "",
  ageGroup = ""
}) {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = validateRole(role);

  const existingUser = users.find(
    user =>
      normalizeEmail(user.email) ===
      normalizedEmail
  );

  if (existingUser) {
    throw new Error(
      "This email is already registered."
    );
  }

  const passwordHash = await bcrypt.hash(
    password,
    12
  );

  const newUser = {
    id: nanoid(16),
    name: String(name || "").trim(),
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,

    masterAccountId:
      normalizeOptionalId(masterAccountId),

    subAccountId:
      normalizeOptionalId(subAccountId),

    gender: String(gender || "").trim(),
    ageGroup: String(ageGroup || "").trim(),

    createdAt: new Date().toISOString(),
    lastLoginAt: "",
    isActive: "true"
  };

  users.push(newUser);
  writeUsers(users);

  return sanitizeUser(newUser);
}

async function verifyUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();

  const user = users.find(
    item =>
      normalizeEmail(item.email) ===
      normalizedEmail
  );

  if (!user || user.isActive !== "true") {
    return null;
  }

  const isValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!isValid) {
    return null;
  }

  user.lastLoginAt =
    new Date().toISOString();

  writeUsers(users);

  return sanitizeUser(user);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role:
      user.role ||
      LEGACY_USER_ROLES.USER,

    masterAccountId:
      normalizeOptionalId(
        user.masterAccountId
      ) || null,

    subAccountId:
      normalizeOptionalId(
        user.subAccountId
      ) || null,

    gender: user.gender || "",
    ageGroup: user.ageGroup || "",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,

    isActive:
      user.isActive === true ||
      user.isActive === "true"
  };
}

module.exports = {
  USER_HEADERS,
  findByEmail,
  findById,
  listUsers,
  createUser,
  verifyUser,
  sanitizeUser,
  readUsers,
  writeUsers
};