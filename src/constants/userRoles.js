"use strict";

const USER_ROLES = Object.freeze({
  PLATFORM_ADMIN: "platform_admin",
  MASTER_ADMIN: "master_admin",
  MEMBER: "member"
});

/*
 * 兼容当前数据库中的旧角色。
 *
 * admin：
 * 现有平台管理员，后续等同于 platform_admin。
 *
 * user：
 * 现有普通用户，过渡期间等同于 member。
 */
const LEGACY_USER_ROLES = Object.freeze({
  ADMIN: "admin",
  USER: "user"
});

const ALLOWED_USER_ROLES = Object.freeze([
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.MASTER_ADMIN,
  USER_ROLES.MEMBER,
  LEGACY_USER_ROLES.ADMIN,
  LEGACY_USER_ROLES.USER
]);

function normalizeUserRole(role) {
  const normalizedRole = String(role || "").trim();

  if (normalizedRole === LEGACY_USER_ROLES.ADMIN) {
    return USER_ROLES.PLATFORM_ADMIN;
  }

  if (normalizedRole === LEGACY_USER_ROLES.USER) {
    return USER_ROLES.MEMBER;
  }

  return normalizedRole;
}

module.exports = {
  USER_ROLES,
  LEGACY_USER_ROLES,
  ALLOWED_USER_ROLES,
  normalizeUserRole
};