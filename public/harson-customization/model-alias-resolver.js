/*
  Shared display-name resolver (pure — no DOM, no network, no routing).

  Used identically by:
    - the iframe renderer (public/harson-customization/image-tab-labels.js)
    - the parent All-Tools catalog (public/js/aigc-workspace.js)

  Data comes from model-aliases.generated.js (window.HarsonModelAliases
  in the browser, module.exports under CommonJS for tests).

  Resolution order (runbook §9.1), strictly one pass:
    1. exact canonical mapping        (names.txt)
    2. display-spelling correspondence (Appendix C policy table)
    3. narrowly scoped contextual rule (Seedream version selector only)
    4. otherwise null — the caller keeps the original label.

  Aliases are never re-fed as source input: resolve("CLImage-4.0")
  returns null unless a canonical source literally spells that.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./model-aliases.generated.js")
    );
  } else {
    root.HarsonModelAliasResolver = factory(
      root.HarsonModelAliases
    );
  }
})(
  typeof self !== "undefined" ? self : this,
  function (data) {
    "use strict";

    const exact = (data && data.exact) || {};
    const variants = (data && data.variants) || {};
    const versionKeys =
      (data && data.seedreamVersionKeys) || {};

    function normalize(value) {
      return String(value || "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    /*
      context (all fields optional):
        module       provider module key
        surface      e.g. "model-version-tab"
        modelFamily  e.g. "seedream", from verified component context
    */
    function resolveDisplayName(sourceText, context) {
      const key = normalize(sourceText);

      if (!key) {
        return null;
      }

      if (Object.prototype.hasOwnProperty.call(exact, key)) {
        return exact[key];
      }

      if (Object.prototype.hasOwnProperty.call(variants, key)) {
        return exact[variants[key]] || null;
      }

      if (
        context &&
        context.surface === "model-version-tab" &&
        context.modelFamily === "seedream" &&
        Object.prototype.hasOwnProperty.call(versionKeys, key)
      ) {
        return exact[versionKeys[key]] || null;
      }

      return null;
    }

    function mappingInfo() {
      return {
        schemaVersion: data && data.schemaVersion,
        mappingHash: data && data.mappingHash
      };
    }

    return {
      resolveDisplayName,
      normalize,
      mappingInfo
    };
  }
);
