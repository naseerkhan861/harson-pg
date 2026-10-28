"use strict";

/*
  Route-policy exceptions for the viral video replicator sub-tool.
  Run: node --test tests/gateway-route-policy.test.cjs
*/

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAllowedReplicatorRequest,
  REPLICATOR_EXCEPTIONS,
  isAllowedColorMatchRequest,
  COLOR_MATCH_EXCEPTIONS,
  isAllowedLocalRepairRequest,
  LOCAL_REPAIR_EXCEPTIONS
} = require("../src/gateway/routePolicy.js");

function request({ method, path, module }) {
  return {
    method,
    path,
    harsonGatewaySession: module
      ? { moduleName: module }
      : undefined
  };
}

test("admits the three verified replicator endpoints for video-generator", () => {
  assert.equal(
    isAllowedReplicatorRequest(
      request({
        method: "POST",
        path: "/app/proxy/viralVideoTaskDetail",
        module: "video-generator"
      })
    ),
    true
  );

  assert.equal(
    isAllowedReplicatorRequest(
      request({
        method: "POST",
        path: "/app/viral-video/pricing",
        module: "video-generator"
      })
    ),
    true
  );

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
});

test("rejects wrong method on the same paths", () => {
  assert.equal(
    isAllowedReplicatorRequest(
      request({
        method: "GET",
        path: "/app/proxy/viralVideoTaskDetail",
        module: "video-generator"
      })
    ),
    false
  );

  assert.equal(
    isAllowedReplicatorRequest(
      request({
        method: "GET",
        path: "/app/viral-video/pricing",
        module: "video-generator"
      })
    ),
    false
  );

  assert.equal(
    isAllowedReplicatorRequest(
      request({
        method: "GET",
        path: "/app/viral-video/link/resolve",
        module: "video-generator"
      })
    ),
    false
  );
});

test("rejects other modules and missing sessions", () => {
  for (const module of [
    "image-generator",
    "clothing",
    "pattern-design",
    undefined
  ]) {
    assert.equal(
      isAllowedReplicatorRequest(
        request({
          method: "POST",
          path: "/app/proxy/viralVideoTaskDetail",
          module
        })
      ),
      false,
      `${module || "no session"} must be rejected`
    );
  }

  // The link resolver is equally module-gated.
  for (const module of [
    "image-generator",
    "clothing",
    undefined
  ]) {
    assert.equal(
      isAllowedReplicatorRequest(
        request({
          method: "POST",
          path: "/app/viral-video/link/resolve",
          module
        })
      ),
      false,
      `link/resolve under ${module || "no session"} must be rejected`
    );
  }
});

test("rejects similarly named and arbitrary /app paths (no broad prefix)", () => {
  for (const path of [
    "/app/proxy/viralVideoTaskDetail/extra",
    "/app/proxy/viralVideoTaskDetails",
    "/app/proxy/viralVideoTaskDetai",
    "/app/proxy/other",
    "/app/proxy",
    "/app",
    "/app/viral-video/pricing/extra",
    "/app/viral-video/link/resolve/extra",
    "/app/viral-video/link/resolves",
    "/app/viral-video/other",
    "/app/viral-video"
  ]) {
    assert.equal(
      isAllowedReplicatorRequest(
        request({
          method: "POST",
          path,
          module: "video-generator"
        })
      ),
      false,
      `${path} must stay rejected`
    );
  }
});

test("clothing color-match pricing admits only its reviewed request", () => {
  const { method, path, module } = COLOR_MATCH_EXCEPTIONS[0];
  assert.equal(module, "clothing");
  assert.ok(method === "GET" || method === "POST");
  assert.ok(path.startsWith("/app/"));
  assert.ok(!path.includes("<"));

  assert.equal(isAllowedColorMatchRequest(request({ method, path, module })), true);
  assert.equal(isAllowedColorMatchRequest(request({
    method: method === "GET" ? "POST" : "GET", path, module
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method, path, module: "video-generator"
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method, path: `${path}/unexpected`, module
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method, path: "/app/unrelated", module
  })), false);
});

