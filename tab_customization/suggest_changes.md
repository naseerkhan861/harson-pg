# Restore video history, storyboard generation, and final video generation

**Workflow:** 视频创作 → 爆款视频复刻 · **Branch:** `temp-main` · **Reviewed:** 2026-11-13 (China time)

## What failed

| Where | Request | Finding |
| --- | --- | --- |
| Open **爆款视频复刻 → 历史记录** | `POST /app/proxy/viralVideoRecords` | The new Chrome screenshot shows two 404s at this exact URL on `ai.harson-base.com`, followed by `[frame-history] query records failed` and `load frame history failed`. The shared provider history API uses POST in existing rules. Confirm the method in the landing page's Network trace. |
| Select a history row | `POST /app/proxy/viralVideoTaskDetail` | The detail route is already allowed for `video-generator`. The list request fails first, so there are no rows to select. |
| **② 裁切视频 → 确认裁切** | `POST /app/viral-video/trim` | The screenshot shows **裁切结果** and a 30-second preview. The trim request has already succeeded. |
| **② 裁切结果 → 生成故事板 ⚡ 30** | `beginViralVideoStoryboard` on `ai.harson-base.com` | Safari shows HTTP 404 with `Content-Length: 0` and `X-Powered-By: Express`. The UI moves to **③ 生成故事板**, but the storyboard stays empty. The screenshot cuts off the full URL and method. |
| **③ 生成故事板 → 生成视频 ⚡ 260** | `POST /app/viral-video/beginViralVideoGeneration` | The earlier console shows this exact request. The rule is **already committed** on current `temp-main`. Check that the running gateway contains it and whether a new 404 comes from YiBai. |

