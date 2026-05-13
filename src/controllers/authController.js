const jwt = require("jsonwebtoken");
const userCsvModel = require("../models/userCsvModel");

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
  );
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required." });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const user = await userCsvModel.createUser({ name, email, password });
    const token = createToken(user);

    res.cookie("harson_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.status(201).json({ success: true, message: "Account created successfully.", user });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Registration failed." });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await userCsvModel.verifyUser(email, password);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = createToken(user);
    res.cookie("harson_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.json({ success: true, message: "Login successful.", user });
  } catch {
    return res.status(500).json({ success: false, message: "Login failed." });
  }
}

function logout(req, res) {
  res.clearCookie("harson_token");
  return res.json({ success: true, message: "Logged out successfully." });
}

function me(req, res) {
  return res.json({ success: true, user: req.user || null });
}

module.exports = { register, login, logout, me };
