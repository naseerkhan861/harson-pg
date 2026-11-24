"use strict";

/*
  Focused tests for the gateway proxy-header transformations.
  Run: node --test tests/gateway-proxy-headers.test.cjs
*/

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  removeGatewayCookie,
  rewriteProviderSetCookie,
  stripProviderAddressHeaders
} = require("../src/gateway/proxyHeaders.js");

test("removes only the gateway session cookie", () => {
  assert.equal(
    removeGatewayCookie(
      "provider_sid=one; __Host-harson_aigc=private==; other=two",
      "__Host-harson_aigc"
    ),
    "provider_sid=one; other=two"
  );
  assert.equal(
    removeGatewayCookie("harson_aigc_gateway=private", "harson_aigc_gateway"),
    ""
  );
});

test("rewrites only provider cookie domains and keeps separate headers", () => {
  assert.deepEqual(
    rewriteProviderSetCookie(
      [
        "sid=abc; Domain=.yibaiaigc.com; Path=/; HttpOnly; Secure; SameSite=None",
        "other=xyz; Domain=unrelated.example; Path=/"
      ],
      "https://cl-base.yibaiaigc.com"
    ),
    [
      "sid=abc; Path=/; HttpOnly; Secure; SameSite=None",
      "other=xyz; Domain=unrelated.example; Path=/"
    ]
  );
});

test("keeps host-only and parent-domain cookies appropriately", () => {
  // No Domain attribute -> untouched (becomes host-only on the gateway).
  assert.equal(
    rewriteProviderSetCookie("sid=abc; Path=/", "https://yibaiaigc.com"),
    "sid=abc; Path=/"
  );

  // Parent domain of the upstream host -> Domain removed.
  assert.equal(
    rewriteProviderSetCookie("sid=abc; Domain=.yibaiaigc.com", "https://cl-base.yibaiaigc.com"),
    "sid=abc"
  );

  // Exact upstream host -> Domain removed.
  assert.equal(
    rewriteProviderSetCookie("sid=abc; Domain=yibaiaigc.com", "https://yibaiaigc.com"),
    "sid=abc"
  );
});

test("handles null and undefined without throwing", () => {
  assert.equal(rewriteProviderSetCookie(null, "https://yibaiaigc.com"), null);
  assert.equal(rewriteProviderSetCookie(undefined, "https://yibaiaigc.com"), undefined);
  assert.equal(removeGatewayCookie(undefined, "x"), "");
});

test("provider boundary drops client address assertions and keeps authentication/body headers", () => {
  const headers = new Map(Object.entries({
    "X-Forwarded-For": "203.0.113.15",
    "x-forwarded-host": "ai.harson-base.com",
    "x-forwarded-proto": "https",
    Forwarded: "for=203.0.113.15",
    "X-Real-IP": "203.0.113.15",
    "CF-Connecting-IP": "203.0.113.15",
    Authorization: "Bearer fixture",
    "Access-Token-Api": "fixture-api-token",
    Cookie: "provider_sid=fixture",
    "Content-Type": "application/json",
    Range: "bytes=0-99"
  }));
  stripProviderAddressHeaders({
    getHeaderNames: () => [...headers.keys()],
    removeHeader: name => headers.delete(name)
  });
  assert.deepEqual(Object.fromEntries(headers), {
    Authorization: "Bearer fixture",
    "Access-Token-Api": "fixture-api-token",
    Cookie: "provider_sid=fixture",
    "Content-Type": "application/json",
    Range: "bytes=0-99"
  });
});
