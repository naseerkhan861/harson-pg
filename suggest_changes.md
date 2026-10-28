# AI 服装 → 局部修复: task-detail polling 404 on `temp-main`

**Reference:** `naseerkhan861/harson-pg`, `temp-main` at `1c6aa20f6c9b4473487cc3d8a1943c1db05dd549` (29 October 2026). This guide describes changes for your development checkout; it does not require editing the bundled YiBai JavaScript or running another paid repair task to establish the gateway failure.

## 1. What the two console exports establish

| Evidence | `corrected.txt` (working branch) | `incorrected.txt` (`temp-main`) |
| --- | --- | --- |
| Task-detail POST failures | None appear in the captured console excerpt. | **88** occurrences of `POST https://ai.harson-base.com/app/proxy/viralVideoTaskDetail 404 (Not Found)`. |
| Images on YiBai OSS | Two image `HEAD 404` errors. | Two image `HEAD 404` errors. |
| Application warnings | Model categories, STS refresh, Canvas, and `allowfullscreen` messages. | Similar warnings, followed by the repeated task-detail errors. |
| UI result | The earlier working-branch screenshot shows a completed repair. | The supplied screenshot shows a task ID with `生成中` and the spinner. |

The good export contains incidental OSS `HEAD 404` messages, so those messages **alone** cannot explain the difference. The bad export's repeated task-detail POST is the actionable difference. Its stack repeatedly passes through `IndexPage-BDriwhMs.js`, `setTimeout`, and `http-client-BTvahscA.js`, consistent with a polling loop that cannot read the task's status. The two exports were captured at different times and do not provide a full request/response trace; they do not prove that the provider itself completed the task in the failing run.

The bad export does **not** contain a `beginRepair` or `viralVideoRecords` failure. The current `temp-main` code already has exact `clothing` exceptions for `POST /app/local-repair/beginRepair` and `POST /app/proxy/viralVideoRecords`. Do not repeat those earlier fixes.

## 2. Root cause in the current gateway

In `src/gateway/routePolicy.js`, `REPLICATOR_EXCEPTIONS` admits `POST /app/proxy/viralVideoTaskDetail` only for a **`video-generator` session**. The `LOCAL_REPAIR_EXCEPTIONS` table admits two related calls for a **`clothing` session** but omits this exact task-detail POST.

In `src/gateway/server.js`, the gateway's allowlist combines its configured prefixes with `isAllowedReplicatorRequest(req)`, `isAllowedColorMatchRequest(req)`, and `isAllowedLocalRepairRequest(req)`. A request matching none of them receives `res.status(404).end()` **before it reaches YiBai**. The same file already imports and calls `isAllowedLocalRepairRequest` and logs its admitted upstream status; it needs no new middleware or broad proxy prefix.

I verified the branch locally with the repository's real gateway and a mock YiBai upstream. Before the change, the `video-generator` POST reached the mock and returned 200, but the **same endpoint under a `clothing` session returned an empty gateway 404**, despite the mock having a 200 handler. This is a reproducible gateway policy gap. The browser export by itself cannot distinguish a gateway-generated 404 from an upstream-generated 404, so the live log check in step 5 remains important.

The older `feature/dashboard-ui` code at `6ec4d1ff0645085ec924246a4d17bfa6b975f4ad` also uses a general route-prefix allowlist and does not contain this newer exception table. A working screenshot from that branch establishes behavior of that deployment, but does not establish that its source includes the missing `clothing` exception; its runtime route configuration or provider path may differ. Apply the narrowly verified fix to the updated `temp-main` gateway.

## 3. Code change: admit only this recorded request

Open `src/gateway/routePolicy.js`. Add one entry to `LOCAL_REPAIR_EXCEPTIONS`, immediately after the existing `viralVideoRecords` entry:

```js
{
  method: "POST",
  path: "/app/proxy/viralVideoTaskDetail",
  module: "clothing",
  reason: "poll task detail for the local-repair subtool"
}
```

The resulting table should contain the existing `beginRepair` and `viralVideoRecords` entries **plus** the new one, with a comma between objects. Leave the existing `video-generator` entry in `REPLICATOR_EXCEPTIONS` intact. Do not alter `isAllowedReplicatorRequest` to accept every clothing request: the repair predicate already provides the exact module, method, and path check.

Do not add `/app` or `/app/proxy` to `YIBAI_GATEWAY_EXTRA_PATHS`. Those are broad prefixes and would admit unrelated authenticated provider calls.

## 4. Tests to add to the same checkout

### Route-policy test

In `tests/gateway-route-policy.test.cjs`, update the `LOCAL_REPAIR_EXCEPTIONS.map(...)` expected array in `local repair submit is exact and clothing-only` to include:

```js
{
  method: "POST",
  path: "/app/proxy/viralVideoTaskDetail",
  module: "clothing"
}
```

