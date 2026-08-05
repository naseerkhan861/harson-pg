"use strict";

const aigcAccountModel = require(
  "../models/aigcAccountCsvModel"
);

const masterOwnerModel = require(
  "../models/aigcMasterOwnerCsvModel"
);

const masterProviderConfigModel = require(
  "../models/aigcMasterProviderConfigCsvModel"
);

const masterTokenCacheModel = require(
  "../models/aigcMasterTokenCacheCsvModel"
);

const activeSessionModel = require(
  "../models/aigcActiveSessionCsvModel"
);

const credentialCrypto = require(
  "../utils/yibaiCredentialCrypto"
);

const yibaiAigcClient = require(
  "./yibaiAigcClient"
);

/**
 * 防止同一个内部企业主账号被多个请求同时执行：
 *
 * - token 验证；
 * - 账号密码登录；
 * - 共享 token 注销。
 *
 * 当前锁只适用于单个 Node.js 服务器进程。
 */
const masterAccountLocks = new Map();

function requireText(
  value,
  fieldName
) {
  const normalizedValue =
    String(value || "").trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
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

function getResponseMessage(
  response,
  fallbackMessage
) {
  return String(
    response?.message ||
    fallbackMessage
  );
}

function readTokenBalance(
  memberResult,
  providerConfig
) {
  /*
   * 管理端 /api/member/loginByToken
   * 返回多个余额字段。
   *
   * Workspace 与 iframe 当前展示的是：
   * - balance
   * - companyBalance
   *
   * mpoint 和 companyMpoint 在当前接口中
   * 可能为 0，不能优先于 balance。
   *
   * 用户数据接口 /user/member/*
   * 仍由后续独立 Client 处理，
   * 不替代这里的管理端 Session 接口。
   */
  const configuredField =
    String(
      providerConfig?.pointsField ||
      ""
    ).trim();

    console.log("YiBai 余额字段检查：", {
  balance: memberResult?.balance,
  rightBalance: memberResult?.rightBalance,
  totalBalance: memberResult?.totalBalance,
  companyBalance: memberResult?.companyBalance,
  mpoint: memberResult?.mpoint,
  companyMpoint: memberResult?.companyMpoint,
  configuredField
});

  const candidates = [
    {
      field: "balance",
      value: memberResult?.balance
    },

    {
      field: "companyBalance",
      value:
        memberResult?.companyBalance
    },

    {
      field: "mpoint",
      value: memberResult?.mpoint
    },

    {
      field: "companyMpoint",
      value:
        memberResult?.companyMpoint
    },

    ...(configuredField
      ? [
          {
            field:
              configuredField,

            value:
              memberResult?.[
                configuredField
              ]
          }
        ]
      : [])
  ];

  const selectedBalance =
    candidates.find(
      candidate => {
        if (
          candidate.value === null ||
          candidate.value ===
            undefined ||
          candidate.value === ""
        ) {
          return false;
        }

        const numericValue =
          Number(
            candidate.value
          );

        return (
          Number.isFinite(
            numericValue
          ) &&
          numericValue >= 0
        );
      }
    );

  if (!selectedBalance) {
    console.warn(
      "YiBai 管理端响应中没有有效余额字段"
    );

    return {
      pointsField: null,
      tokenBalance: null
    };
  }

    const selectedField =
    selectedBalance.field;

  const baseBalance =
    Number(
      selectedBalance.value
    );

  const rawRightBalance =
    memberResult?.rightBalance;

  const rightBalance =
    rawRightBalance === null ||
    rawRightBalance === undefined ||
    rawRightBalance === ""
      ? 0
      : Number(rawRightBalance);

  const includesRightBalance =
    (
      selectedField === "balance" ||
      selectedField === "companyBalance"
    ) &&
    Number.isFinite(rightBalance) &&
    rightBalance >= 0;

    return {
    pointsField:
      includesRightBalance
        ? `${selectedField}+rightBalance`
        : selectedField,

    tokenBalance:
      baseBalance +
      (
        includesRightBalance
          ? rightBalance
          : 0
      ),

    accountTokenBalance:
      baseBalance,

    bonusTokenBalance:
      includesRightBalance
        ? rightBalance
        : 0
  };
}


/**
 * 同一个内部企业主账号在同一时间
 * 只执行一个登录态相关任务。
 *
 * 新任务会等待同一主账号的上一个任务完成，
 * 防止登录、刷新和注销发生竞争。
 */
function withMasterAccountLock(
  masterAccountId,
  task
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const previousTask =
    masterAccountLocks.get(
      normalizedMasterAccountId
    ) || Promise.resolve();

  const currentTask =
    previousTask
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (
          masterAccountLocks.get(
            normalizedMasterAccountId
          ) === currentTask
        ) {
          masterAccountLocks.delete(
            normalizedMasterAccountId
          );
        }
      });

  masterAccountLocks.set(
    normalizedMasterAccountId,
    currentTask
  );

  return currentTask;
}

