# 爆款视频复刻：通过链接上传返回 500 — `temp-main` 实施指南

**Repository:** [`naseerkhan861/harson-pg`, branch `temp-main`](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Affected flow:** 视频创作 → 爆款视频复刻 → 通过链接上传 → 确认  
**Gateway:** `https://ai.harson-base.com`  
**Prepared:** 28 October 2026  
**Scope:** Instructions and code to apply in your own VS Code checkout. This document has not changed the GitHub repository or production server.

## 1. What changed since the previous 404

The new screenshots show:

```text
POST https://ai.harson-base.com/app/viral-video/link/resolve
500 Internal Server Error
```

The latest `temp-main` **already contains** the exact `POST` exception in `src/gateway/routePolicy.js` and tests for it in `tests/gateway-route-policy.test.cjs`. Do not add another exception or widen `YIBAI_GATEWAY_EXTRA_PATHS`. The browser now receives a 500 rather than the former 404. The request can be passing the gateway's path gate, but the console alone does **not** identify whether Nginx, the Harson gateway, or YiBai emitted the 500.

The code provides a useful clue: for ordinary JSON/API responses, `src/gateway/server.js` forwards the **upstream status code and body** (`handleProxyResponse`, around lines 1003–1025). Its explicit proxy network error handler returns **502**, and its denied-route handler returns **404**. Therefore an upstream 500 is likely, subject to verification with the response and gateway logs. The repeated `aigc-workspace.js:747` model-category warnings and `allowfullscreen` warning are separate from this request.

Two concrete weaknesses in the current proxy are worth fixing and testing:

1. `selfHandleResponse: true` makes the gateway responsible for outgoing headers. The current `cookieDomainRewrite: ""` option does not run in the library's normal outgoing response passes, while `copyResponseHeaders()` copies the upstream `Set-Cookie` verbatim. A cookie with `Domain=yibaiaigc.com` cannot become a cookie for `ai.harson-base.com` in the browser. Whether this particular resolver requires such a cookie remains to be checked.
2. The gateway cookie is read at the session gate but the original `Cookie` request header is subsequently proxied as-is. The Harson gateway session cookie should not be sent to YiBai. Other provider cookies should continue to pass through.

Neither weakness alone proves the cause of the shown 500. The changes below correct them without modifying URL input, request payload, model names, or the vendor's UI JavaScript.

## 2. First establish which component returns the 500

Use Chrome DevTools **Network**, select the failed `link/resolve` request, and inspect **Headers**, **Response**, and **Payload** locally. Record only the following non-secret facts:

- Request method/path, response status, response `Content-Type`, whether the response is JSON or HTML, and the vendor's **error code/category** if one exists.
- Whether a provider `Cookie` header is present (cookie **names only**) and whether earlier proxied YiBai responses attempted `Set-Cookie` with a `Domain=yibaiaigc.com` attribute. Use the browser's Issues/Application panel to check for rejected cookies.
- Whether the **same link** works in YiBai's original, signed-in interface. Also try one clearly valid, public, supported link; the screenshot displays only a truncated URL.

Do not copy a HAR file, provider token, cookies, session ticket, a private link, or the complete response body to a public issue. Do not use a browser-console `fetch` to an unrelated host. The vendor may return a 500 for an invalid, inaccessible, expired, or rate-limited Xiaohongshu item; a 500 does not prove the proxy changed the submitted URL.

## 3. Exact code changes for proxy headers and status provenance

### 3A. Add `src/gateway/proxyHeaders.js`

This module makes the two header transformations testable without importing `server.js` (which calls `app.listen()` during import). Keep cookie values out of logs.

```js
"use strict";

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
```

This preserves each cookie's value, `Path`, `Secure`, `HttpOnly`, `SameSite`, and multiple independent `Set-Cookie` headers. It removes `Domain` only when the domain is the actual configured YiBai target host or one of its parent domains.

### 3B. Apply it in `src/gateway/server.js`

Next to the existing import from `./routePolicy`, add:

```js
const {
  removeGatewayCookie,
  rewriteProviderSetCookie
} = require("./proxyHeaders");
```

In the existing `copyResponseHeaders(proxyRes, overrides)`, after constructing `headers` from `proxyRes.headers` and before returning it, add:

```js
if (headers["set-cookie"]) {
  headers["set-cookie"] = rewriteProviderSetCookie(
    headers["set-cookie"],
    UPSTREAM_ORIGIN
  );
}
```

Keep its existing `content-length` and `transfer-encoding` removal and the `...overrides` return. This single insertion covers both the HTML-injection and non-HTML response paths. Remove `cookieDomainRewrite: ""` from the `createProxyMiddleware` options so it does not misleadingly imply an automatic rewrite is active while `selfHandleResponse: true` remains in use.

In the existing `createProxyMiddleware({ ..., on: { ... } })` object, add `proxyReq` **beside** `proxyRes` and `error`:

```js
on: {
  proxyReq: (proxyReq, req) => {
    const providerCookies = removeGatewayCookie(
      req.headers.cookie,
      SESSION_COOKIE_NAME
    );
    if (providerCookies) {
      proxyReq.setHeader("cookie", providerCookies);
    } else {
      proxyReq.removeHeader("cookie");
    }
  },
  proxyRes: handleProxyResponse,
  error: handleProxyError
}
```

This filters only the Harson gateway's session cookie; it does not strip the provider's login cookies or parse/rewrite the POST body. There are two gateway-cookie names in `server.js` depending on `YIBAI_FRAME_PUBLIC_ORIGIN`, and `SESSION_COOKIE_NAME` handles both.

At the **start** of `handleProxyResponse(proxyRes, req, res)`, before the existing `rewriteLocationHeader(proxyRes)` call, add a narrowly scoped status log:

```js
if (
  req.method === "POST" &&
  req.path === "/app/viral-video/link/resolve"
) {
  console.info(
    `[gateway] link/resolve upstream status=${proxyRes.statusCode}`
  );
}
```

The existing `res.on("finish")` log already records the **final** response status. The new line records only a status from an actual YiBai response. It does not read or buffer the response body, log the submitted link, expose cookies, or alter the status. A completed request might now produce two status-only lines.

### 3C. Add focused tests in `tests/gateway-proxy-headers.test.cjs`

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  removeGatewayCookie,
  rewriteProviderSetCookie
} = require("../src/gateway/proxyHeaders.js");

