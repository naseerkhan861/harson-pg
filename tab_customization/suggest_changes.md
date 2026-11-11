# Fix the 404 after 确认裁切

**Workflow:** 视频创作 → 爆款视频复刻 → ② 裁切视频 → 确认裁切  
**Compared:** `temp-main` [28aa5c9](https://github.com/naseerkhan861/harson-pg/commit/28aa5c974c9c8bf0ae30bbde0380f9d24cf6d43d) and `feature/dashboard-ui` [182bc65](https://github.com/naseerkhan861/harson-pg/commit/182bc65d98a94ba26795c5185f752ce98bcd54d1).

## Finding

The failed request in the screenshot is on `ai.harson-base.com` and ends in `/viral-video/trim`. That is the API call made when confirming the trim, after the upload and preview already worked. The displayed 30-second selection is within the page's stated 4–30 second range.

The likely cause is a missing gateway route rule. The screenshot truncates the beginning of the path and does not show the method. The patch below is for **`POST /app/viral-video/trim`**; confirm that exact pair before applying it.

- [`temp-main` route policy](https://github.com/naseerkhan861/harson-pg/blob/28aa5c974c9c8bf0ae30bbde0380f9d24cf6d43d/src/gateway/routePolicy.js) admits the replicator's history detail, pricing and link resolution calls for `video-generator`. It has no trim entry.
- The [gateway](https://github.com/naseerkhan861/harson-pg/blob/28aa5c974c9c8bf0ae30bbde0380f9d24cf6d43d/src/gateway/server.js) checks the authenticated session, CSRF rule, configured/provider menu prefixes and exact exceptions before proxying. With none of the allowed paths matching, it returns an empty HTTP 404 without calling YiBai.
- The dropdown display aliases run inside the iframe. This request is governed by the gateway route policy.

## Why the dashboard branch can work

Both commits have a gateway. They share the same [iframe URL selection logic](https://github.com/naseerkhan861/harson-pg/blob/182bc65d98a94ba26795c5185f752ce98bcd54d1/src/controllers/aigcSessionController.js): a configured `YIBAI_FRAME_PUBLIC_ORIGIN` uses a Harson launch ticket and gateway; leaving it unset uses YiBai directly. The dashboard branch uses a prefix check in its [gateway](https://github.com/naseerkhan861/harson-pg/blob/182bc65d98a94ba26795c5185f752ce98bcd54d1/src/gateway/server.js), while `temp-main` adds exact exceptions. Neither branch forwards the tested trim request under the same restricted configuration.

Compare the **successful trim request’s host** in the working branch's Network panel. A YiBai host indicates the direct path. If both trim requests go through Harson, compare the actual running gateway builds and their configured/provider menu prefixes. A top-level `localhost` address only identifies the workspace shell.

### Local reproduction

I ran each branch's actual gateway against the same loopback mock provider with a test gateway session. The fixture deliberately does not implement video processing; it verifies whether the gateway forwards the request.

| `POST /app/viral-video/trim` | HTTP result | Reached mock provider? |
| --- | --- | --- |
| Direct to the mock | 200 | Yes |
| Unmodified `feature/dashboard-ui` gateway | 404, empty body | No |
| Unmodified `temp-main` gateway | 404, empty body | No |
| `temp-main` with the proposed rule | 200 | Yes, original request body forwarded |

I reached the live trim screen from an existing task. DevTools was unavailable in that browser, so I did not capture a live trim submission. The mock result establishes the gateway behavior for the proposed method and path.

## 1. Confirm the request

On your failing build, open DevTools → **Network**, filter for `trim` and select the failed request from **确认裁切**. If necessary, reproduce it once with a test video. Check **Request Method**, **Request URL** (host and full path) and **Status Code** under **Headers**. The proposed rule applies when the request is `POST https://ai.harson-base.com/app/viral-video/trim`. Ignore query parameters when comparing paths.

On the gateway host you can also check the existing status log:

```bash
docker compose --profile gateway logs --since 5m gateway | grep -F '/viral-video/trim'
```

Look for `[gateway] POST /app/viral-video/trim -> 404`. This identifies the method and path seen by the gateway; the finish status alone does not identify whether YiBai was called.

## 2. Apply the exact rule

If the method and path match, apply `Harson_Viral_Video_Trim_404.patch` from your `temp-main` checkout:

```bash
git apply --check /path/to/Harson_Viral_Video_Trim_404.patch
git apply /path/to/Harson_Viral_Video_Trim_404.patch
git diff --check
node --test tests/gateway-route-policy.test.cjs
```

The production change adds this entry to `REPLICATOR_EXCEPTIONS` in `src/gateway/routePolicy.js`:

```js
{
  method: "POST",
  path: "/app/viral-video/trim",
  module: "video-generator",
  reason: "confirm the selected video trim for the viral video replicator"
}
```

The patch also updates the rule count and checks the method, exact path and module. Keep `YIBAI_GATEWAY_EXTRA_PATHS` unchanged. The narrow rule preserves the gateway session and CSRF checks. If your capture shows a different method or path, review that exact request before changing the rule.

## 3. Deploy and verify

Sync the patched checkout to the server, then rebuild the service that handles `ai.harson-base.com`:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway ps gateway
docker compose --profile gateway exec -T gateway \
  node -e 'const {isAllowedReplicatorRequest: allow} = require("/app/src/gateway/routePolicy.js"); const ok = allow({method:"POST", path:"/app/viral-video/trim", harsonGatewaySession:{moduleName:"video-generator"}}); console.log(ok ? "trim route installed" : "trim route missing"); if (!ok) process.exitCode = 1;'
```

Open a fresh workspace session and repeat the same valid trim. Confirm that the trim request succeeds and the workflow advances to **生成故事板**.

| Result after deployment | Next check |
| --- | --- |
| Container reports `trim route missing` | Verify which server checkout was used to build `gateway`. |
| Browser gets 404 and gateway has no matching log entry | Check the request host and the reverse proxy target for that host. |
| The rule is installed and gateway still logs 404 | Determine whether YiBai returned the 404. In `handleProxyResponse()`, an optional log guarded by the exact method, path and `video-generator` session can record `proxyRes.statusCode`. If it logs 404, check the upstream origin, provider route version and uploaded video/task validity with YiBai. |
| Browser gets 302 or 403 | Check the gateway session or the request origin. These are separate from the missing route rule. |

**Validation:** 75 repository tests, all 111 existing gateway fixture checks, and the targeted trim probes passed locally. The probes also verified that a wrong method, path suffix, unrelated module, missing session, and cross-site POST are rejected before the upstream. The patch has not been deployed.
