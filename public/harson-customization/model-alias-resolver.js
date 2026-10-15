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
      Qualified-label support (proposed_changes.md §3 step 2).

      In renderer-approved contexts only (context.allowQualified === true),
      a COMPLETE known original model name at the START of a label may be
      followed by descriptive text; the suffix is preserved verbatim:
        "Seedance 2.5 原生 720p" -> "CLVideo3.0 原生 720p"

      Guards:
        - Longest (versioned) keys are tried before bare family keys.
        - A whitespace/end boundary must follow the key, so "Seedance 2.50"
          never matches "Seedance 2.5".
        - A suffix that begins with a digit is treated as an unknown
          version ("Seedance 3.0") and is refused, so unknown versions
          are never converted through the bare-family mapping.
        - One pass: aliases are never re-fed as sources.
    */
    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    let qualifiedMatchers = null;

    function getQualifiedMatchers() {
      if (qualifiedMatchers) {
        return qualifiedMatchers;
      }

      qualifiedMatchers = Object.keys(exact)
        .map(String)
        .sort((a, b) => b.length - a.length)
        .map(key => ({
          key,
          pattern: new RegExp(
            "^(\\s*)(" +
              key.split(/\s+/).map(escapeRegExp).join("\\s+") +
              ")(?=\\s|$)",
            "i"
          )
        }));

      return qualifiedMatchers;
    }

    function resolveQualified(sourceText) {
      const raw = String(sourceText || "");

      for (const matcher of getQualifiedMatchers()) {
        const match = matcher.pattern.exec(raw);

        if (!match) {
          continue;
        }

        const suffix = raw.slice(match[0].length);

        if (/^\d/.test(suffix.trim())) {
          // Unknown version suffix — refuse rather than rename through
          // the bare-family mapping.
          return null;
        }

        // Leading whitespace is insignificant (exact matching trims);
        // the descriptive suffix is preserved verbatim.
        return exact[matcher.key] + suffix;
      }

      return null;
    }

    /*
      context (all fields optional):
        module          provider module key
        surface         e.g. "model-version-tab"
        modelFamily     e.g. "seedream", from verified component context
        allowQualified  true only for renderer-approved model-label,
                        metadata and tooltip surfaces (qualified prefix
                        resolution with a preserved descriptive suffix)
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

      if (context && context.allowQualified === true) {
        return resolveQualified(sourceText);
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
