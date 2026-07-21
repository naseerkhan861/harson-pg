"use strict";

const aigcSessionService = require(
  "../services/aigcSessionService"
);

const DEFAULT_HOST =
  "https://cl-base.yibaiaigc.com";

const MODULE_PATHS = Object.freeze({
  "image-generator": "/aigc/image-generator",
  upscaler: "/aigc/upscaler",
  "video-generator": "/aigc/video-generator",
  "pattern-design": "/aigc/pattern-design",
  "prompt-generator": "/aigc/prompt-generator",
  clothing: "/aigc/clothing",
  "e-commerce": "/aigc/e-commerce"
});

function getHost() {
  return String(
    process.env.YIBAI_AIGC_HOST ||
    DEFAULT_HOST
  ).replace(/\/+$/, "");
}

function isMockEnabled() {
  return (
    String(
      process.env.YIBAI_AIGC_MOCK || "false"
    ).toLowerCase() === "true"
  );
}

function resolveModule(moduleName) {
  const normalizedModule = String(
    moduleName || "image-generator"
  ).trim();

  if (!MODULE_PATHS[normalizedModule]) {
    throw new Error("不支持的 AIGC 功能模块");
  }

  return normalizedModule;
}

/**
 * 生成 yibaiaigc iframe 地址。
 *
 * token 只放在 iframe URL 中，不单独返回给前端。
 */
function buildFrameUrl({
  moduleName,
  token
}) {
  const normalizedModule =
    resolveModule(moduleName);

  const url = new URL(
    MODULE_PATHS[normalizedModule],
    `${getHost()}/`
  );

  url.searchParams.set("embed", "2");
  url.searchParams.set("token", token);

  return {
    moduleName: normalizedModule,
    frameUrl: url.toString()
  };
}

function getErrorStatus(error) {
  const message = String(
    error?.message || ""
  );

  if (
    message.includes("尚未配置") ||
    message.includes("不存在或已停用")
  ) {
    return 403;
  }

  if (
    message.includes("无法连接") ||
    message.includes("超时") ||
    message.includes("yibaiaigc 登录失败")
  ) {
    return 502;
  }

  return 400;
}

/**
 * GET /api/aigc/session
 */
async function getSession(req, res) {
  try {
    const moduleName =
      resolveModule(req.query.module);

    const session =
      await aigcSessionService
        .getValidTokenForUser(req.user.id);

    const frameData = buildFrameUrl({
      moduleName,
      token: session.token
    });

    return res.json({
      success: true,
      message: "AIGC session 获取成功",
      result: {
        module: frameData.moduleName,
        frameUrl: frameData.frameUrl,
        mockMode: isMockEnabled(),
        tokenSource: session.source,
        aigcSubAccountId:
          session.aigcSubAccountId,
        providerAccount:
          session.providerAccount
      }
    });
  } catch (error) {
    return res
      .status(getErrorStatus(error))
      .json({
        success: false,
        message:
          error.message ||
          "AIGC session 获取失败"
      });
  }
}

/**
 * POST /api/aigc/session/refresh
 *
 * iframe 通知 token 失效时调用。
 */
async function refreshSession(req, res) {
  try {
    const moduleName =
      resolveModule(
        req.body?.module ||
        req.query?.module
      );

    const session =
      await aigcSessionService
        .refreshTokenForUser(req.user.id);

    const frameData = buildFrameUrl({
      moduleName,
      token: session.token
    });

    return res.json({
      success: true,
      message: "AIGC session 已刷新",
      result: {
        module: frameData.moduleName,
        frameUrl: frameData.frameUrl,
        mockMode: isMockEnabled(),
        tokenSource: session.source,
        aigcSubAccountId:
          session.aigcSubAccountId,
        providerAccount:
          session.providerAccount
      }
    });
  } catch (error) {
    return res
      .status(getErrorStatus(error))
      .json({
        success: false,
        message:
          error.message ||
          "AIGC session 刷新失败"
      });
  }
}

module.exports = {
  getSession,
  refreshSession
};