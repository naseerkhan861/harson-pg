"use strict";

/*
  Tests for the canonical alias generator.
  Run: node --test tests/model-alias-generator.test.cjs
*/

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "build-model-aliases.cjs");
const NAMES = path.join(ROOT, "config", "display-names", "names.txt");
const OUTPUT = path.join(
  ROOT,
  "public",
  "harson-customization",
  "model-aliases.generated.js"
);

function runGenerator(args = []) {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, ...args],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr || `generator exited ${result.status}`
    );
  }

  return result.stdout + result.stderr;
}

test("generated output is current with the canonical source", () => {
  const check = runGenerator(["--check"]);

  assert.match(check, /up to date/);
});

test("generated file exposes schema version and mapping hash", () => {
  const data = require(OUTPUT);

  assert.equal(data.schemaVersion, 1);
  assert.match(data.mappingHash, /^[0-9a-f]{12}$/);
  assert.ok(Object.keys(data.exact).length >= 25);
});

test("--check fails when the generated output is stale", () => {
  const original = fs.readFileSync(OUTPUT, "utf8");

  try {
    fs.writeFileSync(
      OUTPUT,
      original.replace("schemaVersion", "schemaVersionPerturbed"),
      "utf8"
    );

    assert.throws(() => runGenerator(["--check"]), /stale/);
  } finally {
    fs.writeFileSync(OUTPUT, original, "utf8");
  }

  assert.doesNotThrow(() => runGenerator(["--check"]));
});

test("parser rejects malformed rows with file and line context", () => {
  const backup = fs.readFileSync(NAMES, "utf8");

  try {
    fs.writeFileSync(
      NAMES,
      backup + "Midjourney V8\n",
      "utf8"
    );

    assert.throws(
      () => runGenerator([]),
      /names\.txt:\d+: expected exactly 2 columns/
    );
  } finally {
    fs.writeFileSync(NAMES, backup, "utf8");
  }

  assert.doesNotThrow(() => runGenerator([]));
});

test("parser rejects conflicting normalized duplicates", () => {
  const backup = fs.readFileSync(NAMES, "utf8");

  try {
    // "image-2 " trims/case-folds onto the existing image-2 key with a
    // DIFFERENT destination -> conflict.
    fs.writeFileSync(
      NAMES,
      backup + "IMAGE-2 ,CLImage-9.9\n",
      "utf8"
    );

    assert.throws(
      () => runGenerator([]),
      /conflicting duplicate/
    );
  } finally {
    fs.writeFileSync(NAMES, backup, "utf8");
  }

  assert.doesNotThrow(() => runGenerator([]));
});

test("parser coalesces same-destination normalized duplicates", () => {
  const backup = fs.readFileSync(NAMES, "utf8");

  try {
    fs.writeFileSync(
      NAMES,
      backup + "IMAGE-2,CLImage-4.0\n",
      "utf8"
    );

    const out = runGenerator([]);

    assert.match(out, /coalescing harmless duplicate/);
    assert.doesNotThrow(() => runGenerator(["--check"]));
  } finally {
    fs.writeFileSync(NAMES, backup, "utf8");
  }

  assert.doesNotThrow(() => runGenerator([]));
});

test("parser tolerates BOM, CRLF, comments and blank lines", () => {
  const backup = fs.readFileSync(NAMES, "utf8");

  try {
    // Full canonical content, re-serialized with BOM + CRLF + noise, so
    // correspondence validation still has every canonical key available.
    fs.writeFileSync(
      NAMES,
      "﻿" +
        backup.trimEnd().split("\n").join("\r\n") +
        "\r\n\r\n# comment line\r\n",
      "utf8"
    );

    runGenerator([]);

    const data = require(OUTPUT);

    assert.equal(data.exact["flux krea"], "CLImage");
    assert.equal(data.exact["midjourney"], "CLImage");
  } finally {
    fs.writeFileSync(NAMES, backup, "utf8");
  }

  assert.doesNotThrow(() => runGenerator([]));
});
