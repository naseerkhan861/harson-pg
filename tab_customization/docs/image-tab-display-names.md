**Harson image tab: six display aliases and gateway integration**

Prepared against `naseerkhan861/harson-pg`, commit
`862597b454829248effd60c713e6bab1ff3d3917`, on 21 September 2026.
Main website: `https://harson-base.com`. Proposed UI gateway:
`https://ai.harson-base.com`. Provider: the existing configured YiBai origin.

**What is supplied, and what still needs integration**

This change supplies a working, browser-tested display adapter, its six-name
configuration, and an HTML injection helper. It is an implementation starter for
the requested solution. It does not install a reverse proxy, change the existing
iframe URL, modify the running website, or establish a new provider login.

The repository currently loads the provider directly. It has a media-download
proxy, but no authenticated gateway for the complete YiBai interface. The hostname
`ai.harson-base.com` by itself does not provide that gateway. Its current Alibaba
Cloud/Nginx configuration and authenticated provider behavior still need to be
checked before activation. The gateway work below is a concrete integration plan;
the proposed gateway environment variables and endpoints are not implemented by
these starter files.

**1. Exact changes**

The supplied list contains six pairs, rather than seven.

| Existing display name | New display name |
| --- | --- |
| 悠船Midjourney V7 | HarsonMD |
| 全能图片 | Harson-ZP |
| 即梦 | Harson-SD |
| GPT-image-2 | HarsonIM2 |
| FLUX.1 Kontext | HarsonFK1 |
| FLUX Krea | HarsonFK |

The same family appears with different display spellings in the screenshots and
provider components. The configuration includes these related display aliases:

| Related visible label | Display result |
| --- | --- |
| 悠船MJ V7 / 悠船 MJ V7 | HarsonMD |
| image-2 | HarsonIM2 |
| Seedream / 即梦 Seedream | Harson-SD |
| 全能图片 pro / 全能图片2 | Harson-ZP pro / Harson-ZP 2 |
| kontext-pro / kontext-max | HarsonFK1 pro / HarsonFK1 max |
| 即梦 or Seedream followed by a configured version | Harson-SD followed by that version |

Configured Seedream suffixes are 4.0, 4.5, 5.0 lite and 5.0 pro. Bare version
labels such as `4.5` remain as they are. Unknown spellings remain original until
added explicitly to the mapping. No alias is inferred from part of an arbitrary
sentence. Distinct versions remain distinguishable.

The other sidebar tools, including 一键同款, 风格绘画, 风格转换 and 混图, are not
renamed. This rollout is for the image tab; it does not enable renaming in the
video, clothing, pattern or e-commerce tabs.

**2. Plan and reasoning**

Use a small presentation adapter inside the authorized, proxied YiBai document.
The main Harson application continues to own account mapping, provider login,
token refresh and task attribution. A separate gateway serves the provider UI
through `ai.harson-base.com` and adds the two local display scripts to its HTML.

The parent page cannot reach the DOM of the current `yibaiaigc.com` iframe. Moving
the iframe to `ai.harson-base.com` still leaves it on a different origin from
`harson-base.com`. Therefore the scripts must execute **inside the iframe**. Adding
CORS headers, putting an observer in `aigc-workspace.js`, or changing DNS alone
does not grant the parent DOM access. See the
[same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).

Keep the provider's Vue state, request bodies, IDs, object values, selected values,
route keys, source text and stored history intact. Render aliases at selected
label elements. This allows `kontext-max`, for example, to display as `HarsonFK1
max` while the provider still submits its existing `flux-kontext-max` value.

The adapter uses a small shadow tree on each matched label. Original text remains
in the element's light DOM; the displayed text comes from the shadow tree. Manual
slots preserve existing child icons, buttons and their event handlers. This is
more precise than changing every matching word in the page. See
[attachShadow](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)
and [using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM).

Source `textContent` stays original. Rendered-text APIs such as `innerText`, screen
readers, copying and layout can reflect the rendered presentation differently.
The provider must use its model state/IDs for submission; the live acceptance
test must verify this. No external DOM customization is permanently foolproof
against changes in a third-party application.

**3. Files and display coverage**

| File | Purpose |
| --- | --- |
| `public/harson-customization/image-tab-config.js` | Six requested aliases, related display spellings and narrow component selectors. |
| `public/harson-customization/image-tab-labels.js` | Display renderer, dynamic updates, scope checks and immediate disable switch. |
| `src/services/yibaiDisplayInjection.js` | Adds external script tags to an explicitly enabled image-tab HTML document. It is not the gateway itself. |
| `tests/image-tab-injection.test.cjs` | Mapping, module isolation, bounded HTML injection and non-HTML pass-through checks. |
| `tests/image-tab-labels.browser.cjs` | Browser fixtures for source values, events, dynamic cards, portal menus, accessibility and rollback. |

