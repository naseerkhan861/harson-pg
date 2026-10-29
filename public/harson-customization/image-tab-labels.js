(function () {
  "use strict";

  const config = window.HarsonImageTabConfig;
  const resolver = window.HarsonModelAliasResolver;
  const script = document.currentScript;
  if (!config || !resolver || window.HarsonImageLabels || !script ||
      location.origin !== config.expectedOrigin ||
      !Array.isArray(config.modules) ||
      !config.modules.includes(script.dataset.harsonModule)) return;

  // Manual slots let icons/badges remain the SAME provider-owned DOM
  // elements. Unassigned source text stays unchanged in the light DOM;
  // only its rendered counterpart is substituted. Unsupported browsers
  // keep the original UI.
  const probe = document.createElement("span");
  let supported = false;
  try {
    supported = probe.attachShadow({ mode: "open", slotAssignment: "manual" })
      .slotAssignment === "manual" && typeof HTMLSlotElement.prototype.assign === "function";
  } catch (_) { /* Fall back to provider labels. */ }
  if (!supported) return;

  const selector = config.selectors.join(",");
  const aggregateSelector = config.aggregateSelectors.join(",");
  const qualifiedSelector = (config.qualifiedSelectors || []).join(",");
  const videoModule = script.dataset.harsonModule === "video-generator";
  const videoMetadataContext = Object.freeze({
    module: "video-generator",
    surface: "video-metadata"
  });
  const blocked = "input,textarea,select,option,script,style,pre,code," +
    "[contenteditable]:not([contenteditable='false']),.Prompt," +
    ".TextToImageCard-prompt,.prompt-content";
  const hostTags = new Set(["DIV", "SPAN", "P", "H1", "H2", "H3", "H4", "H5", "H6"]);
  const records = new WeakMap();
  const hosts = new Set();
  const pending = new Set();
  const subtrees = new Set();
  let enabled = true;
  let active = true; // Activation no longer depends on the sidebar (runbook §8.2).
  let queued = false;
  let observer;

  function aliasFor(text, context) {
    return resolver.resolveDisplayName(text, context);
  }

  /*
    Short version tabs ("4.5", "5.0 pro") resolve only inside the verified
    Seedream version selector: the owning header_fix container must itself
    reference the Seedream family (runbook §9.2). Never a global rule.
  */
  function versionContextFor(node) {
    if (!config.versionTabSelector ||
        !node.matches(config.versionTabSelector)) {
      return null;
    }

    const container = node.closest(
      config.versionFamilyContainer
    );

    if (!container) {
      return null;
    }

    const familyText = String(
      container.textContent || ""
    ).toLowerCase();

    const family = familyText.includes("seedream")
      ? "seedream"
      : null;

    return {
      surface: "model-version-tab",
      modelFamily: family
    };
  }

  /*
    Context for a label element: Seedream short-version scope, plus
    qualified (model-name + descriptive suffix) resolution for the
    approved model-label/metadata/tooltip surfaces only.
  */
  /*
    AI 服装 / AI 电商 版本 dropdown classifier (proposed_changes.md §4):
    returns a version-dropdown context only for the provider's select
    popup option reading exactly "image-2版", or for the selected-value
    span inside a 版本-titled IcbsSelect. Everything else stays null.
  */
  function versionDropdownContextFor(node) {
    const moduleName = script.dataset.harsonModule;
    if (moduleName !== "clothing" && moduleName !== "e-commerce") {
      return null;
    }

    // Quasar mounts popup options in a portal; match the popup component
    // plus the precise provider-owned source text.
    if (node.matches(
      ".IcbsSelect-header-popup .IcbsSelect-header-popup-option-label"
    )) {
      return resolver.normalize(node.textContent) === "image-2版"
        ? { module: moduleName, surface: "version-dropdown" }
        : null;
    }

    // The selected value remains inside the select's own 版本 row.
    if (!node.matches(
      ".IcbsSelect-header-select .q-field__native > span"
    )) {
      return null;
    }
    const select = node.closest(".IcbsSelect");
    const title = select?.querySelector(".IcbsSelect-header > span.col");
    return resolver.normalize(title?.textContent) === "版本"
      ? { module: moduleName, surface: "version-dropdown" }
      : null;
  }

  /*
    Image-generator scoped contexts (proposed_changes.md §5, 15 Oct).
    The selected family is derived from the ACTIVE sidebar item's
    provider-owned light-DOM text — never from a displayed alias and
    never from list position (ordering can change upstream).
  */
  function activeImageFamily() {
    const active = document.querySelector(
      ".MainLayout-nav .NavList-list-item.active > span.label"
    );
    const source = resolver.normalize(active?.textContent);
    // textContent is the provider-owned LIGHT-DOM text, even if the
    // visible alias is rendered through a shadow root.
    if (source === "即梦" || source === "即梦 seedream") return "seedream";
    if (source === "flux krea" || source === "fluxkrea") return "flux-krea";
    if (source === "flux.1 kontext" || source === "flux.1kontext") {
      return "flux-kontext";
    }
    return null;
  }

  /*
    Kontext selected variant (suggest_changes.md §3B): reads the ORIGINAL
    provider-owned light-DOM text of the 模型 dropdown's selected value —
    never the displayed shadow alias. Returns "pro"/"max" only when
    exactly one recognized Kontext selection exists on the page.
  */
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

  function imageContextFor(node) {
    if (script.dataset.harsonModule !== "image-generator") return null;
    if (node.matches(config.sidebarSelector)) {
      return { module: "image-generator", surface: "image-sidebar" };
    }
    const family = activeImageFamily();
    if (family === "flux-kontext" &&
        node.matches(".ToolLayout-header,.DefaultLayout-header,.header_fix > span")) {
      return {
        module: "image-generator",
        surface: "image-family-title",
        family,
        variant: selectedKontextVariant()
      };
    }
    if (family === "seedream" &&
        node.matches(".ToolLayout-header,.DefaultLayout-header,.header_fix > span")) {
      return { module: "image-generator",
               surface: "image-family-title", family };
    }
    if (family === "flux-krea") {
      // Called only for existing, approved model-label selectors.
      return { module: "image-generator",
               surface: "image-page-label", family };
    }
    return null;
  }

  function contextFor(node) {
    // Version-tab precedence first, especially Seedream's short labels.
    const context = versionContextFor(node) ||
      versionDropdownContextFor(node) ||
      imageContextFor(node) || {};

    if (
      qualifiedSelector &&
      node.matches(qualifiedSelector)
    ) {
      context.allowQualified = true;
    }

    return context;
  }

  function allowsAggregation(node) {
    /*
      Split/nested labels (runbook §10.5): when the element's ENTIRE text
      is exactly one known label (e.g. <span>全能图片</span><span>2</span>),
      resolve it as one label. Only for approved label containers that hold
      no interactive descendants.
    */
    if (!aggregateSelector || !node.matches(aggregateSelector)) {
      return false;
    }

    return !node.querySelector(
      "button,a,input,textarea,select"
    );
  }

  /*
    A video player overlay and the clicked video's detail title can be
    mounted outside the usual form selectors. Their entire source text has
    one of two tightly specified provider metadata formats, including
    "Seedance 2.5(Seedance 2.5 原生 720p)". Match a small, text-only host,
    never the prompt, dialog body, video element or a clickable control.
  */
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
    let owner = null;
    let source = null;
    for (let current = element; current && current !== document.body;
         current = current.parentElement) {
      if (!videoMetadataAlias(current)) continue;
      const candidateSource = resolver.normalize(current.textContent);
      // Prefer the complete semantic label when a nested child contains
      // only the base prefix of MiniMax-H3-MAX. Keep the nearest wrapper
      // when an ancestor merely repeats exactly the same source text.
      if (!owner || candidateSource !== source) {
        owner = current;
        source = candidateSource;
      }
    }
    return owner;
  }

  function collectVideoMetadata(tree, output) {
    if (!videoModule) return;
    const walker = document.createTreeWalker(tree, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      if (!/seedance|minimax[-_]h3/i.test(textNode.data)) continue;
      const owner = videoMetadataOwner(textNode.parentElement);
      if (owner) output.add(owner);
    }
  }

  function attributeMaps(node, context) {
    if (node.hasAttribute("title") &&
        aliasFor(node.getAttribute("title"), context)) {
      return true;
    }

    return node.hasAttribute("aria-label") &&
      Boolean(aliasFor(node.getAttribute("aria-label"), context));
  }

  // Diagnostic only — reports how many mapped sidebar labels are present.
  function sidebarMappedCount() {
    let count = 0;
    for (const node of document.querySelectorAll(
      config.sidebarSelector
    )) {
      if (aliasFor(node.textContent)) count += 1;
    }
    return count;
  }

  function getRecord(node) {
    let record = records.get(node);
    if (record) return record;
    if (node.shadowRoot || !hostTags.has(node.tagName)) return null;
    try {
      record = {
        root: node.attachShadow({ mode: "open", slotAssignment: "manual" }),
        signature: null,
        children: [],
        attrs: new Map(),
        renamed: false
      };
      records.set(node, record);
      return record;
    } catch (_) { return null; }
  }

  function updateAttribute(node, record, name, shouldAlias, context) {
    const current = node.getAttribute(name);
    let attr = record.attrs.get(name);
    if (!attr) {
      attr = { source: current, written: current };
      record.attrs.set(name, attr);
    } else if (current !== attr.written) {
      // A Vue render can change the source while this DOM node is reused.
      attr.source = current;
    }
    const next = shouldAlias ? (aliasFor(attr.source, context) || attr.source) : attr.source;
    attr.written = next;
    if (next === current) return;
    if (next === null) node.removeAttribute(name);
    else node.setAttribute(name, next);
  }

  function render(node) {
    if (!node.isConnected) { hosts.delete(node); return; }
    const metadataAlias = active ? videoMetadataAlias(node) : null;
    const eligible = active && (node.matches(selector) || Boolean(metadataAlias)) &&
      !node.closest(blocked);
    const context = eligible
      ? (metadataAlias ? videoMetadataContext : contextFor(node))
      : null;
    const children = Array.from(node.childNodes);
    const labels = children.map(child => eligible && child.nodeType === Node.TEXT_NODE
      ? aliasFor(child.data, context) : null);

    /*
      Nested/split labels (proposed_changes.md §3 step 3): for an approved
      label-only container, resolve the COMPLETE semantic label — including
      nested text spans — BEFORE any smaller direct-text fragment, so
      <span>Seedance</span><span> 2.5</span> renders one alias instead of
      a partial family rename. The alias is displayed once; consumed
      text-bearing children are not slotted beside it (icons and other
      text-free elements still are).
    */
    let aggregate = null;
    if (eligible && (metadataAlias || allowsAggregation(node))) {
      aggregate = metadataAlias || aliasFor(node.textContent, context);
    }

    let record = records.get(node);
    if (!record && !labels.some(Boolean) && !aggregate) {
      // Attribute-only adaptation (runbook §10.7): title/aria-label may
      // carry a model label even without mapped visible text.
      if (!eligible || !attributeMaps(node, context)) return;
    }
    record = record || getRecord(node);
    if (!record) return;
    hosts.add(node);
    const signature = JSON.stringify([
      aggregate,
      labels.map((label, i) => label
        ? [label, children[i].data.match(/^\s*/)[0], children[i].data.match(/\s*$/)[0]]
        : null)
    ]);
    const sameChildren = record.children.length === children.length &&
      children.every((child, i) => child === record.children[i]);
    if (record.signature !== signature || !sameChildren) {
      const fragment = document.createDocumentFragment();
      const assignments = [];
      if (aggregate) {
        // Whole-element label: alias the complete text. Only text-free
        // element children (icons, svgs) stay visible; text-bearing
        // children were consumed by the aggregate resolution.
        const joined = String(node.textContent || "");
        fragment.appendChild(document.createTextNode(
          metadataAlias ? aggregate :
            joined.match(/^\s*/)[0] + aggregate + joined.match(/\s*$/)[0]
        ));
        children.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE &&
              !String(child.textContent || "").trim()) {
            const slot = document.createElement("slot");
            fragment.appendChild(slot);
            assignments.push([slot, child]);
          }
        });
      } else {
        children.forEach((child, i) => {
          if (labels[i]) {
            // Preserve whitespace without changing the original text node.
            const before = child.data.match(/^\s*/)[0];
            const after = child.data.match(/\s*$/)[0];
            fragment.appendChild(document.createTextNode(before + labels[i] + after));
          } else if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE) {
            const slot = document.createElement("slot");
            fragment.appendChild(slot);
            assignments.push([slot, child]);
          }
        });
      }
      record.root.replaceChildren(fragment);
      assignments.forEach(([slot, child]) => slot.assign(child));
      record.signature = signature;
      record.children = children;
    }
    record.renamed = labels.some(Boolean) || Boolean(aggregate);
    updateAttribute(node, record, "title", eligible, context);
    updateAttribute(node, record, "aria-label", eligible, context);
  }

  function collect(tree, output) {
    if (tree.nodeType !== Node.ELEMENT_NODE && tree.nodeType !== Node.DOCUMENT_NODE) return;
    if (tree.nodeType === Node.ELEMENT_NODE &&
        (tree.matches(selector) || records.has(tree))) output.add(tree);
    tree.querySelectorAll(selector).forEach(node => output.add(node));
    collectVideoMetadata(tree, output);
    hosts.forEach(host => { if (tree.contains(host)) output.add(host); });
  }

  function flush() {
    queued = false;
    const candidates = new Set(pending);
    pending.clear();
    if (!active) {
      hosts.forEach(host => candidates.add(host));
      collect(document, candidates);
    }
    subtrees.forEach(tree => { if (tree.isConnected) collect(tree, candidates); });
    subtrees.clear();
    candidates.forEach(render);
  }

  function schedule() {
    if (!queued) { queued = true; queueMicrotask(flush); }
  }

  function start() {
    observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        const element = mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target : mutation.target.parentElement;
        /*
          Kontext title refresh (suggest_changes.md §3B): changing the
          selected 模型 dropdown may not queue the separate title node.
          When the selection changes, queue the small approved title set;
          the microtask scheduler rerenders it once, no reload.
        */
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
        if (element) {
          if (records.has(element) || element.matches(selector)) pending.add(element);
          if (videoModule) {
            const metadataOwner = videoMetadataOwner(element);
            if (metadataOwner) pending.add(metadataOwner);
          }
          /*
            Deep changes (proposed_changes.md §3 step 5): a text change or
            nested-span insertion several levels down must refresh its
            nearest approved OWNING label, not only the immediate parent.
          */
          const owner = typeof element.closest === "function"
            ? element.closest(selector)
            : null;
          if (owner) pending.add(owner);
          // Managed aggregate hosts containing the change refresh too.
          hosts.forEach(host => { if (host.contains(element)) pending.add(host); });
          if (mutation.type === "attributes" &&
              ["class", "contenteditable"].includes(mutation.attributeName)) {
            subtrees.add(element);
            /*
              Sidebar navigation (proposed_changes.md §5): when the active
              sidebar item changes, the provider may REUSE an existing
              middle heading instead of replacing it — queue a full
              approved-label rescan so scoped family contexts re-resolve.
              The microtask scheduler coalesces this into one pass.
            */
            if (mutation.attributeName === "class" &&
                element.matches(".MainLayout-nav .NavList-list-item")) {
              subtrees.add(document.documentElement);
            }
          }
        }
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) subtrees.add(node);
        });
      });
      schedule();
    });
    observer.observe(document.body, {
      childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ["class", "title", "aria-label", "contenteditable"]
    });
    subtrees.add(document.documentElement);
    flush();
  }

  /*
    Diagnostic: lists elements whose text exactly matches a known original
    label but were NOT renamed (e.g. bare Vue slot-fallback text nodes that
    selectors cannot reach). Run in the iframe console:
      window.HarsonImageLabels.dumpUnmatched()
  */
  function describeChain(element, depth = 4) {
    const parts = [];
    let current = element;
    while (current && depth > 0 && current !== document.body) {
      const cls = typeof current.className === "string" ? current.className : "";
      parts.push(current.tagName + (cls ? "." + cls.trim().split(/\s+/).join(".") : ""));
      current = current.parentElement;
      depth -= 1;
    }
    return parts.join(" <- ");
  }

  function dumpUnmatched() {
    const results = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let alias = aliasFor(node.data);
      let qualified = false;
      if (!alias) {
        // Qualified labels ("model name + descriptive suffix") are also
        // recognizable diagnostics, clearly flagged as such.
        alias = aliasFor(node.data, { allowQualified: true });
        qualified = Boolean(alias);
      }
      if (!alias) continue;
      const parent = node.parentElement;
      if (!parent || records.has(parent)) continue;
      if (parent.closest(blocked)) continue;
      results.push({
        text: String(node.data).trim(),
        alias,
        qualified,
        element: describeChain(parent)
      });
    }
    return results;
  }

  window.HarsonImageLabels = Object.freeze({
    setEnabled(value) {
      enabled = value === true;
      active = enabled; // No sidebar prerequisite (runbook §8.2).
      hosts.forEach(node => pending.add(node));
      subtrees.add(document.documentElement);
      schedule();
    },
    status() {
      return {
        version: config.version,
        release: resolver.mappingInfo(),
        module: document.currentScript?.dataset?.harsonModule ||
          script.dataset.harsonModule,
        enabled,
        active,
        sidebarMappedLabels: sidebarMappedCount(),
        renamedElements: Array.from(hosts).filter(node =>
          node.isConnected && records.get(node).renamed).length
      };
    },
    dumpUnmatched
  });
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
