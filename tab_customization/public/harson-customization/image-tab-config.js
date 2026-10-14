(function (root) {
  "use strict";

  // Display strings only. These are NOT provider model IDs or API values.
  const models = [
    { source: "悠船Midjourney V7", alias: "HarsonMD" },
    { source: "全能图片", alias: "Harson-ZP" },
    { source: "即梦", alias: "Harson-SD" },
    { source: "GPT-image-2", alias: "HarsonIM2" },
    { source: "FLUX.1 Kontext", alias: "HarsonFK1" },
    { source: "FLUX Krea", alias: "HarsonFK" }
  ].map(Object.freeze);

  const aliases = Object.fromEntries(models.map(m => [m.source, m.alias]));
  // Alternate display spellings seen in the screenshots/public UI components.
  // Keep version information: different provider variants must remain distinct.
  Object.assign(aliases, {
    "悠船MJ V7": "HarsonMD",
    "悠船 MJ V7": "HarsonMD",
    "image-2": "HarsonIM2",
    "即梦 Seedream": "Harson-SD",
    "Seedream": "Harson-SD",
    "全能图片 pro": "Harson-ZP pro",
    "全能图片2": "Harson-ZP 2",
    "kontext-pro": "HarsonFK1 pro",
    "kontext-max": "HarsonFK1 max"
  });

  for (const version of ["4.0", "4.5", "5.0 lite", "5.0 pro"]) {
    for (const family of ["即梦", "Seedream", "即梦Seedream"]) {
      for (const separator of ["", " "]) {
        aliases[family + separator + version] = "Harson-SD " + version;
      }
    }
  }

  const config = Object.freeze({
    version: "image-tab-1",
    expectedOrigin: "https://ai.harson-base.com",
    moduleName: "image-generator",
    sidebarSelector: ".MainLayout-nav .NavList-list-item > span.label",
    models: Object.freeze(models),
    aliases: Object.freeze(aliases),
    // Only model-label surfaces. Never select the whole page, prompts or forms.
    // Public component names checked on 2026-09-21; see the deployment guide.
    selectors: Object.freeze([
      ".MainLayout-nav .NavList-list-item > span.label",
      ".SubLayout-draw .ToolLayout-header",
      ".SubLayout-draw .header_fix > span",
      ".SubLayout-draw .header_fix .q-tab__label",
      ".SubLayout-draw .header_fix .IcTab",
      ".SubLayout-draw .IcbsMenuSelect-header-content",
      ".SubLayout-draw .IcbsSelect-header-select .q-field__native > span",
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
