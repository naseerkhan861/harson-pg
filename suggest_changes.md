# AI 电商 → 爆款视频复刻: history, link upload, pricing, and upload checks

**Repository:** [naseerkhan861/harson-pg](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Reviewed branch:** `temp-main`  
**Reviewed commit:** `0a76356343dbcb938b1079fb95f39560cc262fc6`  
**Date:** 29 October 2026

This guide provides the exact proposed source and test edits for your VS Code checkout. They were tested in an isolated local checkout; no GitHub commit, server deployment, or live paid generation was performed.

## 1. Diagnosis from your three screenshots

| User action / console entry | Exact recorded request | What the latest code does |
| --- | --- | --- |
| Click an item in 历史记录; main panel remains at 上传一个爆款参考视频 | `POST /app/proxy/viralVideoTaskDetail` → 404; `load frame history task failed` | Permits this POST for `video-generator` and, through the separate repair policy, `clothing`; it does not admit an `e-commerce` session. |
| Open 爆款视频复刻 / load billing | `POST /app/viral-video/pricing` → 404; `load viral video billing prices failed` | Permits it for `video-generator` only. |
| Confirm 通过链接上传 | `POST /app/viral-video/link/resolve` → 404 | Permits it for `video-generator` only. |
| Separate pricing error visible before the replicator errors | `POST /app/color-match/pricing` → 404 | Permits this request for `clothing` only. The guide admits this exact POST for the reported e-commerce context as well; it does not enable the remaining color-correction API. |
| After adding images | Yellow `refreshSTSToken` / `refreshSTSTokenInterval` recommendation | This is an SDK warning, not an HTTP upload failure. These screenshots do not identify a failed image-upload PUT/POST or its response. Use section 7 to check the actual upload. |

The important distinction is the **outer gateway session module**. `src/controllers/aigcSessionController.js` defines AI电商 as `e-commerce`; its menu route is `/aigc/e-commerce`. Opening a nested 爆款视频复刻 tool does not turn that session into `video-generator`. Therefore the earlier video-tab fixes do not authorize the same requests from AI 电商.

In `src/gateway/server.js`, the route allowlist returns an empty 404 before proxying if the request matches neither a configured prefix nor one of the exact exception predicates. On the reviewed branch there is no e-commerce predicate for these four requests.

The color-match pricing message may be from an earlier nested-page load in the same console capture. It is separate from the history and link-resolver failures; do not treat it as evidence that all color-match operations should be enabled for e-commerce.

## 2. What I reproduced locally

I ran the repository's **real gateway**, real launch-ticket/session flow, a stub main app, and a loopback mock YiBai provider. The mock already had successful handlers for all four screenshot paths.

| Check | Before the proposed edits | After the proposed edits |
| --- | --- | --- |
| E-commerce POST to each of the four paths | Mock provider directly: 200. Through gateway: **empty 404** for all four. | Provider's **200 JSON passed through unchanged** for all four. |
| E-commerce GET to those paths | Not the screenshot method. | Still 404. |
| Image-generator POST to those paths | Unrelated module. | Still 404. |
| Link resolver returns an upstream 500 | Provider-side failure. | Remains 500 with the original response body. |
| Existing video and clothing gateway checks | Existing fixture coverage. | Still pass. |
| Multipart upload through an already admitted fixture API prefix | Additional transport check. | Both supplied JPEG samples arrived with identical multipart byte counts and SHA-256 hashes; content type/boundary and provider cookie survived; Harson's gateway cookie was removed. |

The two earlier sample files decode as JPEG/RGB: `02.jpeg` is 194×259; `03.jpeg` is 738×393. Their successful local multipart checks establish that this gateway path preserves their bytes. They do **not** establish that YiBai's real OSS bucket, STS credentials, or live processing accepted them.

**Verification completed:** 14/14 route-policy tests passed, the complete gateway fixture passed with both actual sample images, and `git diff --check` passed. This is a local gateway reproduction, not a completed live e-commerce video workflow.

## 3. Apply the code changes in order

The exact tested unified diff is in **Appendix A**. It changes these four files:

| Order | File | Change |
| --- | --- | --- |
| 1 | `src/gateway/routePolicy.js` | Add `ECOMMERCE_EXCEPTIONS` with four exact `POST + path + e-commerce` entries; add/export `isAllowedEcommerceRequest`. |
| 2 | `src/gateway/server.js` | Import the new predicate and append it to the existing allowlist expression. |
| 3 | `src/gateway/server.js` | Add a path-specific upstream-status log for admitted e-commerce requests inside `handleProxyResponse`. |
| 4 | `tests/gateway-route-policy.test.cjs` | Test all four exact triples plus wrong method, wrong module, missing session, and nearby-path rejection. |
| 5 | `scripts/test-gateway-fixture.js` | Exercise the e-commerce session against the real gateway and mock provider; check upstream-error preservation and multipart forwarding. |

For manual implementation, put the new table and function **before the existing `module.exports`** in `routePolicy.js`, then add both names to that existing export object. In `server.js`, the tail of the allowlist expression becomes:

```js
isAllowedLocalRepairRequest(req) ||
isAllowedEcommerceRequest(req);
```

Keep the earlier prefix, replicator, and color-match checks in the same expression. The status log belongs in `handleProxyResponse(proxyRes, req, res)`, before the upstream response is copied/streamed.

The new log has this form:

```text
[gateway] e-commerce POST /app/proxy/viralVideoTaskDetail upstream status=200
```

It records method, path, and status; it does not log request bodies, query strings, submitted links, cookies, or tokens.

Keep the existing `REPLICATOR_EXCEPTIONS`, `COLOR_MATCH_EXCEPTIONS`, and `LOCAL_REPAIR_EXCEPTIONS` behavior intact. Do not relabel the session as `video-generator`, add `/app` or `/app/proxy` as an extra prefix, or make a new body parser run before the proxy.

## 4. Run the tests in your development checkout

Use the tested diff below against the reviewed commit, or apply the equivalent edits if `temp-main` has advanced. A coding agent can apply Appendix A directly. If saving it as a patch, first run `git apply --check` against that patch file, then apply it after the check passes.

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
git diff --check
```

The fixture uses loopback ports **3100–3102**. Run it in your development environment with those ports free.

To repeat the multipart check with your exact JPEG files, provide their absolute paths. Bash example:

```bash
HARSON_FIXTURE_SAMPLE_IMAGES='["/absolute/path/02.jpeg","/absolute/path/03.jpeg"]' node scripts/test-gateway-fixture.js
```

PowerShell example:

```powershell
$env:HARSON_FIXTURE_SAMPLE_IMAGES = '["C:/samples/02.jpeg","C:/samples/03.jpeg"]'
node scripts/test-gateway-fixture.js
```

The `/api/__fixture/upload-echo` endpoint in the diff exists **only inside the loopback mock provider**. Do not add it to the production gateway or deployment. The fixture already admits `/api` for its own mock traffic.

## 5. Commit and deploy the gateway

After your usual review, commit/push to `temp-main` and update the server checkout. Rebuild and recreate the gateway service:

```bash
git rev-parse --short HEAD
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway logs --since=10m gateway | grep -E 'e-commerce .*upstream status|viralVideoTaskDetail|viral-video/(pricing|link/resolve)|color-match/pricing'
```

The gateway runs its own container and keeps sessions in memory. Recreating it requires reopening/refreshing the main Harson workspace to obtain a fresh iframe session. Updating only the main app or refreshing an old iframe does not replace the gateway's running code.

## 6. Check each workflow separately after deployment

1. Open **AI 电商 → 爆款视频复刻** with a fresh session. Check that `POST /app/viral-video/pricing` reaches the provider and returns its normal JSON response. Keep the real provider pricing; do not copy the fixture's sample price into production.
2. Click one existing item in **历史记录**. Check `POST /app/proxy/viralVideoTaskDetail`, its task ID and response, then confirm the reference video/task appears in the main panel. If JSON succeeds but the media preview fails, inspect the media URL's own request separately.
3. Open **通过链接上传**, paste a complete supported link, and click **确认**. The resolver POST must pass the gateway. A provider 4xx/5xx or provider error inside HTTP 200 still needs its actual response checked; the gateway must not manufacture a successful result.
4. Add one product/reference image, and the optional model image if used. Follow the real upload request and the subsequent preview request as described in section 7.
5. Navigate to another left-panel tool and return. The outer session remains `e-commerce`, so these exact rules should keep working after nested navigation.
6. Clear the console and revisit the page that caused `POST /app/color-match/pricing`. The new exact e-commerce pricing allowance should remove a gateway-generated 404 if that call belongs to this module. It does not promise the rest of the color-correction workflow is configured.

Prefer an existing history item for the initial check; these routing checks do not require a new paid generation.

## 7. Image-upload checks: what still needs live evidence

Your third screenshot shows a yellow STS refresh recommendation after adding images. It does **not** show a failed image upload or prove expired credentials. No upload endpoint should be guessed from that warning.

In DevTools **Network**, clear the list, enable Preserve log, and add one image:

| Actual request/result | Next action |
| --- | --- |
| Image upload PUT/POST returns 2xx and the image appears | Upload succeeded for that attempt. The STS warning can be investigated separately if long-lived sessions later fail. |
| A preliminary OSS `HEAD` returns 404, followed by a successful upload and preview | The HEAD result alone does not establish a failed upload; it can be an object-existence check. Check the full sequence. |
| Request to `ai.harson-base.com` returns 404 | Use the gateway finish/upstream logs to distinguish a local policy rejection from an upstream 404. Capture its **exact method/path** before considering another scoped rule. |
| Direct request to Alibaba OSS returns 403/404, or reports expired STS credentials | The Harson route exception cannot repair an external bucket object or credentials. Inspect the real OSS response and YiBai's upload/STS flow. `file-utils-C5Qjnf3q.js` is a provider bundle, not a file in this repo. |
| Upload succeeds but image/video preview fails | Inspect the preview GET, final URL, permissions, content type, and any CORS error on that request. |

The current screenshots justify the four API exceptions in this guide. They do not justify changing the OSS endpoint/bucket, disabling CORS checks, adding placeholder upload success responses, or modifying provider STS refresh code without the actual failing response.

## 8. If a 404 or 500 remains

| Gateway evidence | Interpretation |
| --- | --- |
| Final `POST ... -> 404`, with no matching e-commerce upstream-status line | The response may still be local. Verify the running gateway contains the new predicate and that the current session is `e-commerce`. Also check for stale gateway instances or a different Nginx target. |
| `e-commerce POST ... upstream status=404` then final 404 | The request passed the new policy; YiBai returned 404. Inspect its response and the task/link/provider session. Another route exception will not change that response. |
| `e-commerce POST ... upstream status=500` then final 500 | Forwarding is working; diagnose the upstream failure using the response. The fixture explicitly tests preservation of this case. |
| HTTP 200 but the UI still fails | Check the provider's JSON business status, task ID, result fields, and any subsequent failed request. HTTP 200 alone is insufficient to establish success. |

Generic category warnings, `allowfullscreen`, and performance metrics do not explain these exact POST 404s. Keep diagnosis tied to the request that failed.

## Appendix A — exact tested source/test diff

Apply this diff to the reviewed `temp-main` baseline. It preserves the existing video and clothing rules.

```diff
diff --git a/scripts/test-gateway-fixture.js b/scripts/test-gateway-fixture.js
index 613a8fd..287e153 100644
--- a/scripts/test-gateway-fixture.js
+++ b/scripts/test-gateway-fixture.js
@@ -21,6 +21,8 @@
 const { spawn } = require("child_process");
 const http = require("http");
 const express = require("express");
+const fs = require("fs");
+const crypto = require("crypto");
 
 const INTERNAL_SECRET =
   "test-internal-secret-0001";
@@ -133,11 +135,25 @@ function startFixture() {
 
   const seenTokens = [];
 
+  // Loopback mock only: verifies multipart bytes and provider cookies
+  // survive the real gateway. This is NOT a production upload route.
+  app.post(
+    "/api/__fixture/upload-echo",
+    express.raw({ type: () => true, limit: "2mb" }),
+    (req, res) => res.json({
+      bytes: req.body.length,
+      sha256: crypto.createHash("sha256").update(req.body).digest("hex"),
+      contentType: req.headers["content-type"],
+      cookie: req.headers.cookie || ""
+    })
+  );
+
   for (const path of [
     "/aigc/image-generator",
     "/aigc/upscaler",
     "/aigc/video-generator",
-    "/aigc/clothing"
+    "/aigc/clothing",
+    "/aigc/e-commerce"
   ]) {
     app.get(
       path,
@@ -1267,6 +1283,85 @@ async function main() {
     );
     check("clothing GET viralVideoTaskDetail stays 404", clothingDetailGet.status === 404);
 
+    const ecommerceSession = await withSession(
+      "e-commerce", "/aigc/e-commerce?embed=2"
+    );
+    for (const apiPath of [
+      "/app/proxy/viralVideoTaskDetail",
+      "/app/viral-video/pricing",
+      "/app/viral-video/link/resolve",
+      "/app/color-match/pricing"
+    ]) {
+      const upstreamRes = await request(`${FIXTURE_ORIGIN}${apiPath}`, { method: "POST" });
+      const ecommerceRes = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method: "POST",
+        headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
+      });
+      check(
+        `e-commerce POST ${apiPath} reaches mock provider unchanged`,
+        upstreamRes.status === 200 && ecommerceRes.status === 200 &&
+          ecommerceRes.body.equals(upstreamRes.body)
+      );
+
+      const ecommerceGet = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
+      });
+      check(`e-commerce GET ${apiPath} stays 404`, ecommerceGet.status === 404);
+
+      const imagePost = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method: "POST",
+        headers: { Cookie: `harson_aigc_gateway=${first.sessionId}` }
+      });
+      check(`image POST ${apiPath} stays 404`, imagePost.status === 404);
+    }
+
+    const ecommerceUpstreamFailure = await request(
+      `${GATEWAY_ORIGIN}/app/viral-video/link/resolve?fail=1`,
+      {
+        method: "POST",
+        headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
+      }
+    );
+    check(
+      "e-commerce upstream resolver 500 retains original status and body",
+      ecommerceUpstreamFailure.status === 500 &&
+        JSON.parse(ecommerceUpstreamFailure.body.toString()).message === "fixture upstream failure"
+    );
+
+    // Optional real image paths for this local-only fixture. With no env
+    // configured, still exercise binary multipart bytes using a small buffer.
+    const samplePaths = JSON.parse(process.env.HARSON_FIXTURE_SAMPLE_IMAGES || "[]");
+    const uploadSamples = samplePaths.length
+      ? samplePaths.map(file => fs.readFileSync(file))
+      : [Buffer.from([0xff, 0xd8, 0x00, 0x80, 0xff, 0xd9])];
+    const boundary = "harson-fixture-boundary";
+    const contentType = `multipart/form-data; boundary=${boundary}`;
+    for (const [index, sample] of uploadSamples.entries()) {
+      const multipart = Buffer.concat([
+        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.jpeg"\r\nContent-Type: image/jpeg\r\n\r\n`),
+        sample,
+        Buffer.from(`\r\n--${boundary}--\r\n`)
+      ]);
+      const uploadRes = await request(`${GATEWAY_ORIGIN}/api/__fixture/upload-echo`, {
+        method: "POST",
+        headers: {
+          "Content-Type": contentType,
+          "Content-Length": multipart.length,
+          Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}; provider_sid=fixture-ecommerce`
+        },
+        body: multipart
+      });
+      const uploadData = JSON.parse(uploadRes.body.toString());
+      check(
+        `e-commerce multipart sample ${index + 1} bytes/content-type/cookie pass through`,
+        uploadRes.status === 200 &&
+          uploadData.bytes === multipart.length &&
+          uploadData.sha256 === crypto.createHash("sha256").update(multipart).digest("hex") &&
+          uploadData.contentType === contentType &&
+          uploadData.cookie === "provider_sid=fixture-ecommerce"
+      );
+    }
+
     /* 8. JSON passthrough (extra path) + no-store */
     const jsonRes =
       await request(
diff --git a/src/gateway/routePolicy.js b/src/gateway/routePolicy.js
index 361ec31..16c00fd 100644
--- a/src/gateway/routePolicy.js
+++ b/src/gateway/routePolicy.js
@@ -178,11 +178,53 @@ function isAllowedLocalRepairRequest(req) {
   );
 }
 
+/*
+  AI 电商: exact POSTs shown in the supplied e-commerce screenshots.
+  Nested tools retain the outer e-commerce gateway session module.
+  The supplied console also includes a separate color-match pricing call.
+*/
+const ECOMMERCE_EXCEPTIONS = Object.freeze([
+  {
+    method: "POST",
+    path: "/app/proxy/viralVideoTaskDetail",
+    module: "e-commerce",
+    reason: "open a viral video replicator task from history"
+  },
+  {
+    method: "POST",
+    path: "/app/viral-video/pricing",
+    module: "e-commerce",
+    reason: "load viral video replicator billing prices"
+  },
+  {
+    method: "POST",
+    path: "/app/viral-video/link/resolve",
+    module: "e-commerce",
+    reason: "resolve a supported reference video link"
+  },
+  {
+    method: "POST",
+    path: "/app/color-match/pricing",
+    module: "e-commerce",
+    reason: "load color-match pricing during e-commerce navigation"
+  }
+]);
+
+function isAllowedEcommerceRequest(req) {
+  return ECOMMERCE_EXCEPTIONS.some(entry =>
+    req.harsonGatewaySession?.moduleName === entry.module &&
+    req.method === entry.method &&
+    req.path === entry.path
+  );
+}
+
 module.exports = {
   isAllowedReplicatorRequest,
   REPLICATOR_EXCEPTIONS,
   isAllowedColorMatchRequest,
   COLOR_MATCH_EXCEPTIONS,
   isAllowedLocalRepairRequest,
-  LOCAL_REPAIR_EXCEPTIONS
+  LOCAL_REPAIR_EXCEPTIONS,
+  isAllowedEcommerceRequest,
+  ECOMMERCE_EXCEPTIONS
 };
diff --git a/src/gateway/server.js b/src/gateway/server.js
index b276706..10cb8b9 100644
--- a/src/gateway/server.js
+++ b/src/gateway/server.js
@@ -47,7 +47,8 @@ const {
 const {
   isAllowedReplicatorRequest,
   isAllowedColorMatchRequest,
-  isAllowedLocalRepairRequest
+  isAllowedLocalRepairRequest,
+  isAllowedEcommerceRequest
 } = require("./routePolicy");
 const {
   removeGatewayCookie,
@@ -744,7 +745,9 @@ app.use(async (req, res, next) => {
       exact recorded POST, confirmed by console, finish log and local
       reproduction.
     */
-    isAllowedLocalRepairRequest(req);
+    isAllowedLocalRepairRequest(req) ||
+    /* AI 电商: four recorded POST/method/session-module triples. */
+    isAllowedEcommerceRequest(req);
 
   if (!allowed) {
     return res.status(404).end();
@@ -913,6 +916,12 @@ async function handleProxyResponse(
     );
   }
 
+  if (isAllowedEcommerceRequest(req)) {
+    console.info(
+      `[gateway] e-commerce ${req.method} ${req.path} upstream status=${proxyRes.statusCode}`
+    );
+  }
+
   rewriteLocationHeader(
     proxyRes
   );
diff --git a/tests/gateway-route-policy.test.cjs b/tests/gateway-route-policy.test.cjs
index 849b4c6..1c3abde 100644
--- a/tests/gateway-route-policy.test.cjs
+++ b/tests/gateway-route-policy.test.cjs
@@ -14,7 +14,9 @@ const {
   isAllowedColorMatchRequest,
   COLOR_MATCH_EXCEPTIONS,
   isAllowedLocalRepairRequest,
-  LOCAL_REPAIR_EXCEPTIONS
+  LOCAL_REPAIR_EXCEPTIONS,
+  isAllowedEcommerceRequest,
+  ECOMMERCE_EXCEPTIONS
 } = require("../src/gateway/routePolicy.js");
 
 function request({ method, path, module }) {
@@ -27,6 +29,43 @@ function request({ method, path, module }) {
   };
 }
 
+test("e-commerce exceptions match the four screenshot-recorded POSTs", () => {
+  assert.deepEqual(
+    ECOMMERCE_EXCEPTIONS.map(({ method, path, module }) => ({ method, path, module })),
+    [
+      "/app/proxy/viralVideoTaskDetail",
+      "/app/viral-video/pricing",
+      "/app/viral-video/link/resolve",
+      "/app/color-match/pricing"
+    ].map(path => ({ method: "POST", path, module: "e-commerce" }))
+  );
+  for (const entry of ECOMMERCE_EXCEPTIONS) {
+    assert.equal(isAllowedEcommerceRequest(request(entry)), true);
+  }
+});
+
+test("e-commerce exceptions reject other methods, modules, and nearby paths", () => {
+  for (const entry of ECOMMERCE_EXCEPTIONS) {
+    for (const method of ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]) {
+      assert.equal(isAllowedEcommerceRequest(request({ ...entry, method })), false);
+    }
+    for (const module of ["clothing", "video-generator", "image-generator", undefined]) {
+      assert.equal(isAllowedEcommerceRequest(request({ ...entry, module })), false);
+    }
+    for (const path of [`${entry.path}/extra`, `${entry.path}s`]) {
+      assert.equal(isAllowedEcommerceRequest(request({ ...entry, path })), false);
+    }
+  }
+  for (const path of [
+    "/app", "/app/proxy", "/app/proxy/otherEndpoint",
+    "/app/color-match/cast-correction-sessions"
+  ]) {
+    assert.equal(isAllowedEcommerceRequest(request({
+      method: "POST", path, module: "e-commerce"
+    })), false);
+  }
+});
+
 test("admits the three verified replicator endpoints for video-generator", () => {
   assert.equal(
     isAllowedReplicatorRequest(
```

