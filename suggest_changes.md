# AI 电商 → 参考图校色 → 偏色校正: session POST 404 fix

**Repository:** [naseerkhan861/harson-pg](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Reviewed branch/commit:** `temp-main` at `f55b84deb076fe0462c1731abd9dd781dda6f015`  
**Date:** 29 October 2026

## 1. What the screenshot establishes

After selecting the shoe and pressing **开始校色 ⚡ 5**, the screenshot shows:

```text
本地校色服务请求失败

POST https://ai.harson-base.com/app/color-match/cast-correction-sessions
404 (Not Found)
```

This is a failed **cast-correction session request**. The separate yellow STS refresh recommendation does not establish expired credentials or an upload failure. Do not change the OSS bucket or SDK refresh settings to address this POST 404.

The latest reviewed commit changes `suggest_changes.md`. The executable `src/gateway/routePolicy.js` still contains only the four e-commerce entries from the earlier replicator fix. Applying the source/test changes below is required; updating the proposal document alone does not change the running gateway.

## 2. Why the clothing fix does not cover AI 电商

The outer **AI 电商** gateway session uses `moduleName: "e-commerce"`. Opening 参考图校色 does not change it to `clothing`.

The reviewed policy already admits the session POST, session GET, UUID process POST and UUID DELETE for **clothing**. Its e-commerce table admits `POST /app/color-match/pricing`, but does not admit the failing session request or the known follow-up calls.

The allowlist in `src/gateway/server.js` returns an empty 404 before forwarding a request that matches no configured prefix or exception predicate. This is a reproducible policy gap, not a model-name or CSS issue.

## 3. Route changes for this workflow

Keep the four existing e-commerce entries. Add these four exact requests and two strict UUID patterns:

| Method | Path | Evidence / reason |
| --- | --- | --- |
| POST | `/app/color-match/cast-correction-sessions` | Exact failing request in the new screenshot |
| GET | `/app/color-match/cast-correction-sessions` | Reviewed working clothing session-refresh contract |
| POST | `/app/color-match/cast-correction-sessions/<UUID>/process` | Reviewed working clothing processing contract |
| DELETE | `/app/color-match/cast-correction-sessions/<UUID>` | Reviewed working clothing session-removal contract |
| GET | `/app/color-match/pricing` | Reviewed working clothing pricing refresh |
| POST | `/app/local-repair/pricing` | Shared pricing request already reviewed in the clothing color-match policy |

The existing `POST /app/color-match/pricing` remains valid. On this baseline the e-commerce table will contain **eight exact entries**, plus **two anchored UUID patterns**.

The screenshot directly confirms the session POST. The additional operations are mirrored from the reviewed clothing contract and verified against the local provider fixture; they are not new live e-commerce Network captures.

## 4. Exact implementation steps

The complete diff is in **Appendix A**. It was generated from the tested local changes against the reviewed commit.

1. **`src/gateway/routePolicy.js`:** append the four exact entries to `ECOMMERCE_EXCEPTIONS`; add private `ECOMMERCE_PATTERNS`; extend `isAllowedEcommerceRequest` to check both tables. Reuse the existing `UUID_SEGMENT`.
2. **`src/gateway/server.js`:** update the old comment describing four POST rules. Its executable integration already imports/calls `isAllowedEcommerceRequest` and logs upstream status, so no additional proxy or middleware is needed.
3. **`tests/gateway-route-policy.test.cjs`:** update the expected e-commerce table and method matrix. Remove the obsolete assertion that the session-root POST is forbidden; add strict UUID-route checks.
4. **`scripts/test-gateway-fixture.js`:** make the original color-pricing GET expect 200; test all six added operations through a real e-commerce gateway session and compare responses with the mock provider.

Do not add broad `/app`, `/app/proxy` or `/app/color-match` prefixes to `YIBAI_GATEWAY_EXTRA_PATHS`. Keep the session's outer module as `e-commerce`; do not relabel it as clothing. No request-body parsing or provider response substitution is needed.

If your development checkout has advanced beyond this commit, merge these exact rules without deleting additional reviewed rules already present. Do not create duplicate table entries or duplicate pattern constants.

## 5. Local reproduction and test results

I ran the real gateway with the repository's launch-ticket/session flow and a loopback mock provider.

| Check | Before | After |
| --- | --- | --- |
| Each of the six operations in section 3 | Direct mock provider: 200. Gateway under e-commerce: **empty 404**. | Gateway: **200**, with the mock provider's JSON passed through unchanged. |
| Same six operations under an image-generator session | Unrelated module | Remains 404. |
| Wrong methods, malformed UUIDs and extra path suffixes | Must be rejected | Remain rejected by the policy tests. |
| Existing video and clothing policy cases | Existing behavior | Still pass. |

**Completed verification:**

- `node --test tests/gateway-route-policy.test.cjs`: **15/15 passed**.
- `node scripts/test-gateway-fixture.js`: **all checks passed**, including the new e-commerce color-match requests and existing session/cookie, upstream-error and multipart checks.
- `git diff --check`: passed.

These results establish gateway forwarding with a mock provider. They do not establish a completed live YiBai color-correction operation. No GitHub commit or server deployment was performed.

## 6. Apply and validate in your VS Code checkout

Apply Appendix A to the reviewed baseline, or make the equivalent edits in your newer checkout. If copying the diff to a patch file, first use `git apply --check` on that file before applying it.

Run:

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
git diff --check
```

The fixture uses loopback ports **3100–3102**. Run it in your development environment with those ports free.

The mock provider already implements the session, process, delete and pricing handlers. Do not copy its handlers, sample prices or sample results into the production gateway.

## 7. Deploy the updated gateway

After reviewing, committing/pushing, and updating the server checkout:

```bash
git rev-parse --short HEAD
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway logs --since=10m gateway | grep -E 'e-commerce .*upstream status|cast-correction-sessions|color-match/pricing|local-repair/pricing'
```

Reopen/refresh the main Harson workspace after recreating the gateway. Its sessions are held in memory, so an old iframe may need a fresh launch ticket.

Updating only the main app container or the Markdown proposal does not replace the running gateway code.

## 8. Verify the actual color-correction flow

1. Open **AI 电商 → 参考图校色 → 偏色校正** with a fresh session.
2. In DevTools Network, clear the old requests and upload the shoe image.
3. Click **开始校色** once.
4. Check the response to `POST /app/color-match/cast-correction-sessions`.
5. Check the following POST to `/app/color-match/cast-correction-sessions/<UUID>/process`, using the returned session ID.
6. Inspect the provider's JSON business status and result-image URL, then verify the result-image request succeeds.
7. If the UI refreshes or deletes a session, verify its GET/DELETE request separately.

A successful session request alone is not the complete result. The provider process and result-image request must also succeed.

## 9. If the red message persists

| Observation | Meaning / next step |
| --- | --- |
| Final `POST ...cast-correction-sessions -> 404`, without the corresponding e-commerce upstream-status line | Verify the deployed gateway contains the new rules, the iframe session module is `e-commerce`, and traffic reaches the updated gateway instance. |
| `[gateway] e-commerce POST /app/color-match/cast-correction-sessions upstream status=404` | The new rule forwarded the request; YiBai returned the 404. Inspect the actual Network response and provider session. Another gateway exception will not alter that response. |
| Upstream status 500 | Forwarding succeeded; inspect the provider error response. Do not return a fake 200 from Harson. |
| HTTP 200 but a red UI message | Inspect the JSON business error, returned session ID and subsequent process request. HTTP 200 alone does not establish success. |
| An OSS request fails | Inspect that actual upload PUT/POST or image GET separately. The yellow STS recommendation is not proof of an upload failure. |

For a remaining failure, capture the exact request method/path, redacted request/response JSON, and corresponding gateway status lines. Keep cookies, tokens and signed URLs out of shared logs.

## Appendix A — exact tested diff

This focused diff addresses the color-correction workflow against the reviewed commit.

```diff
diff --git a/scripts/test-gateway-fixture.js b/scripts/test-gateway-fixture.js
index 287e153..0e410f0 100644
--- a/scripts/test-gateway-fixture.js
+++ b/scripts/test-gateway-fixture.js
@@ -1306,7 +1306,11 @@ async function main() {
       const ecommerceGet = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
         headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
       });
