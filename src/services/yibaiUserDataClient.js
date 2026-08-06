"use strict";

const DEFAULT_HOST =
  "https://cl-base.yibaiaigc.com";

const DEFAULT_TIMEOUT_MS =
  10000;

function getHost() {
  return String(
    process.env.YIBAI_USER_DATA_HOST ||
    process.env.YIBAI_AIGC_HOST ||
    DEFAULT_HOST
  ).replace(
    /\/+$/,
    ""
  );
}

function getTimeoutMs() {
  const configuredTimeout =
    Number(
      process.env
        .YIBAI_USER_DATA_TIMEOUT_MS ||
      process.env
        .YIBAI_AIGC_TIMEOUT_MS
    );

  if (
    Number.isFinite(
      configuredTimeout
    ) &&
    configuredTimeout > 0
  ) {
    return configuredTimeout;
  }

  return DEFAULT_TIMEOUT_MS;
}

function requireText(
  value,
  fieldName
) {
  const normalizedValue =
    String(
      value || ""
    ).trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

function normalizePageSize(
  value,
  fallback = 100
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const numericValue =
    Number(value);

  if (
    !Number.isInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    throw new Error(
      "pageSize 必须是正整数"
    );
  }

  return numericValue;
}

/**
 * 调用 YiBai 用户端接口。
 *
 * /user/member/login 和
 * /user/member/loginByToken
 * 不携带 Access-Token-User。
 *
 * 其他 /user/* 接口必须携带
 * Access-Token-User。
 */
async function postJson(
  pathname,
  {
    body = {},
    userToken = "",
    requiresAuth = false
  } = {}
) {
  if (
    typeof fetch !== "function"
  ) {
    throw new Error(
      "当前 Node.js 版本不支持 fetch，请使用 Node.js 18 或更高版本"
    );
  }

  const headers = {
    Accept:
      "application/json",

    "Content-Type":
      "application/json"
  };

  if (requiresAuth) {
    headers[
      "Access-Token-User"
    ] = requireText(
      userToken,
      "用户端 Token"
    );
  }

  const timeoutMs =
    getTimeoutMs();

  const startedAt =
    Date.now();

  console.info(
    `[用户端] 请求开始：POST ${pathname}`
  );

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    const response =
      await fetch(
        `${getHost()}${pathname}`,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify(
              body || {}
            ),

          signal:
            controller.signal
        }
      );

    const responseText =
      await response.text();

    let responseBody = {};

    try {
      responseBody =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};
    } catch {
      throw new Error(
        `用户端接口 ${pathname} 返回了无法解析的响应，HTTP 状态码：${response.status}`
      );
    }

    console.info(
      `[用户端] 请求完成：POST ${pathname}`,
      {
        durationMs:
          Date.now() -
          startedAt,

        httpStatus:
          response.status,

        responseCode:
          responseBody?.code ??
          null,

        success:
          responseBody?.success ===
          true
      }
    );

    return {
      ...responseBody,

      httpStatus:
        response.status
    };
  } catch (error) {
    if (
      error.name ===
      "AbortError"
    ) {
      console.warn(
        `[用户端] 请求超时：POST ${pathname}`,
        {
          durationMs:
            Date.now() -
            startedAt,

          timeoutMs
        }
      );

      throw new Error(
        `用户端接口 ${pathname} 超时（${timeoutMs} 毫秒）`
      );
    }

    console.warn(
      `[用户端] 请求失败：POST ${pathname}`,
      {
        durationMs:
          Date.now() -
          startedAt,

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
      `无法连接用户端接口 ${pathname}`
    );
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

/**
 * 用户端账号密码登录。
 *
 * 这里只提供调用能力。
 * 当前阶段不会自动调用，避免影响
 * 正在使用的 Workspace 管理端 Session。
 */
async function login(
  account,
  password
) {
  return postJson(
    "/user/member/login",
    {
      body: {
        account:
          requireText(
            account,
            "YiBai 用户端账号"
          ),

        password:
          requireText(
            password,
            "YiBai 用户端密码"
          )
      }
    }
  );
}

/**
 * 使用已有用户端 Token 获取最新会员信息。
 *
 * Token 放在请求体中，
 * 不放 Access-Token-User 请求头。
 */
async function loginByToken(
  userToken
) {
  return postJson(
    "/user/member/loginByToken",
    {
      body: {
        token:
          requireText(
            userToken,
            "用户端 Token"
          )
      }
    }
  );
}

async function memberWithChildren(
  userToken
) {
  return postJson(
    "/user/member/memberWithChildren",
    {
      userToken,
      requiresAuth: true,
      body: {}
    }
  );
}

async function selectAllRecharge(
  userToken,
  {
    datePay = "",
    pageSize = 100
  } = {}
) {
  const body = {
    pageSize:
      normalizePageSize(
        pageSize
      )
  };

  if (
    String(datePay || "").trim()
  ) {
    body.datePay =
      String(datePay).trim();
  }

  return postJson(
    "/user/shop/selectAllRecharge",
    {
      userToken,
      requiresAuth: true,
      body
    }
  );
}

async function selectAllTaskByCompany(
  userToken,
  {
    dateEnd = "",
    pageSize = 100
  } = {}
) {
  const body = {
    pageSize:
      normalizePageSize(
        pageSize
      )
  };

  if (
    String(dateEnd || "").trim()
  ) {
    body.dateEnd =
      String(dateEnd).trim();
  }

  return postJson(
    "/user/task/selectAllTaskByCompany",
    {
      userToken,
      requiresAuth: true,
      body
    }
  );
}

module.exports = {
  login,
  loginByToken,
  memberWithChildren,
  selectAllRecharge,
  selectAllTaskByCompany
};
