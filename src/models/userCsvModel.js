const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { readCsv, writeCsv } = require("../utils/csvStore");

const USER_FILE = process.env.CSV_USER_FILE || "./data/users.secure.csv";

async function findByEmail(email) {
  const users = readCsv(USER_FILE);
  return users.find(user => user.email.toLowerCase() === String(email).toLowerCase());
}

async function createUser({ name, email, password, role = "user" }) {
  const users = readCsv(USER_FILE);
  const existingUser = users.find(user => user.email.toLowerCase() === String(email).toLowerCase());

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
    createdAt: new Date().toISOString(),
    lastLoginAt: "",
    isActive: "true"
  };

  users.push(newUser);
  writeCsv(USER_FILE, users);

  return sanitizeUser(newUser);
}

async function verifyUser(email, password) {
  const users = readCsv(USER_FILE);
  const user = users.find(item => item.email.toLowerCase() === String(email).toLowerCase());

  if (!user || user.isActive !== "true") {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  user.lastLoginAt = new Date().toISOString();
  writeCsv(USER_FILE, users);

  return sanitizeUser(user);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    isActive: user.isActive === "true"
  };
}

module.exports = { findByEmail, createUser, verifyUser, sanitizeUser };
