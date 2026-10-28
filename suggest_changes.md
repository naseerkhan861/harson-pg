# 局部修复 404: reproduced gateway fix and separate upload/history diagnosis

**Project:** [`naseerkhan861/harson-pg`](https://github.com/naseerkhan861/harson-pg)  
**Branch inspected and run locally:** [`temp-main`](https://github.com/naseerkhan861/harson-pg/tree/temp-main) at commit `2cd8edc6d79b58fca0c539b9febf3aee718c9ce6`  
**Comparison:** `feature/dashboard-ui` at `6ec4d1ff0645085ec924246a4d17bfa6b975f4ad`  
**Prepared:** 29 October 2026  
**Purpose:** Precise instructions for your own VS Code checkout and server deployment. Local experiments were performed in an isolated clone; **nothing was pushed to GitHub or changed on your production server**.

## 1. Updated evidence: three distinct failures

The new screenshots are more useful than the earlier console capture:

| When | Exact evidence from screenshots | Proven or likely owner |
| --- | --- | --- |
| Page opens in **AI 服装 → 局部修复** | Red toast: `本地历史记录暂不可用，仍可继续编辑图片。`; `ai.harson-base.com/a...viralVideoRecords` returns 404. The console shortens the **beginning** of the URL and does not show its method. | A separate history API. Its exact route and response provenance still need a Network or gateway-log check. |
| Images selected/uploaded | Browser makes `HEAD` calls to `https://yb-ai.oss-accelerate.aliyuncs.com/...jpeg` and later `...png`, returning 404. An OSS SDK warns about renewing STS tokens. | These requests go **directly to Alibaba OSS**, outside `ai.harson-base.com` and its Node route gate. A preview alone does not prove an OSS upload succeeded. |
| After **确认修复区域并生成** | Exact console line: **`POST https://ai.harson-base.com/app/local-repair/beginRepair 404 (Not Found)`**; toast: `修复任务提交失败，请稍后重试。` | The current `temp-main` gateway has no exception for this exact POST. This failure was reproduced locally. |

The latest screenshot does **not** show the former `/app/local-repair/pricing` 404. The newest branch already admits that pricing request for `clothing`, and the local fixture confirms it passes. Avoid changing pricing again while addressing the new 404s.

The `aigc-workspace.js:747` “tool not categorized”, `allowfullscreen`, slow font, and Canvas `willReadFrequently` warnings are not the cause of an authenticated `/app/local-repair/beginRepair` 404. The STS warning deserves attention **only in conjunction with the actual OSS upload and HEAD requests**; it is not proof by itself that credentials expired.

## 2. What I ran locally

I cloned `temp-main` at `2cd8edc…`, installed the repository's production dependencies, and ran:

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
```

Baseline: all existing tests passed, but **none** exercised `beginRepair` or the local repair history call. I added a temporary mock YiBai `POST /app/local-repair/beginRepair` endpoint that returns JSON 200, issued the fixture's real `clothing` gateway session, and requested that path through the **real gateway**. Result: **empty 404**, even though the mock provider would have returned 200. This reproduces the Harson gateway route rejection for the exact browser POST.

In the isolated clone I then added only the exact `(POST, /app/local-repair/beginRepair, clothing)` admission described below. The same fixture request became **200 from the mock provider**. A GET to the same path and a video-generator POST still returned **404**. The focused route-policy suite passed **9/9**, and the complete gateway fixture passed, including its existing session/cookie, pricing, color-match, and video checks. `git diff --check` was clean.

**Limit of this local proof:** the fixture uses a mock provider and test cookies; it does not log into YiBai or upload real images. It proves the existing gateway blocks this request and the narrow exception forwards it. It does **not** prove YiBai will accept the real job, that the OSS objects exist, or that the history request is safe to admit.

## 3. Why the older branch can appear to work

The iframe page, browser workspace script, session controller, and frame-ticket service are identical Git blobs in `feature/dashboard-ui` and `temp-main`. Both have the same optional origin switch: when `YIBAI_FRAME_PUBLIC_ORIGIN` is configured, `buildFrameUrl()` launches the frame via `ai.harson-base.com`; when it is empty, the frame points directly to YiBai. The real production `.env` files are not in Git.

The older branch's gateway only allows provider menu prefixes and `YIBAI_GATEWAY_EXTRA_PATHS`, which do **not** include `/app` in `.env.example`. It also lacks the local repair submit exception. Therefore **copying the older gateway code cannot fix this proxied POST**. The older deployment may have bypassed this gateway, used a different `.env`/Nginx route, or faced different provider behavior. This is a runtime comparison to perform, not an established explanation. Keep your current proxy and its newer provider-cookie handling.

## 4. Confirm the live gateway version, then add the verified submit route

In the deployed server checkout, inspect the source and running container **without displaying secrets**:

```bash
git rev-parse HEAD
docker compose --profile gateway ps gateway
docker compose --profile gateway exec gateway node -e 'const p=require("./src/gateway/routePolicy"); console.log(p.COLOR_MATCH_EXCEPTIONS.map(x=>x.method+" "+x.path+" "+x.module))'
```

The current branch's `COLOR_MATCH_EXCEPTIONS` contains `POST /app/local-repair/pricing` and four `/app/color-match/...` entries. A gateway container missing them is stale. This check is important because `docker compose up -d --build` **without `--profile gateway`** does not rebuild the running gateway profile service.

### Change A: `src/gateway/routePolicy.js`

Preserve the existing `REPLICATOR_EXCEPTIONS`, `COLOR_MATCH_EXCEPTIONS`, and their functions. Insert this new table and function immediately before `module.exports`:

```js
const LOCAL_REPAIR_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/local-repair/beginRepair",
    module: "clothing",
    reason: "submit painted region for the clothing local-repair subtool"
  }
]);