/**
 * 解析当前用户的完整账号关系：
 *
 * 普通用户：
 * Harson-Base 用户 → AIGC 子账号 → 企业主账号
 *
 * 企业负责人：
 * Harson-Base 用户 → 主账号负责人绑定 → 企业主账号
 *
 * 最后都通过该主账号的 YiBai 外部账号
 * 获取 Workspace 共享会话。
 *
 * 这里只解析关系，不解密 YiBai 密码。
 * 只有必须重新登录时才解密密码。
 */
function resolveUserAccount(
  clBaseUserId
) {
  const normalizedUserId =
    requireText(
      clBaseUserId,
      "Harson-Base用户ID"
    );

  let mappingData =
    aigcAccountModel.getMyMapping(
      normalizedUserId
    );

  let accountType =
    "sub_account";

  let ownerMapping = null;

  if (!mappingData?.mapping) {
    ownerMapping =
      masterOwnerModel
        .getActiveMappingByUserId(
          normalizedUserId
        );

    if (!ownerMapping) {
      throw new Error(
        "当前 Harson-Base 账号尚未购买服务"
      );
    }

    const ownerMasterAccount =
      aigcAccountModel
        .getMasterAccountById(
          ownerMapping
            .masterAccountId
        );

    mappingData = {
      mapping: null,

      aigcSubAccount: {
        id:
          `master-owner:${ownerMapping.masterAccountId}`,

        masterAccountId:
          ownerMapping.masterAccountId,

        subAccountName:
          "企业主账号负责人",

        status: "active"
      },

      masterAccount:
        ownerMasterAccount
    };

    accountType =
      "master_owner";
  }

  const subAccount =
    mappingData.aigcSubAccount;

  if (
    !subAccount ||
    subAccount.status !== "active"
  ) {
    throw new Error(
      "当前映射的内部 AIGC 子账号不存在或已停用"
    );
  }

  const masterAccount =
    mappingData.masterAccount;

  if (
    !masterAccount ||
    masterAccount.status !== "active"
  ) {
    throw new Error(
      "当前 AIGC 子账号所属的企业主账号不存在或已停用"
    );
  }

  /*
   * 防止 CSV 中出现不一致关系：
   *
   * 子账号所属主账号必须与映射记录
   * 和查询到的主账号一致。
   */
  if (
    String(
      subAccount.masterAccountId || ""
    ) !==
      String(masterAccount.id) ||
    (
      accountType ===
        "sub_account" &&
      String(
        mappingData.mapping
          ?.masterAccountId || ""
      ) !==
        String(masterAccount.id)
    )
  ) {
    throw new Error(
      "AIGC 子账号、企业主账号和用户映射关系不一致"
    );
  }

  const providerConfig =
    masterProviderConfigModel
      .getProviderConfigByMasterAccountId(
        masterAccount.id
      );

  if (!providerConfig) {
    throw new Error(
      "当前 AIGC 企业主账号尚未绑定 YiBai 外部账号"
    );
  }

  if (
    providerConfig.status &&
    providerConfig.status !== "active"
  ) {
    throw new Error(
      "当前企业主账号的 YiBai 外部账号绑定已停用"
    );
  }

  return {
    clBaseUserId:
      normalizedUserId,

    accountType,

    ownerMapping,

    mapping:
      mappingData.mapping,

    subAccount,

    masterAccount,

    providerConfig
  };
}

