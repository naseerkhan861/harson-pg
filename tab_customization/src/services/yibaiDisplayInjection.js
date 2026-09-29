"use strict";

// Called ONLY by an authenticated YiBai UI gateway, after its upstream response
// has been identified as an HTML document and decoded to UTF-8. This helper is
// not a proxy, authentication middleware, or a reason to buffer API responses.
const ASSET_PREFIX = "/__harson_custom/image-tab-1";
const SCRIPT_MARKER = "harson-image-tab-labels";
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function injectImageTabAssets(html, {
  enabled = false,
  moduleName,
  contentType = ""
} = {}) {
  if (!enabled || moduleName !== "image-generator" ||
      !/^text\/html(?:\s*;|\s*$)/i.test(contentType) ||
      typeof html !== "string" || Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES ||
      html.includes(`id="${SCRIPT_MARKER}"`)) return html;

  const end = html.search(/<\/head\s*>/i);
  if (end < 0) return html;
  const tags =
    `<script defer src="${ASSET_PREFIX}/image-tab-config.js"></script>` +
    `<script defer id="${SCRIPT_MARKER}" data-harson-module="image-generator" ` +
    `src="${ASSET_PREFIX}/image-tab-labels.js"></script>`;
  return html.slice(0, end) + tags + html.slice(end);
}

module.exports = { ASSET_PREFIX, MAX_HTML_BYTES, injectImageTabAssets };
