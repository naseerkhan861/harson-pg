# 图片创作 / FLUX.1 Kontext: separate pro and max display names

**Repository:** [`naseerkhan861/harson-pg`, branch `temp-main`](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Page:** 图片创作 → left item `CLImage-1.1` → `模型` dropdown and related form/gallery labels  
**Prepared:** 28 October 2026  
**Purpose:** Code changes for your own VS Code checkout. This document has not changed your GitHub repository or server.

## 1. Confirmed cause and mapping decision

The current `config/display-names/names.txt` contains **both**:

```text
FLUX.1 Kontext pro,CLImage-1.1
FLUX.1 Kontext max,CLImage-1.1
```

`config/display-names/display-correspondence.cjs` already maps the provider's short dropdown spellings `kontext-pro` and `kontext-max` to those **different canonical keys**. The resolver's lookup is one pass and keeps the provider-owned text in the light DOM. Thus the dropdown options are identical because the destinations above are identical. The requested assignment used below is **pro → CLImage-1.1** and **max → CLImage-1.2**. It follows the original pro/max dropdown order shown in earlier screenshots; if you intended the reverse, swap only those two destinations.

| Provider-owned source | Surface | Proposed visible label |
| --- | --- | --- |
| `kontext-pro` / `FLUX.1 Kontext pro` | First dropdown option, selected value, explicitly versioned history metadata | `CLImage-1.1` |
| `kontext-max` / `FLUX.1 Kontext max` | Second dropdown option, selected value, explicitly versioned history metadata | `CLImage-1.2` |
| `FLUX.1 Kontext` | Generic left-menu family label | Keep current `CLImage-1.1` unless you separately choose a family label |
| `FLUX.1 Kontex (pro/max)` | Existing canonical **generic** family key | Keep current `CLImage-1.1` |

The generic family name does **not** identify whether an individual historical image was made with pro or max. This distinction matters for the right-side image badges in your screenshot, all currently displaying `CLImage-1.1`.

## 2. Required change: canonical alias data

Edit **`config/display-names/names.txt`**. Change just its max row:

```diff
 FLUX.1 Kontex (pro/max),CLImage-1.1
 FLUX.1 Kontext pro,CLImage-1.1
-FLUX.1 Kontext max,CLImage-1.1
+FLUX.1 Kontext max,CLImage-1.2
```

Leave the `kontext-pro` / `kontext-max` entries in `config/display-names/display-correspondence.cjs` as they are. Do **not** alter the original model IDs, provider API requests, dropdown `value` attributes, request JSON, or image records.

Regenerate the checked-in data file; **do not** hand-edit `public/harson-customization/model-aliases.generated.js`:

```bash
npm run aliases:build
npm run aliases:check
```

The generated file's `exact["flux.1 kontext max"]` becomes `CLImage-1.2`, while its existing `variants["kontext-max"]` continues to point to that canonical key. The mapping hash changes automatically. Existing selectors in `public/harson-customization/image-tab-config.js` cover `.IcbsMenuSelect-menu-item-label` (dropdown options) and `.IcbsMenuSelect-header-content` (selected value), so the two option labels and selected value should update without new selectors. Clicking either option must still submit the **provider's original identifier**.

### Focused resolver tests

In **`tests/model-alias-resolver.test.cjs`**, change its existing assertion for `kontext-max` from `CLImage-1.1` to `CLImage-1.2`, then add these explicit checks:

```js
test("Kontext pro and max keep distinct display identities", () => {
  assert.equal(resolve("kontext-pro"), "CLImage-1.1");
  assert.equal(resolve("kontext-max"), "CLImage-1.2");
  assert.equal(resolve("FLUX.1 Kontext pro"), "CLImage-1.1");
  assert.equal(resolve("FLUX.1 Kontext max"), "CLImage-1.2");

  // The generic family name is not evidence of a max selection.
  assert.equal(resolve("FLUX.1 Kontext"), "CLImage-1.1");
  assert.equal(resolve("CLImage-1.2"), null); // aliases are not source keys
});
```

Run:

```bash
node --test tests/model-alias-resolver.test.cjs
node --test tests/image-tab-injection.test.cjs
```

## 3. Optional, requested form-title behavior: show the selected variant

The current generic middle title is sourced from `FLUX.1 Kontext`, which maps to the **family** alias `CLImage-1.1`; changing `names.txt` alone will **not** turn that generic title into `CLImage-1.2` when max is chosen. If you want the **current generation form title** to follow the selected dropdown value, use this narrowly scoped context. This title is presentational only; it must never change the selected provider model.

### A. Add a contextual override to `model-alias-resolver.js`

Inside `imageGeneratorOverride(key, context)` in **`public/harson-customization/model-alias-resolver.js`**, before its final `return null`, insert:

```js
if (context.surface === "image-family-title" &&
    context.family === "flux-kontext" &&
    (key === "flux.1 kontext" || key === "flux.1kontext")) {
  if (context.variant === "max") return "CLImage-1.2";
  if (context.variant === "pro") return "CLImage-1.1";
}
```

This override runs before the global exact/variant mapping and only for the form title of the active Kontext page. An unknown variant falls through to the current generic family alias. It cannot relabel historical cards from the currently selected model.

### B. Pass the original selected model as context in `image-tab-labels.js`

In **`public/harson-customization/image-tab-labels.js`**, add the Kontext family to `activeImageFamily()` after it computes `source`:

```js
if (source === "flux.1 kontext" || source === "flux.1kontext") {
  return "flux-kontext";
}
```

Add a helper near `activeImageFamily()`. The alias renderer keeps the provider's original selected text in the light DOM, so read `textContent`, not the displayed shadow text:

```js
function selectedKontextVariant() {
  const originalValues = [...document.querySelectorAll(
    ".IcbsMenuSelect-header-content"
  )].map(node => resolver.normalize(node.textContent));

  const selections = originalValues.filter(value =>
    value === "kontext-pro" || value === "kontext-max" ||
    value === "flux.1 kontext pro" ||
    value === "flux.1 kontext max"
  );

  if (selections.length !== 1) return null;
  return selections[0].endsWith("max") ? "max" : "pro";
}
```

Before relying on this helper, confirm in the YiBai iframe's DevTools that the selected-value element has class `IcbsMenuSelect-header-content` and that its `textContent` retains exactly one of the four original spellings. If the provider changes its markup, update this selector to the **verified `模型` dropdown** rather than choosing the first arbitrary selector match.

In `imageContextFor(node)`, after `const family = activeImageFamily();` and before the current `seedream` branch, insert:

```js
if (family === "flux-kontext" &&
    node.matches(".ToolLayout-header,.DefaultLayout-header,.header_fix > span")) {
  return {
    module: "image-generator",
    surface: "image-family-title",
    family,
    variant: selectedKontextVariant()
  };
}
```

The current `MutationObserver` already tracks subtree text and class changes, but changing a selected dropdown may not queue the **separate title node**. Within the existing `mutations.forEach(mutation => { ... })` callback, immediately after `element` is defined, add:

```js
const selectedModelSelector = ".IcbsMenuSelect-header-content";
const selectionChanged =
  element?.matches?.(selectedModelSelector) ||
  element?.closest?.(selectedModelSelector) ||
  [...mutation.addedNodes].some(node =>
    node.nodeType === Node.ELEMENT_NODE &&
    (node.matches(selectedModelSelector) ||
      Boolean(node.querySelector(selectedModelSelector)))
  );
if (selectionChanged) {
  document.querySelectorAll(
    ".ToolLayout-header,.DefaultLayout-header,.header_fix > span"
  ).forEach(title => pending.add(title));
}
```

The existing microtask scheduler then rerenders the small approved title set once. It does not reload the iframe. The existing `image-tab-config.js` heading selectors already include these titles.

Add to `tests/model-alias-resolver.test.cjs`:

```js
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
```

## 4. Right-side images and opened details: use each item's own original model

The renderer already selects `.DemoCard .DemoCard-banner > span` and `.TextToImageCard .TextToImageCard-header-typeName > span`. After Section 2, any such element whose original text is `kontext-max` or `FLUX.1 Kontext max` automatically shows `CLImage-1.2`; pro shows `CLImage-1.1`. The same applies to existing selected title/dialog surfaces with explicit versioned original text.

However, your screenshot shows **every image badge currently reading `CLImage-1.1`**. That is consistent with the provider displaying only its generic `FLUX.1 Kontext` family name on each card. If the original per-card text is generic, no client-side string replacement can honestly determine which images used max. **Do not** assign all right-side cards from the active dropdown, card order, current selection, or filename; history can mix pro and max from earlier sessions.

Inspect the original source and model metadata **inside the iframe context** before adding a card-specific rule. This read-only diagnostic prints only selected model-looking strings and attribute **names**, not prompts, image URLs, or tokens:

```js
const options = [...document.querySelectorAll(
  ".IcbsMenuSelect-menu-item-label"
)].map(node => node.textContent.trim());
const selected = [...document.querySelectorAll(
  ".IcbsMenuSelect-header-content"
)].map(node => node.textContent.trim());
const cards = [...document.querySelectorAll(".DemoCard")].slice(0, 5)
  .map((card, index) => ({
    index,
    sourceBadge: card.querySelector(".DemoCard-banner > span")?.textContent.trim(),
    dataAttributeNames: [...card.attributes]
      .filter(attr => attr.name.startsWith("data-"))
      .map(attr => attr.name)
  }));
console.table({ options, selected, cards });
```

If each card carries a verified **provider-owned per-task model field** such as `data-model` or an authenticated history record keyed by the card's stable task ID, extend `imageContextFor(node)` for the **badge and its opened detail only**:

```js
// Illustration: use ONLY after confirming this exact attribute exists on
// each provider-owned card and contains its actual model identifier.
if (node.matches(".DemoCard .DemoCard-banner > span")) {
  const card = node.closest(".DemoCard");
  const sourceModel = resolver.normalize(card?.getAttribute("data-model"));
  const variant = sourceModel === "kontext-max" ? "max"
    : sourceModel === "kontext-pro" ? "pro" : null;
  if (variant) {
    return {
      module: "image-generator",
      surface: "kontext-card-badge",
      variant
    };
  }
}
```

Then, in `imageGeneratorOverride` before its final `return null`, map only the generic **card badge** with a verified per-card variant:

```js
if (context.surface === "kontext-card-badge" &&
    (key === "flux.1 kontext" || key === "flux.1kontext")) {
  if (context.variant === "max") return "CLImage-1.2";
  if (context.variant === "pro") return "CLImage-1.1";
}
```

Use an equivalent verified per-task source for an opened side detail panel. If the provider exposes **no per-image variant at all**, this card-specific code cannot be applied; leave the existing generic family badge and ask YiBai to expose the model in authenticated history data, or label the family separately by an explicitly chosen neutral family name. There is no reliable way to derive max from the card image pixels or from the current dropdown. The example `data-model` attribute above is **not confirmed** to exist in your live DOM and must not be pasted in without that check.

## 5. Deploy and verify

After tests pass, push your reviewed commit and update the server checkout. The alias data and renderer are served by the separate gateway container in `docker-compose.yml`:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway exec gateway grep -n 'flux.1 kontext max' /app/public/harson-customization/model-aliases.generated.js
```

Open a new iframe session or refresh once. In the frame console, `window.HarsonImageLabels.status()` should report the new generated mapping hash. Verify:

1. Dropdown source `kontext-pro` displays `CLImage-1.1`; `kontext-max` displays `CLImage-1.2`, including the selected value on each click.
2. The currently selected form title follows the dropdown **if** you applied Section 3, without a full reload.
3. Clicking either option still sends the respective provider model key (check only the **model field name/value**, never share tokens or private prompts).
4. Explicitly versioned gallery badges/history details map to the correct alias; mixed historical pro/max cards keep their own identities when the current dropdown changes.
5. The left family label remains `CLImage-1.1`; other image/video modules and model names are unchanged.

**Verified from `temp-main`:** duplicate destinations in `names.txt`; existing pro/max correspondence entries; dropdown, selected-value, card and title selectors; resolver behavior with a simulated max destination change. **Not established by the screenshot:** whether each right-side historical image exposes its actual pro/max model. Section 4 is therefore intentionally conditional.
