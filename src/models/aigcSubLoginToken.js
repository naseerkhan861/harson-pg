const mongoose = require("mongoose");

const aigcSubLoginTokenSchema =
  new mongoose.Schema(
    {
      /*
       * 对应 aigc_sub_accounts.id。
       *
       * 注意：
       * 现有子账号 Token 加密使用了
       * subAccountId + providerAccount 参与 AAD，
       * 所以这两个字段迁移时绝不能修改。
       */
      subAccountId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      providerAccount: {
        type: String,
        required: true,
        trim: true
      },

      /*
       * 已加密 Token。
       * 必须原样保存。
       */
      encryptedToken: {
        type: String,
        required: true
      },

      iv: {
        type: String,
        required: true
      },

      authTag: {
        type: String,
        required: true
      },

      status: {
        type: String,
        default: "active",
        index: true,
        trim: true
      },

      lastValidatedAt: {
        type: Date,
        default: null
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
      collection: "aigc_sub_login_tokens",
      versionKey: false
    }
  );

module.exports =
  mongoose.models.AigcSubLoginToken ||
  mongoose.model(
    "AigcSubLoginToken",
    aigcSubLoginTokenSchema
  );