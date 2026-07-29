"use strict";

const jwt = require("jsonwebtoken");

const {
  USER_ROLES,
  normalizeUserRole
} = require("../constants/userRoles");

function requireAuth(req, res, next) {
  const token = req.cookies.harson_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user.role =
      normalizeUserRole(req.user.role);

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

function getUserRole(req) {
  return normalizeUserRole(
    req.user?.role
  );
}

/*
 * 保留 requireAdmin 名称，
 * 避免现有路由立即报错。
 *
 * 现在它代表平台级管理员权限。
 */
function requireAdmin(req, res, next) {
  if (
    getUserRole(req) !==
    USER_ROLES.PLATFORM_ADMIN
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Platform administrator permission required."
    });
  }

  next();
}

function requirePlatformAdmin(req, res, next) {
  return requireAdmin(req, res, next);
}

function requireMasterAdmin(req, res, next) {
  if (
    getUserRole(req) !==
    USER_ROLES.MASTER_ADMIN
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Enterprise master account permission required."
    });
  }

  if (!req.user.masterAccountId) {
    return res.status(403).json({
      success: false,
      message:
        "Enterprise master account binding is missing."
    });
  }

  next();
}

function requirePlatformOrMasterAdmin(
  req,
  res,
  next
) {
  const role = getUserRole(req);

  const isAllowed =
    role === USER_ROLES.PLATFORM_ADMIN ||
    role === USER_ROLES.MASTER_ADMIN;

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message:
        "Administrator permission required."
    });
  }

  if (
    role === USER_ROLES.MASTER_ADMIN &&
    !req.user.masterAccountId
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Enterprise master account binding is missing."
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
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user.role =
      normalizeUserRole(req.user.role);
  } catch {
    req.user = null;
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requirePlatformAdmin,
  requireMasterAdmin,
  requirePlatformOrMasterAdmin,
  optionalAuth
};