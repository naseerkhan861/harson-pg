"use strict";

/*
  app ↔ gateway 内部接口（compose 网络内调用）。

  挂载在 /api/aigc/internal（见 server.js，注册于 /api/aigc
  限流之前），仅供网关容器访问：

  - POST /frame-ticket/redeem  赎回一次性启动票据
  - GET  /gateway/routes       网关代理允许的模块路由前缀

  所有请求必须携带 x-harson-internal-secret，且服务端配置了
  HARSON_INTERNAL_API_SECRET 才会放行；秘密不会出现在日志中。
  生产环境 nginx 应对公网屏蔽 /api/aigc/internal/。
*/

const express = require("express");
const rateLimit = require("express-rate-limit");
const aigcFrameTicketService = require(
  "../services/aigcFrameTicketService"
);
const aigcSessionController = require(
  "../controllers/aigcSessionController"
);

const ROUTES_CACHE_MS = 10 * 60 * 1000;

const router = express.Router();

function requireInternalSecret(
  req,
  res,
  next
) {
  const expected = String(
    process.env.HARSON_INTERNAL_API_SECRET ||
      ""
  );

  const provided = String(
    req.get("x-harson-internal-secret") ||
      ""
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

  return next();
}

router.use(requireInternalSecret);

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: {
      success: false,
      message:
        "Too many requests. Please try again later."
    }
  })
);

router.post(
  "/frame-ticket/redeem",
  (req, res) => {
    const redeemed =
      aigcFrameTicketService.redeemTicket(
        req.body?.ticket
      );

    if (!redeemed) {
      return res.status(410).json({
        success: false,
        message:
          "票据无效、已使用或已过期"
      });
    }

    return res.json({
      success: true,
      result: redeemed
    });
  }
);

let routesCache = {
  at: 0,
  routes: null,
  errors: []
};

router.get(
  "/gateway/routes",
  async (req, res) => {
    try {
      if (
        routesCache.routes &&
        Date.now() - routesCache.at <
          ROUTES_CACHE_MS
      ) {
        return res.json({
          success: true,
          result: {
            routes: routesCache.routes,
            errors: routesCache.errors
          }
        });
      }

      const routes = [];
      const errors = [];

      const moduleKeys =
        aigcSessionController
          .MODULE_DEFINITIONS_KEYS;

      for (const moduleKey of moduleKeys) {
        try {
          const moduleRoute =
            await aigcSessionController.resolveModuleRouterUrl(
              moduleKey
            );

          const routerUrl = String(
            moduleRoute?.routerUrl || ""
          ).trim();

          if (routerUrl) {
            routes.push({
              module: moduleKey,
              routerUrl
            });
          }
        } catch (error) {
          errors.push(moduleKey);
        }
      }

      routesCache = {
        at: Date.now(),
        routes,
        errors
      };

      return res.json({
        success: true,
        result: { routes, errors }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;