In [`temp-main` at `b92554c`](https://github.com/naseerkhan861/harson-pg/commit/b92554c346fca9b29ca672f4773c639aba975795), `src/gateway/routePolicy.js` has rules for the detail, pricing, link resolution, trim and final video requests in a `video-generator` session. It admits the shared history POST for clothing, e-commerce and pattern design, but not for `video-generator`. It has no storyboard rule. If no prefix or exception matches, the Harson gateway returns an empty 404 before contacting YiBai. Both missing routes reproduced that failure locally.

The [`feature/dashboard-ui` gateway at `84bf396`](https://github.com/naseerkhan861/harson-pg/commit/84bf396a3755711d9256af3d7135f2f272a10d9c) uses prefix rules. With the same restricted gateway settings, it blocked these mock requests too. Both branches can launch the iframe directly to YiBai or through Harson, depending on `YIBAI_FRAME_PUBLIC_ORIGIN`. To explain the working deployment, compare its actual successful **Request URL**, method, and effective gateway settings. The working browser path was not observed here.

The console also shows an inline event handler blocked by CSP and a `gtm.js` timeout. The history XHRs were sent and received HTTP 404, so those messages do not explain the history failure. The routing fix does not require changing CSP.

## 1. Confirm the live request details before deploying

- **History:** In DevTools → **Network**, filter for `viralVideoRecords` and reopen **视频创作 → 爆款视频复刻**. This only loads history. Verify **POST** and `https://ai.harson-base.com/app/proxy/viralVideoRecords`. Expect the detail call when opening an existing row after the fix.
- **Storyboard:** The patch uses **`POST /app/viral-video/beginViralVideoStoryboard`**. The prefix is inferred from the neighboring trim and final video requests. Confirm the exact **Request URL** and **Request Method** at the top of Safari's saved **Headers** view, or use the gateway finish log for the existing 404 (Nov 12, 06:18:48 UTC / 14:18:48 China time):

  ```bash
  docker compose --profile gateway logs --since '2026-11-12T06:15:00Z' gateway \
    | grep -F 'beginViralVideoStoryboard' | tail -n 20
  ```

  The expected line is `[gateway] POST /app/viral-video/beginViralVideoStoryboard -> 404`. If the recorded path differs, use the recorded exact path in the policy, log and fixture before deploying. The history fix can be applied independently while confirming the storyboard path. Share only method, path and status. The attached headers include a session cookie.

## 2. Apply the combined patch

Use a clean `temp-main` checkout containing `b92554c`. Download `Harson_Viral_Video_Storyboard_and_Generation_404.patch` alongside this guide. From the repo root, replace `/path/to` with the patch's download directory:

```bash
git merge-base --is-ancestor b92554c HEAD
git apply --check /path/to/Harson_Viral_Video_Storyboard_and_Generation_404.patch
git apply /path/to/Harson_Viral_Video_Storyboard_and_Generation_404.patch
git diff --check
node --test tests/*.test.cjs
node scripts/test-gateway-fixture.js
```

If the ancestor check fails, sync to the current `temp-main` first. If `git apply --check` fails, compare the route table and apply only the missing changes by hand.

### Manual changes

In `src/gateway/routePolicy.js`, add the history rule before `viralVideoTaskDetail` and the storyboard rule between trim and final video. These objects go inside `REPLICATOR_EXCEPTIONS`:

```js
{
  method: "POST",
  path: "/app/proxy/viralVideoRecords",
  module: "video-generator",
  reason: "list the viral video replicator's landing page history"
},
{
  method: "POST",
  path: "/app/viral-video/beginViralVideoStoryboard",
  module: "video-generator",
  reason: "start storyboard generation from the confirmed video trim"
},
```

The patch exports constants for both paths and uses them in `handleProxyResponse` in `src/gateway/server.js`. It logs upstream errors for `viralVideoRecords` and the upstream status for the storyboard submission. The existing final video status log covers `beginViralVideoGeneration`. Those lines report status codes without request or response data.

The patch updates the expected number of exact replicator rules from five to seven and updates the loopback fixture to check a returned history row, existing detail, trim, and both generation calls. For a history-only change, add just the first object and adjust the count to six. Keep these rules specific to the observed method, path and `video-generator` session; adding prefixes such as `/app` or `/app/proxy` would also admit unrelated requests.

## 3. Rebuild the gateway and check the running code

Commit the changes and update the deployment checkout through your normal release process. From the deployment checkout:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway ps gateway

docker compose --profile gateway exec -T gateway node - <<'NODE'
const { isAllowedReplicatorRequest: allow } = require("/app/src/gateway/routePolicy.js");
for (const path of [
  "/app/proxy/viralVideoRecords",
  "/app/proxy/viralVideoTaskDetail",
  "/app/viral-video/trim",
  "/app/viral-video/beginViralVideoStoryboard",
  "/app/viral-video/beginViralVideoGeneration"
]) {
  const ok = allow({
    method: "POST",
    path,
    harsonGatewaySession: { moduleName: "video-generator" }
  });
  console.log((ok ? "OK     " : "MISSING") + "  POST " + path);
  if (!ok) process.exitCode = 1;
}
NODE
```

After applying both rules, all five lines should show `OK`. This reads the running container's route policy and submits no requests. If the final video rule is missing, the container has older or different code than `b92554c`. Rebuilding only the main app can leave the gateway on the old image. Reopen the workspace after restarting the gateway to establish a fresh iframe session.

## 4. Verify in this order

1. **History first.** Open **爆款视频复刻** with an account that has a known previous task. Confirm `viralVideoRecords` succeeds and the right panel shows history. Select a row and check that `viralVideoTaskDetail` succeeds and the task loads. Neither action submits a job.
2. **Trim and storyboard.** Use an existing trimmed test clip if possible. Otherwise confirm the trim and wait for **裁切结果**. If you intend to spend the displayed credits, click **生成故事板** once. Check for a successful acknowledgement and wait for the storyboard text in **③ 生成故事板**.
3. **Final video.** From a completed storyboard, click **生成视频** once if you intend to spend the displayed credits. Check `beginViralVideoGeneration` for a successful acknowledgement, then check progress and **④ 完成**. If a submission times out or its outcome is unclear, check **历史记录** and the balance before retrying.

### If a 404 remains

```bash
docker compose --profile gateway logs --since 5m gateway \
  | grep -E 'viralVideoRecords|viralVideoTaskDetail|beginViralVideo(Storyboard|Generation)'
```

The upstream status lines below apply to the history list, storyboard and final video calls. The task detail route has a finish log only.

| Result | What to check |
| --- | --- |
| No matching gateway request | Compare the actual Request URL host with the public gateway origin and the reverse proxy's target container. |
| Gateway finish line `-> 404` without the corresponding `upstream status=404` line | Confirm the active gateway revision and compare the exact method and path. Reopen **视频创作 → 爆款视频复刻** to launch in a `video-generator` session. |
| Corresponding `upstream status=404` | YiBai responded with 404. Compare the provider target, response and task/account context with the working deployment. The gateway has forwarded this request. |
| HTTP 302 to the expired page or HTTP 403 | Check the iframe session and request origin. Reopen the workspace before submitting a job. |
| HTTP success but a job fails in the UI | Check the provider's response and task detail. A successful HTTP response does not guarantee a successful job. |

## Local verification

| Gateway build, same loopback provider | History list | Confirm trim | Submit storyboard | Submit final video |
| --- | --- | --- | --- | --- |
| `feature/dashboard-ui` with restricted prefixes | 404 at gateway | 404 at gateway | 404 at gateway | 404 at gateway |
| `temp-main` at `b92554c` | 404 at gateway | Forwarded | 404 at gateway | Forwarded |
| `temp-main` with combined patch | Forwarded; fixture returned a row | Forwarded | Forwarded | Forwarded |

The patched gateway forwarded the existing task detail call. The submission checks preserved the original JSON and provider cookie while filtering out the Harson session cookie. The history and storyboard checks confirmed that wrong methods, paths, modules, missing sessions and cross-site requests were still rejected. Mock provider 404s remained distinguishable from local rejections.

**74 repository tests and 124 gateway fixture checks passed.** The patch applied cleanly to `b92554c`. The tests used the candidate storyboard URL and a loopback provider. Confirm the production URL before deployment. No live paid requests were submitted.