test("removes only the gateway session cookie", () => {
  assert.equal(
    removeGatewayCookie(
      "provider_sid=one; __Host-harson_aigc=private==; other=two",
      "__Host-harson_aigc"
    ),
    "provider_sid=one; other=two"
  );
  assert.equal(
    removeGatewayCookie("harson_aigc_gateway=private", "harson_aigc_gateway"),
    ""
  );
});

test("rewrites only provider cookie domains and keeps separate headers", () => {
  assert.deepEqual(
    rewriteProviderSetCookie(
      [
        "sid=abc; Domain=.yibaiaigc.com; Path=/; HttpOnly; Secure; SameSite=None",
        "other=xyz; Domain=unrelated.example; Path=/"
      ],
      "https://cl-base.yibaiaigc.com"
    ),
    [
      "sid=abc; Path=/; HttpOnly; Secure; SameSite=None",
      "other=xyz; Domain=unrelated.example; Path=/"
    ]
  );
});
```

Run:

```bash
node --test tests/gateway-proxy-headers.test.cjs tests/gateway-route-policy.test.cjs
node --test tests/image-tab-injection.test.cjs
```

These are focused tests for identity/security behavior and the existing three exact viral-video routes. If your test setup has a mock upstream, add one integration check: a resolver POST must reach that upstream with the same JSON body and provider cookies but **without** the Harson session cookie; a fake `Set-Cookie: Domain=.yibaiaigc.com` must reach the browser without that Domain attribute; upstream 500 must remain 500 with its original body. Avoid network calls to the real provider in automated tests.

## 4. Deploy and classify the outcome

Pull your reviewed `temp-main` changes onto the server, then rebuild the **gateway service**, which is separate from `app` in `docker-compose.yml`:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway exec gateway grep -n 'link/resolve upstream status' /app/src/gateway/server.js
docker compose logs --tail=100 gateway
```

Confirm the running gateway contains the new code. A single browser refresh after deployment is enough to establish a fresh iframe session; there should be no extra iframe reload on each link submission. Retry with a supported public link. Read the status-only log and the failed request's **Network → Response**, then follow this table:

