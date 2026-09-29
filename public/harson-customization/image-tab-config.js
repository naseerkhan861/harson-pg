(function (root) {
  "use strict";

  // Provider-surface adapter configuration. Alias DATA lives in
  // model-aliases.generated.js (built from config/display-names/names.txt)
  // and lookups go through model-alias-resolver.js — nothing here decides
  // model names.
  //
  // Selector notes (verified against provider bundles, 2026-09-29):
  //   - Floating header_fix blocks render BEFORE the content containing
  //     SubLayout-draw, so the header selectors must NOT be scoped under
  //     .SubLayout-draw (runbook §2.4). The classes exist in the workflow
  //     components.
  //   - IcTabs is a wrapper; the visible text is in the individual IcTab
  //     children (runbook §2.5).
  //   - The FLUX Krea workflow page uses DefaultLayout-header (§2.6).
  //   - The tool heading may be a bare Vue slot-fallback text node inside
  //     these header containers; the renderer aggregates a container's full
  //     text when it is exactly a known label.
  const config = Object.freeze({
    version: "all-pages-5",
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
    // Diagnostic only — no longer an activation gate (runbook §8.2).
    sidebarSelector: ".MainLayout-nav .NavList-list-item > span.label",
    // Only model-label surfaces. Never select the whole page, prompts or
    // forms. Matching remains exact against approved model labels.
    selectors: Object.freeze([
      ".MainLayout-nav .NavList-list-item > span.label",
      // Headings and floating model headers (unscoped: they float outside
      // SubLayout-draw):
      ".ToolLayout-header",
      ".DefaultLayout-header",
      ".header_fix > span",
      ".header_fix .IcTabs > .IcTab",
      // Version tab rows inside the form area:
      ".SubLayout-draw .q-tab__label",
      // Selected model + dropdown surfaces:
      ".IcbsMenuSelect-header-content",
      ".IcbsMenuSelect-menu-item-label",
      ".IcbsSelect-header-popup-option-label",
      ".SubLayout-draw .IcbsSelect-header-select .q-field__native > span",
      // Badges, history and dialogs:
      ".DemoCard .DemoCard-banner > span",
      ".TextToImageCard .TextToImageCard-header-typeName > span",
      ".q-dialog .header-container .header .vertical-center > span.title",
      // Tooltips (portal-mounted):
      ".q-tooltip",
      ".q-tooltip *"
    ]),
    // Elements whose ENTIRE normalized text is a known label may be
    // aggregated (split/nested spans, IcTab wrappers). Guarded: no form
    // controls or blocked descendants allowed inside.
    aggregateSelectors: Object.freeze([
      ".header_fix .IcTabs > .IcTab",
      ".header_fix > span",
      ".ToolLayout-header",
      ".DefaultLayout-header"
    ]),
    // Contextual short-version tabs (Seedream selector).
    versionTabSelector: ".header_fix .IcTabs > .IcTab",
    versionFamilyContainer: ".header_fix"
  });

  if (typeof module === "object" && module.exports) module.exports = config;
  else root.HarsonImageTabConfig = config;
})(typeof window === "object" ? window : globalThis);
