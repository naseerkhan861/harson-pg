const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const token = req.cookies.harson_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin permission required."
    });
  }

  next();
}

function optionalAuth(req, res, next) {
  const token = req.cookies.harson_token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null;
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth
};
