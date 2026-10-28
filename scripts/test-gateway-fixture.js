"use strict";

/*
  Local end-to-end test of the image-tab gateway plumbing.

  Boots (on loopback only):
    - 3102: fixture "YiBai upstream" (HTML / JSON / binary / redirect)
    - 3100: stub app mounting the REAL /api/aigc/internal routes and a
      test-only ticket issuer
    - 3101: the REAL gateway (src/gateway/server.js), spawned as a
      child process with fixture env

  Then asserts the launch-ticket flow, single-use redemption, cookie
  session gate, image-module-only HTML injection on/off, header fixes,
  streaming, asset serving and the secret guard. No production code
  paths are modified.

  Run:  node scripts/test-gateway-fixture.js
*/

const { spawn } = require("child_process");
const http = require("http");
const express = require("express");

const INTERNAL_SECRET =
  "test-internal-secret-0001";

const STUB_PORT = 3100;
const GATEWAY_PORT = 3101;
const FIXTURE_PORT = 3102;

const GATEWAY_ORIGIN = `http://127.0.0.1:${GATEWAY_PORT}`;
const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

// Recorded cast-correction session id (gateway finish log, 2026-10-28).
const SESSION_ID = "62f614d0-23ac-4e89-afd4-c175fe60e9c7";

const HTML_BODY =
  "<!DOCTYPE html><html><head><title>YiBai fixture</title>" +
  "</head><body><div>悠船Midjourney V7</div>" +
  "<div>FLUX.1 Kontext</div><div>未知模型保持原样</div>" +
  "</body></html>";

let failures = 0;

function check(
  label,
  condition,
  detail
) {
  if (condition) {
    console.log(
      `PASS  ${label}`
    );
  } else {
    failures += 1;
    console.log(
      `FAIL  ${label}${
        detail
          ? ` -> ${detail}`
          : ""
      }`
    );
  }
}

function listen(server, port) {
  return new Promise(
    (resolve, reject) => {
      server.once(
        "error",
        reject
      );
      server.listen(
        port,
        "127.0.0.1",
        resolve
      );
    }
  );
}

function request(
  url,
  options
) {
  return new Promise(
    (resolve, reject) => {
      const req = http.request(
        url,
        options,
        res => {
          const chunks = [];
          res.on(
            "data",
            c => chunks.push(c)
          );
          res.on(
            "end",
            () =>
              resolve({
                status:
                  res.statusCode,
                headers: res.headers,
                body: Buffer.concat(
                  chunks
                )
              })
          );
        }
      );

      req.on(
        "error",
        reject
      );

      if (options?.body) {
        req.write(
          options.body
        );
      }

      req.end();
    }
  );
}

/* ---------------- fixture upstream ---------------- */

