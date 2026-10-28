# AI 图案设计 → 局部修复: history and submission 404 fixes

**Repository:** [naseerkhan861/harson-pg](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Reviewed branch/commit:** `temp-main` at `70126bd2c5d4e4f41dc0458d8eec9c0a89e73e4b`  
**Date:** 29 October 2026

This guide contains the exact proposed source/test edits for your development checkout. They were verified locally using the real gateway and a mock provider. No GitHub commit, production deployment or live repair generation was performed.

## 1. What your screenshots establish

| Stage | Evidence | Relevant request |
| --- | --- | --- |
| Open AI 图案设计 → 局部修复 | Red toast: `本地历史记录暂不可用，仍可继续编辑图片。`; resource ending in `viralVideoRecords` returns 404 | The reviewed shared provider history contract is `POST /app/proxy/viralVideoRecords`. The screenshot abbreviates this URL; the exact path/method is already established by the working clothing/e-commerce implementation. |
| After painting both images and pressing 确认修复区域并生成 | Red toast: `修复任务提交失败，请稍后重试。`; exact console line shows a POST 404 | `POST https://ai.harson-base.com/app/local-repair/beginRepair` |
| Image/mask handling | Two direct OSS PNG HEAD 404 entries, STS refresh recommendations, Canvas readback warnings | Separate asset/upload checks; these messages alone do not establish the cause of the gateway POST 404. |

The mask editor renders both images, but that preview can be local. It does not prove remote upload succeeded. Conversely, an OSS HEAD 404 alone does not prove a subsequent upload failed.

## 2. Why this still fails on the latest branch

AI 图案设计 uses the outer gateway session module **`pattern-design`**. Opening a nested 局部修复 page keeps that module.

The preceding reference-color-correction fix is present in the reviewed branch. It permits pricing and task-detail requests under `pattern-design`, but the two repair operations below remain unadmitted:

- `POST /app/proxy/viralVideoRecords` — repair history.
- `POST /app/local-repair/beginRepair` — repair submission.

The same requests are permitted for clothing/e-commerce by their own rules. Those predicates do not match a pattern-design session.

The gateway returns an empty 404 before contacting YiBai when no configured route prefix or exact exception predicate matches.

## 3. Complete repair-route state after this fix

| Operation | Exact request | Rule |
| --- | --- | --- |
| Pricing | `POST /app/local-repair/pricing` | Already admitted by the pattern shared color-match rule |
| History | `POST /app/proxy/viralVideoRecords` | **Add the new pattern local-repair rule** |
| Submit painted regions | `POST /app/local-repair/beginRepair` | **Add the new pattern local-repair rule** |
| Task detail / polling | `POST /app/proxy/viralVideoTaskDetail` | Already admitted by the pattern shared color-match rule |

Preserve the earlier pattern-design reference-color rules, including their UUID patterns. The new rule adds exactly **two POST/method/path/module triples**.

## 4. Implementation steps

**Appendix A contains the complete tested four-file diff.**

### Step 1 — add a dedicated repair predicate

File: `src/gateway/routePolicy.js`

Before the existing `module.exports`, add:

- `PATTERN_LOCAL_REPAIR_EXCEPTIONS` containing only the two missing POSTs, both with `module: "pattern-design"`.
- `isAllowedPatternLocalRepairRequest(req)`, checking session module, exact method and exact path.

Add those two names to the existing export object.

Use a separate repair predicate so the existing `isAllowedPatternColorMatchRequest` keeps its current scope. Do not change the outer session module or replace the existing rule tables.

### Step 2 — connect the predicate to the gateway

File: `src/gateway/server.js`

Import `isAllowedPatternLocalRepairRequest` alongside the existing predicates.

Append it to the allowlist expression:

```js
isAllowedPatternColorMatchRequest(req) ||
isAllowedPatternLocalRepairRequest(req);
```

Keep all preceding prefix, video, clothing and e-commerce checks.

Extend the existing pattern-design upstream-status logging condition to include either predicate:

```js
if (
  isAllowedPatternColorMatchRequest(req) ||
  isAllowedPatternLocalRepairRequest(req)
) {
  console.info(
    `[gateway] pattern-design ${req.method} ${req.path} upstream status=${proxyRes.statusCode}`
  );
}
```

This logs method, path and status only. No new proxy, production API handler or request-body parser is required.

Do not add broad `/app` or `/app/proxy` prefixes to `YIBAI_GATEWAY_EXTRA_PATHS`, or suppress the provider UI's red messages to hide failed requests.

### Step 3 — test the new predicate

File: `tests/gateway-route-policy.test.cjs`

Add the new imports and tests that establish:

- The table contains exactly the two reviewed POSTs for pattern-design.
- Other methods, other modules and missing sessions do not match this predicate.
- Nearby paths and broad prefixes remain rejected.

**Keep the existing color-match predicate test that rejects these repair paths.** It tests only `isAllowedPatternColorMatchRequest`. The complete gateway now admits repair through the separate new predicate.

### Step 4 — update the full gateway fixture

File: `scripts/test-gateway-fixture.js`

The existing fixture has a real pattern-design session and mock provider handlers for both repair requests.

Add positive forwarding checks for both POSTs, plus GET/image/video rejection checks.

Remove the old **whole-gateway** fixture expectation that a pattern-design `POST /app/proxy/viralVideoRecords` must return 404. That expectation is obsolete after this repair fix.

The distinction matters: the individual color-match predicate still rejects this operation; the combined gateway now admits it through the repair predicate.

Keep the existing pricing/task-detail, color-correction, cookie, multipart and upstream-error checks.

## 5. Local reproduction and test results

I ran the repository's real gateway and launch-ticket/session flow against the loopback mock provider.

| Request | Direct mock | Before the edit, through pattern-design gateway | After the edit |
| --- | --- | --- | --- |
| `POST /app/local-repair/beginRepair` | 200 | **Empty 404** | **200; original mock JSON unchanged** |
| `POST /app/proxy/viralVideoRecords` | 200 | **Empty 404** | **200; original mock JSON unchanged** |

GET on either path remained 404. Image-generator and video-generator POSTs remained 404 for these two paths. Existing clothing/e-commerce and pattern-design color-correction checks continued to pass.

Completed:

- `node --test tests/gateway-route-policy.test.cjs`: **21/21 passed**.
- `node scripts/test-gateway-fixture.js`: **all checks passed**.
- `git diff --check`: passed.

These are gateway-forwarding results with a mock provider. The fixture does not establish successful live repair processing or emulate the full real task/result lifecycle.

## 6. Apply and validate in your VS Code checkout

Apply Appendix A to the reviewed baseline, or merge equivalent changes if your branch has advanced. Preserve newer reviewed rules and avoid duplicate predicates/entries. If using a patch file, run `git apply --check` against it before applying.

Run:

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
git diff --check
```

The fixture requires free loopback ports **3100–3102**. Its sample prices/results are test data, not production values.

## 7. Deploy the gateway code

After your normal review, commit/push and server-checkout update:

```bash
git rev-parse --short HEAD
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway logs --since=10m gateway | grep -E 'pattern-design .*upstream status|beginRepair|viralVideoRecords|viralVideoTaskDetail|local-repair/pricing'
```

Reopen/refresh the main Harson workspace afterward. The recreated gateway loses its in-memory sessions, so the iframe needs a fresh launch session.

Updating only `suggest_changes.md` or only the main application container does not replace the gateway's running code.

## 8. Check the actual workflow after deployment

1. Open **AI 图案设计 → 局部修复** with a fresh session.
2. Inspect the history POST and its response. If the provider succeeds, the startup history toast should disappear and history should load.
3. Upload the source and correct-detail images.
4. Enter **涂抹修复区域** and paint valid regions on both images as required.
5. Click **确认修复区域并生成** once.
6. Inspect `POST /app/local-repair/beginRepair` and its provider JSON business result/task identifier.
7. Follow the existing `POST /app/proxy/viralVideoTaskDetail` polling request for that same task.
8. Verify a terminal provider state and a successful result-image request.
9. Reopen the history entry to confirm restoration of the saved result.

Confirm the submission response/task identifier before submitting again. An HTTP 200 alone is insufficient if the JSON contains a business error.

## 9. Check the OSS messages separately

The direct `yb-ai.oss-accelerate.aliyuncs.com` HEAD errors are outside these two Harson gateway routes.

For one source image and one generated mask, inspect the full Network sequence:

- Any preliminary HEAD request.
- The actual upload PUT/POST and its response.
- The stored object/preview GET or final URL.
- The subsequent repair-submission request.

A HEAD 404 can precede a successful upload, while a local editor preview can exist even if a remote upload fails. Use the actual upload response to distinguish these cases.

If a direct OSS upload returns an error or an expired-token response, inspect YiBai's upload/STS result separately. The gateway route addition does not change external bucket objects or credentials.

The yellow Canvas readback and STS recommendations, category warnings, `allowfullscreen` and performance logs do not explain an empty policy-generated `beginRepair` 404.

## 10. If a red message remains

| Evidence | Interpretation / next step |
| --- | --- |
| Final 404 without a matching pattern-design upstream-status line | Verify the running gateway version, session module and Nginx target; the request may still be rejected locally or reaching a stale instance. |
| `pattern-design POST /app/local-repair/beginRepair upstream status=404` | The new rule forwarded the request; YiBai returned the 404. Inspect the actual response and provider session/payload. |
| History request logs upstream 404 | Inspect YiBai's history response. Another gateway exception will not repair that response. |
| Upstream 500 | Forwarding succeeded; inspect the provider error. Do not return a fabricated success. |
| Submission succeeds but the UI stays at 生成中 | Inspect the returned task ID, task-detail polling response, JSON business state and result-image request. The polling path is already admitted. |

Capture exact request method/path, redacted response JSON and matching gateway status lines for any remaining failure. Keep cookies, tokens and signed URLs out of shared logs.

## Appendix A — exact tested diff

Apply to the reviewed `70126bd` baseline, preserving the earlier pattern-design color-correction fix.

```diff
diff --git a/scripts/test-gateway-fixture.js b/scripts/test-gateway-fixture.js
index 234e9b5..42bda7b 100644
--- a/scripts/test-gateway-fixture.js
+++ b/scripts/test-gateway-fixture.js
@@ -1409,8 +1409,7 @@ async function main() {
 
     for (const [method, apiPath] of [
       ["GET", "/app/proxy/viralVideoTaskDetail"],
-      ["PUT", "/app/color-match/cast-correction-sessions"],
-      ["POST", "/app/proxy/viralVideoRecords"]
+      ["PUT", "/app/color-match/cast-correction-sessions"]
     ]) {
       const denied = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
         method,
@@ -1419,6 +1418,34 @@ async function main() {
       check(`pattern-design ${method} ${apiPath} stays 404`, denied.status === 404);
     }
 
+    for (const apiPath of [
+      "/app/local-repair/beginRepair",
+      "/app/proxy/viralVideoRecords"
+    ]) {
+      const direct = await request(`${FIXTURE_ORIGIN}${apiPath}`, { method: "POST" });
+      const proxied = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method: "POST",
+        headers: { Cookie: `harson_aigc_gateway=${patternSession.sessionId}` }
+      });
+      check(
+        `pattern-design repair POST ${apiPath} reaches provider unchanged`,
+        direct.status === 200 && proxied.status === 200 && proxied.body.equals(direct.body)
+      );
+      const wrongMethod = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        headers: { Cookie: `harson_aigc_gateway=${patternSession.sessionId}` }
+      });
+      check(`pattern-design GET ${apiPath} stays 404`, wrongMethod.status === 404);
+      for (const [module, sessionId] of [
+        ["image", first.sessionId], ["video", videoSession.sessionId]
+      ]) {
+        const wrongModule = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+          method: "POST",
+          headers: { Cookie: `harson_aigc_gateway=${sessionId}` }
+        });
+        check(`${module} POST ${apiPath} stays 404`, wrongModule.status === 404);
+      }
+    }
+
     const ecommerceUpstreamFailure = await request(
       `${GATEWAY_ORIGIN}/app/viral-video/link/resolve?fail=1`,
       {
diff --git a/src/gateway/routePolicy.js b/src/gateway/routePolicy.js
index 2a935a4..d24410c 100644
--- a/src/gateway/routePolicy.js
+++ b/src/gateway/routePolicy.js
@@ -355,6 +355,30 @@ function isAllowedPatternColorMatchRequest(req) {
   );
 }
 
+/* AI 图案设计 → 局部修复 uses the shared provider repair contract. */
+const PATTERN_LOCAL_REPAIR_EXCEPTIONS = Object.freeze([
+  {
+    method: "POST",
+    path: "/app/local-repair/beginRepair",
+    module: "pattern-design",
+    reason: "submit the painted-region local-repair task"
+  },
+  {
+    method: "POST",
+    path: "/app/proxy/viralVideoRecords",
+    module: "pattern-design",
+    reason: "load local-repair history using the reviewed shared provider contract"
+  }
+]);
+
+function isAllowedPatternLocalRepairRequest(req) {
+  return PATTERN_LOCAL_REPAIR_EXCEPTIONS.some(entry =>
+    req.harsonGatewaySession?.moduleName === entry.module &&
+    req.method === entry.method &&
+    req.path === entry.path
+  );
+}
+
 module.exports = {
   isAllowedReplicatorRequest,
   REPLICATOR_EXCEPTIONS,
@@ -365,5 +389,7 @@ module.exports = {
   isAllowedEcommerceRequest,
   ECOMMERCE_EXCEPTIONS,
   isAllowedPatternColorMatchRequest,
-  PATTERN_COLOR_MATCH_EXCEPTIONS
+  PATTERN_COLOR_MATCH_EXCEPTIONS,
+  isAllowedPatternLocalRepairRequest,
+  PATTERN_LOCAL_REPAIR_EXCEPTIONS
 };
diff --git a/src/gateway/server.js b/src/gateway/server.js
index 1c926ad..cda6a1a 100644
--- a/src/gateway/server.js
+++ b/src/gateway/server.js
@@ -49,7 +49,8 @@ const {
   isAllowedColorMatchRequest,
   isAllowedLocalRepairRequest,
   isAllowedEcommerceRequest,
-  isAllowedPatternColorMatchRequest
+  isAllowedPatternColorMatchRequest,
+  isAllowedPatternLocalRepairRequest
 } = require("./routePolicy");
 const {
   removeGatewayCookie,
@@ -750,7 +751,9 @@ app.use(async (req, res, next) => {
     /* AI 电商: reviewed exact method/session routes and strict UUID patterns. */
     isAllowedEcommerceRequest(req) ||
     /* AI 图案设计 reference color-match: exact routes and strict UUID patterns. */
-    isAllowedPatternColorMatchRequest(req);
+    isAllowedPatternColorMatchRequest(req) ||
+    /* AI 图案设计 local repair: exact submission/history POSTs only. */
+    isAllowedPatternLocalRepairRequest(req);
 
   if (!allowed) {
     return res.status(404).end();
@@ -925,7 +928,10 @@ async function handleProxyResponse(
     );
   }
 
-  if (isAllowedPatternColorMatchRequest(req)) {
+  if (
+    isAllowedPatternColorMatchRequest(req) ||
+    isAllowedPatternLocalRepairRequest(req)
+  ) {
     console.info(
       `[gateway] pattern-design ${req.method} ${req.path} upstream status=${proxyRes.statusCode}`
     );
diff --git a/tests/gateway-route-policy.test.cjs b/tests/gateway-route-policy.test.cjs
index 84e9c97..c7cd7fa 100644
--- a/tests/gateway-route-policy.test.cjs
+++ b/tests/gateway-route-policy.test.cjs
@@ -18,7 +18,9 @@ const {
   isAllowedEcommerceRequest,
   ECOMMERCE_EXCEPTIONS,
   isAllowedPatternColorMatchRequest,
-  PATTERN_COLOR_MATCH_EXCEPTIONS
+  PATTERN_COLOR_MATCH_EXCEPTIONS,
+  isAllowedPatternLocalRepairRequest,
+  PATTERN_LOCAL_REPAIR_EXCEPTIONS
 } = require("../src/gateway/routePolicy.js");
 
 function request({ method, path, module }) {
@@ -31,6 +33,39 @@ function request({ method, path, module }) {
   };
 }
 
+test("pattern-design local repair adds only the reviewed history/submit POSTs", () => {
+  assert.deepEqual(
+    PATTERN_LOCAL_REPAIR_EXCEPTIONS.map(({ method, path, module }) => ({ method, path, module })),
+    [
+      { method: "POST", path: "/app/local-repair/beginRepair", module: "pattern-design" },
+      { method: "POST", path: "/app/proxy/viralVideoRecords", module: "pattern-design" }
+    ]
+  );
+});
+
+test("pattern-design repair predicate rejects other methods/modules and nearby paths", () => {
+  for (const path of ["/app/local-repair/beginRepair", "/app/proxy/viralVideoRecords"]) {
+    for (const method of ["POST", "GET", "HEAD", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
+      assert.equal(isAllowedPatternLocalRepairRequest(request({
+        method, path, module: "pattern-design"
+      })), method === "POST");
+    }
+    for (const module of ["clothing", "e-commerce", "video-generator", "image-generator", undefined]) {
+      assert.equal(isAllowedPatternLocalRepairRequest(request({ method: "POST", path, module })), false);
+    }
+    for (const badPath of [path + "/extra", path + "s"]) {
+      assert.equal(isAllowedPatternLocalRepairRequest(request({
+        method: "POST", path: badPath, module: "pattern-design"
+      })), false);
+    }
+  }
+  for (const path of ["/app", "/app/proxy", "/app/local-repair", "/app/proxy/viralVideoTaskDetail"]) {
+    assert.equal(isAllowedPatternLocalRepairRequest(request({
+      method: "POST", path, module: "pattern-design"
+    })), false);
+  }
+});
+
 const patternColorExpectedPairs = [
   ["POST", "/app/proxy/viralVideoTaskDetail"],
   ["POST", "/app/color-match/pricing"],
```

