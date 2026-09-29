"use strict";

/*
  Checks for the injection helper and adapter configuration.
  Alias DATA behavior is covered by tests/model-alias-resolver.test.cjs.
  Run from the repository root:  node --test tests/image-tab-injection.test.cjs
*/

const test = require("node:test");
const assert = require("node:assert/strict");

const config = require(
  "../public/harson-customization/image-tab-config.js"
);

const {
  ASSET_PREFIX,
  MAX_HTML_BYTES,
  injectImageTabAssets
} = require("../src/services/yibaiDisplayInjection.js");

const HTML =
  "<!DOCTYPE html><html><head><title>t</title></head>" +
  "<body></body></html>";

function inject(html, overrides) {
  return injectImageTabAssets(html, {
    enabled: true,
    moduleName: "image-generator",
    contentType: "text/html; charset=utf-8",
    ...overrides
  });
}

/* ---------------- configuration ---------------- */

test("config is scoped to the gateway origin and all YiBai modules", () => {
  assert.equal(config.expectedOrigin, "https://ai.harson-base.com");
  assert.ok(config.modules.includes("image-generator"));
  assert.ok(config.modules.includes("video-generator"));
  assert.ok(config.sidebarSelector.includes("NavList-list-item"));
});

test("verified selector coverage from the runbook is present", () => {
  for (const required of [
    ".MainLayout-nav .NavList-list-item > span.label",
    ".ToolLayout-header",
    ".DefaultLayout-header",
    ".header_fix > span",
    ".header_fix .IcTabs > .IcTab",
    ".SubLayout-draw .q-tab__label",
    ".q-tooltip"
  ]) {
    assert.ok(
      config.selectors.includes(required),
      `${required} must be targeted`
    );
  }

  // Floating headers must NOT be scoped under SubLayout-draw (runbook §2.4).
  for (const scoped of [
    ".SubLayout-draw .header_fix",
    ".SubLayout-draw .ToolLayout-header"
  ]) {
    assert.ok(
      !config.selectors.includes(scoped),
      `${scoped} over-scopes floating headers`
    );
  }
});

/* ---------------- module handling ---------------- */

test("injection applies to every module, tagged with its module name", () => {
  for (const moduleName of [
    "image-generator",
    "video-generator",
    "upscaler",
    "pattern-design",
    "clothing",
    "e-commerce"
  ]) {
    const result = inject(HTML, { moduleName });

    assert.notEqual(
      result,
      HTML,
      `${moduleName} must receive the scripts`
    );

    assert.ok(result.includes(
      `data-harson-module="${moduleName}"`
    ));
  }
});

test("injection refuses a missing module name", () => {
  assert.equal(inject(HTML, { moduleName: "" }), HTML);
  assert.equal(inject(HTML, { moduleName: undefined }), HTML);
});

test("injection only applies when explicitly enabled", () => {
  assert.equal(inject(HTML, { enabled: false }), HTML);
  assert.equal(inject(HTML, { enabled: undefined }), HTML);
});

/* ---------------- non-HTML pass-through ---------------- */

test("non-HTML content types pass through untouched", () => {
  for (const contentType of [
    "application/json",
    "application/javascript; charset=utf-8",
    "text/css",
    "text/plain",
    "application/octet-stream",
    ""
  ]) {
    assert.equal(
      inject(HTML, { contentType }),
      HTML,
      `${contentType} must not be touched`
    );
  }
});

test("non-string bodies pass through untouched", () => {
  assert.equal(inject(undefined), undefined);
  assert.equal(inject(null), null);
});

/* ---------------- bounded HTML injection ---------------- */

test("valid HTML gets the adapter script tags before </head>", () => {
  const result = inject(HTML);

  assert.ok(result.includes(
    `<script defer src="${ASSET_PREFIX}/image-tab-config.js"></script>`
  ));
  assert.ok(result.includes('id="harson-image-tab-labels"'));
  assert.ok(result.indexOf("<script") < result.indexOf("</head>"));
  assert.ok(result.startsWith("<!DOCTYPE html>"));
});

test("oversized HTML is refused", () => {
  const big =
    "<html><head>" +
    "x".repeat(MAX_HTML_BYTES) +
    "</head><body></body></html>";

  assert.equal(inject(big), big);
});

test("HTML without </head> is left untouched", () => {
  const noHead = "<html><body>partial</body>";

  assert.equal(inject(noHead), noHead);
});

test("already-injected documents are not injected twice", () => {
  const once = inject(HTML);

  assert.equal(inject(once), once);
});

test("exported constants match the deployment guide", () => {
  assert.equal(ASSET_PREFIX, "/__harson_custom/image-tab-1");
  assert.equal(MAX_HTML_BYTES, 2 * 1024 * 1024);
});
