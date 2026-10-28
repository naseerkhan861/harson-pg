# AI 图案设计 → 参考图校色: history, pricing and session 404 fixes

**Repository:** [naseerkhan861/harson-pg](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Reviewed branch/commit:** `temp-main` at `52c22b23d56441ea6c41fffa29e1830a4e08fdb1`  
**Date:** 29 October 2026

This guide contains the exact proposed source/test changes for your development checkout. They were tested locally using the real gateway and a mock provider. No GitHub commit, production deployment or live paid generation was performed.

## 1. What the two screenshots show

| Action | Exact failed request | Effect |
| --- | --- | --- |
| Open 参考图校色 / load its price | `POST /app/color-match/pricing` → 404 | Pricing fails to load. |
| Click a right-panel history item | `POST /app/proxy/viralVideoTaskDetail` → 404 | The UI cannot fetch the selected task's details to restore its inputs/result. |
| Select 偏色校正, upload the shoe and press 开始校色 | `POST /app/color-match/cast-correction-sessions` → 404 | Red toast: `本地校色服务请求失败`. |

These three exact POSTs are visible in the screenshots. The SDK's yellow STS refresh recommendation is a separate message, not proof of an expired token or failed upload.

## 2. Root cause in the reviewed source

`src/controllers/aigcSessionController.js` maps **AI图案设计** to the gateway module **`pattern-design`**.

The existing gateway rules admit the shared requests for clothing, e-commerce, or the video module as appropriate. They do not admit the screenshot requests under a pattern-design session. Opening a nested 参考图校色 page keeps that outer session module.

In `src/gateway/server.js`, a request that matches neither the configured prefixes nor an exact exception predicate receives an empty 404 before the provider is called.

The previous clothing/e-commerce fixes are already in this baseline. A new pattern-design-specific rule is needed for this workflow.

## 3. Requests covered by the proposed rule

All entries below require the authenticated gateway session module to be `pattern-design`.

| Method | Path | Basis |
| --- | --- | --- |
| POST | `/app/proxy/viralVideoTaskDetail` | Screenshot-confirmed history-detail failure |
| POST | `/app/color-match/pricing` | Screenshot-confirmed pricing failure |
| GET | `/app/color-match/pricing` | Reviewed shared pricing-refresh contract |
| POST | `/app/local-repair/pricing` | Shared pricing request reviewed in the working clothing/e-commerce color-match policy |
| POST | `/app/color-match/cast-correction-sessions` | Screenshot-confirmed session failure |
| GET | `/app/color-match/cast-correction-sessions` | Reviewed shared session-refresh contract |
| POST | `/app/color-match/cast-correction-sessions/<UUID>/process` | Reviewed 偏色校正 processing contract |
| DELETE | `/app/color-match/cast-correction-sessions/<UUID>` | Reviewed session-removal contract |

This is **six exact entries and two anchored UUID patterns**. The screenshot directly establishes three POST failures; the supporting operations mirror the already-reviewed working shared-tool contract.

## 4. Apply the changes in this order

**Appendix A contains the complete tested diff for all four files.**

### Step 1 — route policy

File: `src/gateway/routePolicy.js`

Before `module.exports`, add:

- `PATTERN_COLOR_MATCH_EXCEPTIONS`: the six exact method/path/module entries.
- `PATTERN_COLOR_MATCH_PATTERNS`: the process POST and session DELETE regexes, reusing the existing `UUID_SEGMENT`.
- `isAllowedPatternColorMatchRequest(req)`: check session module, method and exact path or strict regex.

Add the predicate and exact-entry table to the **existing** export object. The regex table can remain private.

Do not rename the session to clothing/e-commerce or replace the existing rules. Do not add broad `/app`, `/app/proxy` or `/app/color-match` prefixes.

### Step 2 — gateway integration

File: `src/gateway/server.js`

Import the new predicate alongside the existing ones. Append it to the current allowlist expression:

```js
isAllowedEcommerceRequest(req) ||
isAllowedPatternColorMatchRequest(req);
```

Keep all the preceding prefix, video, clothing and e-commerce checks.

Inside `handleProxyResponse`, add the status-only log from Appendix A:

```js
if (isAllowedPatternColorMatchRequest(req)) {
  console.info(
    `[gateway] pattern-design ${req.method} ${req.path} upstream status=${proxyRes.statusCode}`
  );
}
```

This records method, path and status. It does not log query strings, image bodies, submitted URLs, cookies or tokens. No new body parser or fabricated provider response is needed.

### Step 3 — policy tests

File: `tests/gateway-route-policy.test.cjs`

Add the new imports and tests for:

- Exactly the six reviewed entries.
- The method/path acceptance matrix.
- Wrong modules and missing sessions.
- UUID shape, wrong methods and extra suffixes.
- Rejection of unrelated operations.

The existing clothing, e-commerce and video tests remain in place.

### Step 4 — full gateway fixture

File: `scripts/test-gateway-fixture.js`

Add the mock HTML menu path `/aigc/pattern-design` and obtain a real fixture-issued pattern-design session. Exercise all eight operations through the real gateway and compare their JSON responses with the mock provider.

The mock provider already has the necessary shared handlers. The added HTML path is fixture scaffolding, not a new production API.

Keep the existing cookie, upload transport, upstream-error and other-module regression checks.

## 5. Local reproduction and results

Before the policy edit, all eight operations in section 3 returned **200 directly from the mock provider**, but **empty 404 through the gateway** when using a pattern-design session.

After the edit:

| Check | Result |
| --- | --- |
| Eight reviewed operations through pattern-design gateway session | 200, with the provider's JSON unchanged |
| Same operations through image-generator session | Still 404 |
| GET on the task-detail path | Still 404 |
| PUT on the session collection | Still 404 |
| Unrelated records operation | Still 404 |
| Existing clothing/e-commerce/video checks | Still pass |

Completed:

- `node --test tests/gateway-route-policy.test.cjs`: **19/19 passed**.
- `node scripts/test-gateway-fixture.js`: **all checks passed**.
- `git diff --check`: passed.

This establishes the gateway policy defect and corrected forwarding against a mock provider. It does not establish a completed live YiBai operation or restored real history item.

## 6. Apply and test in your VS Code checkout

Apply Appendix A against the reviewed baseline, or merge equivalent additions if your branch has advanced. Preserve newer reviewed rules. If using a patch file, run `git apply --check` against it before applying.

Run:

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
git diff --check
```

The fixture requires free loopback ports **3100–3102**. Its sample prices/results are test data and must not be copied into production behavior.

## 7. Deploy the updated gateway

After your usual review, commit/push and server-checkout update:

```bash
git rev-parse --short HEAD
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway logs --since=10m gateway | grep -E 'pattern-design .*upstream status|viralVideoTaskDetail|cast-correction-sessions|color-match/pricing|local-repair/pricing'
```

Reopen/refresh the main Harson workspace afterward to obtain a fresh iframe session; gateway sessions are kept in memory.

Updating only the main app container or `suggest_changes.md` does not replace the running gateway code.

## 8. Verify history selection and generation separately

### History selection

1. Open **AI 图案设计 → 参考图校色**.
2. Clear DevTools Network, then click one existing right-panel history item.
3. Check `POST /app/proxy/viralVideoTaskDetail`.
4. Verify the response refers to the selected task and contains the expected provider data.
5. Confirm the correct route/mode, inputs and result are restored.
6. If JSON succeeds but an image remains blank, inspect that image's own GET and URL.

Do not replace the history click handler or frame bridge to work around a task-detail request that is still returning 404.

### 偏色校正

1. Select **偏色校正** and upload the image.
2. Click **开始校色** once.
3. Inspect the session POST response.
4. Check the subsequent POST to the returned UUID's `/process` route.
5. Inspect the provider's JSON business status and result-image request.
6. Verify refresh/delete calls if those UI operations are used.

The reviewed generation contract here is the known 偏色校正 session flow. The screenshots also show the 整图还原正确颜色 mode before history selection, but do not show that mode's own generation request. If a different mode still fails after these observed requests succeed, capture its actual method/path/response before adding another exact rule.

## 9. If errors remain after deployment

| Evidence | Meaning / next step |
| --- | --- |
| Final 404 with no matching pattern-design upstream-status line | Verify the deployed gateway code, current session module and Nginx target; the request may still be rejected locally or reaching a stale instance. |
| `pattern-design ... upstream status=404` | The new rule forwarded the request and YiBai returned 404. Inspect the actual response, task/session ID and provider session. |
| Upstream 500 | Forwarding succeeded; inspect the provider error. Do not hide it with a fake 200. |
| HTTP 200 but a red toast or blank panel | Check the JSON business result, expected task/session fields and subsequent requests. HTTP 200 alone does not establish success. |
| Yellow STS refresh recommendation | Inspect the actual upload PUT/POST if upload failure is suspected. The warning alone does not prove expired credentials. |

The category warnings from `aigc-workspace.js:747`, `allowfullscreen`, performance metrics and frame-bridge MessageEvent logs do not explain the three exact POST 404s.

Capture exact method/path, redacted response JSON and the corresponding gateway status line for any remaining failure. Keep tokens, cookies and signed URLs out of shared logs.

## Appendix A — exact tested diff

Apply to the reviewed `52c22b2` baseline, preserving the preceding clothing/e-commerce fixes.

```diff
diff --git a/scripts/test-gateway-fixture.js b/scripts/test-gateway-fixture.js
index 75dc67d..234e9b5 100644
--- a/scripts/test-gateway-fixture.js
+++ b/scripts/test-gateway-fixture.js
@@ -153,7 +153,8 @@ function startFixture() {
     "/aigc/upscaler",
     "/aigc/video-generator",
     "/aigc/clothing",
-    "/aigc/e-commerce"
+    "/aigc/e-commerce",
+    "/aigc/pattern-design"
   ]) {
     app.get(
       path,
@@ -1376,6 +1377,48 @@ async function main() {
       }
     }
 
+    const patternSession = await withSession(
+      "pattern-design", "/aigc/pattern-design?embed=2"
+    );
+    const patternColorRequests = [
+      ["POST", "/app/proxy/viralVideoTaskDetail"],
+      ["POST", "/app/color-match/pricing"],
+      ["GET", "/app/color-match/pricing"],
+      ["POST", "/app/local-repair/pricing"],
+      ["POST", "/app/color-match/cast-correction-sessions"],
+      ["GET", "/app/color-match/cast-correction-sessions"],
+      ["POST", `/app/color-match/cast-correction-sessions/${SESSION_ID}/process`],
+      ["DELETE", `/app/color-match/cast-correction-sessions/${SESSION_ID}`]
+    ];
+    for (const [method, apiPath] of patternColorRequests) {
+      const direct = await request(`${FIXTURE_ORIGIN}${apiPath}`, { method });
+      const proxied = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method,
+        headers: { Cookie: `harson_aigc_gateway=${patternSession.sessionId}` }
+      });
+      check(
+        `pattern-design color-match ${method} ${apiPath} reaches provider unchanged`,
+        direct.status === 200 && proxied.status === 200 && proxied.body.equals(direct.body)
+      );
+      const wrongModule = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method,
+        headers: { Cookie: `harson_aigc_gateway=${first.sessionId}` }
+      });
+      check(`image session ${method} ${apiPath} stays 404`, wrongModule.status === 404);
+    }
+
+    for (const [method, apiPath] of [
+      ["GET", "/app/proxy/viralVideoTaskDetail"],
+      ["PUT", "/app/color-match/cast-correction-sessions"],
+      ["POST", "/app/proxy/viralVideoRecords"]
+    ]) {
+      const denied = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method,
+        headers: { Cookie: `harson_aigc_gateway=${patternSession.sessionId}` }
+      });
+      check(`pattern-design ${method} ${apiPath} stays 404`, denied.status === 404);
+    }
+
     const ecommerceUpstreamFailure = await request(
       `${GATEWAY_ORIGIN}/app/viral-video/link/resolve?fail=1`,
       {
diff --git a/src/gateway/routePolicy.js b/src/gateway/routePolicy.js
index 4ec72df..2a935a4 100644
--- a/src/gateway/routePolicy.js
+++ b/src/gateway/routePolicy.js
@@ -279,6 +279,82 @@ function isAllowedEcommerceRequest(req) {
   );
 }
 
+/*
+  AI 图案设计 → 参考图校色 keeps the outer pattern-design session.
+  The screenshot confirms POST pricing, history detail, and session calls;
+  follow-up color-match operations mirror the reviewed shared contract.
+*/
+const PATTERN_COLOR_MATCH_EXCEPTIONS = Object.freeze([
+  {
+    method: "POST",
+    path: "/app/proxy/viralVideoTaskDetail",
+    module: "pattern-design",
+    reason: "restore a reference color-match task from history"
+  },
+  {
+    method: "POST",
+    path: "/app/color-match/pricing",
+    module: "pattern-design",
+    reason: "load color-match pricing"
+  },
+  {
+    method: "GET",
+    path: "/app/color-match/pricing",
+    module: "pattern-design",
+    reason: "refresh color-match pricing"
+  },
+  {
+    method: "POST",
+    path: "/app/local-repair/pricing",
+    module: "pattern-design",
+    reason: "load shared color-match/local-repair pricing"
+  },
+  {
+    method: "POST",
+    path: "/app/color-match/cast-correction-sessions",
+    module: "pattern-design",
+    reason: "allow the screenshot-confirmed cast-correction session operation"
+  },
+  {
+    method: "GET",
+    path: "/app/color-match/cast-correction-sessions",
+    module: "pattern-design",
+    reason: "refresh cast-correction sessions"
+  }
+]);
+
+const PATTERN_COLOR_MATCH_PATTERNS = Object.freeze([
+  {
+    method: "POST",
+    pattern: new RegExp(
+      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}/process$`,
+      "i"
+    ),
+    module: "pattern-design"
+  },
+  {
+    method: "DELETE",
+    pattern: new RegExp(
+      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}$`,
+      "i"
+    ),
+    module: "pattern-design"
+  }
+]);
+
+function isAllowedPatternColorMatchRequest(req) {
+  const moduleName = req.harsonGatewaySession?.moduleName;
+  return PATTERN_COLOR_MATCH_EXCEPTIONS.some(entry =>
+    moduleName === entry.module &&
+    req.method === entry.method &&
+    req.path === entry.path
+  ) || PATTERN_COLOR_MATCH_PATTERNS.some(entry =>
+    moduleName === entry.module &&
+    req.method === entry.method &&
+    entry.pattern.test(req.path)
+  );
+}
+
 module.exports = {
   isAllowedReplicatorRequest,
   REPLICATOR_EXCEPTIONS,
@@ -287,5 +363,7 @@ module.exports = {
   isAllowedLocalRepairRequest,
   LOCAL_REPAIR_EXCEPTIONS,
   isAllowedEcommerceRequest,
-  ECOMMERCE_EXCEPTIONS
+  ECOMMERCE_EXCEPTIONS,
+  isAllowedPatternColorMatchRequest,
+  PATTERN_COLOR_MATCH_EXCEPTIONS
 };
diff --git a/src/gateway/server.js b/src/gateway/server.js
index 7b2a2a9..1c926ad 100644
--- a/src/gateway/server.js
+++ b/src/gateway/server.js
@@ -48,7 +48,8 @@ const {
   isAllowedReplicatorRequest,
   isAllowedColorMatchRequest,
   isAllowedLocalRepairRequest,
-  isAllowedEcommerceRequest
+  isAllowedEcommerceRequest,
+  isAllowedPatternColorMatchRequest
 } = require("./routePolicy");
 const {
   removeGatewayCookie,
@@ -747,7 +748,9 @@ app.use(async (req, res, next) => {
     */
     isAllowedLocalRepairRequest(req) ||
     /* AI 电商: reviewed exact method/session routes and strict UUID patterns. */
-    isAllowedEcommerceRequest(req);
+    isAllowedEcommerceRequest(req) ||
+    /* AI 图案设计 reference color-match: exact routes and strict UUID patterns. */
+    isAllowedPatternColorMatchRequest(req);
 
   if (!allowed) {
     return res.status(404).end();
@@ -922,6 +925,12 @@ async function handleProxyResponse(
     );
   }
 
+  if (isAllowedPatternColorMatchRequest(req)) {
+    console.info(
+      `[gateway] pattern-design ${req.method} ${req.path} upstream status=${proxyRes.statusCode}`
+    );
+  }
+
   rewriteLocationHeader(
     proxyRes
   );
diff --git a/tests/gateway-route-policy.test.cjs b/tests/gateway-route-policy.test.cjs
index 2c7a104..84e9c97 100644
--- a/tests/gateway-route-policy.test.cjs
+++ b/tests/gateway-route-policy.test.cjs
@@ -16,7 +16,9 @@ const {
   isAllowedLocalRepairRequest,
   LOCAL_REPAIR_EXCEPTIONS,
   isAllowedEcommerceRequest,
-  ECOMMERCE_EXCEPTIONS
+  ECOMMERCE_EXCEPTIONS,
+  isAllowedPatternColorMatchRequest,
+  PATTERN_COLOR_MATCH_EXCEPTIONS
 } = require("../src/gateway/routePolicy.js");
 
 function request({ method, path, module }) {
@@ -29,6 +31,85 @@ function request({ method, path, module }) {
   };
 }
 
+const patternColorExpectedPairs = [
+  ["POST", "/app/proxy/viralVideoTaskDetail"],
+  ["POST", "/app/color-match/pricing"],
+  ["GET", "/app/color-match/pricing"],
+  ["POST", "/app/local-repair/pricing"],
+  ["POST", "/app/color-match/cast-correction-sessions"],
+  ["GET", "/app/color-match/cast-correction-sessions"]
+];
+
+test("pattern-design color-match exact entries match the reviewed contract", () => {
+  assert.deepEqual(
+    PATTERN_COLOR_MATCH_EXCEPTIONS.map(entry =>
+      `${entry.method} ${entry.path} ${entry.module}`
+    ).sort(),
+    patternColorExpectedPairs.map(([method, path]) =>
+      `${method} ${path} pattern-design`
+    ).sort()
+  );
+});
+
+test("pattern-design color-match method/module/path matrix remains exact", () => {
+  const allowed = new Set(patternColorExpectedPairs.map(([method, path]) => `${method} ${path}`));
+  for (const path of new Set(patternColorExpectedPairs.map(pair => pair[1]))) {
+    for (const method of ["GET", "POST", "HEAD", "OPTIONS", "PUT", "DELETE", "PATCH"]) {
+      assert.equal(isAllowedPatternColorMatchRequest(request({
+        method, path, module: "pattern-design"
+      })), allowed.has(`${method} ${path}`));
+    }
+  }
+  for (const [method, path] of patternColorExpectedPairs) {
+    for (const module of ["clothing", "e-commerce", "video-generator", "image-generator", undefined]) {
+      assert.equal(isAllowedPatternColorMatchRequest(request({ method, path, module })), false);
+    }
+    for (const badPath of [path + "/extra", path + "s"]) {
+      assert.equal(isAllowedPatternColorMatchRequest(request({
+        method, path: badPath, module: "pattern-design"
+      })), false);
+    }
+  }
+});
+
+test("pattern-design cast-correction UUID operations remain strict", () => {
+  const id = "62f614d0-23ac-4e89-afd4-c175fe60e9c7";
+  const root = "/app/color-match/cast-correction-sessions/";
+  for (const [method, path] of [
+    ["POST", root + id + "/process"],
+    ["DELETE", root + id]
+  ]) {
+    assert.equal(isAllowedPatternColorMatchRequest(request({
+      method, path, module: "pattern-design"
+    })), true);
+    for (const otherMethod of ["GET", "POST", "HEAD", "OPTIONS", "PUT", "DELETE", "PATCH"].filter(m => m !== method)) {
+      assert.equal(isAllowedPatternColorMatchRequest(request({
+        method: otherMethod, path, module: "pattern-design"
+      })), false);
+    }
+    for (const module of ["clothing", "e-commerce", "image-generator", undefined]) {
+      assert.equal(isAllowedPatternColorMatchRequest(request({ method, path, module })), false);
+    }
+    for (const badPath of [path + "/extra", path.replace(id, "not-a-uuid"), path.replace(id, id + "a")]) {
+      assert.equal(isAllowedPatternColorMatchRequest(request({
+        method, path: badPath, module: "pattern-design"
+      })), false);
+    }
+  }
+});
+
+test("pattern color-match rules do not admit unrelated app operations", () => {
+  for (const path of [
+    "/app", "/app/proxy", "/app/color-match",
+    "/app/local-repair/beginRepair", "/app/proxy/viralVideoRecords",
+    "/app/viral-video/link/resolve", "/app/viral-video/pricing"
+  ]) {
+    assert.equal(isAllowedPatternColorMatchRequest(request({
+      method: "POST", path, module: "pattern-design"
+    })), false);
+  }
+});
+
 const ecommerceExpectedPairs = [
   ["POST", "/app/proxy/viralVideoTaskDetail"],
   ["POST", "/app/viral-video/pricing"],
```

