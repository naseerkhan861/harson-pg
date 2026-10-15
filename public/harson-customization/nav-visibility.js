(function () {
  "use strict";

  /*
    Hides the provider's 虚拟样机 navigation row (menu id
    nav-chatpattern-virtual-sample, external link target) from every
    YiBai left navigation served through the Harson gateway. Independent
    of the model-name alias renderer: works even when aliases are
    disabled, and never touches content outside .MainLayout-nav rows.
  */
  if (location.origin !== "https://ai.harson-base.com" ||
      window.HarsonNavVisibility) return;

  const navSelector = ".MainLayout-nav";
  const rowSelector = navSelector + " .NavList-list-item";
  const marker = "data-harson-hidden-menu";

  function isVirtualSampleRow(row) {
    if (!row || !row.matches(rowSelector)) return false;
    const label = row.querySelector(":scope > span.label");
    const source = String(label?.textContent || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .trim();
    return source === "虚拟样机";
  }

  function scanNavigation() {
    document.querySelectorAll(rowSelector).forEach(row => {
      if (isVirtualSampleRow(row)) {
        row.setAttribute(marker, "virtual-sample");
      } else if (row.getAttribute(marker) === "virtual-sample") {
        // The provider may reuse a row for a different menu item.
        row.removeAttribute(marker);
      }
    });
  }

  function touchesNavigation(change) {
    const target = change.target.nodeType === Node.ELEMENT_NODE
      ? change.target : change.target.parentElement;
    if (target?.closest(navSelector)) return true;

    // The provider may mount an entire page/nav as one subtree.
    return Array.from(change.addedNodes).some(node =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node.matches(navSelector) || Boolean(node.querySelector(navSelector)))
    );
  }

  const observer = new MutationObserver(changes => {
    if (changes.some(touchesNavigation)) scanNavigation();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  // Capture phase is a backup if a provider click fires before a row
  // has been marked. The provider's current NavList uses onClick.
  document.addEventListener("click", event => {
    const row = event.target instanceof Element
      ? event.target.closest(rowSelector) : null;
    if (!isVirtualSampleRow(row)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  scanNavigation();
  window.HarsonNavVisibility = Object.freeze({
    rescan: scanNavigation
  });
})();
