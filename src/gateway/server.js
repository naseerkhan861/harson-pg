"use strict";

/*
  YiBai iframe 网关（ai.harson-base.com）— image-tab 显示别名集成。

  职责（按请求顺序）：
    1. /__harson_custom/image-tab-1/* 静态显示资产（express.static，
       位于会话门之前，可普通缓存）；
    2. /__harson/* 自有路由：launch 票据赎回、过期页、健康检查、
       内部吊销；
    3. 会话门：无有效网关会话的请求一律引导到过期页；
    4. CSRF：非 GET/HEAD/OPTIONS 请求校验 Sec-Fetch-Site；
    5. 路由白名单：仅放行 YiBai 菜单返回的模块路由前缀
       （+ YIBAI_GATEWAY_EXTRA_PATHS 额外前缀）；
    6. 反向代理 YiBai：非 HTML 一律流式透传（不解析请求/响应体，
       上传与 API 原样通过）；仅当 YIBAI_IMAGE_ALIASES_ENABLED=true
       且会话模块为 image-generator 且响应为 utf-8 HTML 时，调用
       injectImageTabAssets() 注入两个本地显示脚本，并修正
       Content-Length 与缓存头。

  安全要点：
    - 网关会话使用自己的 host-only cookie（生产 __Host- 前缀），
      不扩大主站 cookie 范围；
    - HTML / JSON 一律 no-store，禁止跨账号缓存；
    - 日志不记录 query string、Cookie、票据与 token；
    - provider token 只出现在发往上游的一次性 302 中。

  该服务通过 docker compose 的 gateway profile 启用；未启用时
  对主应用零影响。主应用仅在 YIBAI_FRAME_PUBLIC_ORIGIN 配置时才
  把 image-generator 模块的 iframe 指向本网关。
*/

require("dotenv").config();

const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createProxyMiddleware
} = require("http-proxy-middleware");
const {
  ASSET_PREFIX,
  injectImageTabAssets
} = require("../services/yibaiDisplayInjection");

const PORT = Number(
  process.env.GATEWAY_PORT || 3001
);

const APP_INTERNAL_ORIGIN = String(
  process.env.HARSON_APP_INTERNAL_ORIGIN ||
    "http://app:3000"
).replace(/\/+$/, "");

const UPSTREAM_ORIGIN = String(
  process.env.GATEWAY_UPSTREAM ||
    process.env.YIBAI_AIGC_HOST ||
    "https://cl-base.yibaiaigc.com"
).replace(/\/+$/, "");

const PUBLIC_ORIGIN = String(
  process.env.YIBAI_FRAME_PUBLIC_ORIGIN ||
    ""
).replace(/\/+$/, "");

const IS_SECURE_ORIGIN =
  PUBLIC_ORIGIN.startsWith("https://");

const SESSION_COOKIE_NAME = IS_SECURE_ORIGIN
  ? "__Host-harson_aigc"
  : "harson_aigc_gateway";

const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const ROUTES_CACHE_MS = 10 * 60 * 1000;
const INTERNAL_TIMEOUT_MS = 5000;

const EXPIRED_PAGE_HTML =
  '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
  "<title>会话已过期</title>" +
  "<style>body{font-family:system-ui,sans-serif;background:#111418;" +
  "color:#e8e8e8;display:flex;align-items:center;justify-content:center;" +
  "height:100vh;margin:0}div{text-align:center}a{color:#f5c518}" +
  "</style></head><body><div>" +
  "<h2>会话已过期</h2>" +
  "<p>请返回 Harson 工作空间刷新页面后重试。</p>" +
  "</div></body></html>";

const app = express();

app.set("trust proxy", 1);

/* -------------------------------------------------- */
/* 会话存储（单实例内存）                              */
/* -------------------------------------------------- */

const sessions = new Map();

function createSession({
  userId,
  moduleName,
  providerToken
}) {
  const sessionId = crypto
    .randomBytes(32)
    .toString("hex");

  const now = Date.now();

  sessions.set(sessionId, {
    userId,
    moduleName: String(
      moduleName || ""
    ),
    providerToken,
    createdAt: now,
    lastUsedAt: now,
    absoluteExpiresAt:
      now + SESSION_ABSOLUTE_MS
  });

  return sessionId;
}

function getSession(sessionId) {
  const key = String(sessionId || "");

  if (!key) {
    return null;
  }

  const record = sessions.get(key);

  if (!record) {
    return null;
  }

  const now = Date.now();

  if (
    record.absoluteExpiresAt <= now ||
    now - record.lastUsedAt >
      SESSION_IDLE_MS
  ) {
    sessions.delete(key);
    return null;
  }

  record.lastUsedAt = now;
  return record;
}

