const mongoose = require("mongoose");

const aigcActiveSessionSchema =
  new mongoose.Schema(
    {
      /*
       * Harson-Base 用户业务 ID。
       * 对应 users.id。
       */
      clBaseUserId: {
        type: String,
        required: true,
        unique: true,
        index: true,
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

      status: {
        type: String,
        default: "active",
        index: true,
        trim: true
      },

      loggedInAt: {
        type: Date,
        default: null
      },

      lastActiveAt: {
        type: Date,
        default: null
      },

      loggedOutAt: {
        type: Date,
        default: null
      }
    },
    {
      collection: "aigc_active_sessions",
      versionKey: false
    }
  );

module.exports =
  mongoose.models.AigcActiveSession ||
  mongoose.model(
    "AigcActiveSession",
    aigcActiveSessionSchema
  );