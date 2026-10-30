# 图片创作 — MJ V7 / V8 display-name implementation plan

**Prepared:** 30 October 2026, Asia/Shanghai  
**Repository:** `naseerkhan861/harson-pg`  
**Branch reviewed:** `temp-main`  
**Source commit:** `97fd4353c05f3719d5ab010c81c6cb803b511d00`  
**Scope:** left navigation, middle model panels and subsections, right gallery, 历史记录, 案例库, and the model labels in opened records/details.

This plan includes a proposed seven-file patch checked in a local checkout. It has not been pushed to GitHub or deployed. Live provider galleries remain an acceptance step.

## 1. Required display names

| Version | Original display forms | Required display |
| --- | --- | --- |
| V7 | `悠船MJ V7`, `Midjourney V7`, `MJ V7`, `MJ 7` | `CLImage-2.0` |
| V8 | `悠船MJ V8`, `Midjourney V8`, `MJ V8`, `MJ 8` | `CLImage-2.1` |

The patch also handles short spacing forms such as `MJV7`, `MJ7`, `MJ V 7`, and the corresponding V8 forms. Case and repeated whitespace are normalized. The formatter for approved model fields additionally handles spacing between 悠船, MJ, V and the version digit.

Each history/case record must retain its own version. Opening V8 in the current form must not turn old V7 cards into `CLImage-2.1`, and opening V7 must not turn V8 case cards into `CLImage-2.0`.

Apply the names at the display boundary. Preserve provider model IDs, navigation keys, option values, history JSON, saved records, generation parameters and prompts, including any `--v 7` or `--v 8` text. Existing history does not need a database migration.

## 2. Findings from the current branch

| File/component | Current behavior | Required action |
| --- | --- | --- |
| `config/display-names/names.txt` | Already maps `Midjourney V7` and `悠船MJ V7` to `CLImage-2.0`. No V8 entry. | Add V8; preserve the existing V7 destinations. |
| `config/display-names/display-correspondence.cjs` | Covers several long V7 spellings, but not `MJ V7` / `MJ 7` or V8. | Add explicit short-form and V8 correspondences. |
| `public/harson-customization/model-alias-resolver.js` | Qualified-label matching only includes canonical keys, not spelling variants. | Include correspondence spellings in the qualified matcher. |
| Same resolver | The generic `Midjourney → CLImage` fallback can consume an unknown `V` version suffix. Before the patch, qualified `Midjourney V8` returned `CLImage V8`. | Reject unknown `V` + number suffixes; map the known V8 version explicitly. |
| Same resolver | A prefix-only rewrite can rename the first model in a title while leaving a repeated model inside parentheses original. | Add a scoped formatter that maps each explicit MJ V7/V8 token in an approved image model field. |
| `public/harson-customization/image-tab-config.js` | Already selects model headings, dropdown labels, some history/case badges and dialog titles. Card badges are not in the existing aggregation list. | Declare the existing model-label hosts that can use MJ-specific formatting/aggregation. |
| `public/harson-customization/image-tab-labels.js` | Uses shadow DOM to display aliases while retaining provider source text. Its MutationObserver already watches dynamic content. | Connect the MJ context and complete-label aggregation to this renderer. |
| `tests/model-alias-resolver.test.cjs` | Explicitly expects `Midjourney V8` to be unknown. | Replace that old negative example with V9 and add positive V8/regression checks. |
| `src/services/yibaiDisplayInjection.js` | Injects generated data → resolver → config → renderer into gateway-served HTML. | Deploy the four matching assets together. |

The provider's actual MJ page, history gallery and case-library Vue components are not stored in this repository. The local integration point is the shared alias layer injected through the existing gateway.

The current branch already includes the previous MiniMax mappings/renderer changes. The proposed patch keeps those changes, the existing image aliases, and the repair/color/proxy fixes.

## 3. Implementation sequence

### Step 1 — Add one canonical V8 row

In `config/display-names/names.txt`, keep the existing V7 rows and add:

```text
Midjourney V8,CLImage-2.1
```

The canonical source identifies the version. The display-spelling table sends `悠船MJ V8` and other requested forms to that source; it does not duplicate destination strings throughout the code.

