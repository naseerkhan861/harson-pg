# MiniMax H3 display-name plan — 视频创作

**Branch:** `temp-main`  
**Reviewed commit:** `c48b0f040c2f564f761274ac3d91178632bf523c`  
**Prepared:** 29 October 2026, Asia/Shanghai  
**Target:** 视频创作 → MiniMax_H3, its 模型 dropdown, and both 历史记录 entry points and their opened records.

This is an implementation plan with a locally checked proposed patch. No GitHub branch was pushed and no production container was changed.

## 1. Required names

| Original display text | New display text |
| --- | --- |
| `MiniMax_H3` | `CLVideo-4.0` |
| `MiniMax-H3` | `CLVideo-4.0` |
| `MiniMax-H3-MAX` | `CLVideo-4.1` |

Keep the hyphens in the requested destinations. In particular, MAX must become `CLVideo-4.1`, never `CLVideo-4.0-MAX`.

These are presentation mappings. Keep the provider's model IDs, dropdown option values, task types, routes, API payloads and saved history records. Existing records should acquire the new visible names when rendered; a database migration is unnecessary.

Your request names 历史记录 twice. Apply the acceptance checks below to each history entry point you use, including its list/cards and the record details opened from it. The second entry point's distinct route/component could not be established from the supplied text; this plan does not invent one.

## 2. What the current code actually does

| Location | Finding | Consequence |
| --- | --- | --- |
| `config/display-names/names.txt` | No MiniMax entries. | All three requested names currently resolve to `null`. |
| `config/display-names/display-correspondence.cjs` | No underscore-to-hyphen MiniMax spelling correspondence. | Adding only `MiniMax-H3` would leave `MiniMax_H3` unresolved. |
| `scripts/build-model-aliases.cjs` | Generates a shared browser/CommonJS map and mapping hash. | Edit the canonical inputs and rebuild; a hand edit to generated output will be overwritten. |
| `public/harson-customization/image-tab-config.js` | Already targets sidebar labels, custom model dropdowns, several card badges and dialog titles. | A new name-specific renderer is unnecessary for these existing label hosts. |
| `public/harson-customization/model-alias-resolver.js` | Exact and spelling lookups are shared. Composite video metadata parsing currently handles Seedance formats only. | A name inside a repeated detail title can remain original even after an exact mapping is added. |
| `public/harson-customization/image-tab-labels.js` | `collectVideoMetadata()` only scans text containing `seedance`. | MiniMax player/history metadata outside the normal selectors is skipped. |
| Same renderer, `videoMetadataOwner()` | Stops at the first recognizable ancestor. | A split `MiniMax-H3` + `-MAX` label can resolve its shorter child before the complete version is considered. |
| `src/services/yibaiDisplayInjection.js` | Injects generated data → resolver → config → renderer into the authenticated gateway HTML. | These four assets must be deployed together. |
| `public/js/aigc-workspace.js` | The local All Tools catalog currently contains no MiniMax entry. | The requested labels come from the embedded provider UI, rather than a local MiniMax page component. |

The repository does not contain the provider's actual MiniMax Vue page or its history components. Their labels arrive through the existing proxy. The appropriate integration point is the existing display-alias layer.

Before the proposed change, local checks confirmed that `MiniMax_H3`, `MiniMax-H3`, `MiniMax-H3-MAX`, and MiniMax metadata examples all returned `null` from the resolver.

## 3. Apply the changes in this order

### Step 1 — Add two canonical mappings and one spelling correspondence

Append to `config/display-names/names.txt`:

```text
MiniMax-H3,CLVideo-4.0
MiniMax-H3-MAX,CLVideo-4.1
```

Add inside `correspondences` in `config/display-names/display-correspondence.cjs`:

```js
"MiniMax_H3": "MiniMax-H3",
```

Case differences are already handled by normalization. The underscore requires an explicit spelling entry. Only add further spellings after observing their actual display text and confirming which version they represent.

Use these runtime files. The older copies under `tab_customization/` are not the gateway's runtime assets.

### Step 2 — Cover player badges and opened history details

Extend `resolveVideoMetadata()` with the MiniMax helper in the patch below. It reads destinations from the generated map and handles complete labels, an optional resolution suffix, and a repeated `family(variant + metadata)` label.

The proposed helper checks the entire display string before substituting any tokens and matches MAX first. It preserves punctuation, whitespace and resolution text. Existing Seedance handling stays in place.

