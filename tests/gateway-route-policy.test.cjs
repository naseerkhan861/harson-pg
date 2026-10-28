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
  COLOR_MATCH_EXCEPTIONS
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
  // Recorded from the live gateway finish log, 2026-10-28 15:40–15:47 UTC.
  assert.equal(COLOR_MATCH_EXCEPTIONS.length, 1);
  assert.equal(COLOR_MATCH_EXCEPTIONS[0].method, "POST");
  assert.equal(COLOR_MATCH_EXCEPTIONS[0].path, "/app/local-repair/pricing");
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