-      check(`e-commerce GET ${apiPath} stays 404`, ecommerceGet.status === 404);
+      const expectedGetStatus = apiPath === "/app/color-match/pricing" ? 200 : 404;
+      check(
+        `e-commerce GET ${apiPath} returns ${expectedGetStatus}`,
+        ecommerceGet.status === expectedGetStatus
+      );
 
       const imagePost = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
         method: "POST",
@@ -1315,6 +1319,34 @@ async function main() {
       check(`image POST ${apiPath} stays 404`, imagePost.status === 404);
     }
 
+    const ecommerceColorRequests = [
+      ["GET", "/app/color-match/pricing"],
+      ["POST", "/app/local-repair/pricing"],
+      ["POST", "/app/color-match/cast-correction-sessions"],
+      ["GET", "/app/color-match/cast-correction-sessions"],
+      ["POST", `/app/color-match/cast-correction-sessions/${SESSION_ID}/process`],
+      ["DELETE", `/app/color-match/cast-correction-sessions/${SESSION_ID}`]
+    ];
+    for (const [method, apiPath] of ecommerceColorRequests) {
+      const direct = await request(`${FIXTURE_ORIGIN}${apiPath}`, { method });
+      const proxied = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method,
+        headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
+      });
+      check(
+        `e-commerce color-match ${method} ${apiPath} reaches provider unchanged`,
+        direct.status === 200 && proxied.status === 200 && proxied.body.equals(direct.body)
+      );
+      const wrongModule = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method,
+        headers: { Cookie: `harson_aigc_gateway=${first.sessionId}` }
+      });
+      check(
+        `image session ${method} ${apiPath} stays 404`,
+        wrongModule.status === 404
+      );
+    }
+
     const ecommerceUpstreamFailure = await request(
       `${GATEWAY_ORIGIN}/app/viral-video/link/resolve?fail=1`,
       {
diff --git a/src/gateway/routePolicy.js b/src/gateway/routePolicy.js
index 16c00fd..351ed28 100644
--- a/src/gateway/routePolicy.js
+++ b/src/gateway/routePolicy.js
@@ -179,9 +179,10 @@ function isAllowedLocalRepairRequest(req) {
 }
 
 /*
-  AI 电商: exact POSTs shown in the supplied e-commerce screenshots.
+  AI 电商: exact shared-tool requests, scoped to the outer session module.
   Nested tools retain the outer e-commerce gateway session module.
-  The supplied console also includes a separate color-match pricing call.
+  Color-match session POST is confirmed by the supplied screenshot;
+  its follow-up operations mirror the reviewed clothing contract.
 */
 const ECOMMERCE_EXCEPTIONS = Object.freeze([
   {
@@ -207,14 +208,62 @@ const ECOMMERCE_EXCEPTIONS = Object.freeze([
     path: "/app/color-match/pricing",
     module: "e-commerce",
     reason: "load color-match pricing during e-commerce navigation"
+  },
+  {
+    method: "GET",
+    path: "/app/color-match/pricing",
+    module: "e-commerce",
+    reason: "refresh color-match pricing"
+  },
+  {
+    method: "POST",
+    path: "/app/local-repair/pricing",
+    module: "e-commerce",
+    reason: "load the shared color-match/local-repair pricing contract"
+  },
+  {
+    method: "POST",
+    path: "/app/color-match/cast-correction-sessions",
+    module: "e-commerce",
+    reason: "allow the screenshot-confirmed cast-correction session operation"
+  },
+  {
+    method: "GET",
+    path: "/app/color-match/cast-correction-sessions",
+    module: "e-commerce",
+    reason: "refresh cast-correction sessions"
+  }
+]);
+
+const ECOMMERCE_PATTERNS = Object.freeze([
+  {
+    method: "POST",
+    pattern: new RegExp(
+      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}/process$`,
+      "i"
+    ),
+    module: "e-commerce"
+  },
+  {
+    method: "DELETE",
+    pattern: new RegExp(
+      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}$`,
+      "i"
+    ),
+    module: "e-commerce"
   }
 ]);
 
 function isAllowedEcommerceRequest(req) {
+  const moduleName = req.harsonGatewaySession?.moduleName;
   return ECOMMERCE_EXCEPTIONS.some(entry =>
-    req.harsonGatewaySession?.moduleName === entry.module &&
+    moduleName === entry.module &&
     req.method === entry.method &&
     req.path === entry.path
+  ) || ECOMMERCE_PATTERNS.some(entry =>
+    moduleName === entry.module &&
+    req.method === entry.method &&
+    entry.pattern.test(req.path)
   );
 }
 
diff --git a/src/gateway/server.js b/src/gateway/server.js
index 10cb8b9..7b2a2a9 100644
--- a/src/gateway/server.js
+++ b/src/gateway/server.js
@@ -746,7 +746,7 @@ app.use(async (req, res, next) => {
       reproduction.
     */
     isAllowedLocalRepairRequest(req) ||
-    /* AI 电商: four recorded POST/method/session-module triples. */
+    /* AI 电商: reviewed exact method/session routes and strict UUID patterns. */
     isAllowedEcommerceRequest(req);
 
   if (!allowed) {
diff --git a/tests/gateway-route-policy.test.cjs b/tests/gateway-route-policy.test.cjs
index 1c3abde..68b853e 100644
--- a/tests/gateway-route-policy.test.cjs
+++ b/tests/gateway-route-policy.test.cjs
@@ -29,26 +29,45 @@ function request({ method, path, module }) {
   };
 }
 
-test("e-commerce exceptions match the four screenshot-recorded POSTs", () => {
+const ecommerceExpectedPairs = [
+  ["POST", "/app/proxy/viralVideoTaskDetail"],
+  ["POST", "/app/viral-video/pricing"],
+  ["POST", "/app/viral-video/link/resolve"],
+  ["POST", "/app/color-match/pricing"],
+  ["GET", "/app/color-match/pricing"],
+  ["POST", "/app/local-repair/pricing"],
+  ["POST", "/app/color-match/cast-correction-sessions"],
+  ["GET", "/app/color-match/cast-correction-sessions"]
+];
+const ecommerceExpectedKeys = new Set(
+  ecommerceExpectedPairs.map(([method, path]) => `${method} ${path}`)
+);
+
+test("e-commerce exact rules match the reviewed color-match contract", () => {
   assert.deepEqual(
-    ECOMMERCE_EXCEPTIONS.map(({ method, path, module }) => ({ method, path, module })),
-    [
-      "/app/proxy/viralVideoTaskDetail",
-      "/app/viral-video/pricing",
-      "/app/viral-video/link/resolve",
-      "/app/color-match/pricing"
-    ].map(path => ({ method: "POST", path, module: "e-commerce" }))
+    ECOMMERCE_EXCEPTIONS.map(entry =>
+      `${entry.method} ${entry.path} ${entry.module}`
+    ).sort(),
+    ecommerceExpectedPairs.map(([method, path]) =>
+      `${method} ${path} e-commerce`
+    ).sort()
   );
   for (const entry of ECOMMERCE_EXCEPTIONS) {
     assert.equal(isAllowedEcommerceRequest(request(entry)), true);
   }
 });
 
-test("e-commerce exceptions reject other methods, modules, and nearby paths", () => {
-  for (const entry of ECOMMERCE_EXCEPTIONS) {
-    for (const method of ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]) {
-      assert.equal(isAllowedEcommerceRequest(request({ ...entry, method })), false);
+test("e-commerce method/module/path matrix remains exact", () => {
+  const paths = [...new Set(ecommerceExpectedPairs.map(pair => pair[1]))];
+  for (const path of paths) {
+    for (const method of ["POST", "GET", "HEAD", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
+      assert.equal(
+        isAllowedEcommerceRequest(request({ method, path, module: "e-commerce" })),
+        ecommerceExpectedKeys.has(`${method} ${path}`)
+      );
     }
+  }
+  for (const entry of ECOMMERCE_EXCEPTIONS) {
     for (const module of ["clothing", "video-generator", "image-generator", undefined]) {
       assert.equal(isAllowedEcommerceRequest(request({ ...entry, module })), false);
     }
@@ -57,8 +76,7 @@ test("e-commerce exceptions reject other methods, modules, and nearby paths", ()
     }
   }
   for (const path of [
-    "/app", "/app/proxy", "/app/proxy/otherEndpoint",
-    "/app/color-match/cast-correction-sessions"
+    "/app", "/app/proxy", "/app/proxy/otherEndpoint"
   ]) {
     assert.equal(isAllowedEcommerceRequest(request({
       method: "POST", path, module: "e-commerce"
@@ -66,6 +84,34 @@ test("e-commerce exceptions reject other methods, modules, and nearby paths", ()
   }
 });
 
+test("e-commerce cast-correction session UUID operations are strict", () => {
+  const id = "62f614d0-23ac-4e89-afd4-c175fe60e9c7";
+  const root = "/app/color-match/cast-correction-sessions/";
+  for (const [method, path] of [
+    ["POST", root + id + "/process"],
+    ["DELETE", root + id]
+  ]) {
+    assert.equal(isAllowedEcommerceRequest(request({
+      method, path, module: "e-commerce"
+    })), true);
+    for (const wrongMethod of ["POST", "GET", "HEAD", "PUT", "DELETE", "PATCH"].filter(m => m !== method)) {
+      assert.equal(isAllowedEcommerceRequest(request({
+        method: wrongMethod, path, module: "e-commerce"
+      })), false);
+    }
+    for (const module of ["clothing", "video-generator", "image-generator", undefined]) {
+      assert.equal(isAllowedEcommerceRequest(request({ method, path, module })), false);
+    }
+    for (const badPath of [
+      path + "/extra", path.replace(id, "not-a-uuid"), path.replace(id, id + "a")
+    ]) {
+      assert.equal(isAllowedEcommerceRequest(request({
+        method, path: badPath, module: "e-commerce"
+      })), false);
+    }
+  }
+});
+
 test("admits the three verified replicator endpoints for video-generator", () => {
   assert.equal(
     isAllowedReplicatorRequest(
```

