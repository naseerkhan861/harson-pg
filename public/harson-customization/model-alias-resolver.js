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
        - A suffix that begins with a digit or V + digit is an unknown
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

      const displayAliases = { ...exact };
      for (const [spelling, canonical] of Object.entries(variants)) {
        if (exact[canonical]) displayAliases[spelling] = exact[canonical];
      }
      qualifiedMatchers = Object.keys(displayAliases)
        .map(String)
        .sort((a, b) => b.length - a.length)
        .map(key => ({
          key,
          alias: displayAliases[key],
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

        if (/^(?:v\s*)?\d/iu.test(suffix.trim())) {
          // Unknown numeric/V-number suffix — refuse rather than use
          // the bare-family mapping.
          return null;
        }

        // Leading whitespace is insignificant (exact matching trims);
        // the descriptive suffix is preserved verbatim.
        return matcher.alias + suffix;
      }

      return null;
    }

    /*
      Versioned MJ labels may repeat in a history/case detail title.
      This formatter runs only in renderer-approved image model fields.
      Preserve metadata and delimiters; map each explicit V7/V8 token
      from its own original source, never from the active form selection.
    */
    function resolveMidjourneyModelLabel(sourceText) {
      const raw = String(sourceText || "").trim();
      const token = /(^|[\s()（）:：·|])((?:悠船\s*)?(?:midjourney\s*v\s*([78])|mj\s*v?\s*([78])))(?=$|[\s()（）:：·|])/giu;
      let matched = false;
      const result = raw.replace(token, (whole, before, model, fullVersion, shortVersion) => {
        const alias = exact["midjourney v" + (fullVersion || shortVersion)];
        if (!alias) return whole;
        matched = true;
        return before + alias;
      });
      return matched ? result : null;
    }

    /*
      The video player and its detail drawer use two provider-owned display
      formats. Match the entire format, preserving punctuation, spacing and
      resolution while changing only the two known Seedance model names.
      This is invoked only for video-generator metadata hosts.
    */
    function videoMetadataAlias(model) {
      const key = normalize(model);
      return key === "seedance 2.5" || key === "seedance 2.0"
        ? (exact[key] || null)
        : null;
    }

    /*
      MiniMax labels on video metadata hosts: accept complete approved
      labels, optional resolution metadata, and the provider-style
      family(variant + metadata) form. These are bounded display formats;
      arbitrary text and unknown model versions never match. The MAX
      token precedes the base token, and aliases come from generated data.
    */
    function resolveMiniMaxVideoMetadata(sourceText) {
      const raw = String(sourceText || "");
      const token = "(?:minimax-h3-max|minimax-h3|minimax_h3)";
      const label = token + "(?:\\s+(?:原生\\s*)?\\d{3,4}p)?";
      const format = new RegExp(
        "^\\s*" + label +
        "(?:\\s*\\(\\s*" + label + "\\s*\\)|" +
        "\\s*（\\s*" + label + "\\s*）)?\\s*$",
        "iu"
      );
      if (!format.test(raw)) return null;

      let complete = true;
      const result = raw.replace(new RegExp(token, "giu"), source => {
        const key = normalize(source);
        const alias = exact[key] || exact[variants[key]];
        if (!alias) complete = false;
        return alias || source;
      });
      return complete ? result : null;
    }

    function resolveVideoMetadata(sourceText) {
      const minimax = resolveMiniMaxVideoMetadata(sourceText);
      if (minimax !== null) return minimax;
      const raw = String(sourceText || "");
      const overlay = /^(\s*)(seedance\s+2\.(?:5|0))(\s+原生\s*\d{3,4}p)(\s*)$/iu.exec(raw);
      if (overlay) {
        const alias = videoMetadataAlias(overlay[2]);
        return alias
          ? overlay[1] + alias + overlay[3] + overlay[4]
          : null;
      }

      const detail = /^(\s*)(seedance\s+2\.(?:5|0))(\s*[（(]\s*)(seedance\s+2\.(?:5|0))(\s+原生\s*\d{3,4}p)(\s*[)）])(\s*)$/iu.exec(raw);
      if (!detail || normalize(detail[2]) !== normalize(detail[4])) {
        return null;
      }

      const alias = videoMetadataAlias(detail[2]);
      return alias
        ? detail[1] + alias + detail[3] + alias + detail[5] + detail[6] + detail[7]
        : null;
    }

    /*
      Image-generator scoped overrides (proposed_changes.md §4, 15 Oct).

      The image-creation sidebar needs position-specific display names that
      must NOT become global mappings: 全能图片 stays CLImage-5.0 everywhere
      except its sidebar row; 即梦's bare heading keeps CLImage except as a
      sidebar row; FLUX Krea inner-page labels rename only inside the
      selected FLUX Krea view. Evaluated BEFORE the global exact/variants
      lookups so the scoped values win; returns null for anything else so
      the global mapping applies. Never maps the alias string "CLImage"
      itself, and one-pass resolution is preserved.
    */
    function imageGeneratorOverride(key, context) {
      if (!context || context.module !== "image-generator") {
        return null;
      }

      if (context.surface === "image-sidebar") {
        if (key === "全能图片") return "CLImage-5.1";
        if (key === "即梦" || key === "即梦 seedream") return "CLImage-3.3";
        if (key === "flux krea" || key === "fluxkrea") return "CLImage-1.0";
      }

      if (context.surface === "image-family-title" &&
          context.family === "seedream" &&
          key === "seedream") {
        return "CLImage";
      }

      /*
        Kontext form title (suggest_changes.md §3A, 28 Oct): the generic
        family title follows the SELECTED variant. Presentational only —
        an unknown variant falls through to the generic family alias,
        and this can never relabel historical cards.
      */
      if (context.surface === "image-family-title" &&
          context.family === "flux-kontext" &&
          (key === "flux.1 kontext" || key === "flux.1kontext")) {
        if (context.variant === "max") return "CLImage-1.2";
        if (context.variant === "pro") return "CLImage-1.1";
      }

      if (context.surface === "image-page-label" &&
          context.family === "flux-krea" &&
          (key === "flux krea" || key === "fluxkrea")) {
        return "CLImage-1.0";
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
        module/surface  video-generator/video-metadata for the provider's
                        player overlay and repeated detail title
    */
    function resolveDisplayName(sourceText, context) {
      const key = normalize(sourceText);

      if (!key) {
        return null;
      }

      const scoped = imageGeneratorOverride(key, context);
      if (scoped !== null) {
        return scoped;
      }

      if (Object.prototype.hasOwnProperty.call(exact, key)) {
        return exact[key];
      }

      if (Object.prototype.hasOwnProperty.call(variants, key)) {
        return exact[variants[key]] || null;
      }

      if (context && context.module === "image-generator" &&
          context.surface === "midjourney-model-label") {
        return resolveMidjourneyModelLabel(sourceText);
      }

      if (
        context &&
        context.surface === "model-version-tab" &&
        context.modelFamily === "seedream" &&
        Object.prototype.hasOwnProperty.call(versionKeys, key)
      ) {
        return exact[versionKeys[key]] || null;
      }

      if (context && context.module === "video-generator" &&
          context.surface === "video-metadata") {
        return resolveVideoMetadata(sourceText);
      }

      /*
        AI 服装 / AI 电商 版本 dropdown (proposed_changes.md §3, 15 Oct):
        the provider renders the option label "image-2版" there. Renamed
        contextually ONLY — never in the global exact map, so "image-2"
        keeps its own CLImage-4.0 mapping everywhere else.
      */
      if (
        context &&
        context.surface === "version-dropdown" &&
        (context.module === "clothing" ||
          context.module === "e-commerce") &&
        key === "image-2版"
      ) {
        return "CLImage4.0";
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
