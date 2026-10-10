"use strict";
module.exports = require("./aigcTokenCacheMongoFactory")({
  Model: require("./aigcSubLoginToken"),
  idField: "subAccountId", idName: "AIGC子账号ID",
  accountName: "外部子账号",
  keyNames: ["YIBAI_AIGC_TOKEN_ENCRYPTION_KEY"],
  encryptionError: "YIBAI_AIGC_TOKEN_ENCRYPTION_KEY 必须是 64 个十六进制字符",
  aadPrefix: "sub-token"
});
