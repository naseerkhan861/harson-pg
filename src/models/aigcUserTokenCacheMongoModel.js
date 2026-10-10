"use strict";
module.exports = require("./aigcTokenCacheMongoFactory")({
  Model: require("./aigcUserDataToken"),
  idField: "masterAccountId", idName: "AIGC企业主账号ID",
  accountName: "YiBai外部账号",
  keyNames: ["YIBAI_USER_DATA_TOKEN_ENCRYPTION_KEY", "YIBAI_AIGC_TOKEN_ENCRYPTION_KEY"],
  encryptionError: "用户端 Token 加密密钥必须是 64 个十六进制字符"
});
