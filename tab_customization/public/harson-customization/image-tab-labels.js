(function () {
  "use strict";

  const config = window.HarsonImageTabConfig;
  const script = document.currentScript;
  if (!config || window.HarsonImageLabels || !script ||
      location.origin !== config.expectedOrigin ||
      script.dataset.harsonModule !== config.moduleName) return;

  // Manual slots let icons/badges remain the SAME provider-owned DOM elements.
  // Unassigned source text stays unchanged in the light DOM; only its rendered
  // counterpart is substituted. Unsupported browsers keep the original UI.
  const probe = document.createElement("span");
  let supported = false;
  try {
    supported = probe.attachShadow({ mode: "open", slotAssignment: "manual" })
      .slotAssignment === "manual" && typeof HTMLSlotElement.prototype.assign === "function";
  } catch (_) { /* Fall back to provider labels. */ }
  if (!supported) return;

  const selector = config.selectors.join(",");
  const blocked = "input,textarea,select,option,script,style,pre,code," +
    "[contenteditable]:not([contenteditable='false']),.Prompt," +
    ".TextToImageCard-prompt,.prompt-content";
  const hostTags = new Set(["DIV", "SPAN", "P", "H1", "H2", "H3", "H4", "H5", "H6"]);
  const records = new WeakMap();
  const hosts = new Set();
  const pending = new Set();
  const subtrees = new Set();
  let enabled = true;
  let active = false;
  let queued = false;
  let observer;

  function aliasFor(text) {
    const value = String(text || "").trim().replace(/\s+/g, " ");
    return Object.hasOwn(config.aliases, value) ? config.aliases[value] : null;
  }

  function sidebarMatches() {
    const found = new Set(Array.from(document.querySelectorAll(config.sidebarSelector),
      node => aliasFor(node.textContent)));
    // Image and pattern tools can share URLs. Check the actual six-row image
    // sidebar, not a guessed route prefix or the currently selected model.
    return config.models.every(model => found.has(model.alias));
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

  function updateAttribute(node, record, name, shouldAlias) {
    const current = node.getAttribute(name);
    let attr = record.attrs.get(name);
    if (!attr) {
      attr = { source: current, written: current };
      record.attrs.set(name, attr);
    } else if (current !== attr.written) {
      // A Vue render can change the source while this DOM node is reused.
      attr.source = current;
    }
    const next = shouldAlias ? (aliasFor(attr.source) || attr.source) : attr.source;
    attr.written = next;
    if (next === current) return;
    if (next === null) node.removeAttribute(name);
    else node.setAttribute(name, next);
  }

  function render(node) {
    if (!node.isConnected) { hosts.delete(node); return; }
    const eligible = active && node.matches(selector) && !node.closest(blocked);
    const children = Array.from(node.childNodes);
    const labels = children.map(child => eligible && child.nodeType === Node.TEXT_NODE
      ? aliasFor(child.data) : null);
    let record = records.get(node);
    if (!record && !labels.some(Boolean)) return;
    record = record || getRecord(node);
    if (!record) return;
    hosts.add(node);
    const signature = JSON.stringify(labels.map((label, i) => label
      ? [label, children[i].data.match(/^\s*/)[0], children[i].data.match(/\s*$/)[0]] : null));
    const sameChildren = record.children.length === children.length &&
      children.every((child, i) => child === record.children[i]);
    if (record.signature !== signature || !sameChildren) {
      const fragment = document.createDocumentFragment();
      const assignments = [];
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
      record.root.replaceChildren(fragment);
      assignments.forEach(([slot, child]) => slot.assign(child));
      record.signature = signature;
      record.children = children;
    }
    record.renamed = labels.some(Boolean);
    updateAttribute(node, record, "title", eligible);
    updateAttribute(node, record, "aria-label", eligible);
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
    const nextActive = enabled && sidebarMatches();
    const changed = nextActive !== active;
    active = nextActive;
    const candidates = new Set(pending);
    pending.clear();
    for (const host of hosts) {
      if (!host.isConnected) hosts.delete(host);
      else if (changed) candidates.add(host);
    }
    if (changed) collect(document, candidates);
    else subtrees.forEach(tree => { if (tree.isConnected) collect(tree, candidates); });
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

  window.HarsonImageLabels = Object.freeze({
    setEnabled(value) {
      enabled = value === true;
      hosts.forEach(node => pending.add(node));
      subtrees.add(document.documentElement);
      schedule();
    },
    status() {
      return {
        version: config.version, enabled, active,
        renamedElements: Array.from(hosts).filter(node =>
          node.isConnected && records.get(node).renamed).length
      };
    }
  });
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