function startFixture() {
  const app = express();

  const seenTokens = [];

  for (const path of [
    "/aigc/image-generator",
    "/aigc/upscaler",
    "/aigc/video-generator",
    "/aigc/clothing"
  ]) {
    app.get(
      path,
      (req, res) => {
        seenTokens.push(
          String(
            req.query.token || ""
          )
        );

        res.set(
          "Content-Type",
          "text/html; charset=utf-8"
        );
        res.send(HTML_BODY);
      }
    );
  }

  /* Viral video replicator sub-tool APIs (route-policy exceptions) */
  app.post(
    "/app/proxy/viralVideoTaskDetail",
    (req, res) => {
      res.json({
        code: 200,
        data: { task: "fixture-task", status: "success" }
      });
    }
  );

  app.post(
    "/app/viral-video/pricing",
    (req, res) => {
      res.json({ code: 200, data: { price: 10 } });
    }
  );

  /* Clothing color-match subtool pricing (route-policy exception) */
  app.post(
    "/app/local-repair/pricing",
    (req, res) => {
      res.json({ code: 200, data: { price: 5 } });
    }
  );

  /* Color-match pricing + cast-correction sessions (route exceptions) */
  for (const method of ["post", "get"]) {
    app[method](
      "/app/color-match/pricing",
      (req, res) => {
        res.json({ code: 200, data: { price: 3 } });
      }
    );

    app[method](
      "/app/color-match/cast-correction-sessions",
      (req, res) => {
        res.json({ code: 200, data: { sessions: [] } });
      }
    );
  }

  /* Per-session cast-correction process/delete (UUID-pattern exceptions) */
  app.post(
    `/app/color-match/cast-correction-sessions/${SESSION_ID}/process`,
    (req, res) => {
      res.json({ code: 200, data: { corrected: true } });
    }
  );

  app.delete(
    `/app/color-match/cast-correction-sessions/${SESSION_ID}`,
    (req, res) => {
      res.json({ code: 200, data: { deleted: true } });
    }
  );

  /* Local repair submission (route-policy exception) */
  app.post("/app/local-repair/beginRepair", (_req, res) => {
    res.json({ code: 200, data: { task: "fixture-repair" } });
  });

  /* Viral video replicator link resolver (route-policy exception) */
  app.post(
    "/app/viral-video/link/resolve",
    (req, res) => {
      if (req.query.fail === "1") {
        return res.status(500).json({
          code: 500,
          message: "fixture upstream failure"
        });
      }

      // Exercise Set-Cookie Domain rewriting: the fixture gateway's
      // upstream host is 127.0.0.1, so its Domain attribute must be
      // stripped; the unrelated domain must survive untouched.
      res.set(
        "Set-Cookie",
        [
          "sid=abc; Domain=127.0.0.1; Path=/; HttpOnly",
          "other=xyz; Domain=unrelated.example; Path=/"
        ]
      );

      return res.json({
        code: 200,
        data: {
          videoUrl: "https://image.yibaiaigc.com/fixture.mp4",
          upstreamCookieHeader: req.headers.cookie || ""
        }
      });
    }
  );

  app.get(
    "/api/data.json",
    (req, res) => {
      res.json({
        ok: true,
        model: "FLUX.1 Kontext"
      });
    }
  );

  app.get(
    "/big.bin",
    (req, res) => {
      const chunk = Buffer.alloc(
        64 * 1024,
        7
      );

      res.set(
        "Content-Type",
        "application/octet-stream"
      );

      for (
        let i = 0;
        i < 80;
        i += 1
      ) {
        res.write(chunk);
      }

      res.end();
    }
  );

  app.get(
    "/redirect-me",
    (req, res) => {
      res.redirect(
        302,
        `${FIXTURE_ORIGIN}/aigc/image-generator`
      );
    }
  );

  app.get(
    "/__fixture/seen-tokens",
    (req, res) => {
      res.json({
        tokens: seenTokens
      });
    }
  );

  const server = http.createServer(
    app
  );

  return listen(
    server,
    FIXTURE_PORT
  ).then(() => server);
}

/* ---------------- stub app (real modules) ---------------- */

function startStubApp() {
  process.env.HARSON_INTERNAL_API_SECRET =
    INTERNAL_SECRET;

  process.env.YIBAI_AIGC_MOCK = "true";

  process.env.YIBAI_AIGC_HOST =
    "https://cl-base.yibaiaigc.com";

  const aigcInternalRoutes = require(
    "../src/routes/aigcInternalRoutes"
  );

  const aigcFrameTicketService = require(
    "../src/services/aigcFrameTicketService"
  );

  const app = express();

  app.use(express.json());

  app.use(
    "/api/aigc/internal",
    aigcInternalRoutes
  );

  /* test-only: issue a ticket through the real service */
  app.post(
    "/test/issue-ticket",
    (req, res) => {
      const issued =
        aigcFrameTicketService.issueTicket(
          {
            userId:
              req.body.userId,
            module:
              req.body.module,
            providerToken:
              req.body
                .providerToken
          }
      );

      res.json({
        success: true,
        result: issued
      });
    }
  );

  const server = http.createServer(
    app
  );

  return listen(
    server,
    STUB_PORT
  ).then(() => server);
}

/* ---------------- gateway child ---------------- */