function isAllowedLocalRepairRequest(req) {
  return LOCAL_REPAIR_EXCEPTIONS.some(entry =>
    req.harsonGatewaySession?.moduleName === entry.module &&
    req.method === entry.method &&
    req.path === entry.path
  );
}
```

Add `isAllowedLocalRepairRequest` and `LOCAL_REPAIR_EXCEPTIONS` to that file's existing `module.exports`. This endpoint and its method are **confirmed by the new screenshot and by the local gateway reproduction**. It does not need to be inferred from an ellipsized console link.

### Change B: `src/gateway/server.js`

Add `isAllowedLocalRepairRequest` to the `require("./routePolicy")` destructuring near line 47. In the existing allowlist middleware near line 719, preserve its prefix and current exception logic, and append the new predicate:

```js
const allowed =
  prefixes.some(prefix =>
    requestPath === prefix ||
    requestPath.startsWith(`${prefix}/`) ||
    requestPath.startsWith(`${prefix}?`)
  ) ||
  isAllowedReplicatorRequest(req) ||
  isAllowedColorMatchRequest(req) ||
  isAllowedLocalRepairRequest(req);
```

Do not change the session gate, CSRF check, `prefixes.length === 0` guard, non-HTML response streaming, provider cookies, or request body. Do **not** add `/app`, `/app/local-repair`, or `/app/proxy` to `YIBAI_GATEWAY_EXTRA_PATHS`: a broad prefix would also forward unrelated provider actions.

Immediately after the existing `clothing color-match upstream status` block in `handleProxyResponse()`, add a status-only diagnostic for the newly admitted POST:

```js
if (isAllowedLocalRepairRequest(req)) {
  console.info(
    `[gateway] clothing local-repair upstream status=${proxyRes.statusCode}`
  );
}
```

This line lets you distinguish “Harson now forwarded it but YiBai returned 404/500” from “Harson rejected it before forwarding.” Do not log image data, mask data, provider response bodies, tokens, cookies, query strings, or full signed OSS URLs.

### Change C: meaningful tests

In `tests/gateway-route-policy.test.cjs`, import the two new exports. Add a test that checks the exact table entry, permits the clothing POST, and rejects GET, `video-generator`, no session, `/extra`, and another `/app/local-repair/*` endpoint. The following is the focused test I ran locally:

```js
test("local repair submit is exact and clothing-only", () => {
  assert.deepEqual(
    LOCAL_REPAIR_EXCEPTIONS.map(({ method, path, module }) =>
      ({ method, path, module })),
    [{
      method: "POST",
      path: "/app/local-repair/beginRepair",
      module: "clothing"
    }]
  );
  const check = (method, path, module) =>
    isAllowedLocalRepairRequest(request({ method, path, module }));
  assert.equal(check("POST", "/app/local-repair/beginRepair", "clothing"), true);
  assert.equal(check("GET", "/app/local-repair/beginRepair", "clothing"), false);
  assert.equal(check("POST", "/app/local-repair/beginRepair", "video-generator"), false);
  assert.equal(check("POST", "/app/local-repair/beginRepair", undefined), false);
  assert.equal(check("POST", "/app/local-repair/beginRepair/extra", "clothing"), false);
  assert.equal(check("POST", "/app/local-repair/other", "clothing"), false);
});
```

In `scripts/test-gateway-fixture.js`, add a mock provider handler near the existing local-repair pricing handler:

```js
app.post("/app/local-repair/beginRepair", (_req, res) => {
  res.json({ code: 200, data: { task: "fixture-repair" } });
});
```

After the existing `clothingSession` and pricing checks, add this test block. `videoSession`, `clothingSession`, `request`, `check`, and `GATEWAY_ORIGIN` already exist in the fixture:

```js
const repairSubmit = await request(
  `${GATEWAY_ORIGIN}/app/local-repair/beginRepair`,
  {
    method: "POST",
    headers: {
      Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
    }
  }
);
check(
  "clothing POST beginRepair reaches mock provider",
  repairSubmit.status === 200 &&
    JSON.parse(repairSubmit.body.toString()).data.task === "fixture-repair"
);

const repairWrongMethod = await request(
  `${GATEWAY_ORIGIN}/app/local-repair/beginRepair`,
  { headers: { Cookie: `harson_aigc_gateway=${clothingSession.sessionId}` } }
);
check("GET beginRepair stays 404", repairWrongMethod.status === 404);

const repairWrongModule = await request(
  `${GATEWAY_ORIGIN}/app/local-repair/beginRepair`,
  {
    method: "POST",
    headers: { Cookie: `harson_aigc_gateway=${videoSession.sessionId}` }
  }
);
check("video POST beginRepair stays 404", repairWrongModule.status === 404);
```

**Do not call the real YiBai endpoint from a test**; generation may consume credits.

Run:

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
git diff --check
```

## 5. Fix the page-load history toast independently

The new screenshot still abbreviates the history URL as `ai.harson-base.com/a...viralVideoRecords`. Unlike `beginRepair`, its **full path and method are still unknown**. The present `temp-main` exception tables contain no `viralVideoRecords` entry, but an upstream 404 or a different Nginx target is also possible. Do not paste a guessed `/app/proxy/viralVideoRecords` into production.

Collect the exact method/path from the gateway's existing path-only finish log during **one page load**:

```bash
docker compose --profile gateway logs --since=10m gateway | grep -E 'viralVideoRecords|beginRepair|local-repair|color-match'
```

Or use Chrome DevTools → **Network → Fetch/XHR → request → Headers**, and copy just the method and **URL pathname**. In **Response**, decide whether the 404 body is empty (consistent with Harson's `res.status(404).end()` route gate) or a YiBai JSON error. If there is no matching gateway finish line, check Nginx's `ai.harson-base.com` upstream and any other gateway instance.

If and only if (a) the request is from a `clothing` iframe session, (b) the gateway returns the empty 404, and (c) the endpoint is genuinely used to show this subtool's history, add an entry to `LOCAL_REPAIR_EXCEPTIONS` with the **recorded** method and **recorded** full pathname:

```js
// Add to the array ONLY after recording both values from Network/logs:
{
  method: "<RECORDED_METHOD>",
  path: "<RECORDED_FULL_PATHNAME>",
  module: "clothing",
  reason: "load local-repair history in the clothing subtool"
}
```

Replace both placeholders before committing. Add an exact-entry unit test and a mock-provider fixture case for this history route, plus wrong-method, wrong-module, and nearby-path rejection. If the upstream YiBai site itself returns 404, or the endpoint fetches unrelated video records for the user's account, **do not whitelist it**; treat the history feature as a provider problem and keep the non-blocking history message truthful. The name `viralVideoRecords` is not enough evidence to make a cross-module access decision.

**Why the toast can persist after the submit fix:** loading history and submitting a repair call two different APIs. Whitelisting one does not make the other work.

## 6. Investigate the OSS `HEAD 404` separately

The failing host `yb-ai.oss-accelerate.aliyuncs.com` is outside the Harson gateway. Allowing `beginRepair` does **not** make a missing or inaccessible OSS object appear. The new screenshot shows at least two JPEG and two PNG `HEAD` failures; their timing suggests a connection with the uploaded images or mask, but the ellipsized keys prevent proving that from the screenshot alone.

For **one fresh, non-sensitive test image** in DevTools → Network (Preserve log; filters `Fetch/XHR`, `Img`, and `Other`), record locally:

1. Which YiBai API requested temporary upload credentials or a presigned destination; whether that API succeeded. Do not share the credentials or signed URL.
2. Whether an actual **PUT/POST upload** to OSS occurred, its status, and whether the returned object key is the same key later checked by `HEAD`.
3. Whether the two previews represent local `blob:`/data URLs or remotely fetched OSS objects. A local preview can succeed while remote upload fails.
4. Whether the failed PNG key is the painted-mask object or an older thumbnail. Compare keys **locally**, not full signed URLs in tickets or logs.
5. Whether the same images upload and pass HEAD inside YiBai's original signed-in site with the same authorized account. Compare behavior, not private credentials.

Interpretation:

| Observation | Fix owner/action |
| --- | --- |
| Upload PUT/POST fails, is absent, or returns a different object key from the HEAD | Repair the YiBai upload/credential/object-key flow. Harson's `/app` allowlist cannot fix direct OSS traffic. If only the proxied iframe fails, compare provider cookie **presence**, upload credential response, and allowed origin with the direct frame. |
| PUT/POST succeeds but HEAD of that **same key** returns 404 | Collect redacted object key prefix, upload response status, and request/task ID for YiBai; investigate object path, host, authorization, or lifecycle with the provider. Do not substitute arbitrary public URLs. |
| HEAD failures belong only to old history items | Keep this separate from the new repair submission; old thumbnails may be unavailable while current images are usable. |
| Repair POST is forwarded but upstream status is 4xx/5xx or JSON reports a failure | Use the provider's short error code and job ID to investigate payload/OSS availability or ask YiBai. Another gateway route exception will not turn an upstream failure into success. |

Do not expose `accessKeyId`, `accessKeySecret`, `securityToken`, signed query strings, cookies, full HAR exports, or private images in shared issue reports. The console's STS renewal **recommendation** alone is not a diagnosis; confirm the upload request and response first.

## 7. Deploy, distinguish residual errors, and accept the fix

After editing your checkout and passing the local tests, push your reviewed change to `temp-main` and update the production source by your normal process. Preserve `.env` and persistent `data/`. Rebuild the **gateway container**, since this route policy executes there:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway exec gateway node -e 'const p=require("./src/gateway/routePolicy"); console.log(p.LOCAL_REPAIR_EXCEPTIONS)'
docker compose --profile gateway logs --tail=100 gateway
```

Start a fresh iframe session after deploy. Verify in this order:

1. `POST /app/local-repair/beginRepair` no longer gets an **empty gateway 404**; the gateway emits `clothing local-repair upstream status=...`. Check this **before** spending credits on another attempt if a harmless mock/staging route is available.
2. If upstream returns 200, inspect its **JSON success field/task status**, then confirm an actual output. HTTP 200 alone is not a finished repair.
3. If the history toast persists, capture the exact separate history method/path as in Section 5 and resolve it on its own merits.
4. If upload `HEAD` still fails, correlate its object key with the current uploaded files as in Section 6. Do not repeatedly trigger billable generation until the images are valid.
5. Confirm wrong-method, wrong-module and arbitrary `/app/*` requests still receive 404; pricing, color-match and video replicator flows remain functional.

**Established:** current `temp-main` blocks the screenshot-confirmed clothing `POST /app/local-repair/beginRepair` before the mock upstream, and the exact exception fixes that forwarding locally. **Not established:** the full history request, a successful real YiBai repair task, or the root cause of direct OSS `HEAD 404`s. The guide addresses those unknowns with a precise capture and decision process instead of claiming the Node route change fixes every red message.