/**
 * 只有必须重新登录 YiBai 时，
 * 才解密该企业保存的外部账号密码。
 */
function decryptProviderPassword(
  accountContext
) {
  const {
    masterAccount,
    providerConfig
  } = accountContext;

  return credentialCrypto
    .decryptProviderPassword({
      masterAccountId:
        masterAccount.id,

      providerAccount:
        providerConfig
          .providerAccount,

      encryptionVersion:
        providerConfig
          .encryptionVersion,

      encryptedPassword:
        providerConfig
          .encryptedPassword,

      passwordIv:
        providerConfig
          .passwordIv,

      passwordAuthTag:
        providerConfig
          .passwordAuthTag
    });
}

/**
 * 用户成功获得可用 YiBai token 后，
 * 将其记录为当前共享登录态的活跃用户。
 */
function markUserSessionActive(
  accountContext
) {
  activeSessionModel
    .markSessionActive({
      clBaseUserId:
        accountContext.clBaseUserId,

      aigcSubAccountId:
        accountContext
          .subAccount.id,

      masterAccountId:
        accountContext
          .masterAccount.id
    });
}

/**
 * 使用 YiBai 账号密码登录，
 * 并将 token 保存到企业主账号级缓存。
 */
async function loginAndCacheToken(
  accountContext
) {
  const {
    subAccount,
    masterAccount,
    providerConfig
  } = accountContext;

  const providerPassword =
    decryptProviderPassword(
      accountContext
    );

  const loginResult =
    await yibaiAigcClient.login(
      providerConfig.providerAccount,
      providerPassword
    );

  if (
    !isSuccessfulResponse(
      loginResult
    )
  ) {
    throw new Error(
      getResponseMessage(
        loginResult,
        "YiBai AIGC 登录失败"
      )
    );
  }

  const token =
    String(
      loginResult.result?.token ||
      ""
    ).trim();

  if (!token) {
    throw new Error(
      "YiBai AIGC 登录成功，但响应中没有 token"
    );
  }

  const balanceData =
    readTokenBalance(
      loginResult.result,
      providerConfig
    );

  masterTokenCacheModel
    .upsertTokenCache({
      masterAccountId:
        masterAccount.id,

      providerAccount:
        providerConfig
          .providerAccount,

      token
    });

  markUserSessionActive(
    accountContext
  );

  return {
    token,

    source: "login",

    tokenBalance:
      balanceData.tokenBalance,

    pointsField:
      balanceData.pointsField,

    aigcSubAccountId:
      subAccount.id,

    masterAccountId:
      masterAccount.id,

    providerAccount:
      providerConfig
        .providerAccount
  };
}

/**
 * 获取当前普通用户可用的 YiBai token。
 *
 * 流程：
 *
 * 1. 查询用户与内部子账号映射；
 * 2. 根据子账号找到企业主账号；
 * 3. 查询企业主账号的 YiBai 绑定；
 * 4. 查询企业主账号级 token 缓存；
 * 5. 缓存存在时调用 loginByToken；
 * 6. token 无效时重新账号密码登录；
 * 7. 保存 token，并记录当前用户为 active。
 */
