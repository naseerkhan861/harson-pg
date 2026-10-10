const mongoose = require("mongoose");

const aigcSubAccountSchema =
  new mongoose.Schema(
    {
      /*
       * Harson 内部 AIGC 子账号业务 ID。
       * 保留原 CSV nanoid，不使用 MongoDB _id 替代。
       */
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      /*
       * 所属 Harson 企业主账号业务 ID。
       */
      masterAccountId: {
        type: String,
        required: true,
        index: true,
        trim: true
      },

      subAccountName: {
        type: String,
        required: true,
        trim: true
      },

      platformLogin: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true
      },

      /*
       * 现有 bcrypt hash 原样迁移。
       */
      platformPasswordHash: {
        type: String,
        required: true
      },

      tokenLimit: {
        type: Number,
        default: 0,
        min: 0
      },

      warningThreshold: {
        type: Number,
        default: 10,
        min: 1,
        max: 100
      },

      status: {
        type: String,
        default: "active",
        trim: true
      },

      createdAt: {
        type: Date,
        default: Date.now
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection:
        "aigc_sub_accounts",

      versionKey: false
    }
  );

module.exports =
  mongoose.models.aigcSubAccount ||
  mongoose.model(
    "aigcSubAccount",
    aigcSubAccountSchema
  );