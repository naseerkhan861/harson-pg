const mongoose = require("mongoose");

const aigcMasterLoginTokenSchema =
  new mongoose.Schema(
    {
      /*
       * 对应 aigc_master_accounts.id。
       */
      masterAccountId: {
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
       * 迁移时必须原样保存，
       * 不解密、不重新加密。
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
      collection: "aigc_master_login_tokens",
      versionKey: false
    }
  );

module.exports =
  mongoose.models.AigcMasterLoginToken ||
  mongoose.model(
    "AigcMasterLoginToken",
    aigcMasterLoginTokenSchema
  );