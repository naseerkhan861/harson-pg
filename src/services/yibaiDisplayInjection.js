"use strict";

// Called ONLY by an authenticated YiBai UI gateway, after its upstream response
// has been identified as an HTML document and decoded to UTF-8. This helper is
// not a proxy, authentication middleware, or a reason to buffer API responses.
const ASSET_PREFIX = "/__harson_custom/image-tab-1";
const SCRIPT_MARKER = "harson-image-tab-labels";
const NAV_MARKER = "harson-nav-visibility";
const VIDEO_NAV_MARKER = "harson-video-nav-alignment";
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function injectImageTabAssets(html, {
  enabled = false,
  hideVirtualSample = false,
  moduleName,
  contentType = ""
} = {}) {
  // The navigation filter is independent of the alias feature: inject when
  // either is requested. Shared guards: module session, HTML type, size cap.
  if ((!enabled && !hideVirtualSample) || !moduleName ||
      !/^text\/html(?:\s*;|\s*$)/i.test(contentType) ||
      typeof html !== "string" || Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return html;
  }

  const end = html.search(/<\/head\s*>/i);
  if (end < 0) return html;

  // Navigation filter (proposed_changes.md, 15 Oct): a regular,
  // NON-deferred head script installs its observer before the provider
  // mounts the app; the stylesheet precedes it. Idempotent per asset.
  const navTags = hideVirtualSample && !html.includes(`id="${NAV_MARKER}"`)
    ? '<link rel="stylesheet" href="' + ASSET_PREFIX + '/nav-visibility.css">' +
      '<script id="' + NAV_MARKER + '" src="' + ASSET_PREFIX +
      '/nav-visibility.js"></script>'
    : "";

  // Video-generator sidebar alignment (suggest_changes.md, 28 Oct):
  // keeps the label start inset constant across normal/active rows.
  // Scoped to video-generator HTML only; idempotent via its marker.
  const videoNavTags =
    moduleName === "video-generator" &&
    !html.includes(`id="${VIDEO_NAV_MARKER}"`)
      ? `<link id="${VIDEO_NAV_MARKER}" rel="stylesheet" ` +
        `href="${ASSET_PREFIX}/video-nav-alignment.css">`
      : "";

  // Model-name aliases: dependency order (runbook §13.1) — generated
  // data -> shared resolver -> adapter config -> DOM renderer, deferred.
  const aliasTags = enabled && !html.includes(`id="${SCRIPT_MARKER}"`)
    ? `<script defer src="${ASSET_PREFIX}/model-aliases.generated.js"></script>` +
      `<script defer src="${ASSET_PREFIX}/model-alias-resolver.js"></script>` +
      `<script defer src="${ASSET_PREFIX}/image-tab-config.js"></script>` +
      `<script defer id="${SCRIPT_MARKER}" data-harson-module="${moduleName}" ` +
      `src="${ASSET_PREFIX}/image-tab-labels.js"></script>`
    : "";

  return html.slice(0, end) + navTags + videoNavTags + aliasTags + html.slice(end);
}

module.exports = {
  ASSET_PREFIX,
  MAX_HTML_BYTES,
  NAV_MARKER,
  injectImageTabAssets
};
