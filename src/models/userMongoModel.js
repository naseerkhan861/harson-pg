const bcrypt = require("bcryptjs");
const User = require("./User");

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    isActive: user.isActive
  };
}

async function findByEmail(email) {
  const user = await User.findOne({
    email: String(email).toLowerCase()
  });

  return user ? sanitizeUser(user) : null;
}

async function findById(id) {
  const user = await User.findById(id);

  return user ? sanitizeUser(user) : null;
}

async function listUsers() {
  const users = await User.find().sort({ createdAt: -1 });

  return users.map(sanitizeUser);
}

async function createUser({ name, email, password, role = "user" }) {
  const normalizedEmail = String(email).toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new Error("This email is already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role,
    isActive: true
  });

  return sanitizeUser(newUser);
}

async function verifyUser(email, password) {
  const user = await User.findOne({
    email: String(email).toLowerCase()
  });

  if (!user || user.isActive !== true) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  user.lastLoginAt = new Date();
  await user.save();

  return sanitizeUser(user);
}

module.exports = {
  findByEmail,
  findById,
  listUsers,
  createUser,
  verifyUser,
  sanitizeUser
};