function startGateway(
  aliasesEnabled
) {
  const child = spawn(
    process.execPath,
    [
      "src/gateway/server.js"
    ],
    {
      cwd: require("path").join(
        __dirname,
        ".."
      ),
      env: {
        ...process.env,
        GATEWAY_PORT: String(
          GATEWAY_PORT
        ),
        HARSON_APP_INTERNAL_ORIGIN: `http://127.0.0.1:${STUB_PORT}`,
        HARSON_INTERNAL_API_SECRET:
          INTERNAL_SECRET,
        GATEWAY_UPSTREAM: FIXTURE_ORIGIN,
        YIBAI_FRAME_PUBLIC_ORIGIN: GATEWAY_ORIGIN,
        YIBAI_IMAGE_ALIASES_ENABLED: aliasesEnabled
          ? "true"
          : "false",
        YIBAI_GATEWAY_EXTRA_PATHS:
          "/api,/redirect-me,/big.bin"
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe"
      ]
    }
  );

  child.stdout.on(
    "data",
    () => {}
  );

  child.stderr.on(
    "data",
    data =>
      console.error(
        "[gateway-stderr]",
        String(data).trim()
      )
  );

  /* wait until healthz answers */
  return new Promise(
    (resolve, reject) => {
      const startedAt =
        Date.now();

      const poll = () => {
        if (
          Date.now() -
            startedAt >
          15000
        ) {
          return reject(
            new Error(
              "gateway did not start"
            )
          );
        }

        request(
          `${GATEWAY_ORIGIN}/__harson/healthz`
        )
          .then(res => {
            if (
              res.status === 200
            ) {
              return resolve(
                child
              );
            }

            setTimeout(
              poll,
              200
            );
          })
          .catch(() =>
            setTimeout(
              poll,
              200
            )
          );
      };

      poll();
    }
  );
}

/* ---------------- helpers ---------------- */

async function issueTicket(
  module,
  providerToken
) {
  const issued = await request(
    `http://127.0.0.1:${STUB_PORT}/test/issue-ticket`,
    {
      method: "POST",
      headers: {
        "content-type":
          "application/json"
      },
      body: JSON.stringify({
        userId: "user-42",
        module,
        providerToken
      })
    }
  );

  return JSON.parse(
    issued.body.toString()
  ).result.ticket;
}

async function launch(
  ticket,
  nextPath
) {
  const res = await request(
    `${GATEWAY_ORIGIN}/__harson/launch?ticket=${ticket}&next=${encodeURIComponent(
      nextPath
    )}`
  );

  const setCookie =
    res.headers["set-cookie"]
      ?.join("; ") || "";

  const sessionId =
    /harson_aigc_gateway=([^;]+)/.exec(
      setCookie
    )?.[1];

  return { res, setCookie, sessionId };
}

async function withSession(
  module,
  nextPath
) {
  const ticket = await issueTicket(
    module,
    "TOKEN-" + module
  );

  return launch(ticket, nextPath);
}

/* ---------------- the test ---------------- */

