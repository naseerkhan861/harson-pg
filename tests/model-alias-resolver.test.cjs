"use strict";

/*
  Tests for the shared display-name resolver.
  Run: node --test tests/model-alias-resolver.test.cjs
*/

const test = require("node:test");
const assert = require("node:assert/strict");

const resolver = require(
  "../public/harson-customization/model-alias-resolver.js"
);

const resolve = resolver.resolveDisplayName;

test("resolves exact canonical full names", () => {
  assert.equal(resolve("FLUX Krea"), "CLImage");
  assert.equal(resolve("Midjourney V7"), "CLImage-2.0");
  assert.equal(resolve("即梦 5.0 Pro"), "CLImage-3.3");
  assert.equal(resolve("image-2.5"), "CLImage-4.1");
  assert.equal(resolve("Seedance 2.5"), "CLVideo-3.0");
  assert.equal(resolve("暂未上架"), "CLVideo-2.1");
});

test("case and whitespace variants resolve identically", () => {
  assert.equal(resolve("gpt-image-2.5"), "CLImage-4.1");
  assert.equal(resolve("GPT-IMAGE-2.5"), "CLImage-4.1");
  assert.equal(resolve("  全能图片   Pro  "), "CLImage-5.1");
  assert.equal(resolve("seedance 2.0"), "CLVideo-2.0");
  assert.equal(resolve("HAPPY HORSE"), "CLVideo-1.0");
});

test("display-spelling correspondences resolve through canonical keys", () => {
  assert.equal(resolve("悠船MJ V7"), "CLImage-2.0");
  assert.equal(resolve("悠船 MJ V7"), "CLImage-2.0");
  assert.equal(resolve("悠船M| V7"), "CLImage-2.0");
  assert.equal(resolve("全能图片2"), "CLImage-5.2");
  assert.equal(resolve("HappyHorse"), "CLVideo-1.0");
  assert.equal(resolve("kontext-max"), "CLImage-1.1");
  assert.equal(resolve("FLUXKrea"), "CLImage");
});

test("Seedream policies: bare -> CLVideo, versioned -> CLImage-3.x", () => {
  assert.equal(resolve("Seedream"), "CLVideo");
  assert.equal(resolve("Seedream 4.0"), "CLImage-3.0");
  assert.equal(resolve("Seedream 4.5"), "CLImage-3.1");
  assert.equal(resolve("Seedream 5.0 Lite"), "CLImage-3.2");
  assert.equal(resolve("Seedream 5.0 Pro"), "CLImage-3.3");
});

test("short versions resolve only in the seedream version-selector context", () => {
  const context = {
    surface: "model-version-tab",
    modelFamily: "seedream"
  };

  assert.equal(resolve("4.0", context), "CLImage-3.0");
  assert.equal(resolve("4.5", context), "CLImage-3.1");
  assert.equal(resolve("5.0 lite", context), "CLImage-3.2");
  assert.equal(resolve("5.0 pro", context), "CLImage-3.3");

  // Wrong surface, wrong family, or no context -> unchanged.
  assert.equal(resolve("4.5", null), null);
  assert.equal(
    resolve("4.5", { surface: "sidebar", modelFamily: "seedream" }),
    null
  );
  assert.equal(
    resolve("4.5", { surface: "model-version-tab", modelFamily: "flux" }),
    null
  );
});

test("unknown labels stay original (no substring or prefix guessing)", () => {
  assert.equal(resolve("Seedream 5.0"), null);
  assert.equal(resolve("SeeDance 2.0 VIP"), null);
  assert.equal(resolve("高清放大 2.0"), null);
  assert.equal(resolve("爆款视频复刻"), null);
  assert.equal(resolve("一键同款"), null);
  assert.equal(resolve("悠船"), null);
  assert.equal(resolve("FLUX"), null);
  assert.equal(resolve("Midjourney V8"), null);
  assert.equal(resolve(""), null);
  assert.equal(resolve(null), null);
});

test("resolution does not cascade: aliases are not new sources", () => {
  assert.equal(resolve("CLImage"), null);
  assert.equal(resolve("CLImage-4.0"), null);
  assert.equal(resolve("CLVideo-3.0"), null);
});

test("specific versions never collapse to family aliases", () => {
  assert.notEqual(resolve("image-2.5"), resolve("image-2"));
  assert.notEqual(resolve("Seedance 2.5"), resolve("Seedance"));
});

test("mapping info reports schema and hash", () => {
  const info = resolver.mappingInfo();

  assert.equal(info.schemaVersion, 1);
  assert.match(info.mappingHash, /^[0-9a-f]{12}$/);
});
