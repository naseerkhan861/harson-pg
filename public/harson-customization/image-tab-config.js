(function (root) {
  "use strict";

  // Display strings only. These are NOT provider model IDs or API values.
  // Source of truth: tab_customization/names.txt (left = original label,
  // right = display alias), extended with the display spellings the live
  // YiBai UI actually renders (悠船 prefixes, SeeDance casing, no-space
  // variants). Matching is trim + case-insensitive, with a fallback that
  // ignores internal spaces entirely ("HappyHorse" === "Happy Horse").
  // Duplicate keys in names.txt: the LAST row wins (Happy Horse and
  // FLUX Krea both appear twice).
  const aliases = {
    // --- image families (names.txt) ---
    "FLUX Krea": "CLImage", // last row wins over the earlier CLImage-1.0 row
    "FLUX.1 Kontext": "CLImage-1.1",
    "FLUX.1 Kontext pro": "CLImage-1.1",
    "FLUX.1 Kontext max": "CLImage-1.1",
    "Midjourney V7": "CLImage-2.0",
    "Midjourney": "CLImage",
    "即梦": "CLImage",
    "即梦 4.0": "CLImage-3.0",
    "即梦 4.5": "CLImage-3.1",
    "即梦 5.0 Lite": "CLImage-3.2",
    "即梦 5.0 Pro": "CLImage-3.3",
    "image-2": "CLImage-4.0",
    "image-2.5": "CLImage-4.1",
    "GPT-image-2": "CLImage-4.0",
    "GPT-image-2.5": "CLImage-4.1",
    "gpt-image-2.5": "CLImage-4.1",
    "全能图片": "CLImage-5.0",
    "全能图片 Pro": "CLImage-5.1",
    "全能图片 2": "CLImage-5.2",

    // --- video families (names.txt) ---
    "Seedance 2.0": "CLVideo-2.0",
    "Seedance": "CLVideo",
    "Seedance 2.5": "CLVideo-3.0",
    "Seedream": "CLVideo",
    "Happy Horse": "CLVideo-1.0",
    "暂未上架": "CLVideo-2.1",

    // --- display spellings seen on the live UI (same targets) ---
    "悠船Midjourney V7": "CLImage-2.0",
    "悠船 Midjourney V7": "CLImage-2.0",
    "悠船MJ V7": "CLImage-2.0",
    "悠船 MJ V7": "CLImage-2.0",
    "悠船M| V7": "CLImage-2.0",
    "悠船M｜ V7": "CLImage-2.0",
    "MidjourneyV7": "CLImage-2.0",
    "Kontext Pro": "CLImage-1.1",
    "kontext-pro": "CLImage-1.1",
    "Kontext Max": "CLImage-1.1",
    "kontext-max": "CLImage-1.1",
    "SeeDance 2.0": "CLVideo-2.0",
    "SeeDance 2.5": "CLVideo-3.0",
    "SeeDance": "CLVideo",
    "HappyHorse": "CLVideo-1.0",
    "GPT-Image-2": "CLImage-4.0",
    "GPT-Image-2.5": "CLImage-4.1",
    "GPT image 2": "CLImage-4.0",
    "GPT image 2.5": "CLImage-4.1"
  };

  // No-space variants (即梦4.0, 全能图片2, MidjourneyV7 handled above, ...).
  for (const version of ["4.0", "4.5", "5.0 Lite", "5.0 Pro"]) {
    aliases["即梦" + version] = aliases["即梦 " + version];
  }
  for (const [source, alias] of [
    ["全能图片 pro", aliases["全能图片 Pro"]],
    ["全能图片Pro", aliases["全能图片 Pro"]],
    ["全能图片2", aliases["全能图片 2"]],
    ["FLUX.1 Kontext Pro", aliases["FLUX.1 Kontext pro"]],
    ["FLUX.1 Kontext Max", aliases["FLUX.1 Kontext max"]],
    ["FLUX.1Kontext", aliases["FLUX.1 Kontext"]],
    ["FLUXKrea", aliases["FLUX Krea"]]
  ]) {
    aliases[source] = alias;
  }

  const config = Object.freeze({
    version: "all-pages-4",
    expectedOrigin: "https://ai.harson-base.com",
    // Applied inside every YiBai module frame served by the gateway.
    modules: Object.freeze([
      "image-generator",
      "upscaler",
      "video-generator",
      "pattern-design",
      "prompt-generator",
      "clothing",
      "e-commerce"
    ]),
    sidebarSelector: ".MainLayout-nav .NavList-list-item > span.label",
    aliases: Object.freeze(aliases),
    // Only model-label surfaces. Never select the whole page, prompts or forms.
    // Verified against the live provider bundle 2026-09-29: header_fix and
    // ToolLayout-header no longer exist in the current build; tabs are plain
    // Quasar q-tab__label, tooltips are q-tooltip, and the tool heading is a
    // bare Vue slot-fallback text node (handled via dumpUnmatched diagnostics).
    selectors: Object.freeze([
      ".MainLayout-nav .NavList-list-item > span.label",
      // Legacy-build selectors kept (harmless if absent):
      ".SubLayout-draw .ToolLayout-header",
      ".SubLayout-draw .header_fix > span",
      ".SubLayout-draw .header_fix .q-tab__label",
      ".SubLayout-draw .header_fix .IcTab",
      // Current build (2026-09-29):
      ".SubLayout-draw .q-tab__label",
      ".SubLayout-draw .IcTabs",
      ".q-tooltip",
      ".q-tooltip *",
      ".SubLayout-draw .IcbsMenuSelect-header-content",
      ".SubLayout-draw .IcbsSelect-header-select .q-field__native > span",
      ".IcbsMenuSelect-header-content",
      ".IcbsSelect-header-popup .IcbsSelect-header-popup-option-label",
      ".IcbsMenuSelect-menu-card .IcbsMenuSelect-menu-item-label",
      ".DemoCard .DemoCard-banner > span",
      ".TextToImageCard .TextToImageCard-header-typeName > span",
      ".q-dialog .header-container .header .vertical-center > span.title"
    ])
  });

  if (typeof module === "object" && module.exports) module.exports = config;
  else root.HarsonImageTabConfig = config;
})(typeof window === "object" ? window : globalThis);
