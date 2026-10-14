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
    const eligible = active && node.matches(selector) && !node.closest(blocked);
    const context = eligible ? versionContextFor(node) : null;
    const children = Array.from(node.childNodes);
    const labels = children.map(child => eligible && child.nodeType === Node.TEXT_NODE
      ? aliasFor(child.data, context) : null);

    let aggregate = null;
    if (eligible && !labels.some(Boolean)) {
      if (allowsAggregation(node)) {
        aggregate = aliasFor(node.textContent, context);
      }
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
        // Whole-element label: alias the complete text, slot remaining
        // element children (icons etc.) unchanged.
        const joined = String(node.textContent || "");
        fragment.appendChild(document.createTextNode(
          joined.match(/^\s*/)[0] + aggregate + joined.match(/\s*$/)[0]
        ));
        children.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) {
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
        if (element) {
          if (records.has(element) || element.matches(selector)) pending.add(element);
          if (mutation.type === "attributes" &&
              ["class", "contenteditable"].includes(mutation.attributeName)) {
            subtrees.add(element);
            // Restore any former targets when an ancestor stops matching.
            hosts.forEach(host => { if (element.contains(host)) pending.add(host); });
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
      const alias = aliasFor(node.data);
      if (!alias) continue;
      const parent = node.parentElement;
      if (!parent || records.has(parent)) continue;
      if (parent.closest(blocked)) continue;
      results.push({
        text: String(node.data).trim(),
        alias,
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
