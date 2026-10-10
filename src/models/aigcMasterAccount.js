const mongoose = require("mongoose");

const aigcMasterAccountSchema =
  new mongoose.Schema(
    {
      /*
       * Harson 内部企业主账号业务 ID。
       * 必须保留原 CSV 中的 nanoid。
       */
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      enterpriseName: {
        type: String,
        required: true,
        trim: true
      },

      platformName: {
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
       * 保留现有 bcrypt hash。
       * CSV → MongoDB 时不重新生成。
       */
      platformPasswordHash: {
        type: String,
        required: true
      },

      totalCredits: {
        type: Number,
        default: 0,
        min: 0
      },

      usedCredits: {
        type: Number,
        default: 0,
        min: 0
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
        "aigc_master_accounts",

      versionKey: false
    }
  );

module.exports =
  mongoose.models.aigcMasterAccount ||
  mongoose.model(
    "aigcMasterAccount",
    aigcMasterAccountSchema
  );