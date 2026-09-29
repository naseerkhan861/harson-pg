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

/* ---------------- mapping (source: tab_customization/names.txt) ---------------- */

test("config exposes the names.txt aliases", () => {
  for (const [source, alias] of [
    ["FLUX Krea", "CLImage-1.0"],
    ["FLUX.1 Kontext pro", "CLImage-1.1"],
    ["FLUX.1 Kontext max", "CLImage-1.1"],
    ["Midjourney V7", "CLImage-2.0"],
    ["Midjourney", "CLImage"],
    ["即梦", "CLImage"],
    ["即梦 4.0", "CLImage-3.0"],
    ["即梦 4.5", "CLImage-3.1"],
    ["即梦 5.0 Lite", "CLImage-3.2"],
    ["即梦 5.0 Pro", "CLImage-3.3"],
    ["image-2", "CLImage-4.0"],
    ["image-2.5", "CLImage-4.1"],
    ["GPT-image-2", "CLImage-4.0"],
    ["GPT-image-2.5", "CLImage-4.1"],
    ["全能图片", "CLImage-5.0"],
    ["全能图片 Pro", "CLImage-5.1"],
    ["全能图片 2", "CLImage-5.2"],
    ["Seedance 2.0", "CLVideo-2.0"],
    ["Seedance", "CLVideo"],
    ["Seedance 2.5", "CLVideo-3.0"],
    ["Happy Horse", "CLVideo-1.0"],
    ["暂未上架", "CLVideo-2.1"]
  ]) {
    assert.equal(config.aliases[source], alias);
  }
});

test("related display spellings map to the same family aliases", () => {
  assert.equal(config.aliases["悠船Midjourney V7"], "CLImage-2.0");
  assert.equal(config.aliases["悠船 MJ V7"], "CLImage-2.0");
  assert.equal(config.aliases["悠船M| V7"], "CLImage-2.0");
  assert.equal(config.aliases["Seedream"], "CLImage");
  assert.equal(config.aliases["Seedream 5.0 Pro"], "CLImage-3.3");
  assert.equal(config.aliases["即梦 Seedream"], "CLImage");
  assert.equal(config.aliases["全能图片 pro"], "CLImage-5.1");
  assert.equal(config.aliases["全能图片2"], "CLImage-5.2");
  assert.equal(config.aliases["kontext-pro"], "CLImage-1.1");
  assert.equal(config.aliases["GPT-Image-2.5"], "CLImage-4.1");
});

test("no-space variants resolve; bare versions stay unmapped", () => {
  assert.equal(config.aliases["即梦4.0"], "CLImage-3.0");
  assert.equal(config.aliases["Seedream5.0 Lite"], "CLImage-3.2");
  assert.equal(config.aliases["4.5"], undefined);
  assert.equal(config.aliases["CLImage-1.0"], undefined);
});

test("unknown labels are not aliased (no substring guessing)", () => {
  assert.equal(config.aliases["悠船"], undefined);
  assert.equal(config.aliases["FLUX"], undefined);
  assert.equal(config.aliases["SeeDance 2.0 VIP"], undefined);
  assert.equal(config.aliases["高清放大 2.0"], undefined);
  assert.equal(config.aliases["爆款视频复刻"], undefined);
});

test("config is scoped to the gateway origin and all YiBai modules", () => {
  assert.equal(config.expectedOrigin, "https://ai.harson-base.com");
  assert.ok(config.modules.includes("image-generator"));
  assert.ok(config.modules.includes("video-generator"));
  assert.ok(config.sidebarSelector.includes("NavList-list-item"));
  assert.ok(config.selectors.length > 0);
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