Keep the existing unversioned `Midjourney → CLImage` mapping. An unversioned family label alone does not establish whether a saved image used V7 or V8.

### Step 2 — Add the requested spelling forms

In `config/display-names/display-correspondence.cjs`, add the V7/V8 entries shown in the patch. For example:

```js
"MJ V7": "Midjourney V7",
"MJ 7": "Midjourney V7",
"悠船MJ V8": "Midjourney V8",
"MJ V8": "Midjourney V8",
"MJ 8": "Midjourney V8",
```

Use the runtime files under `config/display-names/` and `public/harson-customization/`. Updating only older copies under `tab_customization/` will not update the gateway's runtime behavior.

### Step 3 — Fix qualified and repeated model labels

Make these resolver changes together:

1. Build qualified matchers from both canonical source names and their spelling correspondences; resolve each spelling to its canonical destination.
2. Keep longest-first matching and a model-name boundary. Reject unknown suffixes beginning with a number or `V` + number, so `Midjourney V9` cannot become `CLImage V9` through the bare family fallback.
3. Add `resolveMidjourneyModelLabel()` for context `{ module: "image-generator", surface: "midjourney-model-label" }`. It maps each explicit V7/V8 token using the generated canonical data and preserves surrounding metadata.

The dedicated context is assigned only to configured model-label hosts that contain an original MJ/Midjourney version. It does not use the currently active model to assign history versions.

Examples checked in the proposed resolver tests:

| Source label | Display label |
| --- | --- |
| `MJ V7 标准` | `CLImage-2.0 标准` |
| `悠船MJ V8（Midjourney V8）` | `CLImage-2.1（CLImage-2.1）` |
| `MJ V7 (MJ V8)` | `CLImage-2.0 (CLImage-2.1)` |
| `悠船  MJ V 8 · 高清` | `CLImage-2.1 · 高清` |
| `模型：MJ 7` | `模型：CLImage-2.0` |

These metadata examples are constructed regression cases, not a claim that those exact strings were seen in your live galleries. The formatter uses explicit token boundaries; `MJ V70`, `MJ V80`, `Midjourney V8.1` and `MJ V8-ULTRA` are not mapped as the requested base versions. Extend punctuation/spelling support only when an actual display label requires it.

Do not add global aliases for `7`, `8`, `V7` or `V8`. If a real MJ version selector displays only one of those short values, add a separate rule scoped to that verified MJ selector; its owning model component must establish the family. Numbers elsewhere can be counts, prices or dimensions.

### Step 4 — Connect the middle and right panels

The patch adds `midjourneyModelLabelSelectors` using these existing configured surfaces:

| Surface | Existing selector(s) used by the patch |
| --- | --- |
| Left model navigation | `.MainLayout-nav .NavList-list-item > span.label` |
| Middle model headings | `.ToolLayout-header`, `.DefaultLayout-header`, `.header_fix > span` |
| Floating model/version tabs | `.header_fix .IcTabs > .IcTab` |
| Existing form tab labels | `.SubLayout-draw .q-tab__label` |
| Selected model and menu options | `.IcbsMenuSelect-header-content`, `.IcbsMenuSelect-menu-item-label` |
| Alternate model selection labels | `.IcbsSelect-header-popup-option-label`, `.SubLayout-draw .IcbsSelect-header-select .q-field__native > span` |
| Existing gallery badge adapters | `.DemoCard .DemoCard-banner > span`, `.TextToImageCard .TextToImageCard-header-typeName > span` |
| Existing opened-detail title | `.q-dialog .header-container .header .vertical-center > span.title` |

In the renderer, assign the MJ context before the existing generic version/family rules when the host actually contains an MJ version. This keeps other image-family overrides working and avoids an unnecessary dependence on the selected sidebar item.

For these MJ hosts, resolve the complete semantic label before rendering individual text fragments. For example:

```html
<span class="actual-model-label">
  <span>MJ</span><span> V8</span>
</span>
```

The visible result must be `CLImage-2.1` once. The illustrative class above is not a verified provider class. The patch retains the existing restrictions on aggregating interactive elements and additionally rejects blocked descendants for MJ aggregation.

Keep the current MutationObserver. Its existing added-node and text-change handling should cover gallery loading, opening detail dialogs and reusing card nodes. No new polling or automatic iframe reload is required.

