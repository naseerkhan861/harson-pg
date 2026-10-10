const mongoose = require("mongoose");

const aigcMasterOwnerMappingSchema =
  new mongoose.Schema(
    {
      /*
       * Harson 内部负责人映射业务 ID。
       * 保留原 CSV nanoid。
       */
      id: {
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
        trim: true
      },

      /*
       * 对应 users.id。
       */
      clBaseUserId: {
        type: String,
        required: true,
        trim: true
      },

      clBaseEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
      },

      mappingStatus: {
        type: String,
        default: "active",
        index: true,
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
        "aigc_master_owner_mappings",

      versionKey: false
    }
  );

/*
 * 一个企业主账号只能存在一个 active 负责人。
 */
aigcMasterOwnerMappingSchema.index(
  {
    masterAccountId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      mappingStatus: "active"
    }
  }
);

/*
 * 一个 Harson-Base 用户只能作为一个
 * active 企业主账号负责人。
 */
aigcMasterOwnerMappingSchema.index(
  {
    clBaseUserId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      mappingStatus: "active"
    }
  }
);

module.exports =
  mongoose.models.AigcMasterOwnerMapping ||
  mongoose.model(
    "AigcMasterOwnerMapping",
    aigcMasterOwnerMappingSchema
  );