function revokeSessionsForUser(
  userId
) {
  const normalizedUserId = String(
    userId || ""
  ).trim();

  let revoked = 0;

  for (const [
    sessionId,
    record
  ] of sessions) {
    if (
      record.userId ===
      normalizedUserId
    ) {
      sessions.delete(sessionId);
      revoked += 1;
    }
  }

  return revoked;
}

const sessionSweeper = setInterval(
  () => {
    const now = Date.now();

    for (const [
      sessionId,
      record
    ] of sessions) {
      if (
        record.absoluteExpiresAt <=
          now ||
        now - record.lastUsedAt >
          SESSION_IDLE_MS
      ) {
        sessions.delete(sessionId);
      }
    }
  },
  60 * 1000
);

if (
  typeof sessionSweeper.unref ===
  "function"
) {
  sessionSweeper.unref();
}

/* -------------------------------------------------- */
/* 内部调用工具                                       */
/* -------------------------------------------------- */

function internalSecret() {
  return String(
    process.env.HARSON_INTERNAL_API_SECRET ||
      ""
  );
}

function imageAliasesEnabled() {
  return (
    String(
      process.env
        .YIBAI_IMAGE_ALIASES_ENABLED ||
        "false"
    ).toLowerCase() === "true"
  );
}

async function postInternal(
  internalPath,
  body
) {
  const secret = internalSecret();

  if (!secret) {
    throw new Error(
      "网关未配置 HARSON_INTERNAL_API_SECRET"
    );
  }

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    INTERNAL_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${APP_INTERNAL_ORIGIN}${internalPath}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          "x-harson-internal-secret":
            secret
        },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    const data =
      await response.json();

    return {
      status: response.status,
      data
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllowedRoutes() {
  const secret = internalSecret();

  if (!secret) {
    throw new Error(
      "网关未配置 HARSON_INTERNAL_API_SECRET"
    );
  }

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    INTERNAL_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${APP_INTERNAL_ORIGIN}/api/aigc/internal/gateway/routes`,
      {
        headers: {
          "x-harson-internal-secret":
            secret
        },
        signal: controller.signal
      }
    );

    const data =
      await response.json();

    const routes = Array.isArray(
      data?.result?.routes
    )
      ? data.result.routes
      : [];

    return routes
      .map(route => ({
        module: String(
          route?.module || ""
        ).trim(),
        routerUrl: String(
          route?.routerUrl || ""
        ).trim()
      }))
      .filter(
        route =>
          route.routerUrl &&
          route.routerUrl.startsWith("/") &&
          !route.routerUrl.startsWith("//")
      );
  } finally {
    clearTimeout(timer);
  }
}

let allowedRoutesCache = {
  at: 0,
  routes: []
};

function extraPathPrefixes() {
  return String(
    process.env.YIBAI_GATEWAY_EXTRA_PATHS ||
      ""
  )
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

async function getAllowedPrefixes() {
  if (
    allowedRoutesCache.routes
      .length > 0 &&
    Date.now() -
      allowedRoutesCache.at <
      ROUTES_CACHE_MS
  ) {
    return allowedRoutesCache.routes
      .map(
        route =>
          route.routerUrl
      )
      .concat(
        extraPathPrefixes()
      );
  }

  const routes =
    await fetchAllowedRoutes();

  allowedRoutesCache = {
    at: Date.now(),
    routes
  };

  return routes
    .map(route => route.routerUrl)
    .concat(extraPathPrefixes());
}

/* -------------------------------------------------- */
/* 日志（不记录 query / cookie / 票据）               */
/* -------------------------------------------------- */

app.use((req, res, next) => {
  if (
    req.path === "/__harson/healthz"
  ) {
    return next();
  }

  res.on("finish", () => {
    console.log(
      `[gateway] ${req.method} ${req.path} -> ${res.statusCode}`
    );
  });

  return next();
});

/* -------------------------------------------------- */
/* 静态显示资产（会话门之前，可普通缓存）             */
/* -------------------------------------------------- */

app.use(
  ASSET_PREFIX,
  express.static(
    path.join(
      __dirname,
      "..",
      "..",
      "public",
      "harson-customization"
    ),
    {
      index: false,
      fallthrough: false
    }
  )
);

/* -------------------------------------------------- */
/* /__harson/* 自有路由                               */
/* -------------------------------------------------- */

app.get(
  "/__harson/healthz",
  (req, res) => {
    return res.json({
      success: true,
      result: {
        ok: true,
        upstream: UPSTREAM_ORIGIN,
        imageAliasesEnabled:
          imageAliasesEnabled()
      }
    });
  }
);

app.get(
  "/__harson/expired.html",
  (req, res) => {
    res.set(
      "Content-Type",
      "text/html; charset=utf-8"
    );
    res.set(
      "Cache-Control",
      "no-store"
    );
    return res
      .status(200)
      .send(EXPIRED_PAGE_HTML);
  }
);

app.post(
  "/__harson/internal/revoke",
  express.json(),
  (req, res) => {
    const expected =
      internalSecret();

    const provided = String(
      req.get(
        "x-harson-internal-secret"
      ) || ""
    );

    if (
      !expected ||
      provided !== expected
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }

    const revoked =
      revokeSessionsForUser(
        req.body?.userId
      );

    return res.json({
      success: true,
      result: { revoked }
    });
  }
);

app.get(
  "/__harson/launch",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: {
      success: false,
      message:
        "Too many requests. Please try again later."
    }
  }),
  async (req, res) => {
    const ticket = String(
      req.query.ticket || ""
    );

    const next = String(
      req.query.next || ""
    );

    /*
      next 只接受站内路径：必须以 “/” 开头且不能以 “//”
      开头（协议相对地址），杜绝开放重定向。
    */
    if (
      !ticket ||
      !next.startsWith("/") ||
      next.startsWith("//")
    ) {
      return res
        .status(400)
        .send(EXPIRED_PAGE_HTML);
    }

    let redemption = null;

    try {
      const internalResult =
        await postInternal(
          "/api/aigc/internal/frame-ticket/redeem",
          { ticket }
        );

      if (
        internalResult.status ===
          200 &&
        internalResult.data
          ?.success
      ) {
        redemption =
          internalResult.data
            .result;
      }
    } catch (error) {
      console.error(
        "[gateway] 票据赎回内部调用失败:",
        error.message
      );
    }

    if (
      !redemption ||
      !redemption.providerToken
    ) {
      res.set(
        "Cache-Control",
        "no-store"
      );
      return res
        .status(410)
        .send(EXPIRED_PAGE_HTML);
    }

    const sessionId = createSession(
      {
        userId: redemption.userId,
        moduleName:
          redemption.module,
        providerToken:
          redemption.providerToken
      }
    );

    const redirectTarget =
      new URL(
        next,
        `${UPSTREAM_ORIGIN}/`
      );

    redirectTarget.searchParams.set(
      "token",
      redemption.providerToken
    );

    res.cookie(
      SESSION_COOKIE_NAME,
      sessionId,
      {
        httpOnly: true,
        secure: IS_SECURE_ORIGIN,
        sameSite: "strict",
        path: "/"
      }
    );

    return res
      .status(302)
      .redirect(
        redirectTarget.pathname +
          redirectTarget.search
      );
  }
);

/* -------------------------------------------------- */
/* 会话门 + CSRF + 白名单                             */
/* -------------------------------------------------- */

app.use((req, res, next) => {
  const cookieHeader = String(
    req.headers.cookie || ""
  );

  let sessionId = "";

  for (
    const part of cookieHeader.split(
      ";"
    )
  ) {
    const [
      name,
      ...rest
    ] = part.trim().split("=");

    if (
      name === SESSION_COOKIE_NAME
    ) {
      sessionId =
        rest.join("=");
      break;
    }
  }

  const session =
    getSession(sessionId);

  if (!session) {
    res.set(
      "Cache-Control",
      "no-store"
    );
    return res
      .status(302)
      .redirect(
        "/__harson/expired.html"
      );
  }

  req.harsonGatewaySession =
    session;

  return next();
});

app.use((req, res, next) => {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return next();
  }

  const fetchSite = String(
    req.headers["sec-fetch-site"] ||
      ""
  );

  if (
    fetchSite &&
    fetchSite !== "same-origin" &&
    fetchSite !== "same-site" &&
    fetchSite !== "none"
  ) {
    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });
  }

  return next();
});

app.use(async (req, res, next) => {
  let prefixes = [];

  try {
    prefixes =
      await getAllowedPrefixes();
  } catch (error) {
    console.error(
      "[gateway] 白名单加载失败:",
      error.message
    );
  }

  if (prefixes.length === 0) {
    return res.status(503).json({
      success: false,
      message:
        "上游路由白名单暂不可用"
    });
  }

  const requestPath = req.path;

  const allowed = prefixes.some(
    prefix =>
      requestPath === prefix ||
      requestPath.startsWith(
        `${prefix}/`
      ) ||
      requestPath.startsWith(
        `${prefix}?`
      )
  );

  if (!allowed) {
    return res.status(404).end();
  }

  return next();
});

/* -------------------------------------------------- */
/* 代理 + HTML 注入（injectImageTabAssets）           */
/* -------------------------------------------------- */

function isHtmlResponse(headers) {
  const contentType = String(
    headers["content-type"] || ""
  );

  return contentType
    .toLowerCase()
    .includes("text/html");
}

function isUtf8OrUnspecified(headers) {
  const contentType = String(
    headers["content-type"] || ""
  ).toLowerCase();

  return (
    !contentType.includes(
      "charset"
    ) ||
    contentType.includes(
      "charset=utf-8"
    )
  );
}

function decodeBuffer(
  buffer,
  encoding
) {
  const normalized = String(
    encoding || ""
  ).toLowerCase();

  if (
    normalized === "gzip" ||
    normalized === "x-gzip"
  ) {
    return zlib.gunzipSync(
      buffer
    );
  }

  if (
    normalized === "deflate"
  ) {
    return zlib.inflateSync(
      buffer
    );
  }

  if (
    normalized === "br"
  ) {
    return zlib.brotliDecompressSync(
      buffer
    );
  }

  return buffer;
}

function copyResponseHeaders(
  proxyRes,
  overrides
) {
  const headers = {
    ...proxyRes.headers
  };

  delete headers[
    "content-length"
  ];

  delete headers[
    "transfer-encoding"
  ];

  return {
    ...headers,
    ...overrides
  };
}

function rewriteLocationHeader(
  proxyRes
) {
  if (!PUBLIC_ORIGIN) {
    return;
  }

  const location =
    proxyRes.headers.location;

  if (typeof location === "string") {
    proxyRes.headers.location =
      location.split(
        UPSTREAM_ORIGIN
      ).join(PUBLIC_ORIGIN);
  }
}

async function handleProxyResponse(
  proxyRes,
  req,
  res
) {
  rewriteLocationHeader(
    proxyRes
  );

  const contentType = String(
    proxyRes.headers[
      "content-type"
    ] || ""
  );

  const isJson =
    contentType
      .toLowerCase()
      .includes(
        "application/json"
      );

  const session =
    req.harsonGatewaySession ||
    {};

  const shouldInject =
    imageAliasesEnabled() &&
    session.moduleName ===
      "image-generator" &&
    isHtmlResponse(
      proxyRes.headers
    ) &&
    isUtf8OrUnspecified(
      proxyRes.headers
    );

  if (shouldInject) {
    const chunks = [];

    proxyRes.on(
      "data",
      chunk =>
        chunks.push(chunk)
    );

    proxyRes.on(
      "end",
      () => {
        try {
          const raw = Buffer.concat(
            chunks
          );

          const decoded =
            decodeBuffer(
              raw,
              proxyRes
                .headers[
                "content-encoding"
              ]
            ).toString("utf8");

          const injected =
            injectImageTabAssets(
              decoded,
              {
                enabled: true,
                moduleName:
                  session.moduleName,
                contentType
              }
            );

          const body = Buffer.from(
            injected,
            "utf8"
          );

          const headers =
            copyResponseHeaders(
              proxyRes,
              {
                "content-type":
                  "text/html; charset=utf-8",
                "cache-control":
                  "no-store"
              }
            );

          delete headers[
            "content-encoding"
          ];

          headers[
            "content-length"
          ] = String(
            body.length
          );

          res.writeHead(
            proxyRes.statusCode,
            headers
          );

          res.end(body);
        } catch (error) {
          console.error(
            "[gateway] HTML 注入失败，原样返回:",
            error.message
          );

          const raw = Buffer.concat(
            chunks
          );

          const headers =
            copyResponseHeaders(
              proxyRes,
              {
                "content-length":
                  String(
                    raw.length
                  ),
                "cache-control":
                  "no-store"
              }
            );

          res.writeHead(
            proxyRes.statusCode,
            headers
          );

          res.end(raw);
        }
      }
    );

    proxyRes.on(
      "error",
      () => {
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      }
    );

    return;
  }

  const overrides = {};

  if (
    isJson ||
    isHtmlResponse(
      proxyRes.headers
    )
  ) {
    overrides[
      "cache-control"
    ] = "no-store";
  }

  res.writeHead(
    proxyRes.statusCode,
    copyResponseHeaders(
      proxyRes,
      overrides
    )
  );

  proxyRes.pipe(res);
}

function handleProxyError(
  err,
  req,
  res
) {
  console.error(
    "[gateway] 上游代理错误:",
    err.message
  );

  if (
    res &&
    !res.headersSent
  ) {
    res.status(502).json({
      success: false,
      message:
        "上游服务暂不可用，请稍后重试"
    });
  }
}

app.use(
  "/",
  createProxyMiddleware({
    target: UPSTREAM_ORIGIN,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    ws: true,
    cookieDomainRewrite: "",
    selfHandleResponse: true,
    on: {
      proxyRes:
        handleProxyResponse,
      error: handleProxyError
    }
  })
);

app.listen(PORT, () => {
  console.log(
    `HARSON gateway running on port ${PORT} -> ${UPSTREAM_ORIGIN}`
  );
});
