"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
// Optional browser fixture: install Playwright or provide the runtime module
// location, and optionally set HARSON_TEST_CHROMIUM_EXECUTABLE.
const { chromium } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright")
    : "playwright"
);

const root = path.join(__dirname, "..", "public", "harson-customization");
const scripts = [
  "model-aliases.generated.js",
  "model-alias-resolver.js",
  "image-tab-config.js",
  "image-tab-labels.js"
];
const files = Object.fromEntries(scripts.map(name => [
  name, fs.readFileSync(path.join(root, name), "utf8")
]));

function documentHtml(moduleName) {
  const tags = scripts.map(name =>
    '<script defer src="/' + name + '"' +
    (name === "image-tab-labels.js"
      ? ' data-harson-module="' + moduleName + '"'
      : "") + "></script>"
  ).join("");
  return '<!doctype html><html><head><meta charset="utf-8">' + tags +
    '</head><body><div class="video-player"><video muted></video>' +
    '<div id="player-label">Seedance 2.5 原生 720p</div></div>' +
    '<div class="prompt-content" id="prompt">Seedance 2.5 原生 720p</div>' +
    '<div class="history-card" id="history-card">' +
    '<p class="prompt-content">Seedance 2.5 原生 720p</p></div>' +
    "</body></html>";
}

async function frame(page) {
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
}

async function values(page, ids) {
  return page.evaluate(ids => {
    function visible(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.data;
      if (node instanceof HTMLSlotElement) {
        return node.assignedNodes().map(visible).join("");
      }
      return Array.from((node.shadowRoot || node).childNodes)
        .map(visible).join("");
    }
    return Object.fromEntries(ids.map(id => {
      const host = document.getElementById(id);
      return [id, { source: host.textContent, shown: visible(host) }];
    }));
  }, ids);
}

(async () => {
  const browser = await chromium.launch({
    ...(process.env.HARSON_TEST_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.HARSON_TEST_CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--disable-dev-shm-usage", "--no-zygote"]
  });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => {
      const requestUrl = new URL(route.request().url());
      const name = path.basename(requestUrl.pathname);
      const moduleName = requestUrl.pathname.startsWith("/image-fixture")
        ? "image-generator" : "video-generator";
      return route.fulfill(files[name]
        ? { contentType: "text/javascript", body: files[name] }
        : { contentType: "text/html; charset=utf-8", body: documentHtml(moduleName) });
    });
    await page.goto("https://ai.harson-base.com/video-fixture");
    await frame(page);
    let shown = await values(page, ["player-label", "prompt", "history-card"]);
    assert.deepEqual(shown["player-label"], {
      source: "Seedance 2.5 原生 720p",
      shown: "CLVideo3.0 原生 720p"
    });
    assert.equal(shown.prompt.shown, "Seedance 2.5 原生 720p");
    assert.equal(shown["history-card"].shown, "Seedance 2.5 原生 720p");

    await page.evaluate(() => {
      const dialog = document.createElement("section");
      dialog.className = "q-dialog";
      const deeplyNestedName = "<span>".repeat(10) +
        '<span id="outer-model">Seedance 2.5</span>' +
        "</span>".repeat(10);
      dialog.innerHTML =
        '<div class="detail-heading" id="detail-title">' +
        deeplyNestedName +
        '<span id="inner-model">(Seedance 2.5 原生 720p)</span>' +
        '</div><button id="download"><svg></svg></button>';
      document.body.append(dialog);
    });
    await frame(page);
    shown = await values(page, ["detail-title"]);
    assert.deepEqual(shown["detail-title"], {
      source: "Seedance 2.5(Seedance 2.5 原生 720p)",
      shown: "CLVideo3.0(CLVideo3.0 原生 720p)"
    });

    await page.evaluate(() => {
      document.getElementById("outer-model").firstChild.data = "Seedance 2.0";
      document.getElementById("inner-model").firstChild.data =
        "(Seedance 2.0 原生 720p)";
      document.getElementById("player-label").firstChild.data =
        "Seedance 2.0 原生 720p";
    });
    await frame(page);
    shown = await values(page, ["player-label", "detail-title"]);
    assert.equal(shown["player-label"].shown, "CLVideo2.0 原生 720p");
    assert.equal(shown["detail-title"].shown,
      "CLVideo2.0(CLVideo2.0 原生 720p)");

    await page.evaluate(() => window.HarsonImageLabels.setEnabled(false));
    await frame(page);
    shown = await values(page, ["player-label", "detail-title"]);
    assert.equal(shown["player-label"].shown, shown["player-label"].source);
    assert.equal(shown["detail-title"].shown, shown["detail-title"].source);

    await page.goto("https://ai.harson-base.com/image-fixture");
    await frame(page);
    shown = await values(page, ["player-label"]);
    assert.equal(shown["player-label"].shown, "Seedance 2.5 原生 720p");

    console.log("Video metadata browser fixture passed.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
