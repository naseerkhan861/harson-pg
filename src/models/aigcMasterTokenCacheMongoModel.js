"use strict";
module.exports = require("./aigcTokenCacheMongoFactory")({
  Model: require("./aigcMasterLoginToken"),
  idField: "masterAccountId", idName: "AIGC企业主账号ID",
  accountName: "YiBai外部账号",
  keyNames: ["YIBAI_AIGC_TOKEN_ENCRYPTION_KEY"],
  encryptionError: "YIBAI_AIGC_TOKEN_ENCRYPTION_KEY 必须是 64 个十六进制字符"
});