Examples supported by the proposed parser:

| Original metadata | Display result |
| --- | --- |
| `MiniMax_H3 原生 720p` | `CLVideo-4.0 原生 720p` |
| `MiniMax-H3-MAX 1080P` | `CLVideo-4.1 1080P` |
| `MiniMax-H3(MiniMax-H3 原生 720p)` | `CLVideo-4.0(CLVideo-4.0 原生 720p)` |
| `MiniMax-H3-MAX(MiniMax-H3-MAX 原生 1080p)` | `CLVideo-4.1(CLVideo-4.1 原生 1080p)` |
| `MiniMax_H3（MiniMax-H3-MAX 原生1080p）` | `CLVideo-4.0（CLVideo-4.1 原生1080p）` |

These are regression examples, not a claim that every format was observed on the live MiniMax page. Inspect both live history entry points for additional actual formats before release. A duration, separator or other suffix outside this grammar needs its own reviewed format and test; do not add an unrestricted replacement over arbitrary history text.

The mixed final example deliberately maps each explicit token independently. A generic family label is not sufficient evidence to classify a historical task as MAX.

### Step 3 — Let the video metadata adapter find MiniMax labels

Update `collectVideoMetadata()` to recognize `seedance` or `minimax[-_]h3` text. Retain its existing `video-generator` module guard, blocked prompt/editable-content checks, and text-only host restrictions.

Update `videoMetadataOwner()` as shown in the patch so a complete recognized ancestor can supersede a shorter recognized child. This matters for markup such as:

```html
<div class="actual-model-label">
  <span>MiniMax-H3</span><span>-MAX</span>
</div>
```

The complete label should display `CLVideo-4.1`. The example class above illustrates split markup; it is not a verified provider selector.

The existing MutationObserver should continue handling portal-mounted dropdowns, newly opened dialogs, pagination and reused record nodes. This change needs no new timer or automatic iframe reload.

### Step 4 — Check the real dropdown and both history entry points

The following selectors are present in the current runtime configuration:

| Surface | Existing configured selector |
| --- | --- |
| Sidebar label | `.MainLayout-nav .NavList-list-item > span.label` |
| Page/floating headings | `.ToolLayout-header`, `.DefaultLayout-header`, `.header_fix > span` |
| Selected custom model value | `.IcbsMenuSelect-header-content` |
| Open model-menu option | `.IcbsMenuSelect-menu-item-label` |
| Alternate popup option | `.IcbsSelect-header-popup-option-label` |
| Alternate selected value | `.SubLayout-draw .IcbsSelect-header-select .q-field__native > span` |
| Existing gallery badge adapters | `.DemoCard .DemoCard-banner > span`, `.TextToImageCard .TextToImageCard-header-typeName > span` |
| Existing dialog-title adapter | `.q-dialog .header-container .header .vertical-center > span.title` |
| Tooltips | `.q-tooltip`, `.q-tooltip *` |

The gallery selectors are existing code coverage; their presence does not prove that the MiniMax history page uses those components. Complete MiniMax labels on eligible text hosts are additionally handled by the expanded video metadata scan.

For every visible original name that remains after the patch:

1. Inspect the element in the **provider iframe**, including menus/dialogs mounted under its body.
2. Check the complete original light-DOM label and whether its container is an existing selector or an eligible video metadata host.
3. If a provider-specific label container is missing, add that **observed label leaf** to `config.selectors`. Add it to `aggregateSelectors` if the semantic label spans multiple children. Keep the existing prohibition on aggregating interactive descendants.
4. Add a fixture using the observed structure and complete original label. For a new metadata format, extend the bounded parser only as far as that format requires.
5. If a native button, tab or option owns the label, target its supported inner text host. The current renderer cannot attach a shadow root to every native element, and intentionally blocks native form value nodes.

Keep free-text prompts, captions and editable fields out of the adapters. Avoid generic selectors such as `.q-dialog span`, all table cells or all buttons.

Use the record's own model label/verified model field for history. Switching the current form to MAX must not relabel previous base-model results as `CLVideo-4.1`. Likewise, switching back to base must not relabel old MAX results as `CLVideo-4.0`.

If history exposes only a generic family string, request the actual model identity from the provider's existing task data before introducing a variant-specific override. Do not infer it from the current dropdown, record order or thumbnail.

