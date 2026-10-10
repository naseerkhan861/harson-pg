const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    /*
     * Harson-Base 业务 ID。
     *
     * 第一阶段迁移必须保留 CSV 中原来的 nanoid，
     * 不能使用 MongoDB _id 替代。
     */
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true
    },

    /*
     * 直接保存现有 bcrypt hash。
     * CSV → MongoDB 迁移时不能重新生成密码。
     */
    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      default: "user",
      trim: true
    },

    gender: {
      type: String,
      default: "",
      trim: true
    },

    ageGroup: {
      type: String,
      default: "",
      trim: true
    },

    createdAt: {
      type: Date,
      default: Date.now
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
    collection: "users",
    versionKey: false
  }
);

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);
