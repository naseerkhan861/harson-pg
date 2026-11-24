"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/js/aigc-workspace.js"), "utf8");
const requestCode = source.slice(
  source.indexOf("async function requestSession("),
  source.indexOf("async function refreshSessionInBackground(")
);
const messageCode = source.slice(
  source.indexOf("function handleIframeMessage("),
  source.indexOf("/**\n * 使用现有 Workspace Token", source.indexOf("function handleIframeMessage("))
);
const recoveryState = source.match(/const MAX_AUTO_LOGIN_RECOVERY_ATTEMPTS = \d+;\s*let automaticLoginRecoveryAttempts = 0;/)?.[0];

function harness() {
  assert.ok(requestCode && messageCode && recoveryState, "workspace recovery entry points exist");
  const calls = [];
  const errors = [];
  let gate;
  let release;
  const scope = {
    FRAME_LOGIN_INVALID: "AIGC_LOGIN_INVALID",
    AIGC_DOWNLOAD_REQUEST: "AIGC_DOWNLOAD_REQUEST",
    MEMBER_INFO: "MEMBER_INFO",
    state: { loading: false, currentView: "module", currentModule: "image-generator",
      currentFrameOrigin: "https://ai.harson-base.com", requestVersion: 0 },
    elements: { frame: { src: "/fixture-frame", contentWindow: {} } },
    cancelBackgroundTokenSync() {},
    stopHomeBannerAutoPlay() {},
    updateActiveNavigation() {},
    showLoading() { scope.state.loading = true; },
    showError(message) { errors.push(message); scope.state.loading = false; },
    showFrame(url) {
      scope.elements.frame.src = url;
      scope.state.currentFrameOrigin = "https://ai.harson-base.com";
      scope.state.loading = false;
    },
    updateTokenBalance() {},
    clearTokenBalance() {},
    handleMemberInfo() {},
    async readJsonResponse() {
      return { success: true, result: { tokenBalance: 10, frameUrl: "/fixture-frame" } };
    },
    async fetch(url, options) {
      calls.push({ url, options });
      if (gate) await gate;
      return { ok: true, status: 200 };
    },
    window: { location: { href: "" } },
    URL,
    Error,
    console
  };
  const context = vm.createContext(scope);
  vm.runInContext(recoveryState + "\n" + requestCode + "\n" + messageCode, context);
  return {
    context, calls, errors,
    invalid(overrides = {}) {
      context.handleIframeMessage({
        source: context.elements.frame.contentWindow,
        origin: "https://ai.harson-base.com",
        data: { type: "AIGC_LOGIN_INVALID" },
        ...overrides
      });
    },
    block() { gate = new Promise(resolve => { release = resolve; }); },
    release() { release?.(); gate = undefined; }
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test("persistent iframe invalid-login messages stop after one automatic recovery", async () => {
  const h = harness();
  await h.context.requestSession();
  h.invalid();
  await settle();
  assert.equal(h.calls.length, 2); // initial load + one recovery
  h.invalid();
  await settle();
  assert.equal(h.calls.length, 2);
  assert.equal(h.context.elements.frame.src, "about:blank");
  assert.equal(h.context.state.currentFrameOrigin, null);
  assert.equal(h.errors.length, 1);
  h.invalid();
  await settle();
  assert.equal(h.calls.length, 2);
});

test("untrusted frame origins and sources cannot trigger recovery", async () => {
  const h = harness();
  h.invalid({ origin: "https://unrelated.example" });
  h.invalid({ source: {} });
  await settle();
  assert.equal(h.calls.length, 0);
  assert.equal(h.errors.length, 0);
});

test("duplicate messages during recovery do not queue more logins or reset the budget", async () => {
  const h = harness();
  await h.context.requestSession();
  h.block();
  h.invalid();
  for (let i = 0; i < 10; i += 1) h.invalid();
  await settle();
  assert.equal(h.calls.length, 2);
  h.release();
  await settle();
  h.context.handleIframeMessage({
    source: h.context.elements.frame.contentWindow,
    origin: "https://ai.harson-base.com",
    data: { type: "MEMBER_INFO" }
  });
  h.invalid();
  await settle();
  assert.equal(h.calls.length, 2);
  assert.equal(h.errors.length, 1);
});

test("an explicit manual refresh starts a fresh recovery budget", async () => {
  const h = harness();
  await h.context.requestSession();
  h.invalid();
  await settle();
  h.invalid();
  await settle();
  await h.context.requestSession({ refresh: true });
  assert.equal(h.calls.length, 3);
  h.invalid();
  await settle();
  assert.equal(h.calls.length, 4);
  h.invalid();
  await settle();
  assert.equal(h.calls.length, 4);
});
