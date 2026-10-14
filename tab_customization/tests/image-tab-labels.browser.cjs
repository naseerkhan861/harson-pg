"use strict";
// Optional browser test tooling; no production dependency is added.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.HARSON_PLAYWRIGHT_MODULE || "playwright");
const config = require("../public/harson-customization/image-tab-config");
const { injectImageTabAssets } = require("../src/services/yibaiDisplayInjection");
const assetDir = path.join(__dirname, "../public/harson-customization");
const scripts = Object.fromEntries(["image-tab-config.js", "image-tab-labels.js"].map(name =>
  [name, fs.readFileSync(path.join(assetDir, name), "utf8")]));
let browser;

before(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HARSON_CHROMIUM_EXECUTABLE || undefined,
    args: ["--disable-dev-shm-usage", "--no-zygote"]
  });
});
after(async () => { await browser?.close(); });

function fixture() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Local Harson label fixture</title>' +
    '<style>body{font:16px sans-serif;background:#111;color:#eee;display:flex;gap:32px}' +
    'nav{width:190px}.NavList-list-item{padding:14px}.SubLayout-draw{width:400px}' +
    '.ToolLayout-header{display:flex;font-size:22px;margin:18px 0}' +
    '.DemoCard-banner{margin:10px;padding:8px;background:#333}.Prompt{margin:20px 0}' +
    'textarea{width:350px;height:50px}</style></head><body>' +
    '<nav class="MainLayout-nav">' + config.models.map((model, i) =>
      `<div class="NavList-list-item" data-model="provider-model-${i}">` +
      `<span class="label" title="${model.source}">${model.source}</span></div>`).join("") +
    '<div class="NavList-list-item"><span class="label">一键同款</span></div></nav>' +
    '<main><div class="SubLayout-draw"><div class="ToolLayout-header">悠船MJ V7' +
    '<button id="help" type="button">?</button></div>' +
    '<div class="IcbsMenuSelect-header-content">FLUX.1 Kontext</div>' +
    '<div class="IcbsSelect-header-select"><div class="q-field__native"><span>kontext-max</span>' +
    '<input id="model-value" type="hidden" value="flux-kontext-max"></div></div></div>' +
    '<div class="DemoCard"><div class="DemoCard-banner"><i id="badge-icon">icon</i>' +
    '<span id="badge">FLUX.1 Kontext</span></div></div>' +
    '<div class="TextToImageCard"><div class="TextToImageCard-header-typeName">' +
    '<i>icon</i><span id="history">Seedream 4.5</span></div>' +
    '<div class="TextToImageCard-prompt">FLUX.1 Kontext</div></div>' +
    '<textarea>FLUX.1 Kontext</textarea><div class="Prompt">GPT-image-2</div>' +
    '<div class="prompt-content" contenteditable="true">即梦</div>' +
    '<select><option value="flux-kontext-max">FLUX.1 Kontext</option></select></main>' +
    '</body></html>';
}