async function getValidTokenForUser(
  clBaseUserId,
  options = {}
) {
  const forceRefresh =
    options.forceRefresh === true;

  const accountContext =
    resolveUserAccount(
      clBaseUserId
    );

  const masterAccountId =
    accountContext
      .masterAccount.id;

  const providerAccount =
    accountContext
      .providerConfig
      .providerAccount;

  return withMasterAccountLock(
    masterAccountId,
    async () => {
      if (forceRefresh) {
        masterTokenCacheModel
          .removeTokenCache(
            masterAccountId
          );

        return loginAndCacheToken(
          accountContext
        );
      }

      let cachedToken = null;

      try {
        cachedToken =
          masterTokenCacheModel
            .getTokenCache(
              masterAccountId
            );
      } catch (error) {
        /*
         * 加密密钥发生变化或缓存损坏时，
         * 删除旧缓存并重新登录。
         *
         * 不输出 token 内容。
         */
        console.warn(
          "企业主账号 token 缓存读取失败，将重新登录：",
          error.message
        );

        masterTokenCacheModel
          .removeTokenCache(
            masterAccountId
          );
      }

      /*
       * 如果管理员更换了该主账号绑定的
       * YiBai 账号，旧账号 token 不能继续使用。
       */
      if (
        cachedToken &&
        cachedToken.providerAccount !==
          providerAccount
      ) {
        masterTokenCacheModel
          .removeTokenCache(
            masterAccountId
          );

        cachedToken = null;
      }

      if (cachedToken?.token) {
        const validationResult =
          await yibaiAigcClient
            .loginByToken(
              cachedToken.token
            );

        if (
          isSuccessfulResponse(
            validationResult
          )
        ) {
          /*
           * 文档通常返回原 token，
           * 但这里兼容服务端返回更新后的 token。
           */
          const validatedToken =
            String(
              validationResult
                .result?.token ||
              cachedToken.token
            ).trim();

          if (!validatedToken) {
            throw new Error(
              "YiBai token 验证成功，但响应中没有可用 token"
            );
          }

          if (
            validatedToken !==
            cachedToken.token
          ) {
            masterTokenCacheModel
              .upsertTokenCache({
                masterAccountId,

                providerAccount,

                token:
                  validatedToken
              });
          } else {
            masterTokenCacheModel
              .touchTokenCache(
                masterAccountId
              );
          }

          markUserSessionActive(
            accountContext
          );

          const balanceData =
            readTokenBalance(
              validationResult.result,
              accountContext
                .providerConfig
            );

          return {
            token:
              validatedToken,

            source: "cache",

            tokenBalance:
              balanceData.tokenBalance,

            pointsField:
              balanceData.pointsField,

            aigcSubAccountId:
              accountContext
                .subAccount.id,

            masterAccountId,

            providerAccount
          };
        }

        /*
         * loginByToken 验证失败，
         * 删除旧缓存后重新账号密码登录。
         */
        masterTokenCacheModel
          .removeTokenCache(
            masterAccountId
          );
      }

      return loginAndCacheToken(
        accountContext
      );
    }
  );
}

/**
 * 手动刷新或 iframe 通知登录失效时：
 *
 * 1. 优先使用企业主账号缓存 token 调用 loginByToken；
 * 2. loginByToken 成功时读取最新余额；
 * 3. token 无效时删除旧缓存并重新账号密码登录。
 *
 * 不再无条件创建新 token，
 * 避免影响同一企业共享登录态中的其他用户。
 */
async function refreshTokenForUser(
  clBaseUserId
) {
  return getValidTokenForUser(
    clBaseUserId
  );
}

/**
 * Harson-Base 用户注销时：
 *
 * 1. 将当前用户标记为 logged_out；
 * 2. 检查同一个企业共享 token 下是否仍有 active 用户；
 * 3. 仍有 active 用户时保留 token；
 * 4. 没有 active 用户时调用 YiBai logout；
 * 5. YiBai logout 成功后清除本地 token 和会话记录。
 *
 * 此函数不清除 Harson-Base Cookie，
 * Cookie 仍由 authController 负责。
 */

/**
 * 使用现有 Workspace 缓存 Token
 * 只读查询 YiBai 最新余额。
 *
 * 不会重新进行账号密码登录，
 * 不会删除或覆盖缓存 Token。
 */
