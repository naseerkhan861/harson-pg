"use strict";

const aigcSessionService = require(
  "../services/aigcSessionService"
);

const yibaiAigcClient = require(
  "../services/yibaiAigcClient"
);

const DEFAULT_HOST =
  "https://cl-base.yibaiaigc.com";

const MODULE_DEFINITIONS = Object.freeze({
  "image-generator": {
    menuName: "图片创作"
  },

  upscaler: {
    menuName: "高清放大"
  },

  "video-generator": {
    menuName: "视频创作"
  },

  "pattern-design": {
    menuName: "AI图案设计"
  },

  "prompt-generator": {
    menuName: "提示词生成"
  },

  clothing: {
    menuName: "AI服装"
  },

  "e-commerce": {
    menuName: "AI电商"
  }
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
    !MODULE_DEFINITIONS[
      normalizedModule
    ]
  ) {
    throw new Error(
      "不支持的 AIGC 功能模块"
    );
  }

  return normalizedModule;
}

function normalizeMenuName(
  value
) {
  return String(
    value || ""
  ).replace(
    /\s+/g,
    ""
  );
}

function isSuccessfulResponse(
  response
) {
  return Boolean(
    response &&
    response.success === true &&
    Number(response.code) === 200
  );
}

/**
 * 根据 YiBai 当前菜单列表解析模块入口。
 *
 * 按菜单名称匹配而不是继续使用写死的路径，
 * 因此 YiBai 调整 routerUrl 后 Harson 无需同步改路径。
 */
async function resolveModuleRouterUrl(
  moduleName
) {
  const normalizedModule =
    resolveModule(
      moduleName
    );

  const definition =
    MODULE_DEFINITIONS[
      normalizedModule
    ];

  const menuResponse =
    await yibaiAigcClient
      .selectAllEmbedMenu();

  if (
    !isSuccessfulResponse(
      menuResponse
    )
  ) {
    throw new Error(
      `CL-AIGC 菜单读取失败：${String(
        menuResponse?.message ||
        "未知错误"
      )}`
    );
  }

  if (
    !Array.isArray(
      menuResponse.result
    )
  ) {
    throw new Error(
      `CL-AIGC 菜单返回格式无效`
    );
  }

  const expectedMenuName =
    normalizeMenuName(
      definition.menuName
    );

  const matchedMenu =
    menuResponse.result.find(
      menu =>
        normalizeMenuName(
          menu?.name
        ) ===
        expectedMenuName
    );

  const routerUrl =
    String(
      matchedMenu?.routerUrl ||
      ""
    ).trim();

  if (!routerUrl) {
    throw new Error(
      `“${definition.menuName}”入口暂不可用，请稍后再试或联系管理员`
    );
  }

  return {
    moduleName:
      normalizedModule,

    menuName:
      definition.menuName,

    routerUrl
  };
}

/**
 * 生成 YiBai iframe 地址，并限制入口必须属于配置的 YiBai 域名。
 *
 * token 只放在 iframe URL 中，
 * 不作为独立字段返回给前端。
 */
async function buildFrameUrl({
  moduleName,
  token
}) {
  const moduleRoute =
    await resolveModuleRouterUrl(
      moduleName
    );

  const hostUrl =
    new URL(
      `${getHost()}/`
    );

  const routerUrl =
    moduleRoute.routerUrl;

  if (
    !routerUrl.startsWith("/") ||
    routerUrl.startsWith("//")
  ) {
    throw new Error(
      `“${moduleRoute.menuName}”入口地址无效，请联系管理员`
    );
  }

  const url =
    new URL(
      routerUrl,
      hostUrl
    );

  if (
    url.origin !==
    hostUrl.origin
  ) {
    throw new Error(
      `“${moduleRoute.menuName}”入口地址无效，请联系管理员`
    );
  }

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
      moduleRoute.moduleName,

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
      "CL-AIGC 登录失败"
    ) ||
    message.includes(
      "cl-aigc 登录失败"
    ) ||
    message.includes(
      "菜单读取失败"
    ) ||
    message.includes(
      "菜单返回格式无效"
    ) ||
    message.includes(
      "入口地址无效"
    ) ||
    message.includes(
      "无法解析"
    )
  ) {
    return 502;
  }

  if (
    message.includes(
      "入口暂不可用"
    )
  ) {
    return 503;
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
      await buildFrameUrl({
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
 * GET /api/aigc/session/token-balance
 *
 * 使用现有 Workspace Token
 * 只读查询 YiBai 最新余额。
 *
 * 不会重新进行账号密码登录。
 */
async function getTokenBalance(
  req,
  res
) {
  try {
    const result =
      await aigcSessionService
        .getCachedTokenBalanceForUser(
          req.user.id
        );

    return res.json({
      success: true,

      message:
        result.available
          ? "AIGC Token 余额读取成功"
          : result.message,

      result
    });
  } catch (error) {
    console.error(
      "读取 AIGC Token 余额失败：",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error?.message ||
          "AIGC Token 余额读取失败"
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
      await buildFrameUrl({
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
  refreshSession,
  getTokenBalance
};