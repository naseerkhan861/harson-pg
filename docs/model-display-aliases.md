# Model Display Aliases

Display-only renaming of AI model labels across the YiBai iframe and
Harson's own pages. Original model identities (IDs, option values,
request payloads, routes, billing) are never modified.

## Source of truth

- **`config/display-names/names.txt`** — owner-controlled `source,alias`
  rows. This is the only file to edit when renaming a model.
- **`config/display-names/display-correspondence.cjs`** — reviewed policy
  table mapping UI display spellings to canonical keys, plus the Seedream
  version-selector context rules.

Build and verify the generated data:

```sh
npm run aliases:build   # regenerate public/harson-customization/model-aliases.generated.js
npm run aliases:check   # fail if the generated file is stale
```

Validation: two-column strict rows, BOM/CRLF tolerant, conflicting
normalized duplicates rejected, same-destination duplicates coalesced,
every correspondence must reference an existing canonical key. Output is
deterministic (schema version + mapping hash, no timestamps).

## Resolution policy

`model-alias-resolver.js` (shared by the iframe renderer and the parent
All-Tools catalog), strictly one pass:

1. exact canonical mapping (`names.txt`)
2. display-spelling correspondence (Appendix C policy)
3. contextual rule — short Seedream versions (`4.0`, `4.5`, `5.0 lite`,
   `5.0 pro`) only inside the verified Seedream version selector
4. otherwise `null` — the original label is kept

Normalization: NFKC, trim, whitespace collapse, case-insensitive. No
substring or prefix matching; aliases are never re-fed as sources.

### Recorded policy decisions

- **FLUX Krea → CLImage** — the owner's file contained both `CLImage-1.0`
  and `CLImage`; the last row wins (same rule as Happy Horse). Changing
  this is a one-row edit in `names.txt`.
- **Seedream → CLVideo** — explicit owner rule, kept literally. Versioned
  English labels (Seedream 5.0 Pro → CLImage-3.3) resolve through the
  explicit correspondence, so the family heading and version buttons can
  intentionally differ in prefix under the current table.
- Unknown spellings (SeeDance 2.0 VIP, 高清放大 x.x, 爆款视频复刻…) stay
  original until added explicitly.

## Runtime surfaces

| Surface | Files |
|---|---|
| Gateway injection (data → resolver → config → renderer) | `src/services/yibaiDisplayInjection.js` |
| Iframe renderer (shadow DOM, manual slots, reversible) | `public/harson-customization/image-tab-labels.js` |
| Adapter selectors/config | `public/harson-customization/image-tab-config.js` |
| Parent All-Tools catalog (title + img.alt at render time) | `public/js/aigc-workspace.js` |

Activation: `YIBAI_IMAGE_ALIASES_ENABLED` (gateway injection) and
`YIBAI_FRAME_PUBLIC_ORIGIN` (gateway routing) in the server `.env`.

## Tests

```sh
node --test tests/model-alias-generator.test.cjs
node --test tests/model-alias-resolver.test.cjs
node --test tests/image-tab-injection.test.cjs
node scripts/test-gateway-fixture.js
```

Browser-fixture tests (Playwright) from the runbook were **not run** —
Playwright is not installed in this environment. Live verification uses
the diagnostics below plus the owner's walkthrough.

## Diagnostics (iframe console, ai.harson-base.com context)

```js
window.HarsonImageLabels.status()        // release, mapping hash, counts
window.HarsonImageLabels.dumpUnmatched() // still-original known labels + DOM chain
window.HarsonImageLabels.setEnabled(false) // instant local rollback, no reload
```

## Rollback

1. Local/browser: `setEnabled(false)`.
2. All labels: `YIBAI_IMAGE_ALIASES_ENABLED=false` + restart gateway
   (iframe reloads labels on next load).
3. Full release: `git revert` the display-name commits and redeploy;
   a prior image tag is retained at each deployment.

## Known limitations

- Text baked into image pixels, canvas-rendered labels, and downloaded
  file names are not DOM labels and are not altered.
- The provider may ship markup changes that require selector updates;
  unmatched labels fall back to originals (never blank controls).
- Names in already-loaded iframes update only after a normal reload of
  that frame following a release.