Add a focused test:

```js
test("local repair task-detail polling is exact and clothing-only", () => {
  const check = (method, path, module) =>
    isAllowedLocalRepairRequest(request({ method, path, module }));

  assert.equal(check("POST", "/app/proxy/viralVideoTaskDetail", "clothing"), true);
  assert.equal(check("GET", "/app/proxy/viralVideoTaskDetail", "clothing"), false);
  assert.equal(check("POST", "/app/proxy/viralVideoTaskDetail", "image-generator"), false);
  assert.equal(check("POST", "/app/proxy/viralVideoTaskDetail", undefined), false);
  assert.equal(check("POST", "/app/proxy/viralVideoTaskDetail/extra", "clothing"), false);
  assert.equal(check("POST", "/app/proxy/viralVideoTaskDetails", "clothing"), false);
});
```

The existing `isAllowedReplicatorRequest` test that rejects a clothing session should **still pass**: that predicate remains dedicated to the video module. The new clothing acceptance is through `isAllowedLocalRepairRequest`.

### Full gateway fixture

In `scripts/test-gateway-fixture.js`, the mock provider already has a 200 handler for `POST /app/proxy/viralVideoTaskDetail`, and the fixture already creates `clothingSession` and `videoSession`. After the existing `viralVideoRecords` history checks, request that endpoint using the clothing session:

```js
const clothingDetailRes = await request(
  `${GATEWAY_ORIGIN}/app/proxy/viralVideoTaskDetail`,
  {
    method: "POST",
    headers: {
      Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
    }
  }
);

check(
  "clothing POST viralVideoTaskDetail reaches mock provider",
  clothingDetailRes.status === 200 &&
    JSON.parse(clothingDetailRes.body.toString()).data.task === "fixture-task"
);
```

Also assert that clothing `GET` remains 404 and an `image-generator` POST remains 404. The fixture already asserts that a `video-generator` POST returns the mock's 200 JSON. These checks exercise the actual gateway and provider forwarding; a unit test of the predicate alone would not establish that.

Run in the development checkout:

```bash
node --test tests/gateway-route-policy.test.cjs
node scripts/test-gateway-fixture.js
git diff --check
```

**Local reproduction results:** before adding the exception, the clothing POST returned an empty gateway 404. After adding this one entry, it returned the mock provider's 200 JSON. Clothing GET and image-generator POST stayed 404; video-generator POST stayed 200. The focused route-policy suite passed **12/12**, the full gateway fixture passed, and `git diff --check` passed. These are local mock-provider results, not evidence of a successful live YiBai repair.

## 5. Deploy and check the live response

After you commit/push the changes to `temp-main` using your normal review workflow and update your server checkout, rebuild and recreate the **gateway** service because it runs `src/gateway/server.js` from its own container:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway logs --since=10m gateway | grep -E 'viralVideoTaskDetail|clothing local-repair upstream status'
```

Use the existing repair task in History if it is still available. Avoid submitting a new paid task just to establish that polling works. Observe one `POST /app/proxy/viralVideoTaskDetail` in browser Network and the corresponding gateway finish log:

| Observation | Meaning and next action |
| --- | --- |
| `POST ...viralVideoTaskDetail -> 200`, plus `[gateway] clothing local-repair upstream status=200` | The gateway forwarded the request and YiBai returned HTTP 200. Check the response JSON for the **same task ID** and whether the UI transitions from `生成中` to the result. |
| `POST ... -> 404` with **no** `clothing local-repair upstream status=...` line | The request was still rejected before the upstream. Check that the **gateway container**, not only the main app, runs the updated code; confirm the iframe session module and that no stale gateway instance is receiving traffic. |
| `clothing local-repair upstream status=404`, followed by `POST ... -> 404` | The exception is active, but YiBai returned the 404. Inspect the Network response and provider session/cookies and compare the request body/task ID with the working environment. Do not keep adding gateway exceptions or hide the error. |
| Upstream 200 but spinner persists | Inspect the returned task state, task ID, and result URL. This is a separate provider or UI task-state issue; the console exports do not contain enough response data to prescribe that change. |

If status remains 404 after rebuilding, use the **Response** tab and a short, redacted Network capture for this one request plus the corresponding gateway log. Do not publish cookies, tokens, signed object URLs, or full image contents in tickets.

## Scope

This recommendation is for the new, directly observed `POST /app/proxy/viralVideoTaskDetail` 404 under **AI 服装 → 局部修复**. It keeps the prior `beginRepair` and `viralVideoRecords` fixes. It does not treat the two OSS `HEAD 404` entries or generic console warnings as proof of a failed task: the working export contains those too. The proposed route change fixes the locally reproduced gateway rejection; completion of a live task still depends on the upstream response.
