"use strict";

const DEFAULT_HOST = "https://cl-base.yibaiaigc.com";
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * 判断当前是否使用模拟接口。
 *
 * YIBAI_AIGC_MOCK=true：
 * 不请求真实服务器，用于提前测试本地流程。
 *
 * YIBAI_AIGC_MOCK=false：
 * 请求真实的 yibaiaigc 测试环境。
 */
function isMockEnabled() {
  return String(process.env.YIBAI_AIGC_MOCK || "false").toLowerCase() === "true";
}

/**
 * 获取 yibaiaigc 服务地址，并移除地址末尾多余的斜杠。
 */
function getHost() {
  return String(process.env.YIBAI_AIGC_HOST || DEFAULT_HOST).replace(/\/+$/, "");
}

/**
 * 获取请求超时时间。
 */
function getTimeoutMs() {
  const configuredTimeout = Number(process.env.YIBAI_AIGC_TIMEOUT_MS);

  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }

  return DEFAULT_TIMEOUT_MS;
}

/**
 * 检查必填字符串参数。
 */
function requireText(value, fieldName) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName}不能为空`);
  }

  return normalizedValue;
}

/**
 * 读取 Mock 数值配置。
 */
function getMockNumber(envKey, fallbackValue) {
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

    memberName:
      String(memberName || "Mock Member"),

    companyName:
      String(
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
 * 向 yibaiaigc 发送 POST JSON 请求。
 *
 * 注意：
 * - 不在日志中打印密码或 token；
 * - 接口返回 code=400 时仍然返回响应体；
 * - 只有网络错误、超时或非法响应才抛出异常。
 */
async function postJson(pathname, options = {}) {
  if (typeof fetch !== "function") {
    throw new Error(
      "当前 Node.js 版本不支持 fetch，请使用 Node.js 18 或更高版本"
    );
  }

  const host = getHost();
  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${host}${pathname}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: JSON.stringify(options.body || {}),
      signal: controller.signal
    });

    const responseText = await response.text();

    let responseBody;

    try {
      responseBody = responseText
        ? JSON.parse(responseText)
        : {};
    } catch (error) {
      throw new Error(
        `yibaiaigc 返回了无法解析的响应，HTTP 状态码：${response.status}`
      );
    }

    return {
      ...responseBody,
      httpStatus: response.status
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`连接 yibaiaigc 超时，超过 ${timeoutMs} 毫秒`);
    }

    if (
      error.message.includes("无法解析") ||
      error.message.includes("不支持 fetch")
    ) {
      throw error;
    }

    throw new Error("无法连接 yibaiaigc 服务");
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
 * 模拟 token 验证。
 *
 * 使用 mock-expired-token 可以模拟 token 失效。
 */
function mockLoginByToken(token) {
  if (token === "mock-expired-token") {
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
 * 使用 yibaiaigc 账号密码登录。
 */
async function login(account, password) {
  const normalizedAccount = requireText(account, "AIGC账号");
  const normalizedPassword = requireText(password, "AIGC密码");

  if (isMockEnabled()) {
    return mockLogin(normalizedAccount);
  }

  return postJson("/api/member/login", {
    body: {
      account: normalizedAccount,
      password: normalizedPassword
    }
  });
}

/**
 * 验证已有的 yibaiaigc token。
 */
async function loginByToken(token) {
  const normalizedToken = requireText(token, "AIGC token");

  if (isMockEnabled()) {
    return mockLoginByToken(normalizedToken);
  }

  return postJson("/api/member/loginByToken", {
    body: {
      token: normalizedToken
    }
  });
}

/**
 * 注销 yibaiaigc token。
 */
async function logout(token) {
  const normalizedToken = requireText(token, "AIGC token");

  if (isMockEnabled()) {
    return mockLogout();
  }

  return postJson("/api/member/logout", {
    headers: {
      "Access-Token-Api": normalizedToken
    },
    body: {}
  });
}

module.exports = {
  login,
  loginByToken,
  logout
};