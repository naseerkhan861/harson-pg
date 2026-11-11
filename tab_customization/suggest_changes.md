# 视频创作 → 爆款视频复刻: rename the Face model

**Target:** `temp-main` at [`0619e8d`](https://github.com/naseerkhan861/harson-pg/commit/0619e8d36158b2cc3c03bb549b35c0dafbf7c527), reviewed November 11, 2026. The patch below is for the files in the repository root.

## Expected result

The screenshot shows the same provider label twice: in the open **生成模型** menu and in the closed control when that model is selected. Both are part of this rename.

| Place | Current | Expected |
| --- | --- | --- |
| **生成模型** → menu option | `Seedance 2.0 Face` | `CLVideo-2.1` |
| **生成模型** → selected value | `Seedance 2.0 Face` | `CLVideo-2.1` |
| Other options, in their current order | `CLVideo3.0`, `CLVideo-4.0`, `CLVideo-4.1` | Same |
| Field caption and tool title | **生成模型**, **爆款视频复刻** | Same |

Keep the existing Face option's provider value, capability settings, pricing and request payload. The change is scoped to **视频创作**. If the same replicator is opened from another main tab, its label follows that tab's existing policy.

### Where the change belongs

- `public/aigc-workspace.html` identifies **视频创作** as `video-generator`. The model dropdown is rendered by the nested YiBai tool. The shell's tool catalog in `public/js/aigc-workspace.js` does not own this dropdown.
- `src/services/yibaiDisplayInjection.js` already injects the display resolver, configuration and renderer into gateway HTML, with the active module on `data-harson-module`. `image-tab-labels.js` already handles dynamically mounted options and reuses the provider's original light DOM and click targets.
- `config/display-names/names.txt` maps plain `Seedance 2.0` to `CLVideo2.0`. There is no exact `Seedance 2.0 Face` alias on this commit. `暂未上架` already has its own `CLVideo-2.1` display mapping; the two sources are separate and the shared display string is not a model ID.
- Use a scoped rule in the existing renderer. The rule requires the video module, the replicator document, a verified dropdown label element, and the complete Face label. API routing, provider model configuration, generated alias data, and the older video metadata rules are outside this change.

## 1. Confirm the two label elements in DevTools

The screenshot establishes the text and control. It does not expose the frame path, selector classes, or model ID. The repository documents `/frame/app/*` and the `app-viral-video-replicator` app in `.env.example`, so the patch starts with `/frame/app/app-viral-video-replicator`. Confirm the actual document pathname before deploying.

1. Open **视频创作 → 爆款视频复刻**. Select the existing Face model without generating a video. In **Elements**, inspect its text inside the closed **生成模型** control. Run the snippet below with that element selected as `$0`.
2. Open the menu and repeat on the Face **option text**. Inspect the label span or div inside the clickable row, especially if the menu is mounted at the end of the document.

```js
(() => {
  const selected = $0;
  const leaf = selected?.getRootNode?.().host ||
    (selected?.nodeType === 1 ? selected : selected?.parentElement);
  if (!leaf) return "Inspect the label in Elements first.";
  const candidates = [
    ".IcbsMenuSelect-header-content",
    ".IcbsMenuSelect-menu-item-label",
    ".IcbsSelect-header-select .q-field__native > span",
    ".IcbsSelect-header-popup-option-label"
  ];
  const owner = leaf.closest(candidates.join(",")) || leaf;
  const doc = owner.ownerDocument;
  const chain = [];
  for (let node = owner; node && node !== doc.body && chain.length < 5;
       node = node.parentElement) {
    chain.push({
      tag: node.tagName,
      classes: [...node.classList],
      role: node.getAttribute("role")
    });
  }
  return {
    origin: doc.location.origin,
    pathname: doc.location.pathname,
    module: doc.getElementById("harson-image-tab-labels")?.dataset.harsonModule,
    rendererVersion: doc.defaultView.HarsonImageLabels?.status().version,
    originalLabel: owner.textContent.trim(),
    matchingSelectors: candidates.filter(s => owner.matches(s)),
    chain
  };
})()
```

Expected evidence: the same document for both labels, `https://ai.harson-base.com`, module `video-generator`, and `originalLabel: "Seedance 2.0 Face"`. A trailing slash in the pathname is handled. The snippet only reads the path and label elements; it does not print URL parameters or change the page.

After applying the patch, keep the verified selected label selector and option selector in `viralVideoGenerationModel.labelSelectors`. If one element has no candidate match, use its stable provider class under the **生成模型** control or under its popup's own wrapper. If a class matches several controls in the frame, narrow it using the actual field or popup ancestor. A portal menu may sit outside the form, so give its label a separate selector. Change `pathname` to the exact observed replicator pathname if it differs. If this deployment uses a shared SPA pathname, first identify an exact app route or dedicated replicator marker and guard on that; a shared pathname alone is too broad.

The renderer needs a label element that can host its display text. If DevTools shows a native `<select>/<option>` or text directly on a button with no label element, the patch below is not the adapter for that markup. Use the owning component's display `label` field if you have its source, preserving its original `value`. Avoid replacing a whole button, listbox, or form.

## 2. Apply the patch to the display adapter

Save the following diff as `harson-viral-face.patch` outside the tracked source tree. From the repository root run:

```bash
git apply --check /path/to/harson-viral-face.patch
git apply /path/to/harson-viral-face.patch
git diff --check
```

If your branch has later edits, use these hunks as the implementation guide and keep those edits. Only the three display assets below need to change.

```diff
diff --git a/public/harson-customization/image-tab-config.js b/public/harson-customization/image-tab-config.js
index 972f883..553d0d0 100644
--- a/public/harson-customization/image-tab-config.js
+++ b/public/harson-customization/image-tab-config.js
@@ -18,7 +18,7 @@
   //     these header containers; the renderer aggregates a container's full
   //     text when it is exactly a known label.
   const config = Object.freeze({
-    version: "all-pages-12-image-v21",
+    version: "all-pages-13-viral-video-face",
     expectedOrigin: "https://ai.harson-base.com",
     // Applied inside every YiBai module frame served by the gateway.
     modules: Object.freeze([
@@ -32,6 +32,17 @@
     ]),
     // Diagnostic only — no longer an activation gate (runbook §8.2).
     sidebarSelector: ".MainLayout-nav .NavList-list-item > span.label",
+    // This field lives in a nested provider frame. Keep its leaf selectors
+    // separate so adding a provider-specific leaf cannot widen other modules.
+    viralVideoGenerationModel: Object.freeze({
+      pathname: "/frame/app/app-viral-video-replicator",
+      labelSelectors: Object.freeze([
+        ".IcbsMenuSelect-header-content",
+        ".IcbsMenuSelect-menu-item-label",
+        ".IcbsSelect-header-select .q-field__native > span",
+        ".IcbsSelect-header-popup-option-label"
+      ])
+    }),
     // Only model-label surfaces. Never select the whole page, prompts or
     // forms. Matching remains exact against approved model labels.
     selectors: Object.freeze([
diff --git a/public/harson-customization/image-tab-labels.js b/public/harson-customization/image-tab-labels.js
index 293f646..c7a6bd6 100644
--- a/public/harson-customization/image-tab-labels.js
+++ b/public/harson-customization/image-tab-labels.js
@@ -21,11 +21,21 @@
   } catch (_) { /* Fall back to provider labels. */ }
   if (!supported) return;
 
-  const selector = config.selectors.join(",");
+  const defaultSelector = config.selectors.join(",");
+  const videoModule = script.dataset.harsonModule === "video-generator";
+  const viralVideoConfig = config.viralVideoGenerationModel;
+  const viralVideoSelector = videoModule && viralVideoConfig &&
+    location.pathname.replace(/\/$/, "") === viralVideoConfig.pathname
+    ? viralVideoConfig.labelSelectors.join(",")
+    : "";
+  const selector = [defaultSelector, viralVideoSelector].filter(Boolean).join(",");
   const aggregateSelector = config.aggregateSelectors.join(",");
   const qualifiedSelector = (config.qualifiedSelectors || []).join(",");
   const imageModelSelector = (config.midjourneyModelLabelSelectors || []).join(",");
-  const videoModule = script.dataset.harsonModule === "video-generator";
+  const viralVideoContext = Object.freeze({
+    module: "video-generator",
+    surface: "viral-video-generation-model"
+  });
   const videoMetadataContext = Object.freeze({
     module: "video-generator",
     surface: "video-metadata"
@@ -206,6 +216,13 @@
     return resolver.resolveScopedImageLabel?.(node.textContent, context) ? context : null;
   }
 
+  function viralVideoContextFor(node) {
+    if (!viralVideoSelector || !node.matches(viralVideoSelector)) return null;
+    return resolver.resolveViralVideoGenerationModelLabel?.(
+      node.textContent, viralVideoContext
+    ) ? viralVideoContext : null;
+  }
+
   function contextFor(node) {
     // Recognize explicit MJ versions in model fields first; preserve the
     // existing Seedream/version and image-family rules for other labels.
@@ -232,7 +249,8 @@
       resolve it as one label. Only for approved label containers that hold
       no interactive descendants.
     */
-    const scopedWholeLabel = context?.surface === "midjourney-model-label" ||
+    const scopedWholeLabel = context === viralVideoContext ||
+      context?.surface === "midjourney-model-label" ||
       Boolean(resolver.resolveScopedImageLabel?.(node.textContent, context));
     if (!scopedWholeLabel && (!aggregateSelector || !node.matches(aggregateSelector))) {
       return false;
@@ -347,10 +365,11 @@
   function render(node) {
     if (!node.isConnected) { hosts.delete(node); return; }
     const metadataAlias = active ? videoMetadataAlias(node) : null;
-    const eligible = active && (node.matches(selector) || Boolean(metadataAlias)) &&
+    const viralContext = active ? viralVideoContextFor(node) : null;
+    const eligible = active && (node.matches(defaultSelector) || metadataAlias || viralContext) &&
       !node.closest(blocked);
     const context = eligible
-      ? (metadataAlias ? videoMetadataContext : contextFor(node))
+      ? (metadataAlias ? videoMetadataContext : viralContext || contextFor(node))
       : null;
     const children = Array.from(node.childNodes);
     const labels = children.map(child => eligible && child.nodeType === Node.TEXT_NODE
diff --git a/public/harson-customization/model-alias-resolver.js b/public/harson-customization/model-alias-resolver.js
index 5150145..cb383cd 100644
--- a/public/harson-customization/model-alias-resolver.js
+++ b/public/harson-customization/model-alias-resolver.js
@@ -219,6 +219,14 @@
       return null;
     }
 
+    function resolveViralVideoGenerationModelLabel(sourceText, context) {
+      return context?.module === "video-generator" &&
+        context.surface === "viral-video-generation-model" &&
+        normalize(sourceText) === "seedance 2.0 face"
+        ? "CLVideo-2.1"
+        : null;
+    }
+
     /*
       Image-generator scoped overrides (proposed_changes.md §4, 15 Oct).
 
@@ -296,6 +304,9 @@
         return scoped;
       }
 
+      const viralVideoLabel = resolveViralVideoGenerationModelLabel(key, context);
+      if (viralVideoLabel !== null) return viralVideoLabel;
+
       if (Object.prototype.hasOwnProperty.call(exact, key)) {
         return exact[key];
       }
@@ -356,6 +367,7 @@
     return {
       resolveDisplayName,
       resolveScopedImageLabel,
+      resolveViralVideoGenerationModelLabel,
       normalize,
       mappingInfo
     };
```

The configuration registers the two types of dropdown label independently of the default selector list. The renderer only uses those extra selectors in the configured nested frame; it asks the resolver to match the **entire original label**. This lets the same rule handle split text, for example `<span>Seedance 2.0</span><span> Face</span>`. The existing observer handles opening the menu, selecting another model, and reopening it. No new observer or API rewrite is needed.

## 3. Check the change locally

Run from the repository root:

```bash
npm run aliases:check
node --test tests/model-alias-resolver.test.cjs tests/model-alias-generator.test.cjs tests/image-tab-injection.test.cjs tests/gateway-route-policy.test.cjs tests/gateway-proxy-headers.test.cjs
git diff --check
```

Quick check of the new exact rule and its scope:

```bash
node <<'NODE'
const assert = require("node:assert/strict");
const { resolveDisplayName: resolve } =
  require("./public/harson-customization/model-alias-resolver.js");
const scope = {
  module: "video-generator",
  surface: "viral-video-generation-model"
};
assert.equal(resolve("Seedance 2.0 Face", scope), "CLVideo-2.1");
assert.equal(resolve("Seedance 2.0 Face"), null);
assert.equal(resolve("Seedance 2.0 Face", { ...scope, module: "e-commerce" }), null);
assert.equal(resolve("Seedance 2.0 Face", { ...scope, surface: "video-metadata" }), null);
assert.equal(resolve("Seedance 2.0 Face Pro", scope), null);
assert.equal(resolve("Seedance 2.0", scope), "CLVideo2.0");
assert.equal(resolve("Seedance 2.5", scope), "CLVideo3.0");
assert.equal(resolve("MiniMax-H3", scope), "CLVideo-4.0");
assert.equal(resolve("MiniMax-H3-MAX", scope), "CLVideo-4.1");
console.log("Face model label checks passed");
NODE
```

**Checks performed for this plan:** The patch passed all 73 tests in the five suites above, 12 direct resolver and mapping assertions, JavaScript syntax checks, and `git diff --check`. The generated mapping hash stayed `d6d2433bff2c`. Browser validation remains: the local Chromium process could not start, and the live provider DOM was not inspected. Complete Step 1 and the browser checks below using your gateway.

## 4. Deploy the gateway assets and verify in the browser

After syncing your patched source to the server, confirm the gateway environment has `YIBAI_IMAGE_ALIASES_ENABLED=true`. For the repository's Compose deployment, run in its server source directory:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway ps gateway
```

The gateway serves these files from `/__harson_custom/image-tab-1/`. Rebuilding only `app` can leave old display assets in the running gateway. Compare the live files to the source files; `cmp` prints nothing for a match:

```bash
asset_base=https://ai.harson-base.com/__harson_custom/image-tab-1
for asset in image-tab-config.js model-alias-resolver.js image-tab-labels.js; do
  curl -fsS "$asset_base/$asset" |
    cmp "public/harson-customization/$asset" - || break
done
```

Reload the workspace. In the Console context of the **nested replicator** frame, `window.HarsonImageLabels.status()` should report `module: "video-generator"` and `version: "all-pages-13-viral-video-face"`. Then verify:

| Action | Pass condition |
| --- | --- |
| Open **生成模型** | The Face option displays `CLVideo-2.1`; the three adjacent options retain their current labels and order. |
| Select another option, then select `CLVideo-2.1` again | The closed control updates each time; mouse and keyboard selection still work. |
| Inspect the selected label and Face option | Their original light DOM text is still `Seedance 2.0 Face`, while the displayed label is `CLVideo-2.1`. Existing accessible label text updates if it was on the matched label element. |
| Reopen the tool; check the other main tab that hosts the replicator | The rename persists in **视频创作** only. The sidebar, history cards and storyboard are outside the new rule. |
| If you have a staging request fixture | Select the Face model and compare its existing provider model value before and after. It must stay identical. The new display name should never become the request value. |

The open/select/reopen checks do not require a paid generation. If only one label changes, recheck that element's selector and frame. If neither changes, check the renderer version and module first, then the verified pathname and selectors. If rollback is needed, revert the rename commit and recreate the gateway with the same Compose command.