| Observation | Interpretation | Action |
| --- | --- | --- |
| No `[gateway] link/resolve upstream status=...` line, but browser sees 500 | The response did not reach this gateway proxy response handler, or a different gateway/Nginx instance served it | Check `docker compose ps`, deployed image, Nginx routing for `ai.harson-base.com`, and gateway error logs. Do not edit the vendor URL. |
| Log says `upstream status=500` and browser says 500 | YiBai returned 500 to the proxy; Harson forwarded it | Compare direct-provider result and response code/category. Continue with Section 5 only if the same link succeeds directly. |
| Log says `upstream status=200` but browser still says 500 | Harson response handling or Nginx is failing after the upstream response | Inspect gateway stack trace and the response-header path; the proxy handler should preserve the upstream status. |
| 200 after the cookie fixes | Cookie/session flow was the likely cause | Confirm video preview and `下一步` work; verify other YiBai tabs still log in normally. |
| 400/422 | Vendor now returned a validation error rather than a proxy error | Correct the link according to the vendor's actual message; do not mask it with a generic toast. |
| 500 both via `ai.harson-base.com` and the direct YiBai interface using the same authorized account/link | Vendor resolver, the link, or vendor availability is the leading issue | Try a supported working link and report the vendor's request ID/error category to YiBai; Harson cannot guarantee vendor-side extraction from its gateway. |

## 5. Only if direct YiBai succeeds but the gateway still gets upstream 500

Compare, **without disclosing secret values**, the direct-provider and proxied requests: target host, method/path, content type, payload field names and sizes, presence of provider cookies, `Origin`, and `Referer`. The current gateway sets `changeOrigin: true`, which changes the target **Host** header; it does not by itself guarantee that `Origin` and `Referer` match the provider origin. If the provider rejects only the proxied origin, the following optional, **resolver-only** normalization may be warranted:

```js
// Add inside the existing proxyReq callback, after the cookie filtering.
if (
  req.method === "POST" &&
  req.path === "/app/viral-video/link/resolve" &&
  PUBLIC_ORIGIN &&
  req.headers.origin === PUBLIC_ORIGIN
) {
  const targetOrigin = new URL(UPSTREAM_ORIGIN).origin;
  proxyReq.setHeader("origin", targetOrigin);

  try {
    const originalReferer = new URL(String(req.headers.referer || ""));
    if (originalReferer.origin === PUBLIC_ORIGIN) {
      proxyReq.setHeader(
        "referer",
        targetOrigin + originalReferer.pathname + originalReferer.search
      );
    }
  } catch {
    // An absent/invalid Referer is left alone.
  }
}
```

Apply this only after the direct-vs-proxy comparison points to an origin/referrer mismatch. Keep the existing `video-generator` session gate and exact allowlist; test that other paths are not rewritten. Do not broaden the rewrite to all API requests, disable TLS verification, add `/app` to the prefix list, bypass CSRF/session checks, or build a generic server-side URL fetcher for Xiaohongshu links. Such changes would create security and compatibility problems without establishing the real cause.

## 6. Completion criteria

- With a valid supported link, `POST /app/viral-video/link/resolve` returns a successful provider response, the video is accepted into the tool, and the user can proceed.
- The gateway never sends `__Host-harson_aigc` / `harson_aigc_gateway` to YiBai, while YiBai login cookies still work.
- Provider cookies with a target domain are accepted by the browser under `ai.harson-base.com` when necessary; separate `Set-Cookie` headers are preserved.
- A provider 4xx/5xx stays visible as the original provider status; the gateway does not silently change it to 200.
- Existing `viralVideoTaskDetail`, pricing, local upload, history, names/aliases, and other navigation paths still work.

**Limit of what can be concluded now:** the screenshots establish an HTTP 500 for the resolver, and `temp-main` establishes the two proxy header flaws above. The vendor's 500 response body, request headers, gateway runtime log, and result from the same link on the original provider interface were not provided. It would be misleading to promise a single code change will fix a vendor-generated 500 without those checks.

**Technical reference:** [http-proxy-middleware documentation](https://github.com/chimurai/http-proxy-middleware/blob/master/README.md) explains that `selfHandleResponse` skips ordinary outgoing passes and `changeOrigin` changes the Host header; the repository pins `http-proxy-middleware` at `3.0.7`.