async function getCachedTokenBalanceForUser(
  clBaseUserId
) {
  const accountContext =
    resolveUserAccount(
      clBaseUserId
    );

  const masterAccountId =
    accountContext
      .masterAccount
      .id;

  const providerAccount =
    accountContext
      .providerConfig
      .providerAccount;

  return withMasterAccountLock(
    masterAccountId,
    async () => {
      let cachedToken = null;

      try {
        cachedToken =
          masterTokenCacheModel
            .getTokenCache(
              masterAccountId
            );
      } catch {
        return {
          success: false,
          available: false,
          reason: "token_cache_unreadable",
          tokenBalance: null,
          message:
            "Workspace Token 缓存暂不可用"
        };
      }

      if (!cachedToken?.token) {
        return {
          success: false,
          available: false,
          reason: "token_missing",
          tokenBalance: null,
          message:
            "当前没有可用的 Workspace Token"
        };
      }

      if (
        cachedToken.providerAccount !==
        providerAccount
      ) {
        return {
          success: false,
          available: false,
          reason:
            "provider_account_changed",
          tokenBalance: null,
          message:
            "YiBai 外部账号已变更"
        };
      }

      const validationResult =
        await yibaiAigcClient
          .loginByToken(
            cachedToken.token
          );

      if (
        !isSuccessfulResponse(
          validationResult
        )
      ) {
        return {
          success: false,
          available: false,

          reason:
            Number(
              validationResult?.code
            ) === 601
              ? "token_expired"
              : "token_invalid",

          tokenBalance: null,

          message:
            getResponseMessage(
              validationResult,
              "Workspace Token 当前不可用"
            )
        };
      }

      const balanceData =
        readTokenBalance(
          validationResult.result,
          accountContext
            .providerConfig
        );

        return {
        success: true,
        available: true,

        tokenBalance:
          balanceData.tokenBalance,

        accountTokenBalance:
          balanceData.accountTokenBalance,

        bonusTokenBalance:
          balanceData.bonusTokenBalance,

        pointsField:
          balanceData.pointsField,

        masterAccountId
      };
    }
  );
}


async function logoutUserAigcSession(
  clBaseUserId
) {
  const normalizedUserId =
    requireText(
      clBaseUserId,
      "Harson-Base用户ID"
    );

  const existingSession =
    activeSessionModel
      .getSessionByUserId(
        normalizedUserId
      );

  if (!existingSession) {
    return {
      success: true,
      action: "no_session",
      message:
        "当前用户没有 AIGC 活跃登录记录"
    };
  }

  const masterAccountId =
    requireText(
      existingSession
        .masterAccountId,
      "AIGC企业主账号ID"
    );

  return withMasterAccountLock(
    masterAccountId,
    async () => {
      activeSessionModel
        .markSessionLoggedOut(
          normalizedUserId
        );

      const remainingActiveSessions =
        activeSessionModel
          .listActiveSessionsByMasterAccountId(
            masterAccountId
          );

      if (
        remainingActiveSessions.length > 0
      ) {
        return {
          success: true,
          action: "token_retained",
          masterAccountId,
          remainingActiveUsers:
            remainingActiveSessions.length,
          message:
            "仍有其他 Harson-Base 用户使用该共享 AIGC 登录态，已保留 token"
        };
      }

      let cachedToken = null;

      try {
        cachedToken =
          masterTokenCacheModel
            .getTokenCache(
              masterAccountId
            );
      } catch (error) {
        console.warn(
          "注销时读取企业主账号 token 缓存失败，将清理本地缓存：",
          error.message
        );

        masterTokenCacheModel
          .removeTokenCache(
            masterAccountId
          );

        activeSessionModel
          .removeSessionsByMasterAccountId(
            masterAccountId
          );

        return {
          success: true,
          action:
            "local_cache_removed",
          masterAccountId,
          message:
            "共享用户已全部注销，本地损坏的 AIGC token 缓存已清理"
        };
      }

      if (!cachedToken?.token) {
        activeSessionModel
          .removeSessionsByMasterAccountId(
            masterAccountId
          );

        return {
          success: true,
          action: "no_token",
          masterAccountId,
          message:
            "共享用户已全部注销，本地没有需要注销的 AIGC token"
        };
      }

      const logoutResult =
        await yibaiAigcClient.logout(
          cachedToken.token
        );

      if (
        !isSuccessfulResponse(
          logoutResult
        )
      ) {
        return {
          success: false,
          action:
            "provider_logout_failed",
          masterAccountId,
          message:
            getResponseMessage(
              logoutResult,
              "YiBai AIGC 注销失败"
            )
        };
      }

      masterTokenCacheModel
        .removeTokenCache(
          masterAccountId
        );

      activeSessionModel
        .removeSessionsByMasterAccountId(
          masterAccountId
        );

      return {
        success: true,
        action: "provider_logged_out",
        masterAccountId,
        remainingActiveUsers: 0,
        message:
          "共享用户已全部注销，YiBai token 已失效并从本地缓存移除"
      };
    }
  );
}

module.exports = {
  getValidTokenForUser,
  refreshTokenForUser,
  logoutUserAigcSession,
  getCachedTokenBalanceForUser
};
