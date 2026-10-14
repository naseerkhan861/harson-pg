"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../public/harson-customization/image-tab-config");
const { injectImageTabAssets: inject, MAX_HTML_BYTES } =
  require("../src/services/yibaiDisplayInjection");

const html = '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head>' +
  '<body><div id="q-app"></div></body></html>';
const options = { enabled: true, moduleName: "image-generator", contentType: "text/html; charset=utf-8" };

test("the six supplied mappings are exact and variant labels remain distinct", () => {
  assert.deepEqual(config.models.map(x => [x.source, x.alias]), [
    ["悠船Midjourney V7", "HarsonMD"], ["全能图片", "Harson-ZP"],
    ["即梦", "Harson-SD"], ["GPT-image-2", "HarsonIM2"],
    ["FLUX.1 Kontext", "HarsonFK1"], ["FLUX Krea", "HarsonFK"]
  ]);
  assert.notEqual(config.aliases["kontext-pro"], config.aliases["kontext-max"]);
  assert.equal(config.aliases["一键同款"], undefined);
  assert.equal(config.aliases["flux-kontext-max"], undefined);
});

test("only an explicitly enabled image HTML document receives external assets", () => {
  const result = inject(html, options);
  assert.match(result, /data-harson-module="image-generator"/);
  assert.match(result, /image-tab-config\.js/);
  assert.match(result, /image-tab-labels\.js/);
  assert.ok(result.indexOf("image-tab-labels.js") < result.indexOf("</head>"));
  assert.equal(inject(result, options), result, "idempotent injection");
  assert.equal(inject(html), html, "disabled by default");
  assert.equal(inject(html, { ...options, enabled: false }), html);
  assert.equal(inject(html, { ...options, moduleName: "pattern-design" }), html);
});

test("JSON, JavaScript, malformed and oversized documents are not rewritten", () => {
  for (const contentType of ["application/json", "text/javascript", "text/event-stream", "image/png"]) {
    assert.equal(inject(html, { ...options, contentType }), html);
  }
  const json = '{"model":"flux-kontext-max","prompt":"FLUX.1 Kontext"}';
  assert.equal(inject(json, options), json);
  const oversized = html + "x".repeat(MAX_HTML_BYTES);
  assert.equal(inject(oversized, options), oversized);
  assert.equal(inject("<html><body>悠船MJ V7</body></html>", options),
    "<html><body>悠船MJ V7</body></html>");
});
