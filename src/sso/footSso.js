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
 * 票据内容（base64url 编码的 JSON，字段名必须与对端 DTO 同名）：
 *  { Sub, Email, Name, Role, Aud: "harson-foot", Exp }
 *
 * 安全性：
 *  - HMAC-SHA256 签名防止内容被篡改/伪造（密钥仅存在于两端服务器）。
 *  - Exp 短有效期（默认 60 秒）防止长期重放。
 *  - Aud 固定为 "harson-foot"，HarsonFOOT 侧校验，防止票据被用于别处。
 *
 * 对端实现说明（对照 HarsonFOOT 源码 + 实测确认，2026-10-12）：
 *  HarsonFOOT（ASP.NET Core 8）backend/Services/SsoTicketService.cs 的校验规则：
 *   1. sig 是 hmacsha256(key, p) 的**大写十六进制**字符串
 *      （对端用 Convert.ToHexString，再做常量时间比较且区分大小写）。
 *   2. p 解码后的 JSON 直接反序列化到 SsoIdentity 类，
 *      JsonSerializer.Deserialize 默认**区分大小写**，
 *      所以字段名必须是 PascalCase 的 Sub/Email/Name/Role/Aud/Exp；
 *      若用小写会全部落空（Aud 变成空串），最终报 sso_invalid。
 *   3. 校验通过后 302 到 /sso/callback?token=...&role=...；
 *      失败一律 302 /login?error=sso_invalid；
 *      缺少 p/sig 时返回 400 application/problem+json。
 *
 *  注意：对端 SSO_INTEGRATION.md 里写的 payload 是小写字段名，与其实现不符，
 *  以源码/实测为准（小写字段名实测必然失败）。
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
    .digest("hex")
    .toUpperCase();
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

  // 字段名必须是 PascalCase：对端 JsonSerializer.Deserialize 默认区分大小写，
  // 小写键名会导致 Aud 落空并被判为 sso_invalid。
  const payload = {
    Sub: String(user?.id || ""),
    Email: String(user?.email || "").toLowerCase(),
    Name: String(user?.name || user?.email || ""),
    Role: String(user?.role || "user"),
    Aud: EXPECTED_AUDIENCE,
    Exp: Math.floor(Date.now() / 1000) + ttlSeconds
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
