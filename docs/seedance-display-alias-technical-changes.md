# Seedance display-name changes: technical implementation on `temp-main`

**Repository:** [naseerkhan861/harson-pg](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Reference implementation:** [merged PR #32](https://github.com/naseerkhan861/harson-pg/pull/32)  
**Scope:** YiBai video module inside the `ai.harson-base.com` iframe, including video navigation, selected model headings, player badges and clicked-video details. This is a record of the *code changes*, not merely a deployment checklist.

> **Current state (15 October 2026):** These changes are already present on `temp-main`. If your checkout contains `collectVideoMetadata` in `public/harson-customization/image-tab-labels.js`, do not paste the same changes a second time. Use this document to review the implementation, reproduce it on another branch, and verify that the correct files reach your server. The remaining old labels observed after merging PR #32 came from an older gateway asset being served.

## 1. Required display behavior

| Provider text / context | Harson display |
| --- | --- |
| `Seedance` as a standalone model label | `CLVideo3.0` |
| `Seedance 2.5` as a standalone model label | `CLVideo3.0` |
| `Seedance 2.0` as a standalone model label | `CLVideo2.0` |
| `Seedance 2.5 原生 720p` on a video player badge | `CLVideo3.0 原生 720p` |
| `Seedance 2.5(Seedance 2.5 原生 720p)` in a clicked-video detail title | `CLVideo3.0(CLVideo3.0 原生 720p)` |
| `Seedance 2.0（Seedance 2.0 原生1080P）` in the corresponding detail title | `CLVideo2.0（CLVideo2.0 原生1080P）` |

The provider's source text, model identifiers, request bodies, login/session handling, database values and billing logic keep their original names. The UI renderer supplies an alias for display. Original text can therefore remain visible in DevTools' light DOM while the browser shows the alias in its shadow root.

## 2. Files and responsibilities

| File | Technical responsibility |
| --- | --- |
| [`config/display-names/names.txt`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/config/display-names/names.txt) | Canonical source-to-display mapping. Already includes all three Seedance rows. |
| [`public/harson-customization/model-aliases.generated.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/public/harson-customization/model-aliases.generated.js) | Generated mapping asset; rebuilt from `names.txt`, never edited by hand. |
| [`public/harson-customization/model-alias-resolver.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/public/harson-customization/model-alias-resolver.js) | Pure name resolution; PR #32 added tightly scoped parsing of complete player/detail metadata strings. |
| [`public/harson-customization/image-tab-config.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/public/harson-customization/image-tab-config.js) | Allowed module/surface selectors; PR #32 changed the adapter version to `all-pages-7`. |
| [`public/harson-customization/image-tab-labels.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/public/harson-customization/image-tab-labels.js) | Renders the aliases inside the iframe; PR #32 added metadata discovery, safe host selection and dynamic refresh. |
| [`src/services/yibaiDisplayInjection.js`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/src/services/yibaiDisplayInjection.js) | Existing gateway HTML injection of the four ordered display scripts. PR #32 did not change it. |
| [`tests/model-alias-resolver.test.cjs`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/tests/model-alias-resolver.test.cjs) | Unit cases for player, details and negative cases. |
| [`tests/video-metadata.browser.cjs`](https://github.com/naseerkhan861/harson-pg/blob/temp-main/tests/video-metadata.browser.cjs) | Browser fixture for the real DOM rendering behavior, including asynchronously inserted dialog content. |

## 3. Canonical mappings and the existing label path

`config/display-names/names.txt` currently contains:

~~~text
Seedance 2.0,CLVideo2.0
Seedance,CLVideo3.0
Seedance 2.5,CLVideo3.0
~~~

The build script converts these into normalized `exact` keys in `model-aliases.generated.js`. When changing *a destination name*, edit `names.txt` and run:

~~~sh
npm run aliases:build
npm run aliases:check
~~~

The existing `image-tab-config.js` selectors cover the left navigation span, module headings, version tabs, model dropdowns, ordinary card badges, history surfaces, detail titles and tooltips. The existing renderer resolves entire approved label containers before child fragments. For example, split nested spans spelling `Seedance` plus ` 2.5` resolve as **one** `CLVideo3.0` label. The approved qualified-label rule also handles a known model prefix followed by description on specific model-label or tooltip surfaces.

**Why PR #32 was needed:** The player badge and clicked-video title can be mounted outside the usual form selectors. Their full text is not an exact mapping key, and the clicked-video title repeats the provider name *twice*. The generic prefix resolver is not enough to replace both occurrences reliably.

## 4. Resolver change: match the *whole* video metadata string

In `public/harson-customization/model-alias-resolver.js`, PR #32 introduced `videoMetadataAlias(model)` and `resolveVideoMetadata(sourceText)`. The rule only executes for the explicit context `{ module: "video-generator", surface: "video-metadata" }`, after existing exact/variant lookups and before the generic qualified-prefix rule.

The implementation uses the values from `names.txt` and only recognizes the two known versioned Seedance sources:

~~~js
function videoMetadataAlias(model) {
  const key = normalize(model);
  return key === "seedance 2.5" || key === "seedance 2.0"
    ? (exact[key] || null)
    : null;
}

function resolveVideoMetadata(sourceText) {
  const raw = String(sourceText || "");
  const overlay = /^(\s*)(seedance\s+2\.(?:5|0))(\s+原生\s*\d{3,4}p)(\s*)$/iu.exec(raw);
  if (overlay) {
    const alias = videoMetadataAlias(overlay[2]);
    return alias
      ? overlay[1] + alias + overlay[3] + overlay[4]
      : null;
  }

  const detail = /^(\s*)(seedance\s+2\.(?:5|0))(\s*[（(]\s*)(seedance\s+2\.(?:5|0))(\s+原生\s*\d{3,4}p)(\s*[)）])(\s*)$/iu.exec(raw);
  if (!detail || normalize(detail[2]) !== normalize(detail[4])) {
    return null;
  }

  const alias = videoMetadataAlias(detail[2]);
  return alias
    ? detail[1] + alias + detail[3] + alias + detail[5] + detail[6] + detail[7]
    : null;
}
~~~

In `resolveDisplayName(sourceText, context)`:

~~~js
if (context && context.module === "video-generator" &&
    context.surface === "video-metadata") {
  return resolveVideoMetadata(sourceText);
}
~~~

The patterns are anchored at both ends. They preserve whitespace, Chinese/English parentheses, `原生` and resolution. The detail rule rejects mismatched model versions inside and outside the parentheses. An unknown version such as `Seedance 3.0` or `Seedance 2.50` is not guessed. This parser is deliberately narrower than a global text replacement; if YiBai changes the provider's metadata format, inspect an actual sample and extend these cases with tests.

## 5. Iframe renderer change: discover the player and clicked-video hosts

In `public/harson-customization/image-tab-labels.js`, obtain the module from the injected script tag:

~~~js
const videoModule = script.dataset.harsonModule === "video-generator";
const videoMetadataContext = Object.freeze({
  module: "video-generator",
  surface: "video-metadata"
});
~~~

PR #32 added three cooperating functions:

- `videoMetadataAlias(node)` only accepts an allowed small text host (`DIV`, `SPAN`, `P` or heading). It refuses input controls, clickable children, prompt containers and elements with prompt descendants. It asks the shared resolver whether the host's *entire* `textContent` is an approved video metadata string.
- `videoMetadataOwner(element)` walks upward from a text node to the closest host that passes that test. This handles deeply nested label spans without selecting a whole video card or dialog.
- `collectVideoMetadata(tree, output)` scans text nodes in a newly discovered subtree, checks for Seedance, finds the matching owner and adds it to the render queue. It only runs for the video module.

Actual host-discovery logic from the merged file:

~~~js
function videoMetadataAlias(node) {
  if (!videoModule || !hostTags.has(node.tagName) ||
      node.closest(blocked + ',[class*="prompt" i]') ||
      node.querySelector("button,a,input,textarea,select,[contenteditable]," +
        '.Prompt,.TextToImageCard-prompt,.prompt-content,[class*="prompt" i]')) {
    return null;
  }
  return resolver.resolveDisplayName(node.textContent, videoMetadataContext);
}

function videoMetadataOwner(element) {
  for (let current = element; current && current !== document.body;
       current = current.parentElement) {
    if (videoMetadataAlias(current)) return current;
  }
  return null;
}

function collectVideoMetadata(tree, output) {
  if (!videoModule) return;
  const walker = document.createTreeWalker(tree, NodeFilter.SHOW_TEXT);
  let textNode;
  while ((textNode = walker.nextNode())) {
    if (!/seedance/i.test(textNode.data)) continue;
    const owner = videoMetadataOwner(textNode.parentElement);
    if (owner) output.add(owner);
  }
}
~~~

The module gate is essential: the same strings on another YiBai page do not become video metadata aliases.

## 6. Rendering and asynchronous update integration

PR #32 integrated the metadata owner into the renderer's existing shadow-DOM display mechanism. The following are the relevant changes, rather than a second renderer:

~~~js
// In render(node):
const metadataAlias = active ? videoMetadataAlias(node) : null;
const eligible = active && (node.matches(selector) || Boolean(metadataAlias)) &&
  !node.closest(blocked);
const context = eligible
  ? (metadataAlias ? videoMetadataContext : contextFor(node))
  : null;

// When resolving an entire approved text-only host:
if (eligible && (metadataAlias || allowsAggregation(node))) {
  aggregate = metadataAlias || aliasFor(node.textContent, context);
}
~~~

For metadata, the existing shadow root shows the already formatted alias directly (`metadataAlias ? aggregate : ...`). The provider-owned light-DOM nodes remain intact. Existing icons and other text-free children remain visible through manual slots. `setEnabled(false)` still restores the display to the provider's original text.

Add discovery in the existing `collect(tree, output)`:

~~~js
collectVideoMetadata(tree, output);
~~~

Add a metadata owner to the existing `MutationObserver` work queue when nodes or text change:

~~~js
if (videoModule) {
  const metadataOwner = videoMetadataOwner(element);
  if (metadataOwner) pending.add(metadataOwner);
}
~~~

The observer already watches `childList`, `characterData`, selected attributes and the subtree. `schedule()` batches refreshes with `queueMicrotask(flush)`. This is why a player badge or detail dialog added after initial page load can still be renamed without reloading the iframe.

In `image-tab-config.js`, PR #32 changed `version` from `all-pages-6` to `all-pages-7`. The pre-existing detail-title selector `.q-dialog .header-container .header .vertical-center > span.title` remains; the resolver and metadata discovery are what make the repeated full title work.

## 7. Injection and gateway boundary

The existing gateway injects assets into eligible authenticated YiBai HTML in this order:

1. `model-aliases.generated.js` — mapping data.
2. `model-alias-resolver.js` — pure resolver.
3. `image-tab-config.js` — allowed modules and surfaces.
4. `image-tab-labels.js` — DOM renderer with `data-harson-module="video-generator"` on a video page.

The script paths start with `/__harson_custom/image-tab-1/`. `src/gateway/server.js` serves them from `public/harson-customization/` in the **gateway** container. These files are static assets baked into the Docker image; changing the parent Node app alone does not replace the gateway's running copy. There is no need to rewrite API responses, replace provider JavaScript bundles, change login tokens, or put display aliases in requests sent to YiBai.

## 8. Tests to run before your own deployment

From the `temp-main` checkout:

~~~sh
npm run aliases:check
node --test tests/model-alias-resolver.test.cjs
~~~

If Playwright/Chromium is available locally, run the optional browser fixture:

~~~sh
node tests/video-metadata.browser.cjs
~~~

The unit tests check both Seedance versions, parentheses/whitespace variations, unknown versions, mismatched versions and the required video-only context. The browser fixture checks: visible player badge; dialog inserted later; deeply nested title; dynamic change from 2.5 to 2.0; prompt/history text left alone; original text retained in provider-owned nodes; and disable/restore. This fixture intercepts its own test page and does not require a YiBai login.

## 9. Checks after you push and deploy

First verify that the code deployed to the server contains `collectVideoMetadata`. If it does not, sync the correct `temp-main` files before rebuilding anything:

~~~sh
cd /var/www/harson-pg
grep -n 'collectVideoMetadata' public/harson-customization/image-tab-labels.js
~~~

Then rebuild and recreate the profiled gateway (the usual `docker compose up -d --build` omits this service):

~~~sh
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker exec harson-pg-gateway grep -n 'collectVideoMetadata' /app/public/harson-customization/image-tab-labels.js
~~~

Check the public asset and the actual iframe, using an existing video without spending credits:

~~~sh
curl -fsS https://ai.harson-base.com/__harson_custom/image-tab-1/image-tab-labels.js | grep -n 'collectVideoMetadata'
~~~

Expected visible text on the video page: sidebar/model names `CLVideo3.0` or `CLVideo2.0` as mapped; badge `CLVideo3.0 原生 720p`; clicked-video title `CLVideo3.0(CLVideo3.0 原生 720p)`. The underlying provider source and API payloads must still contain original Seedance identifiers. If sidebar aliases work but badge/title remain old, compare the local gateway asset with the public asset and confirm the new module's script has `data-harson-module="video-generator"`. The [separate gateway deployment checklist](https://github.com/naseerkhan861/harson-pg/blob/codex/gateway-alias-deploy-20261015/docs/gateway-display-alias-deployment.md) includes the full host/container/HTTP checksum procedure.
