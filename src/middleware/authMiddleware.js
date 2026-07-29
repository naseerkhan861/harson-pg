"use strict";

const jwt = require("jsonwebtoken");
const userCsvModel = require(
  "../models/userCsvModel"
);

const {
  USER_ROLES,
  normalizeUserRole
} = require("../constants/userRoles");


async function requireAuth(
  req,
  res,
  next
) {
  const token =
    req.cookies?.harson_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message:
        "Authentication required."
    });
  }

  try {
    const tokenUser =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    const currentUser =
      await userCsvModel.findById(
        tokenUser.id
      );

    if (
      !currentUser ||
      !currentUser.isActive
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Current account is unavailable."
      });
    }

    /*
     * JWT 只用于确认登录身份。
     * 角色和账号层级必须使用
     * secure CSV 中的最新数据。
     */
    req.user = {
      ...tokenUser,
      ...currentUser,

      role:
        normalizeUserRole(
          currentUser.role
        )
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token."
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

function requireMember(
  req,
  res,
  next
) {
  if (
    getUserRole(req) !==
    USER_ROLES.MEMBER
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Enterprise member permission required."
    });
  }

  const masterAccountId =
    String(
      req.user?.masterAccountId || ""
    ).trim();

  const subAccountId =
    String(
      req.user?.subAccountId || ""
    ).trim();

  if (
    !masterAccountId ||
    !subAccountId
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Enterprise member account binding is missing."
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
  requireMember,
  requirePlatformOrMasterAdmin,
  optionalAuth
};