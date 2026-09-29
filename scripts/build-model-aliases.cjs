#!/usr/bin/env node
"use strict";

/*
  Build the browser/shared alias data from the canonical source.

  Source of truth : config/display-names/names.txt  (owner-controlled)
  Policy tables   : config/display-names/display-correspondence.cjs
  Output          : public/harson-customization/model-aliases.generated.js

  Usage:
    node scripts/build-model-aliases.cjs           generate (writes output)
    node scripts/build-model-aliases.cjs --check   fail if output is stale

  Validation (runbook §4.3):
    - UTF-8 with BOM tolerance, LF and CRLF line endings.
    - Exactly two non-empty comma-separated columns per row.
    - Fields trimmed; original spelling preserved for diagnostics.
    - Conflicting normalized duplicates are ERRORS.
    - Same-destination normalized duplicates coalesce with a warning.
    - Every correspondence must reference an existing canonical source.
    - Deterministic output (no timestamps in unchanged bytes).
*/

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const NAMES_PATH = path.join(
  ROOT,
  "config",
  "display-names",
  "names.txt"
);
const CORRESPONDENCE_PATH = path.join(
  ROOT,
  "config",
  "display-names",
  "display-correspondence.cjs"
);
const OUTPUT_PATH = path.join(
  ROOT,
  "public",
  "harson-customization",
  "model-aliases.generated.js"
);

const SCHEMA_VERSION = 1;

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fail(message) {
  console.error(`build-model-aliases: ${message}`);
  process.exit(1);
}

function parseNamesFile(raw) {
  const text = String(raw).replace(/^﻿/, "");
  const rows = [];
  const seen = new Map();

  const lines = text.split(/\r\n|\n|\r/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];

    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }

    const columns = line.split(",");

    if (columns.length !== 2) {
      fail(
        `${NAMES_PATH}:${lineNumber}: expected exactly 2 columns, ` +
          `got ${columns.length}`
      );
    }

    const source = columns[0].trim();
    const destination = columns[1].trim();

    if (!source || !destination) {
      fail(
        `${NAMES_PATH}:${lineNumber}: source and destination must be non-empty`
      );
    }

    const key = normalizeKey(source);

    if (seen.has(key) && seen.get(key) !== destination) {
      fail(
        `${NAMES_PATH}:${lineNumber}: conflicting duplicate for ` +
          `"${source}" (already -> "${seen.get(key)}", now ` +
          `"${destination}")`
      );
    }

    if (seen.has(key)) {
      console.warn(
        `build-model-aliases: coalescing harmless duplicate ` +
          `"${source}" at line ${lineNumber}`
      );
      continue;
    }

    seen.set(key, destination);
    rows.push({ source, destination, key });
  }

  if (rows.length === 0) {
    fail(`${NAMES_PATH}: no mapping rows found`);
  }

  return rows;
}

function buildData() {
  const raw = fs.readFileSync(NAMES_PATH, "utf8");
  const rows = parseNamesFile(raw);

  const { correspondences, seedreamVersionKeys } =
    require(CORRESPONDENCE_PATH);

  const exact = {};
  for (const row of rows) {
    exact[row.key] = row.destination;
  }

  const variants = {};
  const variantTargets = {};

  for (const [spelling, canonicalSource] of Object.entries(
    correspondences
  )) {
    const variantKey = normalizeKey(spelling);
    const canonicalKey = normalizeKey(canonicalSource);

    if (!(canonicalKey in exact)) {
      fail(
        `display-correspondence: "${spelling}" references unknown ` +
          `canonical source "${canonicalSource}"`
      );
    }

    if (variantKey in exact) {
      fail(
        `display-correspondence: variant "${spelling}" collides with a ` +
          `canonical source key after normalization`
      );
    }

    if (
      variantTargets[variantKey] &&
      variantTargets[variantKey] !== canonicalKey
    ) {
      fail(
        `display-correspondence: variant "${spelling}" conflicts with ` +
          `another variant after normalization`
      );
    }

    variantTargets[variantKey] = canonicalKey;
    variants[variantKey] = canonicalKey;
  }

  const versions = {};
  for (const [version, canonicalSource] of Object.entries(
    seedreamVersionKeys
  )) {
    const canonicalKey = normalizeKey(canonicalSource);

    if (!(canonicalKey in exact)) {
      fail(
        `seedreamVersionKeys: "${version}" references unknown canonical ` +
          `source "${canonicalSource}"`
      );
    }

    versions[normalizeKey(version)] = canonicalKey;
  }

  const mappingHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ exact, variants, versions }))
    .digest("hex")
    .slice(0, 12);

  return {
    schemaVersion: SCHEMA_VERSION,
    mappingHash,
    exact,
    variants,
    seedreamVersionKeys: versions
  };
}

function renderOutput(data) {
  const json = JSON.stringify(data, null, 2);

  return (
    "/*\n" +
    "  GENERATED FILE — do not edit by hand.\n" +
    "  Source: config/display-names/names.txt\n" +
    "  Policy: config/display-names/display-correspondence.cjs\n" +
    "  Rebuild: npm run aliases:build   Verify: npm run aliases:check\n" +
    `  Schema: ${data.schemaVersion}   Mapping hash: ${data.mappingHash}\n` +
    "*/\n" +
    "(function (root, factory) {\n" +
    '  if (typeof module === "object" && module.exports) {\n' +
    "    module.exports = factory();\n" +
    "  } else {\n" +
    "    root.HarsonModelAliases = factory();\n" +
    "  }\n" +
    "})(typeof self !== \"undefined\" ? self : this, function () {\n" +
    `  return ${json};\n` +
    "});\n"
  );
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const data = buildData();
  const output = renderOutput(data);

  if (checkOnly) {
    const current = fs.existsSync(OUTPUT_PATH)
      ? fs.readFileSync(OUTPUT_PATH, "utf8")
      : "";

    if (current !== output) {
      console.error(
        "build-model-aliases: generated output is stale; run " +
          "npm run aliases:build"
      );
      process.exit(1);
    }

    console.log(
      `aliases up to date (schema ${data.schemaVersion}, hash ` +
        `${data.mappingHash})`
    );
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output, "utf8");
  console.log(
    `wrote ${path.relative(ROOT, OUTPUT_PATH)} ` +
      `(schema ${data.schemaVersion}, hash ${data.mappingHash})`
  );
}

main();
