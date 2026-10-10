const mongoose = require("mongoose");

const accountMappingSchema =
  new mongoose.Schema(
    {
      /*
       * Harson 账号映射业务 ID。
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
       * Harson-Base 用户业务 ID。
       * 对应 users.id，不是 users._id。
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

      /*
       * 对应 aigc_sub_accounts.id。
       */
      aigcSubAccountId: {
        type: String,
        required: true,
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
        "account_mappings",

      versionKey: false
    }
  );

/*
 * 一个 Harson-Base 用户只能有一个 active 子账号映射。
 *
 * disabled 历史记录可以继续保留。
 */
accountMappingSchema.index(
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
  mongoose.models.AccountMapping ||
  mongoose.model(
    "AccountMapping",
    accountMappingSchema
  );