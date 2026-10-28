# Fix “通过链接上传” returning 404 in 爆款视频复刻

**Repository:** [`naseerkhan861/harson-pg` → `temp-main`](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Affected UI:** `视频创作` → left item `爆款视频复刻` → `上传参考视频` → `通过链接上传` → `确认`  
**Gateway:** `https://ai.harson-base.com`  
**Prepared:** 28 October 2026  
**Purpose:** code changes to apply and test in your VS Code checkout. This document does not modify your GitHub repository or production server.

## 1. Evidence and likely cause

Your screenshots show a red **“Request failed with status code 404”** toast after `确认`. The nested `app-viral-video-replicator` frame sends:

```http
POST https://ai.harson-base.com/app/viral-video/link/resolve
```

The browser reports a 404 for that exact request. The link dialog says it accepts Xiaohongshu links or direct video addresses; the screenshot shows a Xiaohongshu URL, but **the 404 occurs before we can conclude whether YiBai accepts that particular link**.

The current `temp-main` [gateway route policy](https://github.com/naseerkhan861/harson-pg/blob/temp-main/src/gateway/routePolicy.js) permits the previous two viral-video requests as exact `(method, path, module)` combinations:

| Method | Path | Module | Current policy |
| --- | --- | --- | --- |
| `POST` | `/app/proxy/viralVideoTaskDetail` | `video-generator` | Allowed |
| `POST` | `/app/viral-video/pricing` | `video-generator` | Allowed |
| `POST` | **`/app/viral-video/link/resolve`** | `video-generator` | **Missing** |

[`src/gateway/server.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/src/gateway/server.js) calls `isAllowedReplicatorRequest(req)` after checking provider menu routes and `YIBAI_GATEWAY_EXTRA_PATHS`; otherwise it returns an empty 404 **before** proxying to YiBai. [`.env.example`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/.env.example) also does not include `/app/viral-video/link/resolve`. This is the **leading explanation**, provided the deployed `.env` has no broader matching prefix and the 404 really comes from that gateway. The running `.env` and Nginx response were not visible, so confirm in Network before attributing the 404 conclusively.

The repeated warnings from `aigc-workspace.js:747` about uncategorized `CLImage`/`CLVideo` tools, and the iframe `allowfullscreen` warning, do not explain this POST failure. The previous **history** issue used another endpoint; this fix adds the **link resolver** only.

## 2. Check the failing request before editing

1. Open the nested tool's DevTools **Network** panel, select **Preserve log**, click `通过链接上传`, enter a known valid supported link, and press `确认`.
2. Select the failed `link/resolve` request. Verify **Request Method = POST** and **Path = `/app/viral-video/link/resolve`**. Check the Response tab and response headers. Avoid copying cookies, the link if private, provider tokens, session tickets, or request body into public reports.
3. If the 404 response is **empty**, Harson's gateway route gate is a strong match: its code calls `res.status(404).end()`. If it is an Nginx error page or YiBai JSON error, first identify which layer returned it.
4. Inspect the live, uncommitted `.env` on the server for `YIBAI_GATEWAY_EXTRA_PATHS`. The example file does not prove the production value. If production has a broad `/app` or `/app/viral-video` prefix, the request may already pass the gate, and the 404 would require a different investigation.
5. For comparison, try the **same authorized link** directly in YiBai's original interface under the same account. If it fails there too, check link validity and the provider's resolver rather than changing Harson's proxy policy.

## 3. Exact code change in `temp-main`

### A. Add the third reviewed exception

In [`src/gateway/routePolicy.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/src/gateway/routePolicy.js), append one entry to `REPLICATOR_EXCEPTIONS` after the existing pricing entry:

```js
{
  method: "POST",
  path: "/app/viral-video/link/resolve",
  module: "video-generator",
  reason: "resolve a supported video link for the viral video replicator"
}
```

Include the comma between object entries. `isAllowedReplicatorRequest(req)` already requires a `video-generator` gateway session and exact method/path equality; **no change to that function or to `server.js` is needed** for this endpoint. The existing CSRF/session checks and streaming of non-HTML API responses remain in place.

Do **not** use `YIBAI_GATEWAY_EXTRA_PATHS=/app` or `/app/viral-video` as a permanent workaround. Those settings accept whole path prefixes and any method, allowing unrelated authenticated provider operations. An exact policy entry matches the existing pattern established for the history and pricing fixes.

### B. Extend the focused policy tests

In [`tests/gateway-route-policy.test.cjs`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/tests/gateway-route-policy.test.cjs):

1. Add a positive assertion beside the two existing permitted requests:

   ```js
   assert.equal(
     isAllowedReplicatorRequest(
       request({
         method: "POST",
         path: "/app/viral-video/link/resolve",
         module: "video-generator"
       })
     ),
     true
   );
   ```

2. Add a **GET** for the same path to “rejects wrong method”; it must be `false`.
3. Test the exact path under `image-generator`, `clothing`, and no gateway session; each must be `false`.
4. Add `/app/viral-video/link/resolve/extra`, `/app/viral-video/link/resolves`, and `/app/viral-video/other` to the rejected-path list.
5. Change the test describing **“two verified replicator endpoints”** to **“three”** and change `REPLICATOR_EXCEPTIONS.length >= 2` to an exact assertion for the reviewed set (or `>= 3` if the repository intentionally permits independently reviewed future entries). Keep its checks that each exception is `POST` and `video-generator`.

These tests matter because the route accepts a request that can ask the provider to resolve an external URL; the gateway must not become a generic `/app` proxy.

### C. Update the configuration example and documentation

The [`.env.example`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/.env.example) comment above `YIBAI_GATEWAY_EXTRA_PATHS` currently names the history and pricing exceptions. Add:

```text
# POST /app/viral-video/link/resolve is also admitted by
# src/gateway/routePolicy.js for video-generator sessions only.
```

Leave the `YIBAI_GATEWAY_EXTRA_PATHS` value unchanged. **Do not commit production `.env`**, credentials, or copied link URLs. If a temporary broad `/app` entry was added during troubleshooting, remove it once the exact route policy is deployed, after checking whether other independently needed routes rely on it.

## 4. Tests and deployment

From your VS Code repository checkout based on the latest `temp-main`:

```bash
node --test tests/gateway-route-policy.test.cjs
node --test tests/image-tab-injection.test.cjs
```

The first checks the precise gateway exception. The second protects the gateway's existing HTML injection behavior. If your repo has a gateway integration test harness, also send a `POST` through the gateway to a mock YiBai upstream and verify it forwards the method and request body unchanged, while an unknown `/app/viral-video/*` path stays 404.

After committing and pushing your reviewed change, update the server checkout and rebuild **the gateway container**. The repository's `docker-compose.yml` uses a separate `gateway` service:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway exec gateway grep -n 'link/resolve' /app/src/gateway/routePolicy.js
docker compose logs --tail=100 gateway
```

The second command verifies the running image contains the new rule; do not paste sensitive logs publicly. A browser reload after deployment loads the updated server behavior. You do not need to reload the iframe for every subsequent link submission.

## 5. Accept or investigate the next result

| Result after deployment | Meaning and next action |
| --- | --- |
| `POST /app/viral-video/link/resolve` returns 200 and a valid video appears in the reference upload/workflow | Route fix worked. Check that `下一步` works and that a generated result uses the intended provider model. |
| 400/422 with a provider validation message | Gateway now forwards the request. Test a supported, accessible Xiaohongshu item or direct video URL; preserve the provider's validation message rather than masking it. |
| 401/403 from upstream | Investigate nested iframe session and provider authentication; the route rule is no longer the blocker. |
| Still 404 with an empty Harson response | Verify gateway image was recreated, live `routePolicy.js` contains the rule, and the request path/method/module match exactly. Inspect Nginx location forwarding. |
| Still 404 with YiBai's response body | The request reaches upstream; compare the direct-provider origin, exact path, and method. The gateway's `GATEWAY_UPSTREAM` may differ from the nested tool's actual API host. Do not invent a target or rewrite the link without evidence. |
| Resolver returns a video URL but preview/video loading fails | Treat as a **separate media/CORS or CDN** issue, like the MP4 problem in the prior history guide; the URL resolver's 404 has been repaired. |

The red toast is a consequence of the request failure. Do not suppress the toast, change the button text, weaken browser security, or store provider credentials in client-side JavaScript to make the symptom disappear.

## 6. Acceptance checklist

- A supported link resolves through `POST /app/viral-video/link/resolve` in the `video-generator` session.
- The returned video is shown in the provider's reference-video step, and the workflow can proceed.
- The earlier `viralVideoTaskDetail` and pricing exceptions still work.
- `GET` on the resolver path, requests from other modules, and arbitrary `/app` paths still fail at the gateway.
- Other model aliases, history, local upload, and login behavior are unchanged.

**Confidence:** the missing exact route is established in the current `temp-main` source. The screenshot establishes the POST 404. Whether that specific live 404 is produced by Harson or upstream still requires the Network Response and current server configuration checks in Section 2.