### Step 5 — Audit 历史记录 and 案例库 separately

Existing selectors are repository evidence, not proof that every current provider component uses them. Before calling the work complete, inspect both live subpanels inside the 图片创作 iframe:

1. Open 历史记录 with existing V7 and V8 results. Check list/grid badges, model filters, selected-item information and each opened detail/preview panel.
2. Open 案例库 and repeat the checks on example cards, filtering/selection controls, detail dialogs and the data restored into the generation form when an example is selected.
3. Check nested sections in those views for **model-owned fields**, including dropdowns, headings, tooltips, `title` and accessible model labels.
4. Exercise pagination/infinite scroll and switch between V7/V8 and other left-panel tools. Revisit the same card after it has been reused or updated.
5. For an original name that remains visible, inspect its actual label leaf and original source text. Add the observed model-label selector to both `selectors` and `midjourneyModelLabelSelectors` where MJ composite formatting is needed. The latter list alone does not schedule new elements for rendering.
6. If a model tooltip uses a new provider-specific component, add its observed model-only selector. Generic `.q-tooltip` currently supports exact/qualified lookups; it is deliberately not included in the new composite MJ list because generic tooltips can also contain prompt text.

Do not target entire cards, whole dialog bodies, every table cell or every span. A card contains user prompts, captions, action buttons and other content. Target its model-name field and preserve the card's original interactions.

For native tabs/buttons/options, use a supported inner label host. The renderer's shadow-root host restrictions and native form exclusions remain relevant. If no supported display host exists, adapt that component's display formatter after identifying its actual implementation; keep the underlying option value.

If a historical record exposes only `Midjourney`, an existing generic alias, or a bare version number, inspect that record's verified model identity. Do not derive its version from the active form, thumbnail, card order or gallery filter. Use per-record model data if a variant-specific display override is necessary.

## 4. Build, regression checks and browser acceptance

Generate the shared data and run the focused checks:

```bash
npm run aliases:build
npm run aliases:check
node --test tests/model-alias-resolver.test.cjs tests/model-alias-generator.test.cjs tests/image-tab-injection.test.cjs
node --check public/harson-customization/image-tab-labels.js
git diff --check
```

The old negative assertion for `Midjourney V8` must be updated to an unknown version such as V9. Do not keep a test that rejects a model this change intentionally adds.

Commit the generated map with its inputs. On the reviewed baseline, the proposed result is:

- Adapter version: `all-pages-11`.
- Mapping hash: `d6d2433bff2c`, replacing `73bb112c1fe8`.
- Seven changed files, listed in the appendix.

If your branch has advanced, retain its newer legitimate mappings and choose a fresh adapter version. The complete mapping hash will change when other entries change.

### Browser acceptance matrix

| Area | Required result |
| --- | --- |
| Left V8 item | `悠船MJ V8` visibly becomes `CLImage-2.1`. |
| Left V7 item | `MJ V7`, `MJ 7` and existing long V7 forms visibly become `CLImage-2.0`. |
| Middle headings and subsections | Explicit V7/V8 names use the matching alias. Chinese workflow labels keep their meaning. |
| Model dropdown/version controls | Options and selected labels display the right alias; pointer/keyboard selection still uses the original provider value. |
| 历史记录 cards | Mixed V7/V8 records show their own versions, independent of the current form. |
| 历史记录 details | Every explicit MJ model occurrence in the model fields is mapped, including repeated names in a title. |
| 案例库 cards/details | The same names are correct in cards, selected examples, previews and model metadata. |
| Select a history/case item | Images and settings still load, and the restored model is the record's original model. |
| Split labels | Nested `MJ` + ` V7` or `MJ` + ` V8` displays one complete alias. |
| Pagination and reuse | New and recycled gallery nodes update correctly when their original source changes from V7 to V8 or vice versa. |
| Tooltips/accessibility | Model tooltips and `title`/`aria-label` agree with the visible model name. Inspect the actual accessibility tree. |
| User content | Prompts, captions, copied generation parameters and editable text are preserved, including `--v` parameters. |
| Existing integrations | MiniMax, Seedance, Kontext and other current aliases retain their established names and behavior. |

