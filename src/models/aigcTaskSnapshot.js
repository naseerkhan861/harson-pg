const mongoose = require("mongoose");

const aigcTaskSnapshotSchema =
  new mongoose.Schema(
    {
      /*
       * 对应 aigc_master_accounts.id。
       */
      masterAccountId: {
        type: String,
        required: true,
        trim: true
      },

      /*
       * 外部平台任务 ID。
       */
      providerTaskId: {
        type: String,
        required: true,
        trim: true
      },

      memberId: {
        type: String,
        default: "",
        trim: true
      },

      memberName: {
        type: String,
        default: "",
        trim: true
      },

      companyId: {
        type: String,
        default: "",
        trim: true
      },

      companyName: {
        type: String,
        default: "",
        trim: true
      },

      object: {
        type: String,
        default: "",
        trim: true
      },

      objectName: {
        type: String,
        default: "",
        trim: true
      },

      status: {
        type: String,
        default: "",
        index: true,
        trim: true
      },

      point: {
        type: Number,
        default: 0
      },

      refundedPoint: {
        type: Number,
        default: 0
      },

      netPoint: {
        type: Number,
        default: 0
      },

      imageUrl: {
        type: String,
        default: "",
        trim: true
      },

      imageWidth: {
        type: Number,
        default: 0
      },

      imageHeight: {
        type: Number,
        default: 0
      },

      dateCreate: {
        type: Date,
        default: null
      },

      dateEnd: {
        type: Date,
        default: null
      },

      syncedAt: {
        type: Date,
        default: null
      }
    },
    {
      collection:
        "aigc_task_snapshots",

      versionKey: false
    }
  );

/*
 * 同一个企业主账号下，
 * 同一个外部任务只能保存一条快照。
 *
 * 这是现有 CSV Model 的正式业务唯一键。
 */
aigcTaskSnapshotSchema.index(
  {
    masterAccountId: 1,
    providerTaskId: 1
  },
  {
    unique: true
  }
);

/*
 * Dashboard / 用户数据查询时
 * 会经常按企业主账号查询任务。
 */
aigcTaskSnapshotSchema.index(
  {
    masterAccountId: 1
  }
);

module.exports =
  mongoose.models.AigcTaskSnapshot ||
  mongoose.model(
    "AigcTaskSnapshot",
    aigcTaskSnapshotSchema
  );