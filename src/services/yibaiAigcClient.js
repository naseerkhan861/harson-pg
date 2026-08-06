"use strict";

const DEFAULT_HOST = "https://cl-base.yibaiaigc.com";
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * 判断当前是否使用模拟接口。
 */
function isMockEnabled() {
  return String(
    process.env.YIBAI_AIGC_MOCK || "false"
  ).toLowerCase() === "true";
}

/**
 * 获取 YiBai 服务地址。
 * 正式环境会优先使用 .env 中的 YIBAI_AIGC_HOST。
 */
function getHost() {
  return String(
    process.env.YIBAI_AIGC_HOST ||
    DEFAULT_HOST
  ).replace(/\/+$/, "");
}

/**
 * 获取请求超时时间。
 */
function getTimeoutMs() {
  const configuredTimeout = Number(
    process.env.YIBAI_AIGC_TIMEOUT_MS
  );

  if (
    Number.isFinite(configuredTimeout) &&
    configuredTimeout > 0
  ) {
    return configuredTimeout;
  }

  return DEFAULT_TIMEOUT_MS;
}

/**
 * 检查必填字符串参数。
 */
function requireText(value, fieldName) {
  const normalizedValue = String(
    value || ""
  ).trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

/**
 * 读取 Mock 数值配置。
 */
function getMockNumber(
  envKey,
  fallbackValue
) {
  const configuredValue = Number(
    process.env[envKey]
  );

  if (
    Number.isFinite(configuredValue) &&
    configuredValue >= 0
  ) {
    return configuredValue;
  }

  return fallbackValue;
}

/**
 * 构造与 YiBai 真实接口结构一致的
 * Mock 用户和企业数据。
 */
function buildMockMemberResult({
  token,
  memberName
}) {
  return {
    token,
    id: 10001,

    memberName: String(
      memberName || "Mock Member"
    ),

    companyName: String(
      process.env
        .YIBAI_AIGC_MOCK_COMPANY_NAME ||
      "HARSON Mock Enterprise"
    ),

    companyId: getMockNumber(
      "YIBAI_AIGC_MOCK_COMPANY_ID",
      10001
    ),

    mpoint: getMockNumber(
      "YIBAI_AIGC_MOCK_MPOINT",
      1000
    ),

    companyMpoint: getMockNumber(
      "YIBAI_AIGC_MOCK_COMPANY_MPOINT",
      5000
    ),

    platformAccess: 1
  };
}

/**
 * 向 YiBai 发送 POST JSON 请求。
 *
 * 注意：
 * - 不在日志中打印密码或 Token；
 * - 接口返回业务错误时仍然返回响应体；
 * - 只有网络错误、超时或非法响应才抛出异常。
 */
async function postJson(
  pathname,
  options = {}
) {
  if (typeof fetch !== "function") {
    throw new Error(
      "当前 Node.js 版本不支持 fetch，请使用 Node.js 18 或更高版本"
    );
  }

  const host = getHost();
  const timeoutMs = getTimeoutMs();
  const startedAt = Date.now();
  const controller =
    new AbortController();

  console.info(
    `[管理端] 请求开始：POST ${pathname}`
  );

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${host}${pathname}`,
      {
        method: "POST",

        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/json",

          ...(options.headers || {})
        },

        body: JSON.stringify(
          options.body || {}
        ),

        signal: controller.signal
      }
    );

    const responseText =
      await response.text();

    let responseBody;

    try {
      responseBody = responseText
        ? JSON.parse(responseText)
        : {};
    } catch (error) {
      throw new Error(
        `CL-AIGC 管理端接口 ${pathname} 返回了无法解析的响应，HTTP 状态码：${response.status}`
      );
    }

    console.info(
      `[CL-AIGC 管理端] 请求完成：POST ${pathname}`,
      {
        durationMs:
          Date.now() - startedAt,

        httpStatus:
          response.status,

        responseCode:
          responseBody?.code ?? null,

        success:
          responseBody?.success === true
      }
    );

    return {
      ...responseBody,
      httpStatus: response.status
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn(
        `[CL-AIGC 管理端] 请求超时：POST ${pathname}`,
        {
          durationMs:
            Date.now() - startedAt,

          timeoutMs
        }
      );

      throw new Error(
        `CL-AIGC 管理端接口 ${pathname} 超时（${timeoutMs} 毫秒）`
      );
    }

    console.warn(
      `[CL-AIGC 管理端] 请求失败：POST ${pathname}`,
      {
        durationMs:
          Date.now() - startedAt,

        message:
          error.message
      }
    );

    if (
      error.message.includes(
        "无法解析"
      ) ||
      error.message.includes(
        "不支持 fetch"
      )
    ) {
      throw error;
    }

    throw new Error(
      `无法连接 CL-AIGC 管理端接口 ${pathname}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 模拟账号密码登录。
 */
function mockLogin(account) {
  const token =
    `mock-token-${Date.now()}`;

  return {
    code: 200,
    success: true,
    message: "模拟登录成功",

    result: buildMockMemberResult({
      token,
      memberName: account
    }),

    httpStatus: 200
  };
}

/**
 * 模拟 Token 验证。
 *
 * 使用 mock-expired-token
 * 可以模拟 Token 失效。
 */
function mockLoginByToken(token) {
  if (
    token === "mock-expired-token"
  ) {
    return {
      code: 400,
      success: false,
      message: "token 无效",
      result: null,
      httpStatus: 200
    };
  }

  return {
    code: 200,
    success: true,
    message: "模拟 token 验证成功",

    result: buildMockMemberResult({
      token,
      memberName: "Mock Member"
    }),

    httpStatus: 200
  };
}

/**
 * 模拟退出登录。
 */
function mockLogout() {
  return {
    code: 200,
    success: true,
    message: "模拟退出成功",
    result: null,
    httpStatus: 200
  };
}

/**
 * 模拟可嵌入的 YiBai 一级菜单。
 */
function mockSelectAllEmbedMenu() {
  return {
    code: 200,
    success: true,
    message: "模拟菜单读取成功",

    result: [
      {
        id: 1,
        name: "图片创作",
        routerUrl:
          "/aigc/image-generator"
      },
      {
        id: 2,
        name: "高清放大",
        routerUrl:
          "/aigc/upscaler"
      },
      {
        id: 3,
        name: "视频创作",
        routerUrl:
          "/aigc/video-generator"
      },
      {
        id: 4,
        name: "AI图案设计",
        routerUrl:
          "/aigc/pattern-design"
      },
      {
        id: 5,
        name: "提示词生成",
        routerUrl:
          "/aigc/prompt-generator"
      },
      {
        id: 6,
        name: "AI服装",
        routerUrl:
          "/aigc/clothing"
      },
      {
        id: 7,
        name: "AI电商",
        routerUrl:
          "/aigc/e-commerce"
      }
    ],

    httpStatus: 200
  };
}

/**
 * 使用 YiBai 账号密码登录。
 */
async function login(
  account,
  password
) {
  const normalizedAccount =
    requireText(
      account,
      "AIGC账号"
    );

  const normalizedPassword =
    requireText(
      password,
      "AIGC密码"
    );

  if (isMockEnabled()) {
    return mockLogin(
      normalizedAccount
    );
  }

  return postJson(
    "/api/member/login",
    {
      body: {
        account:
          normalizedAccount,

        password:
          normalizedPassword
      }
    }
  );
}

/**
 * 验证已有的 YiBai Token。
 */
async function loginByToken(token) {
  const normalizedToken =
    requireText(
      token,
      "AIGC token"
    );

  if (isMockEnabled()) {
    return mockLoginByToken(
      normalizedToken
    );
  }

  return postJson(
    "/api/member/loginByToken",
    {
      body: {
        token: normalizedToken
      }
    }
  );
}

/**
 * 注销 YiBai Token。
 */
async function logout(token) {
  const normalizedToken =
    requireText(
      token,
      "AIGC token"
    );

  if (isMockEnabled()) {
    return mockLogout();
  }

  return postJson(
    "/api/member/logout",
    {
      headers: {
        "Access-Token-Api":
          normalizedToken
      },

      body: {}
    }
  );
}

/**
 * 获取当前可嵌入 Harson-Base 的
 * YiBai 一级菜单。
 *
 * 文档规定：
 * - 不需要认证；
 * - 不需要请求参数。
 */
async function selectAllEmbedMenu() {
  if (isMockEnabled()) {
    return mockSelectAllEmbedMenu();
  }

  return postJson(
    "/api/menu/selectAllEmbedMenu",
    {
      body: {}
    }
  );
}

module.exports = {
  login,
  loginByToken,
  logout,
  selectAllEmbedMenu
};
