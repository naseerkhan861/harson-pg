const mongoose = require("mongoose");

const {
  ALLOWED_USER_ROLES,
  LEGACY_USER_ROLES
} = require("../constants/userRoles");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ALLOWED_USER_ROLES,
      default: LEGACY_USER_ROLES.USER,
      index: true
    },

    /*
     * 企业主账号 ID。
     *
     * platform_admin：
     * masterAccountId 为 null。
     *
     * master_admin：
     * 保存自己管理的企业主账号 ID。
     *
     * member：
     * 保存自己所属的企业主账号 ID。
     */
    masterAccountId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },

    /*
     * 企业子账号 ID。
     *
     * platform_admin 和 master_admin：
     * subAccountId 为 null。
     *
     * member：
     * 保存自己的企业子账号 ID。
     */
    subAccountId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },

    lastLoginAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);