async function main() {
  const fixtureServer =
    await startFixture();

  const stubServer =
    await startStubApp();

  let gateway =
    await startGateway(true);

  try {
    /* 1. internal secret guard */
    const forbidden =
      await request(
        `http://127.0.0.1:${STUB_PORT}/api/aigc/internal/gateway/routes`,
        {
          headers: {
            "x-harson-internal-secret":
              "wrong"
          }
        }
      );

    check(
      "internal API rejects wrong secret",
      forbidden.status === 403
    );

    const allowed =
      await request(
        `http://127.0.0.1:${STUB_PORT}/api/aigc/internal/gateway/routes`,
        {
          headers: {
            "x-harson-internal-secret":
              INTERNAL_SECRET
          }
        }
      );

    const routesData = JSON.parse(
      allowed.body.toString()
    );

    check(
      "internal API returns module routes",
      allowed.status ===
        200 &&
        routesData.result?.routes?.some(
          route =>
            route.module ===
              "image-generator" &&
            route.routerUrl
        )
    );

    /* 2. display assets served without a session (versioned, cacheable) */
    const dataAsset =
      await request(
        `${GATEWAY_ORIGIN}/__harson_custom/image-tab-1/model-aliases.generated.js`
      );

    check(
      "generated alias data served at reserved prefix",
      dataAsset.status ===
        200 &&
        dataAsset.body
          .toString()
          .includes(
            "HarsonModelAliases"
          )
    );

    const resolverAsset =
      await request(
        `${GATEWAY_ORIGIN}/__harson_custom/image-tab-1/model-alias-resolver.js`
      );

    check(
      "shared resolver served at reserved prefix",
      resolverAsset.status ===
        200 &&
        resolverAsset.body
          .toString()
          .includes(
            "HarsonModelAliasResolver"
          )
    );

    const configAsset =
      await request(
        `${GATEWAY_ORIGIN}/__harson_custom/image-tab-1/image-tab-config.js`
      );

    check(
      "config asset served at reserved prefix",
      configAsset.status ===
        200 &&
        configAsset.body
          .toString()
          .includes(
            "all-pages-9"
          )
    );

    const labelsAsset =
      await request(
        `${GATEWAY_ORIGIN}/__harson_custom/image-tab-1/image-tab-labels.js`
      );

    check(
      "labels asset served at reserved prefix",
      labelsAsset.status ===
        200 &&
        labelsAsset.body
          .toString()
          .includes(
            "HarsonImageLabels"
          )
    );

    const navCssAsset =
      await request(
        `${GATEWAY_ORIGIN}/__harson_custom/image-tab-1/nav-visibility.css`
      );

    check(
      "nav-visibility.css served at reserved prefix",
      navCssAsset.status ===
        200 &&
        navCssAsset.body
          .toString()
          .includes(
            "data-harson-hidden-menu"
          )
    );

    const navJsAsset =
      await request(
        `${GATEWAY_ORIGIN}/__harson_custom/image-tab-1/nav-visibility.js`
      );

    check(
      "nav-visibility.js served at reserved prefix",
      navJsAsset.status ===
        200 &&
        navJsAsset.body
          .toString()
          .includes(
            "HarsonNavVisibility"
          )
    );

    /* 3. launch flow (image-generator) */
    const PROVIDER_TOKEN =
      "SECRET-PROVIDER-TOKEN-123";

    const ticket =
      await issueTicket(
        "image-generator",
        PROVIDER_TOKEN
      );

    const first = await launch(
      ticket,
      "/aigc/image-generator?embed=2"
    );

    check(
      "launch redeems ticket -> 302",
      first.res.status === 302
    );

    check(
      "launch sets gateway session cookie (host-only name)",
      first.setCookie.includes(
        "harson_aigc_gateway="
      ) &&
        first.setCookie.includes(
          "HttpOnly"
        )
    );

    check(
      "launch redirects with provider token appended",
      String(
        first.res.headers.location
      ).includes(
        `token=${PROVIDER_TOKEN}`
      )
    );

    /* browser follows the 302: upstream sees the token exactly once */
    await request(
      `${FIXTURE_ORIGIN}${first.res.headers.location}`
    );

    const seen =
      await request(
        `${FIXTURE_ORIGIN}/__fixture/seen-tokens`
      );

    check(
      "provider token forwarded to upstream exactly once",
      JSON.parse(
        seen.body.toString()
      ).tokens.filter(
        t =>
          t === PROVIDER_TOKEN
      ).length === 1
    );

    /* 4. single use */
    const replay =
      await request(
        `${GATEWAY_ORIGIN}/__harson/launch?ticket=${ticket}&next=/aigc/image-generator%3Fembed%3D2`
      );

    check(
      "ticket replay rejected (410)",
      replay.status === 410
    );

    /* 5. session gate */
    const noCookie =
      await request(
        `${GATEWAY_ORIGIN}/aigc/image-generator`
      );

    check(
      "no-cookie request redirected to expired page",
      noCookie.status === 302
    );

    /* 6. image-generator HTML WITH injection */
    const htmlRes =
      await request(
        `${GATEWAY_ORIGIN}/aigc/image-generator?embed=2`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${first.sessionId}`
          }
        }
      );

    const html =
      htmlRes.body.toString();

    check(
      "proxied HTML status 200",
      htmlRes.status === 200
    );

    check(
      "all four alias assets injected in dependency order, after nav assets",
      html.includes(
        "/__harson_custom/image-tab-1/nav-visibility.css"
      ) &&
        html.includes(
          'id="harson-nav-visibility"'
        ) &&
        html.indexOf("nav-visibility.css") <
          html.indexOf("harson-nav-visibility") &&
        html.includes(
          "/__harson_custom/image-tab-1/model-aliases.generated.js"
      ) &&
        html.includes(
          "/__harson_custom/image-tab-1/model-alias-resolver.js"
        ) &&
        html.includes(
          "/__harson_custom/image-tab-1/image-tab-config.js"
        ) &&
        html.includes(
          'id="harson-image-tab-labels"'
        ) &&
        html.indexOf("model-aliases.generated.js") <
          html.indexOf("model-alias-resolver.js") &&
        html.indexOf("model-alias-resolver.js") <
          html.indexOf("image-tab-config.js") &&
        html.indexOf("image-tab-config.js") <
          html.indexOf("harson-image-tab-labels")
    );

    check(
      "tags inserted before </head>",
      html.indexOf("<script") <
        html.indexOf("</head>")
    );

    check(
      "Content-Length matches injected body",
      Number(
        htmlRes.headers[
          "content-length"
        ]
      ) ===
        htmlRes.body.length
    );

    check(
      "HTML served no-store",
      String(
        htmlRes.headers[
          "cache-control"
        ]
      ).includes(
        "no-store"
      )
    );

    /* 7. other modules also injected, tagged with their own module */
    const other = await withSession(
      "upscaler",
      "/aigc/upscaler?embed=2"
    );

    const otherHtml =
      await request(
        `${GATEWAY_ORIGIN}/aigc/upscaler?embed=2`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${other.sessionId}`
          }
        }
      );

    check(
      "upscaler session injected with its own module marker",
      otherHtml.status ===
        200 &&
        otherHtml.body
          .toString()
          .includes(
            'data-harson-module="upscaler"'
          )
    );

    /* 7b. replicator route-policy exceptions (video-generator session) */
    const videoSession = await withSession(
      "video-generator",
      "/aigc/video-generator?embed=2"
    );

    const detailRes = await request(
      `${GATEWAY_ORIGIN}/app/proxy/viralVideoTaskDetail`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "video-generator POST viralVideoTaskDetail passes route policy + JSON returns",
      detailRes.status === 200 &&
        JSON.parse(detailRes.body.toString()).data
          .task === "fixture-task"
    );

    const pricingRes = await request(
      `${GATEWAY_ORIGIN}/app/viral-video/pricing`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "video-generator POST viral-video/pricing passes route policy",
      pricingRes.status === 200 &&
        JSON.parse(pricingRes.body.toString()).data
          .price === 10
    );

    const wrongMethod = await request(
      `${GATEWAY_ORIGIN}/app/proxy/viralVideoTaskDetail`,
      {
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "GET on the detail path stays 404 (method-aware policy)",
      wrongMethod.status === 404
    );

    const arbitraryApp = await request(
      `${GATEWAY_ORIGIN}/app/proxy/otherEndpoint`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "arbitrary /app/proxy path stays 404 (no broad prefix)",
      arbitraryApp.status === 404
    );

    const wrongModule = await request(
      `${GATEWAY_ORIGIN}/app/proxy/viralVideoTaskDetail`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${first.sessionId}`
        }
      }
    );

    check(
      "image-generator session POST stays 404 (module-aware policy)",
      wrongModule.status === 404
    );

    const linkResolveRes = await request(
      `${GATEWAY_ORIGIN}/app/viral-video/link/resolve`,
      {
        method: "POST",
        headers: {
          // Both cookies: the gateway session cookie must be filtered out
          // before upstream; the provider cookie must survive.
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}; provider_sid=one`
        }
      }
    );

    check(
      "video-generator POST link/resolve passes route policy + JSON returns",
      linkResolveRes.status === 200 &&
        JSON.parse(linkResolveRes.body.toString()).data
          .videoUrl === "https://image.yibaiaigc.com/fixture.mp4"
    );

    /* 7c. proxy header behavior on the link resolver */
    const echoedCookies = JSON.parse(
      linkResolveRes.body.toString()
    ).data.upstreamCookieHeader;

    check(
      "gateway session cookie NOT forwarded to upstream; provider cookie kept",
      !echoedCookies.includes("harson_aigc_gateway") &&
        echoedCookies.includes("provider_sid=one")
    );

    const setCookies =
      linkResolveRes.headers["set-cookie"] || [];

    check(
      "upstream-host Domain attribute stripped from Set-Cookie; unrelated kept",
      setCookies.some(c =>
        c.startsWith("sid=abc") &&
        !/domain/i.test(c) &&
        c.includes("HttpOnly")
      ) &&
        setCookies.some(c =>
          c.includes("Domain=unrelated.example")
        )
    );

    const upstream500 = await request(
      `${GATEWAY_ORIGIN}/app/viral-video/link/resolve?fail=1`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "upstream 500 stays 500 with its original body",
      upstream500.status === 500 &&
        JSON.parse(upstream500.body.toString()).message ===
          "fixture upstream failure"
    );

    const unknownViral = await request(
      `${GATEWAY_ORIGIN}/app/viral-video/other`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "unknown /app/viral-video/* path stays 404",
      unknownViral.status === 404
    );

    /* 7d. clothing color-match pricing exception */
    const clothingSession = await withSession(
      "clothing",
      "/aigc/clothing?embed=2"
    );

    const colorPricing = await request(
      `${GATEWAY_ORIGIN}/app/local-repair/pricing`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "clothing POST local-repair/pricing passes route policy + JSON returns",
      colorPricing.status === 200 &&
        JSON.parse(colorPricing.body.toString()).data
          .price === 5
    );

    const colorWrongModule = await request(
      `${GATEWAY_ORIGIN}/app/local-repair/pricing`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "video-generator session on the color-match path stays 404",
      colorWrongModule.status === 404
    );

    /* 7e. cast-correction sessions + color-match pricing (clothing) */
    const sessionsPost = await request(
      `${GATEWAY_ORIGIN}/app/color-match/cast-correction-sessions`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "clothing POST cast-correction-sessions passes + JSON returns",
      sessionsPost.status === 200 &&
        Array.isArray(
          JSON.parse(sessionsPost.body.toString()).data.sessions
        )
    );

    const pricingGet = await request(
      `${GATEWAY_ORIGIN}/app/color-match/pricing`,
      {
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "clothing GET color-match/pricing passes route policy",
      pricingGet.status === 200 &&
        JSON.parse(pricingGet.body.toString()).data.price === 3
    );

    const sessionsWrongModule = await request(
      `${GATEWAY_ORIGIN}/app/color-match/cast-correction-sessions`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${videoSession.sessionId}`
        }
      }
    );

    check(
      "video-generator session on color-match sessions stays 404",
      sessionsWrongModule.status === 404
    );

    /* 7f. cast-correction per-session process/delete + beginRepair */
    const processRes = await request(
      `${GATEWAY_ORIGIN}/app/color-match/cast-correction-sessions/${SESSION_ID}/process`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "clothing POST session/process (UUID pattern) reaches provider",
      processRes.status === 200 &&
        JSON.parse(processRes.body.toString()).data.corrected === true
    );

    const deleteRes = await request(
      `${GATEWAY_ORIGIN}/app/color-match/cast-correction-sessions/${SESSION_ID}`,
      {
        method: "DELETE",
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "clothing DELETE session (UUID pattern) reaches provider",
      deleteRes.status === 200 &&
        JSON.parse(deleteRes.body.toString()).data.deleted === true
    );

    const badId = await request(
      `${GATEWAY_ORIGIN}/app/color-match/cast-correction-sessions/not-a-uuid/process`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "non-UUID session id stays 404",
      badId.status === 404
    );

    const repairSubmit = await request(
      `${GATEWAY_ORIGIN}/app/local-repair/beginRepair`,
      {
        method: "POST",
        headers: {
          Cookie: `harson_aigc_gateway=${clothingSession.sessionId}`
        }
      }
    );

    check(
      "clothing POST beginRepair reaches mock provider",
      repairSubmit.status === 200 &&
        JSON.parse(repairSubmit.body.toString()).data.task === "fixture-repair"
    );

    const repairWrongMethod = await request(
      `${GATEWAY_ORIGIN}/app/local-repair/beginRepair`,
      { headers: { Cookie: `harson_aigc_gateway=${clothingSession.sessionId}` } }
    );
    check("GET beginRepair stays 404", repairWrongMethod.status === 404);

    const repairWrongModule = await request(
      `${GATEWAY_ORIGIN}/app/local-repair/beginRepair`,
      {
        method: "POST",
        headers: { Cookie: `harson_aigc_gateway=${videoSession.sessionId}` }
      }
    );
    check("video POST beginRepair stays 404", repairWrongModule.status === 404);

    /* 8. JSON passthrough (extra path) + no-store */
    const jsonRes =
      await request(
        `${GATEWAY_ORIGIN}/api/data.json`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${first.sessionId}`
          }
        }
      );

    check(
      "JSON body passes through untouched",
      jsonRes.status ===
        200 &&
        JSON.parse(
          jsonRes.body.toString()
        ).model ===
          "FLUX.1 Kontext"
    );

    check(
      "JSON served no-store",
      String(
        jsonRes.headers[
          "cache-control"
        ]
      ).includes(
        "no-store"
      )
    );

    /* 9. binary streaming */
    const binRes =
      await request(
        `${GATEWAY_ORIGIN}/big.bin`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${first.sessionId}`
          }
        }
      );

    check(
      "binary streams through intact (5MB)",
      binRes.body.length ===
        80 * 64 * 1024
    );

    /* 10. redirect rewrite */
    const redirectRes =
      await request(
        `${GATEWAY_ORIGIN}/redirect-me`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${first.sessionId}`
          }
        }
      );

    check(
      "Location rewritten to gateway origin",
      String(
        redirectRes.headers
          .location
      ).startsWith(
        GATEWAY_ORIGIN
      )
    );

    /* 11. revoke drops sessions */
    const revokeRes =
      await request(
        `${GATEWAY_ORIGIN}/__harson/internal/revoke`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            "x-harson-internal-secret":
              INTERNAL_SECRET
          },
          body: JSON.stringify({
            userId: "user-42"
          })
        }
      );

    const afterRevoke =
      await request(
        `${GATEWAY_ORIGIN}/aigc/image-generator?embed=2`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${first.sessionId}`
          }
        }
      );

    check(
      "internal revoke drops the user's gateway session",
      revokeRes.status ===
        200 &&
        afterRevoke.status ===
          302
    );

    /* 12. pilot mode: aliases OFF -> no injection anywhere */
    gateway.kill();

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          500
        )
    );

    gateway =
      await startGateway(false);

    const pilot =
      await withSession(
        "image-generator",
        "/aigc/image-generator?embed=2"
      );

    const pilotHtml =
      await request(
        `${GATEWAY_ORIGIN}/aigc/image-generator?embed=2`,
        {
          headers: {
            Cookie: `harson_aigc_gateway=${pilot.sessionId}`
          }
        }
      );

    check(
      "pilot mode (aliases off) injects ONLY the navigation filter",
      pilotHtml.status ===
        200 &&
        pilotHtml.body
          .toString()
          .includes(
            "nav-visibility.css"
          ) &&
        pilotHtml.body
          .toString()
          .includes(
            'id="harson-nav-visibility"'
          ) &&
        !pilotHtml.body
          .toString()
          .includes(
            "harson-image-tab-labels"
          ) &&
        pilotHtml.body
          .toString()
          .includes(
            "悠船Midjourney V7"
          )
    );

    console.log(
      failures === 0
        ? "\nALL GATEWAY FIXTURE TESTS PASSED"
        : `\n${failures} TEST(S) FAILED`
    );
  } finally {
    gateway.kill();

    fixtureServer.close();

    stubServer.close();
  }

  process.exit(
    failures === 0 ? 0 : 1
  );
}

main().catch(error => {
  console.error(
    "fixture test crashed:",
    error
  );
  process.exit(1);
});
