const path = require("path");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { readCsv, writeCsv } = require("../utils/csvStore");

/**
 * Runtime data directory
 *
 * Development:
 *   D:\\harson-platform\\harson-pg\\data
 *
 * Installed Electron app:
 *   C:\\Users\\<user>\\AppData\\Roaming\\HARSON CL_Base Platform\\data
 *
 * IMPORTANT:
 * Do not allow CSV_USER_FILE from .env to override this path in the packaged app.
 * The installed app must read/write user data from a writable AppData folder.
 */
const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../../data");

const USER_FILE = path.join(DATA_DIR, "users.secure.csv");

console.log("[HARSON] USER_FILE =", USER_FILE);

const USER_HEADERS = [
  "id",
  "name",
  "email",
  "passwordHash",
  "role",
  "gender",
  "ageGroup",
  "createdAt",
  "lastLoginAt",
  "isActive"
];

function readUsers() {
  return readCsv(USER_FILE, USER_HEADERS);
}

function writeUsers(users) {
  writeCsv(USER_FILE, users, USER_HEADERS);
}

async function findByEmail(email) {
  const users = readUsers();

  return users.find(
    user => user.email.toLowerCase() === String(email).toLowerCase()
  );
}

async function findById(id) {
  const users = readUsers();
  const user = users.find(item => item.id === id);

  return user ? sanitizeUser(user) : null;
}

async function listUsers() {
  return readUsers().map(sanitizeUser);
}

async function createUser({
  name,
  email,
  password,
  role = "user",
  gender = "",
  ageGroup = ""
}) {
  const users = readUsers();

  const existingUser = users.find(
    user => user.email.toLowerCase() === String(email).toLowerCase()
  );

  if (existingUser) {
    throw new Error("This email is already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = {
    id: nanoid(16),
    name,
    email: String(email).toLowerCase(),
    passwordHash,
    role,
    gender,
    ageGroup,
    createdAt: new Date().toISOString(),
    lastLoginAt: "",
    isActive: "true"
  };

  users.push(newUser);
  writeUsers(users);

  return sanitizeUser(newUser);
}

async function verifyUser(email, password) {
  const users = readUsers();

  const user = users.find(
    item => item.email.toLowerCase() === String(email).toLowerCase()
  );

  if (!user || user.isActive !== "true") {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  user.lastLoginAt = new Date().toISOString();
  writeUsers(users);

  return sanitizeUser(user);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gender: user.gender || "",
    ageGroup: user.ageGroup || "",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    isActive: user.isActive === "true"
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