async function openFixture(t, { origin = config.expectedOrigin, moduleName = config.moduleName } = {}) {
  const context = await browser.newContext({ viewport: { width: 1050, height: 750 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", req => requests.push(new URL(req.url()).pathname));
  await page.route("**/*", route => {
    const file = path.basename(new URL(route.request().url()).pathname);
    if (scripts[file]) return route.fulfill({ contentType: "text/javascript", body: scripts[file] });
    return route.fulfill({
      contentType: "text/html",
      body: injectImageTabAssets(fixture(), { enabled: true, moduleName, contentType: "text/html" })
    });
  });
  await page.goto(origin + "/local-fixture");
  await settle(page);
  t.after(() => assert.deepEqual(errors, [], "no browser errors"));
  return { page, requests };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
}

async function shadow(page, selector) {
  return page.locator(selector).evaluate(node => node.shadowRoot?.textContent ?? null);
}

test("six sidebar aliases, title, history and picture badge; original values retained", async t => {
  const { page, requests } = await openFixture(t);
  const rows = await page.locator(config.sidebarSelector).evaluateAll(nodes => nodes.map(node => ({
    source: node.textContent, display: node.shadowRoot?.textContent, title: node.title
  })));
  config.models.forEach((model, i) => {
    assert.equal(rows[i].source, model.source);
    assert.equal(rows[i].display, model.alias);
    assert.equal(rows[i].title, model.alias);
  });
  assert.equal(rows[6].display, undefined);
  assert.equal(await shadow(page, ".ToolLayout-header"), "HarsonMD");
  assert.equal(await shadow(page, "#badge"), "HarsonFK1");
  assert.equal(await shadow(page, "#history"), "Harson-SD 4.5");
  assert.equal(await page.locator("#model-value").inputValue(), "flux-kontext-max");
  assert.equal(await page.locator("textarea").inputValue(), "FLUX.1 Kontext");
  assert.equal(await page.locator(".TextToImageCard-prompt").textContent(), "FLUX.1 Kontext");
  assert.equal(await page.locator("select").inputValue(), "flux-kontext-max");
  assert.deepEqual(requests, ["/local-fixture", "/__harson_custom/image-tab-1/image-tab-config.js",
    "/__harson_custom/image-tab-1/image-tab-labels.js"]);
});

test("click handlers and model submission still read original source values", async t => {
  const { page } = await openFixture(t);
  await page.evaluate(() => {
    window.submitted = [];
    document.querySelectorAll(".NavList-list-item").forEach(row => {
      row.addEventListener("click", () => window.submitted.push({
        model: row.dataset.model,
        name: row.querySelector(".label").textContent
      }));
    });
    window.helpClicks = 0;
    document.querySelector("#help").addEventListener("click", () => window.helpClicks++);
  });
  for (let i = 0; i < 6; i++) await page.locator(config.sidebarSelector).nth(i).click();
  await page.locator("#help").click();
  assert.deepEqual(await page.evaluate(() => window.submitted), config.models.map((model, i) => ({
    model: "provider-model-" + i, name: model.source
  })));
  assert.equal(await page.evaluate(() => window.helpClicks), 1);
});

test("Vue text updates, replaced nodes and reused cards get the correct alias", async t => {
  const { page } = await openFixture(t);
  await page.evaluate(() => { document.querySelector("#badge").firstChild.data = "GPT-image-2"; });
  await settle(page);
  assert.equal(await shadow(page, "#badge"), "HarsonIM2");
  await page.evaluate(() => { document.querySelector("#badge").textContent = "FLUX Krea"; });
  await settle(page);
  assert.equal(await shadow(page, "#badge"), "HarsonFK");
  await page.evaluate(() => { document.querySelector("#badge").textContent = "New provider model"; });
  await settle(page);
  assert.equal(await page.locator("#badge").evaluate(node =>
    node.shadowRoot.querySelector("slot").assignedNodes()[0].data), "New provider model");
  await page.evaluate(() => { document.querySelector("#badge").textContent = "FLUX.1 Kontext"; });
  await settle(page);
  assert.equal(await shadow(page, "#badge"), "HarsonFK1");
});

test("late image cards and body-level Quasar menus are handled without reload", async t => {
  const { page, requests } = await openFixture(t);
  await page.evaluate(() => {
    const card = document.querySelector(".DemoCard").cloneNode(true);
    card.querySelector("span").id = "late-badge";
    card.querySelector("span").textContent = "全能图片 pro";
    document.querySelector("main").append(card);
    const menu = document.createElement("div");
    menu.className = "q-menu IcbsMenuSelect-menu-card";
    menu.innerHTML = '<div class="IcbsMenuSelect-menu-item-label"><i id="menu-icon">icon</i>kontext-pro</div>';
    document.body.append(menu);
    window.originalMenuIcon = document.querySelector("#menu-icon");
  });
  await settle(page);
  assert.equal(await shadow(page, "#late-badge"), "Harson-ZP pro");
  assert.equal(await shadow(page, ".IcbsMenuSelect-menu-item-label"), "HarsonFK1 pro");
  assert.equal(await page.evaluate(() => document.querySelector("#menu-icon") === window.originalMenuIcon), true);
  assert.equal(requests.length, 3);
});

test("leaving the image sidebar restores names and returning reapplies them", async t => {
  const { page } = await openFixture(t);
  await page.evaluate(() => { document.querySelector(".label").textContent = "AI服装"; });
  await settle(page);
  assert.equal(await page.evaluate(() => window.HarsonImageLabels.status().active), false);
  assert.equal(await page.locator("#badge").evaluate(node =>
    node.shadowRoot.querySelector("slot").assignedNodes()[0].data), "FLUX.1 Kontext");
  assert.equal(await page.locator(config.sidebarSelector).nth(1).getAttribute("title"), "全能图片");
  await page.evaluate(() => { document.querySelector(".label").textContent = "悠船Midjourney V7"; });
  await settle(page);
  assert.equal(await shadow(page, "#badge"), "HarsonFK1");
});

test("disable restores originals immediately and remains correct as Vue updates", async t => {
  const { page } = await openFixture(t);
  await page.evaluate(() => window.HarsonImageLabels.setEnabled(false));
  await settle(page);
  await page.evaluate(() => { document.querySelector("#badge").textContent = "GPT-image-2"; });
  await settle(page);
  assert.equal(await page.locator("#badge").evaluate(node =>
    node.shadowRoot.querySelector("slot").assignedNodes()[0].data), "GPT-image-2");
  await page.evaluate(() => window.HarsonImageLabels.setEnabled(true));
  await settle(page);
  assert.equal(await shadow(page, "#badge"), "HarsonIM2");
});

test("a model label moved into editable content reverts to the original", async t => {
  const { page } = await openFixture(t);
  await page.evaluate(() => { document.querySelector(".DemoCard").contentEditable = "true"; });
  await settle(page);
  assert.equal(await page.locator("#badge").evaluate(node =>
    node.shadowRoot.querySelector("slot").assignedNodes()[0].data), "FLUX.1 Kontext");
});

test("native accessibility tree exposes the alias rather than hidden source text", async t => {
  const { page } = await openFixture(t);
  const cdp = await page.context().newCDPSession(page);
  const tree = await cdp.send("Accessibility.getFullAXTree");
  const names = tree.nodes.filter(node => !node.ignored && node.role?.value === "StaticText")
    .map(node => node.name?.value);
  for (const model of config.models) assert.ok(names.includes(model.alias), model.alias);
  assert.ok(!names.includes("悠船Midjourney V7"));
});

test("parent site and other module documents are outside the adapter scope", async t => {
  for (const options of [{ origin: "https://harson-base.com" }, { moduleName: "clothing" }]) {
    const { page } = await openFixture(t, options);
    assert.equal(await page.evaluate(() => typeof window.HarsonImageLabels), "undefined");
    assert.equal(await shadow(page, ".label >> nth=0"), null);
  }
});
