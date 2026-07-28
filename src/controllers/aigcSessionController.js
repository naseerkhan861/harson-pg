"use strict";

const aigcSessionService = require(
  "../services/aigcSessionService"
);

const DEFAULT_HOST =
  "https://cl-base.yibaiaigc.com";

const MODULE_PATHS = Object.freeze({
  "image-generator":
    "/aigc/image-generator",

  upscaler:
    "/aigc/upscaler",

  "video-generator":
    "/aigc/video-generator",

  "pattern-design":
    "/aigc/pattern-design",

  "prompt-generator":
    "/aigc/prompt-generator",

  clothing:
    "/aigc/clothing",

  "e-commerce":
    "/aigc/e-commerce"
});

function getHost() {
  return String(
    process.env.YIBAI_AIGC_HOST ||
    DEFAULT_HOST
  ).replace(
    /\/+$/,
    ""
  );
}

function isMockEnabled() {
  return (
    String(
      process.env.YIBAI_AIGC_MOCK ||
      "false"
    ).toLowerCase() ===
    "true"
  );
}

function resolveModule(
  moduleName
) {
  const normalizedModule =
    String(
      moduleName ||
      "image-generator"
    ).trim();

  if (
    !MODULE_PATHS[
      normalizedModule
    ]
  ) {
    throw new Error(
      "不支持的 AIGC 功能模块"
    );
  }

  return normalizedModule;
}

/**
 * 生成 YiBai iframe 地址。
 *
 * token 只放在 iframe URL 中，
 * 不作为独立字段返回给前端。
 */
function buildFrameUrl({
  moduleName,
  token
}) {
  const normalizedModule =
    resolveModule(
      moduleName
    );

  const url =
    new URL(
      MODULE_PATHS[
        normalizedModule
      ],
      `${getHost()}/`
    );

  url.searchParams.set(
    "embed",
    "2"
  );

  url.searchParams.set(
    "token",
    token
  );

  return {
    moduleName:
      normalizedModule,

    frameUrl:
      url.toString()
  };
}

/**
 * 将 Service 返回的余额规范化。
 *
 * 有效余额返回数字；
 * 没有读取到余额时返回 null。
 */
function normalizeTokenBalance(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    return null;
  }

  return numericValue;
}

/**
 * 统一构造返回给前端的 Session 结果。
 *
 * 不向前端单独暴露 token。
 */
function buildSessionResult({
  frameData,
  session
}) {
  return {
    module:
      frameData.moduleName,

    frameUrl:
      frameData.frameUrl,

    mockMode:
      isMockEnabled(),

    tokenSource:
      session.source,

    tokenBalance:
      normalizeTokenBalance(
        session.tokenBalance
      ),

    pointsField:
      session.pointsField ||
      null,

    aigcSubAccountId:
      session.aigcSubAccountId,

    providerAccount:
      session.providerAccount
  };
}

function getErrorStatus(
  error
) {
  const message =
    String(
      error?.message ||
      ""
    );

  if (
    message.includes(
      "尚未配置"
    ) ||
    message.includes(
      "不存在或已停用"
    )
  ) {
    return 403;
  }

  if (
    message.includes(
      "无法连接"
    ) ||
    message.includes(
      "超时"
    ) ||
    message.includes(
      "YiBai AIGC 登录失败"
    ) ||
    message.includes(
      "yibaiaigc 登录失败"
    )
  ) {
    return 502;
  }

  return 400;
}

/**
 * GET /api/aigc/session
 *
 * 用于首次进入某个 AIGC 模块。
 */
async function getSession(
  req,
  res
) {
  try {
    const moduleName =
      resolveModule(
        req.query.module
      );

    const session =
      await aigcSessionService
        .getValidTokenForUser(
          req.user.id
        );

    const frameData =
      buildFrameUrl({
        moduleName,

        token:
          session.token
      });

    return res.json({
      success:
        true,

      message:
        "AIGC session 获取成功",

      result:
        buildSessionResult({
          frameData,
          session
        })
    });
  } catch (error) {
    console.error(
      "获取 AIGC session 失败：",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success:
          false,

        message:
          error?.message ||
          "AIGC session 获取失败"
      });
  }
}

/**
 * POST /api/aigc/session/refresh
 *
 * 用于：
 * - 用户手动点击刷新登录状态；
 * - iframe 通知 token 失效；
 * - 重新读取最新 Token 余额。
 */
async function refreshSession(
  req,
  res
) {
  try {
    const moduleName =
      resolveModule(
        req.body?.module ||
        req.query?.module
      );

    const session =
      await aigcSessionService
        .refreshTokenForUser(
          req.user.id
        );

    const frameData =
      buildFrameUrl({
        moduleName,

        token:
          session.token
      });

    return res.json({
      success:
        true,

      message:
        "AIGC session 已刷新",

      result:
        buildSessionResult({
          frameData,
          session
        })
    });
  } catch (error) {
    console.error(
      "刷新 AIGC session 失败：",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success:
          false,

        message:
          error?.message ||
          "AIGC session 刷新失败"
      });
  }
}

module.exports = {
  getSession,
  refreshSession
};