### Step 5 — Rebuild the data and bump the adapter version

```bash
npm run aliases:build
npm run aliases:check
```

Commit the regenerated `public/harson-customization/model-aliases.generated.js` alongside its inputs. Bump `image-tab-config.js` from `all-pages-9` to `all-pages-10` for diagnostics. If your branch already uses a later version, use a fresh version rather than downgrading it.

The proposed mapping built from the reviewed commit has hash **`73bb112c1fe8`**, replacing **`6c6475c74fad`**. Additional legitimate mapping changes will produce a different hash.

## 4. Regression and acceptance checks

### Automated checks

```bash
npm run aliases:check
node --test tests/model-alias-resolver.test.cjs tests/model-alias-generator.test.cjs tests/image-tab-injection.test.cjs
node --check public/harson-customization/image-tab-labels.js
git diff --check
```

Extend `tests/video-metadata.browser.cjs` with MiniMax cases before treating browser coverage as complete. Its current fixture primarily tests Seedance. Use the actual runtime assets and cover the rows below, especially split MAX labels and reused history nodes. Then run:

```bash
node tests/video-metadata.browser.cjs
```

That optional browser script needs Playwright and an installed Chromium executable; it already accepts the documented runtime/executable environment variables in its source.

### Browser acceptance matrix

| Check | Expected result |
| --- | --- |
| Open 视频创作 | Sidebar `MiniMax_H3` displays `CLVideo-4.0`. |
| Open the MiniMax workflow | Every explicit base-model heading displays `CLVideo-4.0`; the 模型 field label remains 模型. |
| Open 模型 dropdown | Base option displays `CLVideo-4.0`; MAX option displays `CLVideo-4.1`. |
| Select base, then MAX, then base | Selected display updates correctly; keyboard/pointer selection and provider handlers still work. |
| History entry point A | Inspect its list/cards, model badges, filter options, hover text and opened record details. All explicit model names use the corresponding alias. |
| History entry point B | Repeat the same checks independently, including any other detail layout it opens. |
| Mixed old base and MAX results | Each keeps its own version, regardless of the current form's dropdown selection. |
| Player overlay/detail title | Every explicit MiniMax token is mapped; resolution, punctuation and other supported metadata remain intact. |
| Split label `MiniMax-H3` + `-MAX` | Complete display is `CLVideo-4.1`, with no base alias left beside `-MAX`. |
| Pagination, scrolling, route changes | Newly created and reused nodes receive the correct alias without a manual refresh. |
| Tooltip/title/accessible model label | Exact MiniMax model labels resolve consistently with visible text. Verify the accessibility tree as well as `title`/`aria-label`. |
| Prompt mentioning MiniMax | Prompt text, editability and submitted prompt remain intact. |
| Model selection data | Original provider option values/model fields remain intact. No request should submit `CLVideo-4.0` or `CLVideo-4.1` as a replacement API model ID. |
| Other video/image workflows | Existing Seedance, Kontext and other aliases retain their previous behavior. |

Use existing historical results for display verification. Inspect model fields safely; avoid copying credentials, authorization headers or private task bodies into reports.

Original model names can intentionally remain in hidden light-DOM source text because the renderer uses shadow DOM for display. Finding `MiniMax-H3` in Elements or a history API response alone is not evidence of a visible naming failure. Verify the rendered and accessible labels.

## 5. Deploy the assets that the iframe actually receives

After reviewing, committing and updating your server checkout, ensure the gateway deployment enables `YIBAI_IMAGE_ALIASES_ENABLED=true`. The example environment file defaults this flag to false.

