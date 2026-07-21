"use strict";

const aigcAccountModel = require(
  "../models/aigcAccountCsvModel"
);

const masterProviderConfigModel =
  require(
    "../models/aigcMasterProviderConfigCsvModel"
  );

const masterTokenCacheModel =
  require(
    "../models/aigcMasterTokenCacheCsvModel"
  );

const credentialCrypto = require(
  "../utils/yibaiCredentialCrypto"
);

const yibaiAigcClient = require(
  "./yibaiAigcClient"
);

/**
 * 防止同一个内部企业主账号同时发生：
 *
 * 绑定
 * 重新绑定
 * 点数同步
 *
 * 当前锁适用于单个 Node.js 进程。
 */
const masterAccountLocks =
  new Map();

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

function normalizePointsField(
  value
) {
  const normalizedValue =
    String(
      value ||
      "companyMpoint"
    ).trim();

  if (
    normalizedValue !==
      "companyMpoint" &&
    normalizedValue !== "mpoint"
  ) {
    throw new Error(
      "YiBai点数字段只能是 companyMpoint 或 mpoint"
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

function withMasterAccountLock(
  masterAccountId,
  task
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const existingTask =
    masterAccountLocks.get(
      normalizedMasterAccountId
    );

  if (existingTask) {
    return existingTask;
  }

  const currentTask =
    Promise.resolve()
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
 * 从 YiBai 登录结果中提取：
 *
 * token
 * 企业点数
 * 企业信息
 *
 * token 只用于后端缓存，
 * 不会进入管理员 API 响应。
 */
function extractProviderSession({
  loginResponse,
  pointsField
}) {
  const result =
    loginResponse?.result || {};

  const token =
    requireText(
      result.token,
      "YiBai登录token"
    );

  const rawCredits =
    result[pointsField];

  if (
    rawCredits === undefined ||
    rawCredits === null ||
    rawCredits === ""
  ) {
    throw new Error(
      `YiBai登录响应中缺少点数字段：${pointsField}`
    );
  }

  const syncedTotalCredits =
    Number(rawCredits);

  if (
    !Number.isFinite(
      syncedTotalCredits
    ) ||
    syncedTotalCredits < 0
  ) {
    throw new Error(
      `YiBai返回的 ${pointsField} 不是有效的非负数字`
    );
  }

  return {
    token,

    syncedTotalCredits,

    providerCompanyId:
      String(
        result.companyId || ""
      ).trim(),

    providerCompanyName:
      String(
        result.companyName || ""
      ).trim(),

    providerMemberId:
      String(
        result.id || ""
      ).trim(),

    providerMemberName:
      String(
        result.memberName || ""
      ).trim()
  };
}

function buildSafeResult({
  binding,
  creditSync,
  providerAccount,
  pointsField,
  providerSession
}) {
  return {
    binding,

    master: {
      masterAccountId:
        binding.masterAccountId,

      previousTotalCredits:
        creditSync
          .previousTotalCredits,

      syncedTotalCredits:
        creditSync
          .syncedTotalCredits,

      allocatedTokens:
        creditSync.allocatedTokens,

      availableForAllocation:
        creditSync
          .availableForAllocation
    },

    provider: {
      providerAccount,

      pointsField,

      syncedTotalCredits:
        providerSession
          .syncedTotalCredits,

      providerCompanyId:
        providerSession
          .providerCompanyId,

      providerCompanyName:
        providerSession
          .providerCompanyName,

      providerMemberId:
        providerSession
          .providerMemberId,

      providerMemberName:
        providerSession
          .providerMemberName
    },

    tokenReceived: true
  };
}

/**
 * 读取旧 token 缓存。
 *
 * 缓存损坏时不阻止管理员重新绑定；
 * 后续成功登录会覆盖它。
 */
function readPreviousTokenCache(
  masterAccountId
) {
  try {
    return (
      masterTokenCacheModel
        .getTokenCache(
          masterAccountId
        )
    );
  } catch (error) {
    console.warn(
      "读取旧 YiBai token 缓存失败，后续将重新生成缓存：",
      error.message
    );

    return null;
  }
}

/**
 * 恢复绑定操作前的外部账号配置。
 *
 * 仅在绑定事务后续步骤失败时调用。
 */
function restorePreviousBinding({
  masterAccountId,
  previousConfig
}) {
  if (!previousConfig) {
    masterProviderConfigModel
      .disableMasterProviderConfig(
        masterAccountId
      );

    return;
  }

  masterProviderConfigModel
    .upsertMasterProviderConfig({
      masterAccountId:
        previousConfig
          .masterAccountId,

      providerAccount:
        previousConfig
          .providerAccount,

      encryptionVersion:
        previousConfig
          .encryptionVersion,

      encryptedPassword:
        previousConfig
          .encryptedPassword,

      passwordIv:
        previousConfig.passwordIv,

      passwordAuthTag:
        previousConfig
          .passwordAuthTag,

      pointsField:
        previousConfig.pointsField
    });

  masterProviderConfigModel
    .updateProviderSyncSnapshot({
      masterAccountId:
        previousConfig
          .masterAccountId,

      syncedTotalCredits:
        Number(
          previousConfig
            .syncedTotalCredits || 0
        ),

      providerCompanyId:
        previousConfig
          .providerCompanyId || "",

      providerCompanyName:
        previousConfig
          .providerCompanyName || ""
    });
}

/**
 * 绑定失败时恢复旧 token。
 *
 * 若此次登录的是同一个 YiBai 账号，
 * 旧 token 可能已经被新登录作废，
 * 因此不能恢复旧 token，只能删除缓存。
 *
 * 若此次尝试登录的是另一个 YiBai 账号，
 * 则旧账号 token 通常仍可保留。
 */
function restorePreviousToken({
  masterAccountId,
  previousConfig,
  previousTokenCache,
  attemptedProviderAccount
}) {
  const previousProviderAccount =
    previousConfig
      ?.providerAccount || "";

  const attemptedSameProvider =
    previousProviderAccount &&
    previousProviderAccount ===
      attemptedProviderAccount;

  if (
    previousTokenCache?.token &&
    !attemptedSameProvider
  ) {
    masterTokenCacheModel
      .upsertTokenCache({
        masterAccountId,

        providerAccount:
          previousTokenCache
            .providerAccount,

        token:
          previousTokenCache.token
      });

    return;
  }

  masterTokenCacheModel
    .removeTokenCache(
      masterAccountId
    );
}

/**
 * 管理员通过网页提交真实账号密码。
 *
 * 正式顺序：
 *
 * 1. 调用 YiBai login 验证账号密码；
 * 2. 登录成功后提取 token 和点数；
 * 3. 加密密码；
 * 4. 保存主账号绑定；
 * 5. 同步内部企业主账号总点数；
 * 6. 保存主账号级 token；
 * 7. 保存外部企业和点数快照。
 *
 * 任一步失败会尽可能恢复修改前状态。
 */
async function bindMasterProviderAndSync({
  masterAccountId,
  providerAccount,
  providerPassword,
  pointsField
}) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const normalizedProviderAccount =
    requireText(
      providerAccount,
      "YiBai外部账号"
    );

  const normalizedProviderPassword =
    requireText(
      providerPassword,
      "YiBai登录密码"
    );

  const normalizedPointsField =
    normalizePointsField(
      pointsField
    );

  return withMasterAccountLock(
    normalizedMasterAccountId,
    async () => {
      const previousConfig =
        masterProviderConfigModel
          .getProviderConfigByMasterAccountId(
            normalizedMasterAccountId
          );

      const previousTokenCache =
        readPreviousTokenCache(
          normalizedMasterAccountId
        );

      let providerAuthenticated =
        false;

      let bindingWritten =
        false;

      let creditSync = null;

      try {
        /*
         * 必须先向 YiBai 验证真实账号密码。
         * 验证失败时不会保存任何绑定。
         */
        const loginResponse =
          await yibaiAigcClient.login(
            normalizedProviderAccount,
            normalizedProviderPassword
          );

        if (
          !isSuccessfulResponse(
            loginResponse
          )
        ) {
          throw new Error(
            getResponseMessage(
              loginResponse,
              "YiBai账号或密码验证失败"
            )
          );
        }

        providerAuthenticated =
          true;

        const providerSession =
          extractProviderSession({
            loginResponse,
            pointsField:
              normalizedPointsField
          });

        const encryptedCredential =
          credentialCrypto
            .encryptProviderPassword({
              masterAccountId:
                normalizedMasterAccountId,

              providerAccount:
                normalizedProviderAccount,

              password:
                normalizedProviderPassword
            });

        masterProviderConfigModel
          .upsertMasterProviderConfig({
            masterAccountId:
              normalizedMasterAccountId,

            providerAccount:
              normalizedProviderAccount,

            pointsField:
              normalizedPointsField,

            ...encryptedCredential
          });

        bindingWritten = true;

        creditSync =
          await Promise.resolve(
            aigcAccountModel
              .syncMasterTotalCredits({
                masterAccountId:
                  normalizedMasterAccountId,

                totalCredits:
                  providerSession
                    .syncedTotalCredits
              })
          );

        /*
         * 账号密码登录可能令旧 token 失效，
         * 因此必须保存本次返回的新 token。
         */
        masterTokenCacheModel
          .upsertTokenCache({
            masterAccountId:
              normalizedMasterAccountId,

            providerAccount:
              normalizedProviderAccount,

            token:
              providerSession.token
          });

        const binding =
          masterProviderConfigModel
            .updateProviderSyncSnapshot({
              masterAccountId:
                normalizedMasterAccountId,

              syncedTotalCredits:
                providerSession
                  .syncedTotalCredits,

              providerCompanyId:
                providerSession
                  .providerCompanyId,

              providerCompanyName:
                providerSession
                  .providerCompanyName
            });

        return buildSafeResult({
          binding,
          creditSync,

          providerAccount:
            normalizedProviderAccount,

          pointsField:
            normalizedPointsField,

          providerSession
        });
      } catch (error) {
        /*
         * 登录成功后，旧 token 可能已经失效。
         * 无论后续哪一步失败，都不能保留
         * 当前失败事务产生的新 token 状态。
         */
        if (
          providerAuthenticated
        ) {
          try {
            restorePreviousToken({
              masterAccountId:
                normalizedMasterAccountId,

              previousConfig,

              previousTokenCache,

              attemptedProviderAccount:
                normalizedProviderAccount
            });
          } catch (
            rollbackError
          ) {
            console.error(
              "回滚 YiBai token 缓存失败：",
              rollbackError.message
            );
          }
        }

        if (creditSync) {
          try {
            await Promise.resolve(
              aigcAccountModel
                .syncMasterTotalCredits({
                  masterAccountId:
                    normalizedMasterAccountId,

                  totalCredits:
                    creditSync
                      .previousTotalCredits
                })
            );
          } catch (
            rollbackError
          ) {
            console.error(
              "回滚企业主账号总点数失败：",
              rollbackError.message
            );
          }
        }

        if (bindingWritten) {
          try {
            restorePreviousBinding({
              masterAccountId:
                normalizedMasterAccountId,

              previousConfig
            });
          } catch (
            rollbackError
          ) {
            console.error(
              "回滚 YiBai 账号绑定失败：",
              rollbackError.message
            );
          }
        }

        throw error;
      }
    }
  );
}

/**
 * 使用已加密保存的密码重新登录 YiBai，
 * 同步点数并更新共享 token。
 */
async function syncBoundMasterProvider(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  return withMasterAccountLock(
    normalizedMasterAccountId,
    async () => {
      const providerConfig =
        masterProviderConfigModel
          .getProviderConfigByMasterAccountId(
            normalizedMasterAccountId
          );

      if (!providerConfig) {
        throw new Error(
          "当前企业主账号尚未绑定 YiBai 外部账号"
        );
      }

      const providerAccount =
        requireText(
          providerConfig
            .providerAccount,
          "YiBai外部账号"
        );

      const pointsField =
        normalizePointsField(
          providerConfig.pointsField
        );

      const providerPassword =
        credentialCrypto
          .decryptProviderPassword({
            masterAccountId:
              normalizedMasterAccountId,

            providerAccount,

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

      let providerAuthenticated =
        false;

      let creditSync = null;

      try {
        const loginResponse =
          await yibaiAigcClient.login(
            providerAccount,
            providerPassword
          );

        if (
          !isSuccessfulResponse(
            loginResponse
          )
        ) {
          throw new Error(
            getResponseMessage(
              loginResponse,
              "YiBai账号重新登录失败"
            )
          );
        }

        providerAuthenticated =
          true;

        const providerSession =
          extractProviderSession({
            loginResponse,
            pointsField
          });

        creditSync =
          await Promise.resolve(
            aigcAccountModel
              .syncMasterTotalCredits({
                masterAccountId:
                  normalizedMasterAccountId,

                totalCredits:
                  providerSession
                    .syncedTotalCredits
              })
          );

        masterTokenCacheModel
          .upsertTokenCache({
            masterAccountId:
              normalizedMasterAccountId,

            providerAccount,

            token:
              providerSession.token
          });

        const binding =
          masterProviderConfigModel
            .updateProviderSyncSnapshot({
              masterAccountId:
                normalizedMasterAccountId,

              syncedTotalCredits:
                providerSession
                  .syncedTotalCredits,

              providerCompanyId:
                providerSession
                  .providerCompanyId,

              providerCompanyName:
                providerSession
                  .providerCompanyName
            });

        return buildSafeResult({
          binding,
          creditSync,
          providerAccount,
          pointsField,
          providerSession
        });
      } catch (error) {
        /*
         * 同一 YiBai 账号再次账号密码登录后，
         * 旧 token 可能已经失效。
         *
         * 后续写入失败时直接删除缓存，
         * 避免继续使用可能已失效的旧 token。
         */
        if (
          providerAuthenticated
        ) {
          try {
            masterTokenCacheModel
              .removeTokenCache(
                normalizedMasterAccountId
              );
          } catch (
            rollbackError
          ) {
            console.error(
              "清理失效 YiBai token 缓存失败：",
              rollbackError.message
            );
          }
        }

        if (creditSync) {
          try {
            await Promise.resolve(
              aigcAccountModel
                .syncMasterTotalCredits({
                  masterAccountId:
                    normalizedMasterAccountId,

                  totalCredits:
                    creditSync
                      .previousTotalCredits
                })
            );
          } catch (
            rollbackError
          ) {
            console.error(
              "回滚企业主账号总点数失败：",
              rollbackError.message
            );
          }
        }

        throw error;
      }
    }
  );
}

function listMasterProviderBindings() {
  return masterProviderConfigModel
    .listMasterProviderConfigs();
}

module.exports = {
  bindMasterProviderAndSync,
  syncBoundMasterProvider,
  listMasterProviderBindings
};