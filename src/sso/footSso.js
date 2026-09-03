const crypto = require("crypto");

/**
 * HarsonFOOT（3D 足型测量平台）免登录跳转票据
 *
 * 流程：
 *  1. 用户在 HARSON 平台已登录（harson_token cookie 有效）。
 *  2. 前端调用 GET /api/sso/foot-entry，本模块签发一张 60 秒有效的
 *     HMAC-SHA256 签名票据。
 *  3. 前端 window.location.href 跳转到 HarsonFOOT 的
 *     /api/auth/sso-login?p=<base64url>&sig=<hex>，由 HarsonFOOT
 *     使用共享密钥本地验签，验证通过后签发它自己的登录凭证。
 *
 * 票据内容（base64url 编码的 JSON）：
 *  { sub, email, name, role, aud: "harson-foot", exp }
 *
 * 安全性：
 *  - HMAC-SHA256 签名防止内容被篡改/伪造（密钥仅存在于两端服务器）。
 *  - exp 短有效期（默认 60 秒）防止长期重放。
 *  - aud 固定为 "harson-foot"，HarsonFOOT 侧校验，防止票据被用于别处。
 */

const DEFAULT_TTL_SECONDS = 60;
const EXPECTED_AUDIENCE = "harson-foot";

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function computeSignature(encodedPayload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload, "utf8")
    .digest("hex");
}

/**
 * 为当前登录用户生成跳转到 HarsonFOOT 的完整 URL。
 *
 * @param {{id: string, email: string, name?: string, role?: string}} user
 *   requireAuth 中间件解析出的当前用户。
 * @returns {string|null} 完整跳转 URL；配置缺失时返回 null。
 */
function createFootSsoUrl(user) {
  const baseUrl = String(process.env.SSO_FOOT_BASE_URL || "").replace(/\/+$/, "");
  const secret = String(process.env.SSO_FOOT_SHARED_SECRET || "");
  const ttlSeconds = Number(process.env.SSO_FOOT_TTL_SECONDS) || DEFAULT_TTL_SECONDS;

  if (!baseUrl || !secret) {
    return null;
  }

  const payload = {
    sub: String(user?.id || ""),
    email: String(user?.email || "").toLowerCase(),
    name: String(user?.name || user?.email || ""),
    role: String(user?.role || "user"),
    aud: EXPECTED_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(encodedPayload, secret);

  return `${baseUrl}/api/auth/sso-login?p=${encodedPayload}&sig=${signature}`;
}

module.exports = {
  createFootSsoUrl,
  computeSignature,
  base64UrlEncode,
  DEFAULT_TTL_SECONDS,
  EXPECTED_AUDIENCE
};