The gateway serves the iframe's alias assets from its own container. Rebuild and recreate that service:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway ps gateway
```

Verify that the host checkout, local gateway response and public response contain the same generated data:

```bash
curl -fsS http://127.0.0.1:3001/__harson_custom/image-tab-1/model-aliases.generated.js -o /tmp/harson-minimax-alias-local.js
curl -fsS https://ai.harson-base.com/__harson_custom/image-tab-1/model-aliases.generated.js -o /tmp/harson-minimax-alias-public.js
sha256sum public/harson-customization/model-aliases.generated.js /tmp/harson-minimax-alias-local.js /tmp/harson-minimax-alias-public.js
```

All three checksums should match. Compare `model-alias-resolver.js`, `image-tab-config.js` and `image-tab-labels.js` the same way if a surface still shows an old label. These files form one release; a matching data hash alone does not prove the new renderer was deployed.

Reopen the workspace after recreating the gateway so the existing launch flow establishes a fresh iframe session. In the **iframe console**, inspect:

```js
window.HarsonImageLabels?.status()
window.HarsonModelAliasResolver?.resolveDisplayName("MiniMax_H3")
window.HarsonModelAliasResolver?.resolveDisplayName("MiniMax-H3-MAX")
```

Expected for this exact patch: module `video-generator`, version `all-pages-10`, enabled/active true, mapping hash `73bb112c1fe8`; resolver results `CLVideo-4.0` and `CLVideo-4.1`.

If the scripts/status object are absent, check the gateway feature flag and HTML injection first. If public bytes differ from the gateway's bytes, check the running image and Nginx/cache target. A browser refresh cannot update stale files inside a running container.

This naming work fits the existing display layer. Keep the current proxy/session and route-policy fixes in place; it requires no new API exception or response-body rewriting.

For rollback, revert the reviewed naming-change commit, rebuild its generated mapping, and recreate the gateway with those matched assets. Preserve the separate repair/color/proxy fixes already present on `temp-main`.

## 6. What was verified here

- Fetched and inspected the actual `temp-main` commit identified above in an isolated checkout.
- Confirmed the missing exact mappings, spelling correspondence and MiniMax metadata scan.
- Prepared the seven-file proposed patch below, including resolver regressions.
- `aliases:build` and `aliases:check`: passed, resulting hash `73bb112c1fe8`.
- Resolver, generator and injection tests: **43 passed, 0 failed**.
- Renderer JavaScript syntax check and `git diff --check`: passed.
- **Browser rendering and authenticated history workflows were not executed.** The available Playwright package has no installed Chromium executable here, and the public provider pages could not be inspected from this environment. The browser matrix remains a release gate, especially for actual history markup, split labels and suffix formats.

## 7. Source snapshot

All analysis and patch contexts refer to [temp-main at c48b0f0](https://github.com/naseerkhan861/harson-pg/tree/c48b0f040c2f564f761274ac3d91178632bf523c), including:

- [Canonical names](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/config/display-names/names.txt) and [spelling policy](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/config/display-names/display-correspondence.cjs).
- [Shared resolver](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/public/harson-customization/model-alias-resolver.js), [adapter configuration](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/public/harson-customization/image-tab-config.js) and [renderer](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/public/harson-customization/image-tab-labels.js).
- [HTML asset injection](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/src/services/yibaiDisplayInjection.js) and [gateway deployment instructions](https://github.com/naseerkhan861/harson-pg/blob/c48b0f040c2f564f761274ac3d91178632bf523c/docs/gateway-display-alias-deployment.md).

## Appendix — Proposed seven-file patch

Apply to the reviewed commit or merge the individual hunks into your newer `temp-main`. The generated-file changes below are shown for completeness; produce them using `npm run aliases:build`. Browser acceptance is still required after applying this patch.

```diff
diff --git a/config/display-names/display-correspondence.cjs b/config/display-names/display-correspondence.cjs
index d0b5b0c..d905a72 100644
--- a/config/display-names/display-correspondence.cjs
+++ b/config/display-names/display-correspondence.cjs
@@ -19,6 +19,7 @@
 */
 
 const correspondences = {
+  "MiniMax_H3": "MiniMax-H3",
   "FLUX.1 Kontext": "FLUX.1 Kontex (pro/max)",
   "FLUX.1Kontext": "FLUX.1 Kontex (pro/max)",
   "FLUXKrea": "FLUX Krea",
diff --git a/config/display-names/names.txt b/config/display-names/names.txt
index 23c4af8..8632601 100644
--- a/config/display-names/names.txt
+++ b/config/display-names/names.txt
@@ -24,3 +24,5 @@ Seedance 2.5,CLVideo3.0
 Seedream,CLVideo
 Happy Horse,CL Dragon
 暂未上架,CLVideo-2.1
+MiniMax-H3,CLVideo-4.0
+MiniMax-H3-MAX,CLVideo-4.1
diff --git a/public/harson-customization/image-tab-config.js b/public/harson-customization/image-tab-config.js
index 270d700..03f5ee1 100644
--- a/public/harson-customization/image-tab-config.js
+++ b/public/harson-customization/image-tab-config.js
@@ -18,7 +18,7 @@
   //     these header containers; the renderer aggregates a container's full
   //     text when it is exactly a known label.
   const config = Object.freeze({
-    version: "all-pages-9",
+    version: "all-pages-10",
     expectedOrigin: "https://ai.harson-base.com",
     // Applied inside every YiBai module frame served by the gateway.
     modules: Object.freeze([
diff --git a/public/harson-customization/image-tab-labels.js b/public/harson-customization/image-tab-labels.js
index f9cc933..d75d26c 100644
--- a/public/harson-customization/image-tab-labels.js
+++ b/public/harson-customization/image-tab-labels.js
@@ -239,11 +239,21 @@
   }
 
   function videoMetadataOwner(element) {
+    let owner = null;
+    let source = null;
     for (let current = element; current && current !== document.body;
          current = current.parentElement) {
-      if (videoMetadataAlias(current)) return current;
+      if (!videoMetadataAlias(current)) continue;
+      const candidateSource = resolver.normalize(current.textContent);
+      // Prefer the complete semantic label when a nested child contains
+      // only the base prefix of MiniMax-H3-MAX. Keep the nearest wrapper
+      // when an ancestor merely repeats exactly the same source text.
+      if (!owner || candidateSource !== source) {
+        owner = current;
+        source = candidateSource;
+      }
     }
-    return null;
+    return owner;
   }
 
   function collectVideoMetadata(tree, output) {
@@ -251,7 +261,7 @@
     const walker = document.createTreeWalker(tree, NodeFilter.SHOW_TEXT);
     let textNode;
     while ((textNode = walker.nextNode())) {
-      if (!/seedance/i.test(textNode.data)) continue;
+      if (!/seedance|minimax[-_]h3/i.test(textNode.data)) continue;
       const owner = videoMetadataOwner(textNode.parentElement);
       if (owner) output.add(owner);
     }
diff --git a/public/harson-customization/model-alias-resolver.js b/public/harson-customization/model-alias-resolver.js
index 1524913..76e406f 100644
--- a/public/harson-customization/model-alias-resolver.js
+++ b/public/harson-customization/model-alias-resolver.js
@@ -128,7 +128,38 @@
         : null;
     }
 
+    /*
+      MiniMax labels on video metadata hosts: accept complete approved
+      labels, optional resolution metadata, and the provider-style
+      family(variant + metadata) form. These are bounded display formats;
+      arbitrary text and unknown model versions never match. The MAX
+      token precedes the base token, and aliases come from generated data.
+    */
+    function resolveMiniMaxVideoMetadata(sourceText) {
+      const raw = String(sourceText || "");
+      const token = "(?:minimax-h3-max|minimax-h3|minimax_h3)";
+      const label = token + "(?:\\s+(?:原生\\s*)?\\d{3,4}p)?";
+      const format = new RegExp(
+        "^\\s*" + label +
+        "(?:\\s*\\(\\s*" + label + "\\s*\\)|" +
+        "\\s*（\\s*" + label + "\\s*）)?\\s*$",
+        "iu"
+      );
+      if (!format.test(raw)) return null;
+
+      let complete = true;
+      const result = raw.replace(new RegExp(token, "giu"), source => {
+        const key = normalize(source);
+        const alias = exact[key] || exact[variants[key]];
+        if (!alias) complete = false;
+        return alias || source;
+      });
+      return complete ? result : null;
+    }
+
     function resolveVideoMetadata(sourceText) {
+      const minimax = resolveMiniMaxVideoMetadata(sourceText);
+      if (minimax !== null) return minimax;
       const raw = String(sourceText || "");
       const overlay = /^(\s*)(seedance\s+2\.(?:5|0))(\s+原生\s*\d{3,4}p)(\s*)$/iu.exec(raw);
       if (overlay) {
diff --git a/public/harson-customization/model-aliases.generated.js b/public/harson-customization/model-aliases.generated.js
index c0450db..061db30 100644
--- a/public/harson-customization/model-aliases.generated.js
+++ b/public/harson-customization/model-aliases.generated.js
@@ -3,7 +3,7 @@
   Source: config/display-names/names.txt
   Policy: config/display-names/display-correspondence.cjs
   Rebuild: npm run aliases:build   Verify: npm run aliases:check
-  Schema: 1   Mapping hash: 6c6475c74fad
+  Schema: 1   Mapping hash: 73bb112c1fe8
 */
 (function (root, factory) {
   if (typeof module === "object" && module.exports) {
@@ -14,7 +14,7 @@
 })(typeof self !== "undefined" ? self : this, function () {
   return {
   "schemaVersion": 1,
-  "mappingHash": "6c6475c74fad",
+  "mappingHash": "73bb112c1fe8",
   "exact": {
     "flux krea": "CLImage",
     "flux.1 kontex (pro/max)": "CLImage-1.1",
@@ -40,9 +40,12 @@
     "seedance 2.5": "CLVideo3.0",
     "seedream": "CLVideo",
     "happy horse": "CL Dragon",
-    "暂未上架": "CLVideo-2.1"
+    "暂未上架": "CLVideo-2.1",
+    "minimax-h3": "CLVideo-4.0",
+    "minimax-h3-max": "CLVideo-4.1"
   },
   "variants": {
+    "minimax_h3": "minimax-h3",
     "flux.1 kontext": "flux.1 kontex (pro/max)",
     "flux.1kontext": "flux.1 kontex (pro/max)",
     "fluxkrea": "flux krea",
diff --git a/tests/model-alias-resolver.test.cjs b/tests/model-alias-resolver.test.cjs
index c9b7b58..e6d5a00 100644
--- a/tests/model-alias-resolver.test.cjs
+++ b/tests/model-alias-resolver.test.cjs
@@ -239,6 +239,45 @@ test("Kontext title follows only its own selected variant", () => {
   assert.equal(resolve("kontext-max", title("pro")), "CLImage-1.2");
 });
 
+test("MiniMax exact labels preserve base and MAX identities", () => {
+  assert.equal(resolve("MiniMax_H3"), "CLVideo-4.0");
+  assert.equal(resolve("MiniMax-H3"), "CLVideo-4.0");
+  assert.equal(resolve("MiniMax-H3-MAX"), "CLVideo-4.1");
+  assert.equal(resolve("  minimax-h3-max  "), "CLVideo-4.1");
+  assert.equal(resolve("CLVideo-4.0"), null);
+  assert.equal(resolve("CLVideo-4.1"), null);
+  assert.equal(resolve("MiniMax-H3-MAX-FAST"), null);
+});
+
+test("MiniMax metadata maps every explicit label while keeping its suffix", () => {
+  const context = { module: "video-generator", surface: "video-metadata" };
+  const cases = [
+    ["MiniMax_H3 原生 720p", "CLVideo-4.0 原生 720p"],
+    ["MiniMax-H3-MAX 1080P", "CLVideo-4.1 1080P"],
+    ["MiniMax-H3(MiniMax-H3 原生 720p)", "CLVideo-4.0(CLVideo-4.0 原生 720p)"],
+    ["MiniMax-H3-MAX(MiniMax-H3-MAX 原生 1080p)", "CLVideo-4.1(CLVideo-4.1 原生 1080p)"],
+    ["MiniMax_H3（MiniMax-H3-MAX 原生1080p）", "CLVideo-4.0（CLVideo-4.1 原生1080p）"],
+    [" MiniMax-H3 ( MiniMax-H3-MAX )\n", " CLVideo-4.0 ( CLVideo-4.1 )\n"]
+  ];
+  for (const [source, expected] of cases) {
+    assert.equal(resolve(source, context), expected, source);
+  }
+});
+
+test("MiniMax metadata rejects unknown versions and arbitrary text", () => {
+  const context = { module: "video-generator", surface: "video-metadata" };
+  for (const source of [
+    "MiniMax-H30 原生 720p", "MiniMax-H3-MAX-FAST 1080p",
+    "MiniMax_H3_MAX", "MiniMax-H3-MAX2", "MiniMax-H4",
+    "Create a video with MiniMax-H3", "MiniMax-H3 sunset",
+    "MiniMax-H3(MiniMax-H4 原生 720p)"
+  ]) assert.equal(resolve(source, context), null, source);
+  assert.equal(resolve("MiniMax_H3 原生 720p"), null);
+  assert.equal(resolve("MiniMax_H3 原生 720p", {
+    module: "image-generator", surface: "video-metadata"
+  }), null);
+});
+
 test("mapping info reports schema and hash", () => {
   const info = resolver.mappingInfo();
 
```
