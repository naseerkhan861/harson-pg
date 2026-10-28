# AI 电商 → 局部修复: history and submission 404 fixes

**Repository:** [naseerkhan861/harson-pg](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Reviewed branch/commit:** `temp-main` at `05ac201f5f6349c3c6bfd0950fe4f143efed42fa`  
**Date:** 29 October 2026

This guide contains the exact proposed source/test edits for your development checkout. The patch was verified locally with the real gateway and a mock provider. No GitHub commit, production deployment, or live repair generation was performed.

## 1. The two failures in your screenshots

| Stage | Message / request | Diagnosis |
| --- | --- | --- |
| Open AI 电商 → 局部修复 | `本地历史记录暂不可用，仍可继续编辑图片。`; a request ending in `viralVideoRecords` returns 404 | The e-commerce policy lacks the repair-history request. The shared provider contract already used by clothing is `POST /app/proxy/viralVideoRecords`. The new screenshot abbreviates the history URL; this exact path/method comes from the reviewed existing clothing implementation and earlier confirmed workflow. |
| After painting both images and clicking 确认修复区域并生成 | `修复任务提交失败，请稍后重试。`; exact console line `POST https://ai.harson-base.com/app/local-repair/beginRepair 404 (Not Found)` | The e-commerce policy lacks this exact repair-submission POST. |
| During image/mask handling | Two direct OSS `HEAD ...png 404` entries, STS refresh recommendations and Canvas readback warnings | Separate from the confirmed gateway policy gaps. Inspect the actual upload PUT/POST before concluding the uploads failed; section 8 describes the check. |

The existing gateway rejects an unadmitted path with an empty 404 **before forwarding it to YiBai**. The request body can be valid and still get this policy-generated 404.

The earlier working-branch screenshots also contained some OSS HEAD/STS/Canvas messages. Those messages alone are not enough to explain why a repair job fails.

## 2. Current branch state: preserve the fixes already applied

The latest branch contains the earlier e-commerce color-correction fix. Its `ECOMMERCE_EXCEPTIONS` table has **eight exact entries**, plus two UUID patterns.

For the local-repair workflow:

| Operation | Exact request | Current e-commerce policy |
| --- | --- | --- |
| Pricing | `POST /app/local-repair/pricing` | Already admitted |
| History | `POST /app/proxy/viralVideoRecords` | **Missing — add** |
| Submit painted regions | `POST /app/local-repair/beginRepair` | **Missing — add** |
| Task detail / polling | `POST /app/proxy/viralVideoTaskDetail` | Already admitted |

The clothing table already permits the missing operations, but an **AI 电商** iframe has `moduleName: "e-commerce"`. Its nested 局部修复 page does not change that outer session to clothing.

Add the two missing entries to **`ECOMMERCE_EXCEPTIONS`**, not to the clothing-only table. Afterward, this baseline has **ten exact e-commerce entries**, with its existing UUID patterns preserved.

## 3. Source change

File: `src/gateway/routePolicy.js`

Append these objects inside the existing `ECOMMERCE_EXCEPTIONS` array, after its current last entry. Add a comma after the preceding object:

```js
{
  method: "POST",
  path: "/app/local-repair/beginRepair",
  module: "e-commerce",
  reason: "submit the painted-region local-repair task"
},
{
  method: "POST",
  path: "/app/proxy/viralVideoRecords",
  module: "e-commerce",
  reason: "load local-repair history using the reviewed shared provider contract"
}
```

The existing `isAllowedEcommerceRequest` predicate already checks method, exact path, and session module. The existing `src/gateway/server.js` already calls it in the route gate and logs its upstream response status. No additional middleware, body parser, API handler or proxy is required.

Keep the current pricing, task-detail, color-match and UUID rules. Do not replace the table with only the two entries above. Do not add broad `/app` or `/app/proxy` prefixes, and do not suppress the frontend error messages to hide the failed requests.

## 4. Test changes

### Route-policy test

File: `tests/gateway-route-policy.test.cjs`

Append these pairs to the existing `ecommerceExpectedPairs` array:

```js
["POST", "/app/local-repair/beginRepair"],
["POST", "/app/proxy/viralVideoRecords"]
```

The existing method/module/path matrix will then test the new paths as well. Update the first e-commerce test's description to mention both color-match and repair contracts.

### Full gateway fixture

File: `scripts/test-gateway-fixture.js`

The mock provider already has handlers for both missing routes. Add e-commerce-session checks that:

1. Request each path directly from the mock and through the real gateway.
2. Expect provider 200 and identical JSON through the gateway.
3. Keep GET on those paths rejected.
4. Keep image-generator and video-generator POSTs rejected.
5. Retain the existing clothing, color-match, pricing, task-detail, cookie, multipart and upstream-error checks.

**Appendix A contains the complete tested diff for all three files**, including these fixture checks. If your checkout has advanced, merge the additions while preserving newer reviewed rules.

## 5. Local reproduction and verification

Before the policy edit, I issued each missing POST with a real fixture-issued `e-commerce` session:

| Request | Direct mock provider | Before edit, through gateway | After edit, through gateway |
| --- | --- | --- | --- |
| `POST /app/local-repair/beginRepair` | 200 | **Empty 404** | **200; original mock JSON unchanged** |
| `POST /app/proxy/viralVideoRecords` | 200 | **Empty 404** | **200; original mock JSON unchanged** |

Afterward, GET still returned 404, and image/video sessions still returned 404 for those two paths. The existing e-commerce pricing/task-detail checks and the previous clothing/color-correction checks passed in the complete fixture.

Completed:

- `node --test tests/gateway-route-policy.test.cjs`: **15/15 passed**.
- `node scripts/test-gateway-fixture.js`: **all checks passed**.
- `git diff --check`: passed.

The fixture verifies gateway forwarding and policy boundaries. It does not simulate a completed live repair with a real provider task ID.

Run the same commands after applying the diff in your development checkout. The fixture needs free loopback ports **3100–3102**.

## 6. Deploy the updated gateway

After your normal review, commit/push and update the server checkout:

```bash
git rev-parse --short HEAD
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway logs --since=10m gateway | grep -E 'e-commerce .*upstream status|beginRepair|viralVideoRecords|viralVideoTaskDetail|local-repair/pricing'
```

Reopen/refresh the main Harson workspace after recreating the gateway. Its sessions are in memory, so the iframe needs a fresh launch session.

Updating only the main app container or `suggest_changes.md` does not update the running gateway code.

## 7. Verify the live repair sequence

1. Open **AI 电商 → 局部修复** with a fresh session.
2. Check the history POST. It should reach the provider; if the provider succeeds, the history error toast should no longer appear.
3. Upload the source and correct-detail images. Enter 涂抹修复区域 and paint valid regions on both images as required by the UI.
4. Click **确认修复区域并生成** once and inspect the `beginRepair` response.
5. Confirm the provider returned a valid task identifier/business result before submitting again.
6. Follow the already-admitted task-detail polling request and verify it refers to that same task.
7. Confirm the task reaches a terminal provider state and the result image loads. Reopen the history entry to verify the stored result.

HTTP 200 alone is not sufficient: inspect the provider's JSON business status and task/result fields.

## 8. Separate the OSS HEAD messages from submission failure

The screenshot shows direct `HEAD` requests to Alibaba OSS returning 404. They do not pass through the two Harson routes being fixed.

The editor preview can be local, so seeing an image on the canvas does not prove the remote upload succeeded. Conversely, a HEAD 404 can precede a successful object upload, so it does not prove failure by itself.

In browser Network, capture the full sequence for one source image and one generated mask:

- The actual upload PUT/POST and its response.
- Any preceding HEAD/object-existence request.
- The subsequent image/object GET or saved URL.
- The final `beginRepair` request and response.

If the upload succeeds and the object loads, continue with the task submission check. If a direct OSS upload returns 403/404 or an expired-token response, inspect YiBai's actual upload/STS result separately. A gateway allowlist entry cannot create a missing external object or repair external credentials.

Do not change OSS endpoints, strip signed parameters, disable browser security, or return fake upload/task success based on the abbreviated HEAD errors.

## 9. If an error remains after deployment

| Observation | Next action |
| --- | --- |
| Final `POST ... -> 404`, with no matching e-commerce upstream-status line | Check the running gateway version, current session module and Nginx target. The request may still be rejected locally or reaching a stale instance. |
| `[gateway] e-commerce POST /app/local-repair/beginRepair upstream status=404` | The rule is active and YiBai returned the 404. Inspect the actual response and provider session/task payload. |
| The corresponding history request logs upstream 404 | Inspect the provider history response; another allowlist rule will not change it. |
| Upstream 500 | Forwarding succeeded; diagnose the provider's error response. |
| Submission succeeds but UI stays at 生成中 | Inspect task-detail polling, the task ID, returned business status and result-image request. The polling path is already admitted on this baseline. |

Use exact request method/path and redacted response JSON to diagnose any remaining failure. Keep cookies, tokens and signed URLs out of shared logs.

## Appendix A — exact tested diff

Apply against the reviewed `05ac201` baseline, preserving the previous e-commerce color-correction changes.

```diff
diff --git a/scripts/test-gateway-fixture.js b/scripts/test-gateway-fixture.js
index 0e410f0..75dc67d 100644
--- a/scripts/test-gateway-fixture.js
+++ b/scripts/test-gateway-fixture.js
@@ -1347,6 +1347,35 @@ async function main() {
       );
     }
 
+    for (const apiPath of [
+      "/app/local-repair/beginRepair",
+      "/app/proxy/viralVideoRecords"
+    ]) {
+      const direct = await request(`${FIXTURE_ORIGIN}${apiPath}`, { method: "POST" });
+      const proxied = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        method: "POST",
+        headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
+      });
+      check(
+        `e-commerce repair POST ${apiPath} reaches provider unchanged`,
+        direct.status === 200 && proxied.status === 200 && proxied.body.equals(direct.body)
+      );
+      const wrongMethod = await request(`${GATEWAY_ORIGIN}${apiPath}`, {
+        headers: { Cookie: `harson_aigc_gateway=${ecommerceSession.sessionId}` }
+      });
+      check(`e-commerce GET ${apiPath} stays 404`, wrongMethod.status === 404);
+      for (const [module, sessionId] of [
+        ["image", first.sessionId],
+        ["video", videoSession.sessionId]
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
index 351ed28..4ec72df 100644
--- a/src/gateway/routePolicy.js
+++ b/src/gateway/routePolicy.js
@@ -232,6 +232,18 @@ const ECOMMERCE_EXCEPTIONS = Object.freeze([
     path: "/app/color-match/cast-correction-sessions",
     module: "e-commerce",
     reason: "refresh cast-correction sessions"
+  },
+  {
+    method: "POST",
+    path: "/app/local-repair/beginRepair",
+    module: "e-commerce",
+    reason: "submit the painted-region local-repair task"
+  },
+  {
+    method: "POST",
+    path: "/app/proxy/viralVideoRecords",
+    module: "e-commerce",
+    reason: "load local-repair history using the reviewed shared provider contract"
   }
 ]);
 
diff --git a/tests/gateway-route-policy.test.cjs b/tests/gateway-route-policy.test.cjs
index 68b853e..2c7a104 100644
--- a/tests/gateway-route-policy.test.cjs
+++ b/tests/gateway-route-policy.test.cjs
@@ -37,13 +37,15 @@ const ecommerceExpectedPairs = [
   ["GET", "/app/color-match/pricing"],
   ["POST", "/app/local-repair/pricing"],
   ["POST", "/app/color-match/cast-correction-sessions"],
-  ["GET", "/app/color-match/cast-correction-sessions"]
+  ["GET", "/app/color-match/cast-correction-sessions"],
+  ["POST", "/app/local-repair/beginRepair"],
+  ["POST", "/app/proxy/viralVideoRecords"]
 ];
 const ecommerceExpectedKeys = new Set(
   ecommerceExpectedPairs.map(([method, path]) => `${method} ${path}`)
 );
 
-test("e-commerce exact rules match the reviewed color-match contract", () => {
+test("e-commerce exact rules match the reviewed color-match and repair contracts", () => {
   assert.deepEqual(
     ECOMMERCE_EXCEPTIONS.map(entry =>
       `${entry.method} ${entry.path} ${entry.module}`
```

