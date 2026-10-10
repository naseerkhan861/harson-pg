const mongoose = require("mongoose");

const aigcSubProviderAccountSchema =
  new mongoose.Schema(
    {
      /*
       * 对应 aigc_sub_accounts.id。
       */
      subAccountId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      /*
       * 对应 aigc_master_accounts.id。
       */
      masterAccountId: {
        type: String,
        required: true,
        index: true,
        trim: true
      },

      providerAccount: {
        type: String,
        required: true,
        trim: true
      },

      /*
       * 以下为现有加密凭据。
       * CSV → MongoDB 时原样保存。
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

      syncedTokenBalance: {
        type: Number,
        default: 0,
        min: 0
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
        "aigc_sub_provider_accounts",

      versionKey: false
    }
  );

module.exports =
  mongoose.models.AigcSubProviderAccount ||
  mongoose.model(
    "AigcSubProviderAccount",
    aigcSubProviderAccountSchema
  );