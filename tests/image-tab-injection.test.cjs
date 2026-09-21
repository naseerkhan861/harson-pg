"use strict";

/*
  Dependency-free checks for the image-tab display layer.
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

/* ---------------- mapping ---------------- */

test("config exposes the six requested aliases", () => {
  for (const [source, alias] of [
    ["悠船Midjourney V7", "HarsonMD"],
    ["全能图片", "Harson-ZP"],
    ["即梦", "Harson-SD"],
    ["GPT-image-2", "HarsonIM2"],
    ["FLUX.1 Kontext", "HarsonFK1"],
    ["FLUX Krea", "HarsonFK"]
  ]) {
    assert.equal(config.aliases[source], alias);
  }
});

test("related display spellings map to the same family aliases", () => {
  assert.equal(config.aliases["悠船MJ V7"], "HarsonMD");
  assert.equal(config.aliases["悠船 MJ V7"], "HarsonMD");
  assert.equal(config.aliases["image-2"], "HarsonIM2");
  assert.equal(config.aliases["Seedream"], "Harson-SD");
  assert.equal(config.aliases["即梦 Seedream"], "Harson-SD");
  assert.equal(config.aliases["全能图片 pro"], "Harson-ZP pro");
  assert.equal(config.aliases["全能图片2"], "Harson-ZP 2");
  assert.equal(config.aliases["kontext-pro"], "HarsonFK1 pro");
  assert.equal(config.aliases["kontext-max"], "HarsonFK1 max");
});

test("versioned Seedream variants keep their versions; bare versions stay unmapped", () => {
  assert.equal(config.aliases["Seedream 4.5"], "Harson-SD 4.5");
  assert.equal(config.aliases["即梦5.0 pro"], "Harson-SD 5.0 pro");
  assert.equal(config.aliases["即梦Seedream5.0 lite"], "Harson-SD 5.0 lite");
  assert.equal(config.aliases["4.5"], undefined);
  assert.equal(config.aliases["HarsonFK1"], undefined);
});

test("unknown labels are not aliased (no substring guessing)", () => {
  assert.equal(config.aliases["悠船"], undefined);
  assert.equal(config.aliases["FLUX"], undefined);
  assert.equal(config.aliases["SeeDance 2.5"], undefined);
});

test("config is scoped to the gateway origin and image module", () => {
  assert.equal(config.expectedOrigin, "https://ai.harson-base.com");
  assert.equal(config.moduleName, "image-generator");
  assert.ok(config.sidebarSelector.includes("NavList-list-item"));
  assert.ok(config.selectors.length > 0);
});

/* ---------------- module isolation ---------------- */

test("injection only applies to the image-generator module", () => {
  for (const moduleName of [
    "video-generator",
    "upscaler",
    "pattern-design",
    "clothing",
    "e-commerce"
  ]) {
    assert.equal(
      inject(HTML, { moduleName }),
      HTML,
      `${moduleName} must not be touched`
    );
  }

  assert.notEqual(inject(HTML), HTML);
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

test("valid HTML gets both deferred script tags before </head>", () => {
  const result = inject(HTML);

  assert.ok(result.includes(
    `<script defer src="${ASSET_PREFIX}/image-tab-config.js"></script>`
  ));
  assert.ok(result.includes('id="harson-image-tab-labels"'));
  assert.ok(result.includes('data-harson-module="image-generator"'));
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