The sidebar selector is confirmed by the supplied DevTools screenshot:

```css
.MainLayout-nav .NavList-list-item > span.label
```

Additional selectors were checked against the provider's publicly served
components. They target the following presentation areas:

| Area | Adapter target / behavior |
| --- | --- |
| Sidebar | Only the model label span, preserving its clickable row and model data. |
| Form heading | Direct title text in `ToolLayout-header`, preserving adjacent help controls. |
| Model family/version tabs | Label spans and `IcTab` elements inside the form's `header_fix`. |
| Selected model | `IcbsMenuSelect-header-content` or the visible label span in the custom select. |
| Open dropdown | `IcbsSelect-header-popup-option-label` and `IcbsMenuSelect-menu-item-label`. |
| Example pictures | The span in `DemoCard-banner`; each card keeps its own model identity. |
| History | The span in `TextToImageCard-header-typeName`, including mixed-model history. |
| Preview dialog | The model title span in the inspected dialog header when its full label matches the map. |

Picture labels in the inspected `DemoCard` component are HTML overlay spans.
The adapter does not edit the picture file, its pixels, downloads, file names or
watermarks. Names baked into an image would require a separate image-processing
change.

Preview titles that combine a model name with additional metadata, native
`<option>` controls, unsupported shadow hosts, new component structures and
unmapped tooltip text retain their original labels. The live pilot should record
any such remaining label, then add a precise adapter; do not respond by replacing
text across the whole document. Existing exact-match `title` and `aria-label`
attributes on adapted hosts are also updated and restored.