Add a browser regression fixture using the actual observed history/case markup. Run production alias files in that fixture and cover initial rendering, dynamic card insertion, node reuse, split text, opened details and click/selection preservation. The older fixtures under `tab_customization/tests/` load older copied assets; they are not sufficient proof for this patch.

Use existing history/case images for display checks. This naming change can be verified without submitting new generation tasks.

## 5. Deploy the correct gateway assets

After reviewing and committing your implementation, update the server checkout through your existing deployment process. Confirm the gateway enables `YIBAI_IMAGE_ALIASES_ENABLED=true`; `.env.example` defaults it to false.

The iframe's display scripts are served by the separate gateway container. Rebuild and recreate it:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway ps gateway
```

Verify the host file, local gateway response and public response match:

```bash
curl -fsS http://127.0.0.1:3001/__harson_custom/image-tab-1/model-aliases.generated.js -o /tmp/harson-mj-alias-local.js
curl -fsS https://ai.harson-base.com/__harson_custom/image-tab-1/model-aliases.generated.js -o /tmp/harson-mj-alias-public.js
sha256sum public/harson-customization/model-aliases.generated.js /tmp/harson-mj-alias-local.js /tmp/harson-mj-alias-public.js
```

All three checksums should match. Compare the resolver, config and renderer files the same way if a surface remains unchanged: matching mapping data alone does not prove the new renderer was deployed.

Reopen the workspace through its existing launch flow after the gateway restart to obtain a fresh iframe session. In the **图片创作 iframe console**, check:

```js
window.HarsonImageLabels?.status()
window.HarsonModelAliasResolver?.resolveDisplayName("悠船MJ V8")
window.HarsonModelAliasResolver?.resolveDisplayName("MJ V7")
window.HarsonModelAliasResolver?.resolveDisplayName("MJ 7")
```

Expected for this exact patch: module `image-generator`, adapter `all-pages-11`, enabled/active true, hash `d6d2433bff2c`; results `CLImage-2.1`, `CLImage-2.0`, `CLImage-2.0`.

Original names may intentionally remain in the light DOM and provider responses. The renderer preserves them as functional source data while displaying aliases through shadow DOM. Verify what is rendered and exposed through accessibility; a text search in Elements or a JSON response alone cannot establish a visible naming failure.

If the status object is missing, check the gateway feature flag and HTML asset injection. If local bytes are current but public bytes are older, check the Nginx/cache target and running gateway instance. Rebuilding only the main app container does not update an already-running gateway container.

The parent workspace also loads the shared map/resolver. Its current All Tools catalog already displays `CLImage-2.0` for the existing V7 card. Adding a new V8 catalog card is a separate content change; this request does not require inventing one. If you later update parent-side alias behavior, deploy the main app's shared assets as well.

For rollback, revert the reviewed MJ naming commit and recreate the gateway with the matching previous alias assets. Keep the earlier proxy/repair/color and MiniMax fixes. No new gateway API allowlist entry, broad Nginx text substitution, or history-response rewrite is needed for this plan.

## 6. Verification completed here

- Read the actual `temp-main` source at the commit identified above.
- Reproduced the missing V8/short-V7 resolutions and the qualified `CLImage V8` fallback problem.
- Prepared the seven-file proposed patch below.
- Alias generation and freshness checks passed; new hash `d6d2433bff2c`.
- **46 resolver/generator/injection tests passed; 0 failed.**
- Renderer JavaScript syntax and diff-whitespace checks passed.
- **Live authenticated 历史记录/案例库 panels were not opened, and browser DOM tests were not run.** The local Playwright package has no installed Chromium executable. Actual provider selectors, interactions, tooltip formats and accessibility remain browser acceptance work, rather than verified outcomes.

## 7. Source references

Snapshot: [temp-main at 97fd435](https://github.com/naseerkhan861/harson-pg/tree/97fd4353c05f3719d5ab010c81c6cb803b511d00).

- [Canonical mappings](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/config/display-names/names.txt) and [spelling policy](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/config/display-names/display-correspondence.cjs).
- [Shared resolver](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/public/harson-customization/model-alias-resolver.js), [renderer configuration](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/public/harson-customization/image-tab-config.js) and [renderer](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/public/harson-customization/image-tab-labels.js).
- [Resolver tests](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/tests/model-alias-resolver.test.cjs), [HTML injection](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/src/services/yibaiDisplayInjection.js) and [gateway deployment guidance](https://github.com/naseerkhan861/harson-pg/blob/97fd4353c05f3719d5ab010c81c6cb803b511d00/docs/gateway-display-alias-deployment.md).

## Appendix — Proposed seven-file patch

Apply these hunks to the reviewed baseline, or merge them carefully into your newer `temp-main`. Regenerate the generated-file hunk with `npm run aliases:build`. The live browser acceptance work described above is still required.

```diff
diff --git a/config/display-names/display-correspondence.cjs b/config/display-names/display-correspondence.cjs
index d905a72..15c6273 100644
--- a/config/display-names/display-correspondence.cjs
+++ b/config/display-names/display-correspondence.cjs
@@ -33,6 +33,22 @@ const correspondences = {
   "悠船M| V7": "悠船MJ V7",
   "悠船M｜ V7": "悠船MJ V7",
   "MidjourneyV7": "Midjourney V7",
+  // Owner-requested short/spacing forms of the versioned MJ labels.
+  "MJ V7": "Midjourney V7",
+  "MJ 7": "Midjourney V7",
+  "MJV7": "Midjourney V7",
+  "MJ7": "Midjourney V7",
+  "MJ V 7": "Midjourney V7",
+  "悠船MJ V8": "Midjourney V8",
+  "悠船 MJ V8": "Midjourney V8",
+  "悠船Midjourney V8": "Midjourney V8",
+  "悠船 Midjourney V8": "Midjourney V8",
+  "MidjourneyV8": "Midjourney V8",
+  "MJ V8": "Midjourney V8",
+  "MJ 8": "Midjourney V8",
+  "MJV8": "Midjourney V8",
+  "MJ8": "Midjourney V8",
+  "MJ V 8": "Midjourney V8",
   "即梦4.0": "即梦 4.0",
   "即梦4.5": "即梦 4.5",
   "即梦5.0 Lite": "即梦 5.0 Lite",
diff --git a/config/display-names/names.txt b/config/display-names/names.txt
index 8632601..7d165cf 100644
--- a/config/display-names/names.txt
+++ b/config/display-names/names.txt
@@ -3,6 +3,7 @@ FLUX.1 Kontex (pro/max),CLImage-1.1
 FLUX.1 Kontext pro,CLImage-1.1
 FLUX.1 Kontext max,CLImage-1.2
 Midjourney V7,CLImage-2.0
+Midjourney V8,CLImage-2.1
 Midjourney,CLImage
 悠船MJ V7,CLImage-2.0
 即梦,CLImage
diff --git a/public/harson-customization/image-tab-config.js b/public/harson-customization/image-tab-config.js
index 03f5ee1..2174bde 100644
--- a/public/harson-customization/image-tab-config.js
+++ b/public/harson-customization/image-tab-config.js
@@ -18,7 +18,7 @@
   //     these header containers; the renderer aggregates a container's full
   //     text when it is exactly a known label.
   const config = Object.freeze({
-    version: "all-pages-10",
+    version: "all-pages-11",
     expectedOrigin: "https://ai.harson-base.com",
     // Applied inside every YiBai module frame served by the gateway.
     modules: Object.freeze([
@@ -57,6 +57,24 @@
       ".q-tooltip",
       ".q-tooltip *"
     ]),
+    // Versioned MJ metadata only: these existing selectors own model
+    // labels, rather than prompts or whole history/case-card bodies.
+    // The renderer also checks image-generator and an original MJ version.
+    midjourneyModelLabelSelectors: Object.freeze([
+      ".MainLayout-nav .NavList-list-item > span.label",
+      ".ToolLayout-header",
+      ".DefaultLayout-header",
+      ".header_fix > span",
+      ".header_fix .IcTabs > .IcTab",
+      ".SubLayout-draw .q-tab__label",
+      ".IcbsMenuSelect-header-content",
+      ".IcbsMenuSelect-menu-item-label",
+      ".IcbsSelect-header-popup-option-label",
+      ".SubLayout-draw .IcbsSelect-header-select .q-field__native > span",
+      ".DemoCard .DemoCard-banner > span",
+      ".TextToImageCard .TextToImageCard-header-typeName > span",
+      ".q-dialog .header-container .header .vertical-center > span.title"
+    ]),
     // Elements whose ENTIRE normalized text is a known label may be
     // aggregated (split/nested spans, IcTab wrappers). Guarded: no form
     // controls or blocked descendants allowed inside.
diff --git a/public/harson-customization/image-tab-labels.js b/public/harson-customization/image-tab-labels.js
index d75d26c..81e6c83 100644
--- a/public/harson-customization/image-tab-labels.js
+++ b/public/harson-customization/image-tab-labels.js
@@ -24,6 +24,7 @@
   const selector = config.selectors.join(",");
   const aggregateSelector = config.aggregateSelectors.join(",");
   const qualifiedSelector = (config.qualifiedSelectors || []).join(",");
+  const midjourneySelector = (config.midjourneyModelLabelSelectors || []).join(",");
   const videoModule = script.dataset.harsonModule === "video-generator";
   const videoMetadataContext = Object.freeze({
     module: "video-generator",
@@ -189,9 +190,18 @@
     return null;
   }
 
+  function midjourneyContextFor(node) {
+    if (script.dataset.harsonModule !== "image-generator" ||
+        !midjourneySelector || !node.matches(midjourneySelector) ||
+        !/(?:midjourney|mj)\s*v?\s*\d/iu.test(node.textContent)) return null;
+    return { module: "image-generator", surface: "midjourney-model-label" };
+  }
+
   function contextFor(node) {
-    // Version-tab precedence first, especially Seedream's short labels.
-    const context = versionContextFor(node) ||
+    // Recognize explicit MJ versions in model fields first; preserve the
+    // existing Seedream/version and image-family rules for other labels.
+    const context = midjourneyContextFor(node) ||
+      versionContextFor(node) ||
       versionDropdownContextFor(node) ||
       imageContextFor(node) || {};
 
@@ -205,19 +215,20 @@
     return context;
   }
 
-  function allowsAggregation(node) {
+  function allowsAggregation(node, context) {
     /*
       Split/nested labels (runbook §10.5): when the element's ENTIRE text
       is exactly one known label (e.g. <span>全能图片</span><span>2</span>),
       resolve it as one label. Only for approved label containers that hold
       no interactive descendants.
     */
-    if (!aggregateSelector || !node.matches(aggregateSelector)) {
+    const midjourney = context?.surface === "midjourney-model-label";
+    if (!midjourney && (!aggregateSelector || !node.matches(aggregateSelector))) {
       return false;
     }
 
     return !node.querySelector(
-      "button,a,input,textarea,select"
+      "button,a,input,textarea,select" + (midjourney ? "," + blocked : "")
     );
   }
 
@@ -344,7 +355,7 @@
       text-free elements still are).
     */
     let aggregate = null;
-    if (eligible && (metadataAlias || allowsAggregation(node))) {
+    if (eligible && (metadataAlias || allowsAggregation(node, context))) {
       aggregate = metadataAlias || aliasFor(node.textContent, context);
     }
 
diff --git a/public/harson-customization/model-alias-resolver.js b/public/harson-customization/model-alias-resolver.js
index 76e406f..b84ba57 100644
--- a/public/harson-customization/model-alias-resolver.js
+++ b/public/harson-customization/model-alias-resolver.js
@@ -57,7 +57,7 @@
         - Longest (versioned) keys are tried before bare family keys.
         - A whitespace/end boundary must follow the key, so "Seedance 2.50"
           never matches "Seedance 2.5".
-        - A suffix that begins with a digit is treated as an unknown
+        - A suffix that begins with a digit or V + digit is an unknown
           version ("Seedance 3.0") and is refused, so unknown versions
           are never converted through the bare-family mapping.
         - One pass: aliases are never re-fed as sources.
@@ -73,11 +73,16 @@
         return qualifiedMatchers;
       }
 
-      qualifiedMatchers = Object.keys(exact)
+      const displayAliases = { ...exact };
+      for (const [spelling, canonical] of Object.entries(variants)) {
+        if (exact[canonical]) displayAliases[spelling] = exact[canonical];
+      }
+      qualifiedMatchers = Object.keys(displayAliases)
         .map(String)
         .sort((a, b) => b.length - a.length)
         .map(key => ({
           key,
+          alias: displayAliases[key],
           pattern: new RegExp(
             "^(\\s*)(" +
               key.split(/\s+/).map(escapeRegExp).join("\\s+") +
@@ -101,20 +106,39 @@
 
         const suffix = raw.slice(match[0].length);
 
-        if (/^\d/.test(suffix.trim())) {
-          // Unknown version suffix — refuse rather than rename through
+        if (/^(?:v\s*)?\d/iu.test(suffix.trim())) {
+          // Unknown numeric/V-number suffix — refuse rather than use
           // the bare-family mapping.
           return null;
         }
 
         // Leading whitespace is insignificant (exact matching trims);
         // the descriptive suffix is preserved verbatim.
-        return exact[matcher.key] + suffix;
+        return matcher.alias + suffix;
       }
 
       return null;
     }
 
+    /*
+      Versioned MJ labels may repeat in a history/case detail title.
+      This formatter runs only in renderer-approved image model fields.
+      Preserve metadata and delimiters; map each explicit V7/V8 token
+      from its own original source, never from the active form selection.
+    */
+    function resolveMidjourneyModelLabel(sourceText) {
+      const raw = String(sourceText || "").trim();
+      const token = /(^|[\s()（）:：·|])((?:悠船\s*)?(?:midjourney\s*v\s*([78])|mj\s*v?\s*([78])))(?=$|[\s()（）:：·|])/giu;
+      let matched = false;
+      const result = raw.replace(token, (whole, before, model, fullVersion, shortVersion) => {
+        const alias = exact["midjourney v" + (fullVersion || shortVersion)];
+        if (!alias) return whole;
+        matched = true;
+        return before + alias;
+      });
+      return matched ? result : null;
+    }
+
     /*
       The video player and its detail drawer use two provider-owned display
       formats. Match the entire format, preserving punctuation, spacing and
@@ -262,6 +286,11 @@
         return exact[variants[key]] || null;
       }
 
+      if (context && context.module === "image-generator" &&
+          context.surface === "midjourney-model-label") {
+        return resolveMidjourneyModelLabel(sourceText);
+      }
+
       if (
         context &&
         context.surface === "model-version-tab" &&
diff --git a/public/harson-customization/model-aliases.generated.js b/public/harson-customization/model-aliases.generated.js
index 061db30..6ec34e7 100644
--- a/public/harson-customization/model-aliases.generated.js
+++ b/public/harson-customization/model-aliases.generated.js
@@ -3,7 +3,7 @@
   Source: config/display-names/names.txt
   Policy: config/display-names/display-correspondence.cjs
   Rebuild: npm run aliases:build   Verify: npm run aliases:check
-  Schema: 1   Mapping hash: 73bb112c1fe8
+  Schema: 1   Mapping hash: d6d2433bff2c
 */
 (function (root, factory) {
   if (typeof module === "object" && module.exports) {
@@ -14,13 +14,14 @@
 })(typeof self !== "undefined" ? self : this, function () {
   return {
   "schemaVersion": 1,
-  "mappingHash": "73bb112c1fe8",
+  "mappingHash": "d6d2433bff2c",
   "exact": {
     "flux krea": "CLImage",
     "flux.1 kontex (pro/max)": "CLImage-1.1",
     "flux.1 kontext pro": "CLImage-1.1",
     "flux.1 kontext max": "CLImage-1.2",
     "midjourney v7": "CLImage-2.0",
+    "midjourney v8": "CLImage-2.1",
     "midjourney": "CLImage",
     "悠船mj v7": "CLImage-2.0",
     "即梦": "CLImage",
@@ -58,6 +59,21 @@
     "悠船 mj v7": "悠船mj v7",
     "悠船m| v7": "悠船mj v7",
     "midjourneyv7": "midjourney v7",
+    "mj v7": "midjourney v7",
+    "mj 7": "midjourney v7",
+    "mjv7": "midjourney v7",
+    "mj7": "midjourney v7",
+    "mj v 7": "midjourney v7",
+    "悠船mj v8": "midjourney v8",
+    "悠船 mj v8": "midjourney v8",
+    "悠船midjourney v8": "midjourney v8",
+    "悠船 midjourney v8": "midjourney v8",
+    "midjourneyv8": "midjourney v8",
+    "mj v8": "midjourney v8",
+    "mj 8": "midjourney v8",
+    "mjv8": "midjourney v8",
+    "mj8": "midjourney v8",
+    "mj v 8": "midjourney v8",
     "即梦4.0": "即梦 4.0",
     "即梦4.5": "即梦 4.5",
     "即梦5.0 lite": "即梦 5.0 lite",
diff --git a/tests/model-alias-resolver.test.cjs b/tests/model-alias-resolver.test.cjs
index e6d5a00..951ab22 100644
--- a/tests/model-alias-resolver.test.cjs
+++ b/tests/model-alias-resolver.test.cjs
@@ -80,7 +80,7 @@ test("unknown labels stay original (no substring or prefix guessing)", () => {
   assert.equal(resolve("一键同款"), null);
   assert.equal(resolve("悠船"), null);
   assert.equal(resolve("FLUX"), null);
-  assert.equal(resolve("Midjourney V8"), null);
+  assert.equal(resolve("Midjourney V9"), null);
   assert.equal(resolve(""), null);
   assert.equal(resolve(null), null);
 });
@@ -278,6 +278,44 @@ test("MiniMax metadata rejects unknown versions and arbitrary text", () => {
   }), null);
 });
 
+test("MJ V7 and V8 exact spellings keep distinct identities", () => {
+  for (const source of ["悠船MJ V7", "Midjourney V7", "MJ V7", "MJ 7", "MJV7", "MJ7", "MJ V 7"]) {
+    assert.equal(resolve(source), "CLImage-2.0", source);
+  }
+  for (const source of ["悠船MJ V8", "悠船 MJ V8", "悠船Midjourney V8", "Midjourney V8", "MJ V8", "MJ 8", "MJV8", "MJ8", "MJ V 8"]) {
+    assert.equal(resolve(source), "CLImage-2.1", source);
+  }
+  assert.equal(resolve("  mj   v7  "), "CLImage-2.0");
+  assert.equal(resolve("CLImage-2.1"), null);
+  assert.equal(resolve("Midjourney"), "CLImage");
+});
+
+test("MJ model-field metadata maps each original version independently", () => {
+  const context = { module: "image-generator", surface: "midjourney-model-label" };
+  const cases = [
+    ["MJ V7 标准", "CLImage-2.0 标准"],
+    ["悠船MJ V8（Midjourney V8）", "CLImage-2.1（CLImage-2.1）"],
+    ["MJ V7 (MJ V8)", "CLImage-2.0 (CLImage-2.1)"],
+    ["悠船  MJ V 8 · 高清", "CLImage-2.1 · 高清"],
+    ["模型：MJ 7", "模型：CLImage-2.0"]
+  ];
+  for (const [source, expected] of cases) assert.equal(resolve(source, context), expected, source);
+  assert.equal(resolve("MJ V7 (MJ V8)"), null);
+  assert.equal(resolve("MJ V7 (MJ V8)", { module: "video-generator", surface: "midjourney-model-label" }), null);
+});
+
+test("MJ unknown versions and prompt text do not resolve through a family prefix", () => {
+  const context = { module: "image-generator", surface: "midjourney-model-label" };
+  for (const source of ["MJ V70", "MJ V80", "MJ V9", "Midjourney V8.1", "MJ V8-ULTRA", "7", "V8"]) {
+    assert.equal(resolve(source, context), null, source);
+  }
+  assert.equal(resolve("Midjourney V9", { allowQualified: true }), null);
+  assert.equal(resolve("Midjourney V8.1", { allowQualified: true }), null);
+  assert.equal(resolve("MJ V7 标准", { allowQualified: true }), "CLImage-2.0 标准");
+  assert.equal(resolve("悠船MJ V8 高清", { allowQualified: true }), "CLImage-2.1 高清");
+  assert.equal(resolve("Draw a shoe with MJ V7 and MJ V8"), null);
+});
+
 test("mapping info reports schema and hash", () => {
   const info = resolver.mappingInfo();
 
```
