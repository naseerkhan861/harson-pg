# Fix video-creation sidebar labels shifting after navigation

**Repository:** [`naseerkhan861/harson-pg`, `temp-main`](https://github.com/naseerkhan861/harson-pg/tree/temp-main)  
**Affected view:** `视频创作` left menu on `ai.harson-base.com`  
**Prepared:** 28 October 2026  
**Application:** Edit and deploy these files from your own development checkout. This guide itself does not modify GitHub or your server.

## 1. What the screenshots and code show

The four menu items are initially aligned, but after selecting `爆款视频复刻` or `CL Dragon`, some labels start farther left than others. A full reload restores the initial appearance temporarily. The screenshots suggest a **horizontal offset change on navigation**, rather than a wrong name mapping; their exact computed CSS and DOM after the click were not supplied, so the particular vendor rule responsible is not yet proven.

The left menu belongs to the **YiBai iframe** at `ai.harson-base.com`. The parent's `public/css/aigc-workspace.css` cannot style its contents. In the current `temp-main` branch:

- `src/gateway/server.js` proxies YiBai HTML and serves `/__harson_custom/image-tab-1/*` assets from `public/harson-customization/`.
- `src/services/yibaiDisplayInjection.js` injects the existing navigation and alias assets into the frame's HTML.
- `public/harson-customization/image-tab-labels.js` renders approved aliases on the original `span.label` using a shadow root, and rescans on provider class changes.
- `public/harson-customization/image-tab-config.js` already supports module `video-generator` and selects `.MainLayout-nav .NavList-list-item > span.label`.

The intended fix is a **small CSS rule scoped to video-generator HTML**, loaded through the same gateway. It keeps the row's left inset and the label's own inset constant for normal and active rows. It does not rewrite the provider's menu text, route IDs, click handlers, or backend model values.

## 2. Verify the actual offset once in DevTools

In DevTools, choose the **YiBai frame** context (`ai.harson-base.com`) rather than the parent `harson-base.com` page. Run this read-only snippet before a click and again after clicking through the four items:

```js
[...document.querySelectorAll(".MainLayout-nav .NavList-list-item")]
  .map((row, index) => {
    const label = row.querySelector(":scope > span.label");
    if (!label) return null;
    const rowStyle = getComputedStyle(row);
    const labelStyle = getComputedStyle(label);
    return {
      index,
      originalText: label.textContent.trim(),
      active: row.classList.contains("active"),
      rowX: Math.round(row.getBoundingClientRect().left),
      labelX: Math.round(label.getBoundingClientRect().left),
      rowPaddingLeft: rowStyle.paddingLeft,
      labelMarginLeft: labelStyle.marginLeft,
      labelPaddingLeft: labelStyle.paddingLeft,
      labelTextIndent: labelStyle.textIndent,
      labelTransform: labelStyle.transform
    };
  })
  .filter(Boolean);
```

Expected diagnosis: the `labelX`, `rowPaddingLeft`, or label inset values differ between some rows after a click. If the values remain identical while the *painted glyphs* still shift, inspect the label's open `shadowRoot` and the provider's `::before`/`::after` rules before changing the stylesheet below. The original text shown in `textContent` is intentional: the displayed alias comes from the shadow renderer; do not replace source text nodes.

## 3. Add a video-only stylesheet

Create **`public/harson-customization/video-nav-alignment.css`**:

```css
/* Loaded only into video-generator HTML through the Harson gateway. */
.MainLayout-nav {
  --harson-video-label-start: 40px;
}

.MainLayout-nav .NavList-list-item,
.MainLayout-nav .NavList-list-item.active {
  box-sizing: border-box;
  padding-left: var(--harson-video-label-start) !important;
  justify-content: flex-start !important;
  text-align: left !important;
}

.MainLayout-nav .NavList-list-item > span.label,
.MainLayout-nav .NavList-list-item.active > span.label {
  min-width: 0;
  margin-left: 0 !important;
  padding-left: 0 !important;
  text-indent: 0 !important;
  transform: none !important;
  text-align: left !important;
}
```

`40px` matches the approximately aligned starting position in the **initial** screenshot; if your DevTools measurements show a different desired inset, change only `--harson-video-label-start`. This CSS does not set a new font, color, row height, or background, so the provider's selected-state styling remains intact. It keeps the DOM structure and all click handlers in place.

Do not put this in `public/css/aigc-workspace.css` (the parent cannot reach the iframe), nor in the shared `nav-visibility.css` (that file is injected into all modules). Do not modify `config/display-names/names.txt` or the generated alias mapping for a spacing problem.

## 4. Inject the stylesheet into video-generator HTML only

Open **`src/services/yibaiDisplayInjection.js`**. Near its existing `SCRIPT_MARKER` and `NAV_MARKER`, add:

```js
const VIDEO_NAV_MARKER = "harson-video-nav-alignment";
```

Inside `injectImageTabAssets(...)`, after the current `navTags` definition and before its final `return`, add:

```js
const videoNavTags =
  moduleName === "video-generator" &&
  !html.includes(`id="${VIDEO_NAV_MARKER}"`)
    ? `<link id="${VIDEO_NAV_MARKER}" rel="stylesheet" ` +
      `href="${ASSET_PREFIX}/video-nav-alignment.css">`
    : "";
```

Change the return expression from:

```js
return html.slice(0, end) + navTags + aliasTags + html.slice(end);
```

to:

```js
return html.slice(0, end) + navTags + videoNavTags + aliasTags + html.slice(end);
```

The stylesheet is injected near the end of `<head>`, after the provider's initial stylesheet links, and only when the existing safe HTML-injection guards pass. Its link has a unique marker, so running injection twice will not duplicate it. The gateway currently calls this helper with `hideVirtualSample: true`, so the style can load for video navigation even if model aliases are disabled; it is not tied to the alias mapping.

No change to the `src/gateway/server.js` route allowlist or to `YIBAI_GATEWAY_EXTRA_PATHS` is needed. The static asset route already serves files in `public/harson-customization/` under the `ASSET_PREFIX` URL.

## 5. Add focused injection coverage

In **`tests/image-tab-injection.test.cjs`**, add one test alongside the other injection tests:

```js
test("video sidebar alignment CSS is scoped and not duplicated", () => {
  const video = inject(HTML, {
    moduleName: "video-generator",
    hideVirtualSample: true
  });
  const marker = 'id="harson-video-nav-alignment"';

  assert.ok(video.includes(marker));
  assert.ok(video.includes(
    `${ASSET_PREFIX}/video-nav-alignment.css`
  ));
  assert.equal(video.split(marker).length - 1, 1);
  assert.equal(inject(video, {
    moduleName: "video-generator",
    hideVirtualSample: true
  }), video);

  for (const otherModule of ["image-generator", "clothing", "e-commerce"]) {
    assert.ok(!inject(HTML, {
      moduleName: otherModule,
      hideVirtualSample: true
    }).includes(marker));
  }
});
```

Run from the repo root:

```bash
node --test tests/image-tab-injection.test.cjs
npm run aliases:check
```

The second command confirms the alias data was not accidentally edited. A CSS alignment result still needs a visual browser check; the test only proves that the stylesheet is injected in the correct module and not duplicated.

## 6. Deploy and verify without repeated reloads

After committing/pushing your reviewed changes and updating the server checkout, rebuild the **gateway** service, which serves the iframe HTML and static customization file:

```bash
docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
docker compose --profile gateway exec gateway test -f /app/public/harson-customization/video-nav-alignment.css
```

Make one initial browser refresh to load the new CSS link. In DevTools → Network verify the stylesheet returns **200** from `ai.harson-base.com/__harson_custom/image-tab-1/video-nav-alignment.css`. If the old page is cached, use one hard refresh and then test in the same session:

1. Switch among all four left items in different orders, including `CLVideo3.0`, `爆款视频复刻`, `CL Dragon`, and `MiniMax_H3`.
2. Check that all four label starts remain aligned in normal, hover, and active states **without** refreshing between clicks.
3. Repeat at your common desktop widths and one narrower browser width; check that no text is clipped and selected row colors still work.
4. Check another module such as 图片创作 to confirm that the video-only CSS was not added there.

If the stylesheet is loaded but the text still moves, rerun the snippet in Section 2. Inspect DevTools → Computed for the winning `padding-left`/`margin-left` declarations and the actual row structure. If the provider changed its markup so the label is no longer a direct `span.label`, update the selector to match the **observed** video menu structure; do not broaden it to arbitrary `.label` elements. If the measured host boxes stay aligned but only shadow-rendered glyphs move, the cause is inside the label's shadow presentation and needs a renderer-specific adjustment rather than another row padding override.

**Confidence:** the correct code insertion points, module key, and existing static asset route are established from current `temp-main`. The exact CSS property responsible for your live visual shift remains a hypothesis until the before/after computed-style comparison; `40px` is a proposed visual target from the screenshots, not a measured provider specification.