test("color-match exception equals the exact recorded gateway-log value", () => {
  // Recorded from the live gateway finish log:
  // 2026-10-28 15:40-15:47Z (local-repair) and 15:53-15:54Z (color-match).
  assert.equal(COLOR_MATCH_EXCEPTIONS.length, 5);

  const admitted = COLOR_MATCH_EXCEPTIONS.map(
    entry => `${entry.method} ${entry.path}`
  );

  assert.ok(admitted.includes("POST /app/local-repair/pricing"));
  assert.ok(admitted.includes("POST /app/color-match/pricing"));
  assert.ok(admitted.includes("GET /app/color-match/pricing"));
  assert.ok(admitted.includes("POST /app/color-match/cast-correction-sessions"));
  assert.ok(admitted.includes("GET /app/color-match/cast-correction-sessions"));

  for (const entry of COLOR_MATCH_EXCEPTIONS) {
    assert.equal(entry.module, "clothing");
  }
});

test("cast-correction sessions admit both recorded methods, clothing only", () => {
  const { method, path, module } = COLOR_MATCH_EXCEPTIONS[3];
  assert.equal(method, "POST");
  assert.equal(path, "/app/color-match/cast-correction-sessions");

  assert.equal(isAllowedColorMatchRequest(request({ method, path, module })), true);
  assert.equal(isAllowedColorMatchRequest(request({
    method: "DELETE", path, module
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method, path, module: "e-commerce"
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method, path: "/app/color-match/cast-correction-sessions/other", module
  })), false);
});

test("local repair submit is exact and clothing-only", () => {
  assert.deepEqual(
    LOCAL_REPAIR_EXCEPTIONS.map(({ method, path, module }) =>
      ({ method, path, module })),
    [{
      method: "POST",
      path: "/app/local-repair/beginRepair",
      module: "clothing"
    },
    {
      method: "POST",
      path: "/app/proxy/viralVideoRecords",
      module: "clothing"
    },
    {
      method: "POST",
      path: "/app/proxy/viralVideoTaskDetail",
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

test("local repair history endpoint admits only the recorded request", () => {
  const check = (method, path, module) =>
    isAllowedLocalRepairRequest(request({ method, path, module }));

  // Recorded 14x from the page-load polling loop (finish log, 17:54-17:55Z).
  assert.equal(check("POST", "/app/proxy/viralVideoRecords", "clothing"), true);
  assert.equal(check("GET", "/app/proxy/viralVideoRecords", "clothing"), false);
  assert.equal(check("POST", "/app/proxy/viralVideoRecords", "video-generator"), false);
  assert.equal(check("POST", "/app/proxy/viralVideoRecords", undefined), false);
  assert.equal(check("POST", "/app/proxy/viralVideoRecords/extra", "clothing"), false);
  assert.equal(check("POST", "/app/proxy/otherRecords", "clothing"), false);
});

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

test("cast-correction per-session UUID patterns are strict", () => {
  const sessionId = "62f614d0-23ac-4e89-afd4-c175fe60e9c7";

  // Recorded shapes: POST .../process and DELETE the session itself.
  assert.equal(isAllowedColorMatchRequest(request({
    method: "POST",
    path: `/app/color-match/cast-correction-sessions/${sessionId}/process`,
    module: "clothing"
  })), true);
  assert.equal(isAllowedColorMatchRequest(request({
    method: "DELETE",
    path: `/app/color-match/cast-correction-sessions/${sessionId}`,
    module: "clothing"
  })), true);

  // Wrong methods, modules, and malformed shapes stay rejected.
  assert.equal(isAllowedColorMatchRequest(request({
    method: "GET",
    path: `/app/color-match/cast-correction-sessions/${sessionId}/process`,
    module: "clothing"
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method: "DELETE",
    path: `/app/color-match/cast-correction-sessions/${sessionId}`,
    module: "video-generator"
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method: "POST",
    path: "/app/color-match/cast-correction-sessions/not-a-uuid/process",
    module: "clothing"
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method: "DELETE",
    path: `/app/color-match/cast-correction-sessions/${sessionId}/extra`,
    module: "clothing"
  })), false);
  assert.equal(isAllowedColorMatchRequest(request({
    method: "POST",
    path: `/app/color-match/cast-correction-sessions/${sessionId}/../../other`,
    module: "clothing"
  })), false);
});

test("exception table stays exact and video-generator only", () => {
  assert.equal(REPLICATOR_EXCEPTIONS.length, 3);

  for (const entry of REPLICATOR_EXCEPTIONS) {
    assert.equal(entry.method, "POST");
    assert.equal(entry.module, "video-generator");
    assert.ok(entry.path.startsWith("/"));
    assert.ok(!entry.path.endsWith("/"));
  }
});
