const mongoose = require("mongoose");

const aigcMasterProviderAccountSchema =
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
       * 以下字段均为现有加密数据。
       * CSV → MongoDB 时必须原样保存，
       * 不重新加密。
       */
      encryptionVersion: {
        type: String,
        default: "",
        trim: true
      },

      encryptedPassword: {
        type: String,
        required: true
      },

      passwordIv: {
        type: String,
        required: true
      },

      passwordAuthTag: {
        type: String,
        required: true
      },

      pointsField: {
        type: String,
        default: "",
        trim: true
      },

      syncedTotalCredits: {
        type: Number,
        default: 0,
        min: 0
      },

      providerCompanyId: {
        type: String,
        default: "",
        trim: true
      },

      providerCompanyName: {
        type: String,
        default: "",
        trim: true
      },

      providerMemberId: {
        type: String,
        default: "",
        trim: true
      },

      providerMemberName: {
        type: String,
        default: "",
        trim: true
      },

      status: {
        type: String,
        default: "active",
        index: true,
        trim: true
      },

      lastSyncedAt: {
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
      collection:
        "aigc_master_provider_accounts",

      versionKey: false
    }
  );

module.exports =
  mongoose.models.AigcMasterProviderAccount ||
  mongoose.model(
    "AigcMasterProviderAccount",
    aigcMasterProviderAccountSchema
  );