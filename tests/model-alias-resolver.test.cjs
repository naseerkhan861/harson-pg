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
  assert.equal(resolve("Seedance 2.5"), "CLVideo3.0");
  assert.equal(resolve("暂未上架"), "CLVideo-2.1");
});

test("case and whitespace variants resolve identically", () => {
  assert.equal(resolve("gpt-image-2.5"), "CLImage-4.1");
  assert.equal(resolve("GPT-IMAGE-2.5"), "CLImage-4.1");
  assert.equal(resolve("  全能图片   Pro  "), "CLImage-5.1");
  assert.equal(resolve("seedance 2.0"), "CLVideo2.0");
  assert.equal(resolve("HAPPY HORSE"), "CL Dragon");
});

test("display-spelling correspondences resolve through canonical keys", () => {
  assert.equal(resolve("悠船MJ V7"), "CLImage-2.0");
  assert.equal(resolve("悠船 MJ V7"), "CLImage-2.0");
  assert.equal(resolve("悠船M| V7"), "CLImage-2.0");
  assert.equal(resolve("全能图片2"), "CLImage-5.2");
  assert.equal(resolve("HappyHorse"), "CL Dragon");
  assert.equal(resolve("kontext-max"), "CLImage-1.2");
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

test("Seedance family policy per proposed_changes.md (15 Oct 2026)", () => {
  // Seedance and Seedance 2.5 intentionally share CLVideo3.0; only 2.0 differs.
  assert.equal(resolve("Seedance"), "CLVideo3.0");
  assert.equal(resolve("Seedance 2.5"), "CLVideo3.0");
  assert.equal(resolve("Seedance 2.0"), "CLVideo2.0");
  // Image families keep version specificity.
  assert.notEqual(resolve("image-2.5"), resolve("image-2"));
});

test("qualified video labels resolve only with the approved context", () => {
  const q = { allowQualified: true };

  assert.equal(resolve("Seedance 2.5 原生 720p", q), "CLVideo3.0 原生 720p");
  assert.equal(resolve("Seedance 2.0 高清", q), "CLVideo2.0 高清");
  assert.equal(resolve("seedance 2.5 原生 720p", q), "CLVideo3.0 原生 720p");
  assert.equal(resolve("  Seedance 2.5 原生 720p", q), "CLVideo3.0 原生 720p");

  // No context flag -> exact-only, the composite stays original.
  assert.equal(resolve("Seedance 2.5 原生 720p", null), null);
  assert.equal(resolve("Seedance 2.5 原生 720p", { surface: "sidebar" }), null);

  // Unknown versions must not convert through the bare-family mapping.
  assert.equal(resolve("Seedance 2.50", q), null);
  assert.equal(resolve("Seedance 3.0", q), null);
  assert.equal(resolve("Seedance2.5 原生", q), null); // missing boundary

  // Prompt-like text never matches (model name must lead the label).
  assert.equal(
    resolve("Generate an image inspired by Seedance 2.5", q),
    null
  );

  // One pass: an alias output is not a new source.
  assert.equal(resolve("CLVideo3.0 原生 720p", q), null);
});

test("video player and detail metadata replace each original occurrence", () => {
  const context = { module: "video-generator", surface: "video-metadata" };
  assert.equal(
    resolve("Seedance 2.5 原生 720p", context),
    "CLVideo3.0 原生 720p"
  );
  assert.equal(
    resolve("Seedance 2.5(Seedance 2.5 原生 720p)", context),
    "CLVideo3.0(CLVideo3.0 原生 720p)"
  );
  assert.equal(
    resolve("Seedance 2.5(Seedance 2.5 原生 720p\n)", context),
    "CLVideo3.0(CLVideo3.0 原生 720p\n)"
  );
  assert.equal(
    resolve("Seedance 2.0（Seedance 2.0 原生1080P）", context),
    "CLVideo2.0（CLVideo2.0 原生1080P）"
  );
  assert.equal(
    resolve("Seedance 2.5(Seedance 2.0 原生 720p)", context),
    null
  );
  assert.equal(resolve("Seedance 2.50 原生 720p", context), null);
  assert.equal(resolve("Seedance 3.0 原生 720p", context), null);
  assert.equal(
    resolve("Seedance 2.5(Seedance 2.5 原生 720p)"),
    null
  );
  assert.equal(
    resolve("Seedance 2.5(Seedance 2.5 原生 720p)", { module: "image-generator", surface: "video-metadata" }),
    null
  );
});

test("版本 dropdown: image-2版 renames only in clothing/e-commerce context", () => {
  const version = module => ({ module, surface: "version-dropdown" });

  assert.equal(resolve("image-2版", version("clothing")), "CLImage4.0");
  assert.equal(resolve("image-2版", version("e-commerce")), "CLImage4.0");
  assert.equal(resolve("image-2版"), null);
  assert.equal(resolve("image-2版", version("image-generator")), null);
  assert.equal(resolve("mage-2版", version("clothing")), null);
  // The global image-2 mapping is untouched by this contextual rule.
  assert.equal(resolve("image-2", version("clothing")), "CLImage-4.0");
  // Whitespace/case tolerance comes from normalize().
  assert.equal(resolve("  IMAGE-2版 ", version("clothing")), "CLImage4.0");
});

test("image-generator sidebar/headings: scoped overrides win only in context", () => {
  const imageSidebar = { module: "image-generator", surface: "image-sidebar" };
  const seedreamTitle = {
    module: "image-generator", surface: "image-family-title", family: "seedream"
  };
  const fluxPage = {
    module: "image-generator", surface: "image-page-label", family: "flux-krea"
  };

  // Scoped sidebar values (items 2, 3, 7).
  assert.equal(resolve("全能图片", imageSidebar), "CLImage-5.1");
  assert.equal(resolve("即梦", imageSidebar), "CLImage-3.3");
  assert.equal(resolve("FLUX Krea", imageSidebar), "CLImage-1.0");

  // Global mappings unchanged everywhere else.
  assert.equal(resolve("全能图片"), "CLImage-5.0");
  assert.equal(resolve("即梦"), "CLImage");
  assert.equal(resolve("Seedream"), "CLVideo");
  assert.equal(resolve("FLUX Krea"), "CLImage");

  // Existing versioned identities keep their own mappings.
  assert.equal(resolve("全能图片 Pro", imageSidebar), "CLImage-5.1");
  assert.equal(resolve("Seedream 5.0 Pro", seedreamTitle), "CLImage-3.3");

  // Seedream family heading inside the selected 即梦 view.
  assert.equal(resolve("Seedream", seedreamTitle), "CLImage");

  // FLUX Krea inner-page labels inside the selected FLUX Krea view.
  assert.equal(resolve("FLUX Krea", fluxPage), "CLImage-1.0");

  // The alias string itself is never a source; other labels unaffected.
  assert.equal(resolve("CLImage", fluxPage), null);
  assert.equal(resolve("image-2.5", imageSidebar), "CLImage-4.1");

  // Spelling variants covered by the scoped rule.
  assert.equal(resolve("FLUXKrea", imageSidebar), "CLImage-1.0");
  assert.equal(resolve("即梦 Seedream", imageSidebar), "CLImage-3.3");
});

test("Kontext pro and max keep distinct display identities", () => {
  assert.equal(resolve("kontext-pro"), "CLImage-1.1");
  assert.equal(resolve("kontext-max"), "CLImage-1.2");
  assert.equal(resolve("FLUX.1 Kontext pro"), "CLImage-1.1");
  assert.equal(resolve("FLUX.1 Kontext max"), "CLImage-1.2");

  // The generic family name is not evidence of a max selection.
  assert.equal(resolve("FLUX.1 Kontext"), "CLImage-1.1");
  assert.equal(resolve("CLImage-1.2"), null); // aliases are not source keys
});

test("Kontext title follows only its own selected variant", () => {
  const title = variant => ({
    module: "image-generator",
    surface: "image-family-title",
    family: "flux-kontext",
    variant
  });
  assert.equal(resolve("FLUX.1 Kontext", title("pro")), "CLImage-1.1");
  assert.equal(resolve("FLUX.1 Kontext", title("max")), "CLImage-1.2");
  assert.equal(resolve("FLUX.1 Kontext", title(null)), "CLImage-1.1");
  assert.equal(resolve("FLUX.1 Kontext"), "CLImage-1.1");
  assert.equal(resolve("kontext-max", title("pro")), "CLImage-1.2");
});

test("MiniMax exact labels preserve base and MAX identities", () => {
  assert.equal(resolve("MiniMax_H3"), "CLVideo-4.0");
  assert.equal(resolve("MiniMax-H3"), "CLVideo-4.0");
  assert.equal(resolve("MiniMax-H3-MAX"), "CLVideo-4.1");
  assert.equal(resolve("  minimax-h3-max  "), "CLVideo-4.1");
  assert.equal(resolve("CLVideo-4.0"), null);
  assert.equal(resolve("CLVideo-4.1"), null);
  assert.equal(resolve("MiniMax-H3-MAX-FAST"), null);
});

test("MiniMax metadata maps every explicit label while keeping its suffix", () => {
  const context = { module: "video-generator", surface: "video-metadata" };
  const cases = [
    ["MiniMax_H3 原生 720p", "CLVideo-4.0 原生 720p"],
    ["MiniMax-H3-MAX 1080P", "CLVideo-4.1 1080P"],
    ["MiniMax-H3(MiniMax-H3 原生 720p)", "CLVideo-4.0(CLVideo-4.0 原生 720p)"],
    ["MiniMax-H3-MAX(MiniMax-H3-MAX 原生 1080p)", "CLVideo-4.1(CLVideo-4.1 原生 1080p)"],
    ["MiniMax_H3（MiniMax-H3-MAX 原生1080p）", "CLVideo-4.0（CLVideo-4.1 原生1080p）"],
    [" MiniMax-H3 ( MiniMax-H3-MAX )\n", " CLVideo-4.0 ( CLVideo-4.1 )\n"]
  ];
  for (const [source, expected] of cases) {
    assert.equal(resolve(source, context), expected, source);
  }
});

test("MiniMax metadata rejects unknown versions and arbitrary text", () => {
  const context = { module: "video-generator", surface: "video-metadata" };
  for (const source of [
    "MiniMax-H30 原生 720p", "MiniMax-H3-MAX-FAST 1080p",
    "MiniMax_H3_MAX", "MiniMax-H3-MAX2", "MiniMax-H4",
    "Create a video with MiniMax-H3", "MiniMax-H3 sunset",
    "MiniMax-H3(MiniMax-H4 原生 720p)"
  ]) assert.equal(resolve(source, context), null, source);
  assert.equal(resolve("MiniMax_H3 原生 720p"), null);
  assert.equal(resolve("MiniMax_H3 原生 720p", {
    module: "image-generator", surface: "video-metadata"
  }), null);
});

test("mapping info reports schema and hash", () => {
  const info = resolver.mappingInfo();

  assert.equal(info.schemaVersion, 1);
  assert.match(info.mappingHash, /^[0-9a-f]{12}$/);
});
