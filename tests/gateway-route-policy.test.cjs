"use strict";

/*
  Route-policy exceptions for the viral video replicator sub-tool.
  Run: node --test tests/gateway-route-policy.test.cjs
*/

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAllowedReplicatorRequest,
  REPLICATOR_EXCEPTIONS
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

test("admits the two verified replicator endpoints for video-generator", () => {
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

test("exception table stays exact and video-generator only", () => {
  assert.ok(REPLICATOR_EXCEPTIONS.length >= 2);

  for (const entry of REPLICATOR_EXCEPTIONS) {
    assert.equal(entry.method, "POST");
    assert.equal(entry.module, "video-generator");
    assert.ok(entry.path.startsWith("/"));
    assert.ok(!entry.path.endsWith("/"));
  }
});
