"use strict";

/*
  Testable proxy-header transformations for the YiBai gateway
  (suggest_changes.md §3A, 28 October 2026).

  - removeGatewayCookie: strips ONLY the Harson gateway session cookie
    from an outgoing Cookie header; provider login cookies pass through.
  - rewriteProviderSetCookie: with selfHandleResponse active, upstream
    Set-Cookie headers are copied verbatim, so a Domain=yibaiaigc.com
    attribute would be rejected by the browser on ai.harson-base.com.
    The Domain attribute is removed only when it belongs to the
    configured upstream host or one of its parent domains; unrelated
    domains are left untouched (the browser rejects those itself).
    Values, Path, Secure, HttpOnly, SameSite and multiple independent
    Set-Cookie headers are preserved. Cookie values are never logged.
*/

function removeGatewayCookie(rawCookie, gatewayCookieName) {
  return String(rawCookie || "")
    .split(";")
    .map(part => part.trim())
    .filter(part => {
      const equals = part.indexOf("=");
      return equals > 0 &&
        part.slice(0, equals).trim() !== gatewayCookieName;
    })
    .join("; ");
}

function rewriteProviderSetCookie(value, upstreamOrigin) {
  if (value == null) return value;

  const upstreamHost = new URL(upstreamOrigin).hostname.toLowerCase();

  function rewriteOne(cookie) {
    return String(cookie).replace(
      /;\s*domain\s*=\s*([^;]+)/gi,
      (attribute, rawDomain) => {
        const domain = rawDomain.trim().replace(/^\./, "").toLowerCase();
        const belongsToUpstream =
          upstreamHost === domain ||
          upstreamHost.endsWith(`.${domain}`);

        // No Domain attribute means host-only on ai.harson-base.com.
        // Leave unrelated domains untouched; the browser will reject them.
        return belongsToUpstream ? "" : attribute;
      }
    );
  }

  return Array.isArray(value) ? value.map(rewriteOne) : rewriteOne(value);
}

module.exports = { removeGatewayCookie, rewriteProviderSetCookie };
