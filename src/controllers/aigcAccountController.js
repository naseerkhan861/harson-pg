const aigcAccountModel = require("../models/aigcAccountCsvModel");

const taskSnapshotModel = require(
  "../models/aigcTaskSnapshotCsvModel"
);
const userCsvModel = require("../models/userCsvModel");
const aigcMasterProviderService = require(
  "../services/aigcMasterProviderService"
);

const aigcUserDataService = require(
  "../services/aigcUserDataService"
);

async function dashboard(req, res) {
  try {
    return res.json({
      success: true,
      data: aigcAccountModel.listAdminData()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function aigcCenter(req, res) {
  try {
    return res.json({
      success: true,
      data: aigcAccountModel.listAigcCenterData()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function purchaseTokens(req, res) {
  try {
    const { masterAccountId, packageName, tokens, amount } = req.body;

    if (!masterAccountId) {
      return res.status(400).json({
        success: false,
        message: "请选择 AIGC 企业主账号"
      });
    }

    if (!packageName || !tokens) {
      return res.status(400).json({
        success: false,
        message: "请选择 token 套餐"
      });
    }

    const result = aigcAccountModel.purchaseTokens({
      masterAccountId,
      packageName,
      tokens,
      amount
    });

    return res.status(201).json({
      success: true,
      message: "token 套餐购买成功，AIGC 主账号总点数已更新",
      data: result
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function createMaster(req, res) {
  try {
    const { enterpriseName, platformName, platformLogin, platformPassword, totalCredits } = req.body;

    if (!enterpriseName || !platformName || !platformLogin || !platformPassword) {
      return res.status(400).json({
        success: false,
        message: "企业名称、AIGC 平台名称、登录邮箱和密码不能为空"
      });
    }

    const master = await aigcAccountModel.createMaster({
      enterpriseName,
      platformName,
      platformLogin,
      platformPassword,
      totalCredits
    });

    return res.status(201).json({
      success: true,
      message: "AIGC 企业主账号创建成功",
      data: master
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function createSubAccount(req, res) {
  try {
    const {
      masterAccountId,
      subAccountName,
      platformLogin,
      platformPassword,
      tokenLimit,
      warningThreshold
    } = req.body;

    if (!masterAccountId || !subAccountName || !platformLogin || !platformPassword) {
      return res.status(400).json({
        success: false,
        message: "企业主账号、子账号名称、登录邮箱和密码不能为空"
      });
    }

    const subAccount = await aigcAccountModel.createSubAccount({
      masterAccountId,
      subAccountName,
      platformLogin,
      platformPassword,
      tokenLimit,
      warningThreshold
    });

    return res.status(201).json({
      success: true,
      message: "AIGC 子账号创建成功",
      data: subAccount
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

function updateSubAccountTokenSettings(req, res) {
  try {
    const { subAccountId, tokenLimit, warningThreshold } = req.body;

    if (!subAccountId) {
      return res.status(400).json({
        success: false,
        message: "请选择需要调整的 AIGC 子账号"
      });
    }

    if (tokenLimit === undefined || tokenLimit === null || tokenLimit === "") {
      return res.status(400).json({
        success: false,
        message: "请输入新的 token 配额"
      });
    }

    const subAccount = aigcAccountModel.updateSubAccountTokenSettings({
      subAccountId,
      tokenLimit,
      warningThreshold
    });

    return res.json({
      success: true,
      message: "AIGC 子账号 token 配额设置已更新",
      data: subAccount
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function createMapping(req, res) {
  try {
    const { clBaseUserId, aigcSubAccountId } = req.body;

    if (!clBaseUserId || !aigcSubAccountId) {
      return res.status(400).json({
        success: false,
        message: "请选择 Harson-Base 用户和 AIGC 子账号"
      });
    }

    const users = await userCsvModel.listUsers();
    const user = users.find(item => item.id === clBaseUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "未找到对应的 Harson-Base 用户"
      });
    }

    const mapping = aigcAccountModel.createMapping({
      clBaseUserId,
      clBaseEmail: user.email,
      aigcSubAccountId
    });

    return res.status(201).json({
      success: true,
      message: "Harson-Base 与 AIGC 子账号一对一映射创建成功",
      data: mapping
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * 管理员查看：
 *
 * 内部 AIGC 企业主账号
 * → YiBai 外部账号
 *
 * 的全部绑定记录。
 */
function listMasterProviderBindings(
  req,
  res
) {
  try {
    const bindings =
      aigcMasterProviderService
        .listMasterProviderBindings();

    return res.json({
      success: true,
      data: bindings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}



async function bindMasterProvider(
  req,
  res
) {
  try {
    const {
      masterAccountId,
      providerAccount,
      providerPassword,
      pointsField
    } = req.body || {};

    const normalizedMasterAccountId =
      String(
        masterAccountId || ""
      ).trim();

    const normalizedProviderAccount =
      String(
        providerAccount || ""
      ).trim();

    /*
     * 密码不能写入日志，也不能放进响应。
     * 此处仅检查是否提交，真正的验证由
     * aigcMasterProviderService 调用 YiBai
     * 登录接口完成。
     */
    if (
      !normalizedMasterAccountId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "请选择内部 AIGC 企业主账号"
      });
    }

    if (
      !normalizedProviderAccount
    ) {
      return res.status(400).json({
        success: false,
        message:
          "请输入 YiBai 外部账号"
      });
    }

    if (
      typeof providerPassword !==
        "string" ||
      providerPassword.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "请输入 YiBai 登录密码"
      });
    }

    const result =
      await aigcMasterProviderService
        .bindMasterProviderAndSync({
          masterAccountId:
            normalizedMasterAccountId,

          providerAccount:
            normalizedProviderAccount,

          /*
           * 不要 trim 密码。
           * 密码中的空格可能属于真实密码。
           */
          providerPassword,

          pointsField:
            String(
              pointsField ||
              "companyMpoint"
            ).trim()
        });

    return res.status(201).json({
      success: true,

      message:
        "YiBai 账号验证成功，绑定、点数同步和登录缓存已完成",

      data: result
    });
  } catch (error) {
    /*
     * 这里只返回 Service 的安全错误信息。
     * 不返回 req.body，也不返回管理员输入的密码。
     */
    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "YiBai 账号绑定失败"
    });
  }
}

/**
 * 管理员对已经存在的绑定
 * 重新读取 YiBai 点数。
 */

/**
 * 管理员解除 Harson-Base 企业主账号
 * 与 YiBai 外部账号的绑定。
 */
async function unbindMasterProvider(
  req,
  res
) {
  try {
    const masterAccountId =
      String(
        req.params.masterAccountId ||
        ""
      ).trim();

    if (!masterAccountId) {
      return res.status(400).json({
        success: false,

        message:
          "AIGC 企业主账号 ID 不能为空"
      });
    }

    const result =
      await aigcMasterProviderService
        .unbindMasterProvider(
          masterAccountId
        );

    return res.json({
      success: true,

      message:
        "YiBai 外部账号已解绑，主账号和子账号点数已归零",

      data:
        result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "YiBai 外部账号解绑失败"
    });
  }
}


async function syncMasterProvider(
  req,
  res
) {
  try {
    const masterAccountId =
      String(
        req.params.masterAccountId || ""
      ).trim();

    if (!masterAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "AIGC 企业主账号 ID 不能为空"
      });
    }

    const result =
      await aigcMasterProviderService
        .syncBoundMasterProvider(
          masterAccountId
        );

    return res.json({
      success: true,
      message:
        "YiBai 外部账号点数同步成功",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}



/**
 * 管理员明确触发 YiBai 用户数据同步。
 *
 * 顺序：
 * 1. 建立用户端登录；
 * 2. 获取并保存真实任务快照；
 * 3. 重新建立管理端登录；
 * 4. 清除临时用户端 Token。
 *
 * 无论任务同步成功或失败，
 * 都会尝试恢复 Workspace 管理端 Session。
 */
async function syncMasterUserData(
  req,
  res
) {
  const masterAccountId =
    String(
      req.params.masterAccountId ||
      ""
    ).trim();

  if (!masterAccountId) {
    return res.status(400).json({
      success: false,

      message:
        "AIGC 企业主账号 ID 不能为空"
    });
  }

  let taskSyncResult = null;
  let taskSyncError = null;
  let workspaceRestoreError = null;

  try {
    taskSyncResult =
      await aigcUserDataService
        .syncCompanyTaskSnapshot(
          masterAccountId
        );
  } catch (error) {
    taskSyncError = error;
  }

  try {
    /*
     * 用户端登录可能影响管理端 Token，
     * 因此同步后重新建立管理端 Session。
     */
    await aigcMasterProviderService
      .syncBoundMasterProvider(
        masterAccountId
      );
  } catch (error) {
    workspaceRestoreError =
      error;
  } finally {
    try {
      /*
       * 管理端重新登录后，
       * 用户端 Token 很可能已经失效，
       * 不保留无效缓存。
       */
      aigcUserDataService
        .clearUserDataToken(
          masterAccountId
        );
    } catch (error) {
      console.warn(
        "清理 YiBai 用户端 Token 缓存失败：",
        error.message
      );
    }
  }

  if (workspaceRestoreError) {
    return res.status(500).json({
      success: false,

      message:
        taskSyncError
          ? `YiBai 用户数据同步失败，且 Workspace 登录状态恢复失败：${workspaceRestoreError.message}`
          : `真实创作记录已同步，但 Workspace 登录状态恢复失败：${workspaceRestoreError.message}`
    });
  }

  if (taskSyncError) {
    return res.status(400).json({
      success: false,

      message:
        `YiBai 用户数据同步失败：${taskSyncError.message}。Workspace 登录状态已恢复`
    });
  }

  return res.json({
    success: true,

    message:
      "YiBai 真实创作记录同步成功，Workspace 登录状态已恢复",

    data: {
      taskSync:
        taskSyncResult,

      workspaceRestored:
        true
    }
  });
}



/**
 * 当前 Harson-Base 用户
 * 明确点击“Token 明细”后，
 *“Token 明细”后，
 * 读取其所属企业的真实 Token 充值记录。
 *
 * 用户数据接口调用完成后，
 * 必须恢复 Workspace 管理端登录状态。
 */
async function getMyRechargeRecords(
  req,
  res
) {
  const mapping =
    aigcAccountModel
      .getMyMapping(
        req.user.id
      );

  const masterAccountId =
    String(
      mapping?.masterAccount?.id ||
      mapping?.mapping
        ?.masterAccountId ||
      ""
    ).trim();

  if (!masterAccountId) {
    return res.status(404).json({
      success: false,

      message:
        "当前 Harson-Base 账号尚未绑定可用的 AIGC 企业主账号"
    });
  }

  const datePay =
    String(
      req.query?.datePay || ""
    ).trim();

  const requestedPageSize =
    Number.parseInt(
      req.query?.pageSize,
      10
    );

  const pageSize =
    Number.isFinite(
      requestedPageSize
    )
      ? Math.min(
          Math.max(
            requestedPageSize,
            1
          ),
          100
        )
      : 100;

  let rechargeResult = null;
  let rechargeError = null;
  let workspaceRestoreError = null;

  try {
    rechargeResult =
      await aigcUserDataService
        .getRechargeRecords(
          masterAccountId,
          {
            datePay,
            pageSize,

            /*
             * 只有用户明确点击
             * Token 明细时才允许
             * 建立用户数据登录。
             */
            allowLogin: true
          }
        );
  } catch (error) {
    rechargeError = error;
  }

  try {
    /*
     * 用户数据登录可能导致
     * Workspace 管理端 Token 失效，
     * 因此读取完成后重新建立管理端登录。
     */
    await aigcMasterProviderService
      .syncBoundMasterProvider(
        masterAccountId
      );
  } catch (error) {
    workspaceRestoreError =
      error;
  } finally {
    try {
      /*
       * 管理端重新登录后，
       * 不保留可能已经失效的
       * Access-Token-User。
       */
      aigcUserDataService
        .clearUserDataToken(
          masterAccountId
        );
    } catch (error) {
      console.warn(
        "清理 YiBai 用户端 Token 缓存失败：",
        error.message
      );
    }
  }

  if (workspaceRestoreError) {
    return res.status(500).json({
      success: false,

      message:
        rechargeError
          ? `Token 明细读取失败，且 Workspace 登录状态恢复失败：${workspaceRestoreError.message}`
          : `Token 明细读取成功，但 Workspace 登录状态恢复失败：${workspaceRestoreError.message}`
    });
  }

  if (rechargeError) {
    return res.status(400).json({
      success: false,

      message:
        `CL-AIGC Token 明细读取失败：${rechargeError.message}。Workspace 登录状态已恢复`
    });
  }

  return res.json({
    success: true,

    message:
      "Token 明细读取成功，Workspace 登录状态已恢复",

    data: {
      summary:
        rechargeResult.summary,

      records:
        rechargeResult.records,

      workspaceRestored:
        true
    }
  });
}


async function listClBaseUsers(req, res) {
  try {
    const users = await userCsvModel.listUsers();
    const normalUsers = users.filter(user => user.role !== "admin");

    return res.json({ success: true, data: normalUsers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}


function toNumber(
  value,
  fallbackValue = 0
) {
  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : fallbackValue;
}

function buildRealTokenUsage(
  subAccount,
  taskSummary
) {
  const tokenLimit =
    Math.max(
      toNumber(
        subAccount?.tokenLimit,
        0
      ),
      0
    );

  const usedTokens =
    Math.max(
      toNumber(
        taskSummary
          ?.netUsedTokens,
        0
      ),
      0
    );

  const remainingTokens =
    tokenLimit > 0
      ? Math.max(
          tokenLimit -
          usedTokens,
          0
        )
      : 0;

  const usageRate =
    tokenLimit > 0
      ? Number(
          (
            usedTokens /
            tokenLimit *
            100
          ).toFixed(2)
        )
      : 0;

  const remainingRate =
    tokenLimit > 0
      ? Number(
          (
            remainingTokens /
            tokenLimit *
            100
          ).toFixed(2)
        )
      : 0;

  const warningThreshold =
    Math.max(
      toNumber(
        subAccount
          ?.warningThreshold,
        10
      ),
      0
    );

  let warningStatus =
    "normal";

  if (
    tokenLimit > 0 &&
    remainingTokens <= 0
  ) {
    warningStatus =
      "exceeded";
  } else if (
    tokenLimit > 0 &&
    remainingRate <=
      warningThreshold
  ) {
    warningStatus =
      "warning";
  }

  return {
    tokenLimit,
    usedTokens,
    remainingTokens,
    usageRate,
    remainingRate,
    warningThreshold,
    warningStatus
  };
}

function taskStatusLabel(
  status
) {
  if (status === "O") {
    return "成功";
  }

  if (status === "R") {
    return "失败";
  }

  return "处理中";
}

function toWorkspaceWork(
  task
) {
  return {
    id:
      task.providerTaskId,

    title:
      task.objectName ||
      "AIGC 创作任务",

    workType:
      task.object ||
      "AIGC",

    promptSummary:
      taskStatusLabel(
        task.status
      ),

    creditCost:
      task.netPoint,

    status:
      task.status,

    statusLabel:
      taskStatusLabel(
        task.status
      ),

    imageUrl:
      task.imageUrl,

    memberId:
      task.memberId,

    memberName:
      task.memberName,

    createdAt:
      task.dateEnd ||
      task.dateCreate ||
      task.syncedAt
  };
}

function myAigcWorkspace(
  req,
  res
) {
  try {
    const originalMapping =
      aigcAccountModel
        .getMyMapping(
          req.user.id
        );

    if (
      !originalMapping ||
      !originalMapping
        .aigcSubAccount
    ) {
      return res.json({
        success: true,

        data: {
          mapping:
            originalMapping,

          works: [],

          taskSummary: {
            totalTasks: 0,
            successfulTasks: 0,
            failedTasks: 0,
            processingTasks: 0,
            deductedTokens: 0,
            refundedTokens: 0,
            netUsedTokens: 0
          },

          taskSync: {
            status:
              "mapping_missing",

            memberId:
              null,

            latestSyncedAt:
              null,

            source:
              "yibai_snapshot"
          }
        }
      });
    }

    const masterAccountId =
      String(
        originalMapping
          .mapping
          ?.masterAccountId ||
        originalMapping
          .aigcSubAccount
          ?.masterAccountId ||
        originalMapping
          .masterAccount
          ?.id ||
        ""
      ).trim();

    const snapshot =
      taskSnapshotModel
        .listTaskSnapshotByIdentity({
          masterAccountId,

          identities: [
            originalMapping
              .aigcSubAccount
              ?.platformLogin,

            originalMapping
              .aigcSubAccount
              ?.subAccountName,

            originalMapping
              .mapping
              ?.clBaseEmail,

            req.user.email
          ]
        });

    const realTokenUsage =
      buildRealTokenUsage(
        originalMapping
          .aigcSubAccount,

        snapshot.summary
      );

    const mapping = {
      ...originalMapping,

      aigcSubAccount: {
        ...originalMapping
          .aigcSubAccount,

        ...realTokenUsage
      }
    };

    return res.json({
      success: true,

      data: {
        mapping,

        /*
         * 保留 works 字段，
         * 让现有前端直接显示真实任务，
         * 不再读取模拟 creative_works。
         */
        works:
          snapshot.tasks.map(
            toWorkspaceWork
          ),

        taskSummary:
          snapshot.summary,

        taskSync: {
          status:
            snapshot.status,

          memberId:
            snapshot.memberId,

          latestSyncedAt:
            snapshot
              .latestSyncedAt,

          source:
            "yibai_snapshot"
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message
    });
  }
}


function addMyWork(req, res) {
  try {
    const { title, workType, promptSummary, creditCost } = req.body;

    if (!title || !workType) {
      return res.status(400).json({
        success: false,
        message: "作品标题和作品类型不能为空"
      });
    }

    const result = aigcAccountModel.addMyWork({
      clBaseUserId: req.user.id,
      title,
      workType,
      promptSummary: promptSummary || "",
      creditCost: Number(creditCost || 0)
    });

    let message = "创作记录保存成功";

    if (result.tokenUsage.warningStatus === "warning") {
      message = `创作记录保存成功，提醒：当前 AIGC 子账号 token 使用率已达到 ${result.tokenUsage.usageRate}%`;
    }

    if (result.tokenUsage.warningStatus === "exceeded") {
      message = "创作记录保存成功，提醒：当前 AIGC 子账号已达到 token 上限";
    }

    return res.status(201).json({
      success: true,
      message,
      data: result.work,
      tokenUsage: result.tokenUsage
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = {
  dashboard,
  aigcCenter,
  purchaseTokens,

  createMaster,
  createSubAccount,
  updateSubAccountTokenSettings,

  listMasterProviderBindings,
  bindMasterProvider,
  syncMasterProvider,
  syncMasterUserData,

  createMapping,
  listClBaseUsers,
  myAigcWorkspace,
  addMyWork,
  unbindMasterProvider,
  getMyRechargeRecords
};