Quasar can place dropdowns directly under the document body, outside the form.
The observer accounts for these new subtrees. See the
[Quasar menu documentation](https://quasar.dev/vue-components/menu/).

**4. First establish the authenticated gateway**

Run a dedicated Node gateway behind the `ai.harson-base.com` Nginx virtual host,
for example on a loopback/internal port 3001. Keep the existing Harson app on 3000.
Use the existing application build if convenient, but a separate gateway entry
point. Do not start a second copy of `server.js` to implement the gateway: account
and token CSV files currently rely on in-process locking.

The gateway contract should be:

1. Harson authenticates its existing `harson_token` cookie and resolves the
   user's existing YiBai account and image module using the current session code.
2. Harson issues an opaque, random launch ticket, valid for at most 60 seconds,
   bound to that Harson user, provider account, module, approved route and login
   expiry. Store the provider token on the server, not inside a readable ticket.
3. The iframe opens an address such as
   `https://ai.harson-base.com/__harson/launch?ticket=<one-use-ticket>`.
4. The gateway redeems the ticket through an authenticated internal service
   endpoint on the existing Harson app. Consume it atomically and reject reuse.
   Never accept an arbitrary user-supplied upstream URL.
5. The gateway sets its own opaque, host-only session cookie, for example
   `__Host-harson_aigc`, with `Secure; HttpOnly; SameSite=Strict; Path=/` and no
   `Domain` attribute. Bind its server-side record to the redeemed user/account.
   Do not broaden `harson_token` to `.harson-base.com`.
6. Every provider request requires a valid gateway session. Tie its expiry to
   the Harson login and revoke that user's gateway access on logout, account
   disable or rebinding. Close/revoke long-lived streams as appropriate. Provider
   shared-login retention must not keep a logged-out Harson user's gateway open.
7. Launch the provider with the same route, `embed=2`, and current token that its
   existing embed protocol expects. If YiBai requires the token in the browser URL,
   it remains visible to that browser; a launch ticket is not a claim to hide it
   from the iframe user. Redact query strings and credentials from access logs.

An atomic Redis store is suitable when multiple application/gateway instances
need to share tickets and revocations. Do not scale the current CSV-writing main
app as part of this change without addressing its existing locking model.

The gateway must preserve provider requests and responses, with targeted transport
adaptations only:

- Fix the upstream to the approved YiBai host; allow only reviewed redirect/CDN
  destinations. Do not accept `?url=` as a general proxy target.
- Stream API bodies, uploads, downloads, event streams and WebSockets. Do not
  buffer them to search for model words. Avoid the main app's generic JSON parser,
  `/api/aigc` limiter and CSP on these provider transport routes.
- Keep each user's provider cookies/session separate; remove Harson/gateway
  credentials from forwarded headers. Rewrite only reviewed provider cookie
  domains/paths and redirects that need to remain on the gateway.
- Test provider absolute API/asset URLs, login redirects, CSRF checks, local
  storage, service workers and account switching. A browser-origin change can
  affect these even when the HTML itself loads successfully.
- Preserve provider CSRF tokens and apply explicit origin/CSRF protection to
  Harson state-changing cookie-authenticated endpoints. Both Harson hosts are
  same-site; `SameSite=Strict` alone does not isolate them from each other.
- Permit the parent to frame the gateway using a reviewed `frame-ancestors`
  policy. Retain CSP protections and make a narrow allowance for the two local
  scripts if needed. Do not remove all CSP headers or add unrestricted CORS.
- Disable shared caching of personalized HTML, API and login responses. The two
  versioned display assets can have ordinary static-file caching.

Start by verifying the original YiBai UI through the authenticated gateway with
customization disabled. Test login, subaccount separation, opening image tools,
uploads, a permitted test generation, history, previews, downloads and logout.
Only then enable script injection. This isolates proxy compatibility problems
from display-adapter problems.

Nginx must forward the entire provider path space to the dedicated gateway,
including `/assets`, API routes and WebSocket upgrades, with streaming-friendly
buffering/timeouts. Configure valid HTTPS for `ai.harson-base.com` and keep the
gateway's application port private. Inspect the existing virtual-host setup
before replacing it. See
[Nginx proxy documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

**5. Connect that gateway to the existing repository**

Make the following integration changes after the no-customization pilot succeeds:

| Existing file | Required integration |
| --- | --- |
| `src/controllers/aigcSessionController.js` | After the existing route/token resolution, issue a gateway launch URL for `image-generator` when the feature is enabled. Use the existing direct URL when the feature is disabled. |
| `server.js` | Add `https://ai.harson-base.com` to `frame-src`; keep the existing direct provider entries for rollback. Add authenticated internal ticket/session endpoints outside the provider traffic path. |
| `src/controllers/authController.js` | Revoke gateway sessions on Harson logout even when a shared provider login must remain available for another user. |
| `public/js/aigc-workspace.js` | Keep `event.source === iframe.contentWindow` and exact `event.origin === state.currentFrameOrigin`. The returned launch URL must remain on the gateway origin after redirects. Never replace origin checks with `*`. |
| Gateway entry point | Serve the two local assets before proxy routes; inject them only into authorized image-module HTML documents. |
| Alibaba Cloud deployment | Add the dedicated service and the `ai.harson-base.com` HTTPS virtual host, with port and log settings described above. |

Keep `YIBAI_AIGC_HOST` pointing to the real provider. It is also used by the
server-side provider API client; replacing it with the gateway can create loops
or break account login. Introduce separate settings for the public frame origin,
gateway authentication and the image-alias feature, such as
`YIBAI_FRAME_PUBLIC_ORIGIN` and `YIBAI_IMAGE_ALIASES_ENABLED`. These names are
proposed settings for the gateway integration, not active switches in this starter.

Do not rename `MODULE_DEFINITIONS[*].menuName`. That code uses original provider
menu names to resolve the correct route. Retain the subaccount runtime patch
installed by `aigcAccountRoutes.js`; it determines the real account/token used by
ordinary users and master owners.

Do not change `ALL_TOOLS[*].name` or `TOOL_FILTERS` keys to the new aliases.
Those strings are functional keys in the native Harson catalogue. If the native
catalogue is added to the rollout later, alias its rendered `title.textContent`
and image alt text without changing those keys.

**6. Install the prepared display layer in the gateway**

The following snippets belong in the new, authenticated gateway, not in the
parent page. They describe integration points; they do not supply the missing
gateway authentication/streaming implementation.

Serve the static files from this reserved gateway path before forwarding requests:

```js
const path = require("node:path");
const express = require("express");
const { ASSET_PREFIX, injectImageTabAssets } =
  require("./src/services/yibaiDisplayInjection");

gatewayApp.use(ASSET_PREFIX, express.static(
  path.join(__dirname, "public/harson-customization"),
  { index: false, fallthrough: false }
));
```

In the authorized HTML-response branch of that gateway, call:

```js
const renderedHtml = injectImageTabAssets(decodedHtml, {
  enabled: imageAliasesEnabled,
  moduleName: gatewaySession.moduleName,
  contentType: upstreamContentType
});
```

The caller must already have validated the session, destination and content type,
bounded the HTML body, and decoded/decompressed it correctly. The helper refuses
non-HTML, non-image-module, disabled, duplicate and oversized injections. After a
body change, remove/recompute stale `Content-Length`, `Content-Encoding` and ETag
headers, then encode/send it correctly. Do not pass API JSON to this function.

It adds two external deferred script tags. Its browser guard requires the exact
`https://ai.harson-base.com` origin and `image-generator` module metadata. It also
checks for the six original image-sidebar labels, so a later in-frame switch to
another module restores provider labels. A changed sidebar may therefore disable
customization until its adapter is updated; the original interface stays usable.

No `iframe.contentDocument` calls, `innerHTML` replacements, API interception,
passwords, tokens or framework-store mutations are used by the adapter.

**7. Reload behavior and rollback**

The adapter uses `MutationObserver` and batches changed elements. It makes no
network requests after its two asset loads, calls no session endpoint and never
assigns `iframe.src`. Opening a dropdown, loading more examples, switching model
rows and updating a history card therefore require no reload for renaming.

The existing parent `handleNavigationClick()` still requests a session and
`showFrame()` still assigns `iframe.src`. This starter does not change that
navigation behavior. A later parent change can ignore clicks on an already
displayed, healthy module and preserve an existing frame when returning from
local panels. Explicit refresh and genuine session expiry still need their normal
recovery. The provider has not supplied a verified cross-module navigation bridge,
so this solution does not promise zero reloads between every top-level tab.

For immediate display rollback, select the iframe's execution context in browser
DevTools and run:

```js
window.HarsonImageLabels.setEnabled(false);
```

Original text and adapted accessibility/title attributes reappear without
reloading. The observer remains active to keep the restored slots correct if Vue
changes the page. Re-enable with `setEnabled(true)`. To roll back future page loads,
disable gateway injection. To roll back the gateway itself, return image-module
launches to the existing direct provider URL; that navigation necessarily reloads
the iframe. Save any current user input first.

**8. Verification and release criteria**

Run the dependency-free checks from the repository root:

```sh
node --test tests/image-tab-injection.test.cjs
```

The browser suite requires Playwright and its Chromium browser as development
tooling; it adds no production dependency. With that tooling installed, run:

```sh
node --test tests/image-tab-labels.browser.cjs
```

The suite also accepts `HARSON_PLAYWRIGHT_MODULE` and
`HARSON_CHROMIUM_EXECUTABLE` for an existing development runtime. Local results:
3 Node tests and 9 Chromium fixture tests passed. The browser tests check all six
aliases, title/history/badge rendering, original text/values, click handlers,
late cards, portal menus, Vue-like updates, module exit, disable/re-enable,
editable-content exclusion and the browser's native accessibility tree.

These are controlled fixture tests, not an authenticated test of your deployed
YiBai session. Before enabling for users, verify:

1. Each of the six models displays its alias in the sidebar, heading, examples
   and historical records; variants retain their suffixes.
2. Submitted model IDs/objects/values match a baseline request from the original
   interface. Compare semantic model fields, ignoring changing tokens, timestamps
   and request IDs. Never store a credential-bearing HAR in Git.
3. Selecting models/variants, keyboard use, help buttons, preview dialogs and
   downloads still work, and user-entered prompts remain unchanged.
4. Repeated navigation, slow responses, infinite scroll and reused history cards
   remain correct. Record any unmapped visible label for a narrow follow-up.
5. Main-owner and subaccount users retain separate history and balances. Logout,
   expiry and account switching invalidate the right gateway session without
   logging out another user's shared provider account.
6. Test the browsers your users actually use. Unsupported manual-slot browsers
   keep the provider labels. Check clipping, zoom, mobile widths and screen-reader
   names with the real provider styles.
7. Both display-only rollback and gateway rollback work before broad release.

Provider source evidence used to identify the label surfaces, without changing
those upstream files: [sidebar](https://yibaiaigc.com/assets/NavListZh-BsTUHK-b.js),
[example cards](https://yibaiaigc.com/assets/DemoPage-BPkjTmwP.js),
[history](https://yibaiaigc.com/assets/MainLayout-DoXedi3G.js),
[form heading](https://yibaiaigc.com/assets/ToolLayout-BE2GaP26.js), and
[model selector](https://yibaiaigc.com/assets/IcbsMenuSelect-n9JcOuF7.js).
These hashed asset URLs identify the inspected provider build; they are not
stable selector names or files to patch.
