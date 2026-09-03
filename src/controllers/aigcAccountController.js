const aigcAccountModel = require("../models/aigcAccountCsvModel");
const masterOwnerModel = require(
  "../models/aigcMasterOwnerCsvModel"
);

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
const aigcSessionService = require(
  "../services/aigcSessionService"
);
const aigcDashboardService = require(
  "../services/aigcDashboardService"
);

async function dashboard(req, res) {
  try {
    const data =
      aigcAccountModel.listAdminData();

    return res.json({
      success: true,
      data: {
        ...data,
        masterOwnerMappings:
          masterOwnerModel
            .listActiveMappings()
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function getMyEnterpriseSubAccounts(
  req,
  res
) {
  try {
    const ownerMapping =
      req.user?.id
        ? masterOwnerModel
            .getActiveMappingByUserId(
              req.user.id
            )
        : null;

    if (!ownerMapping) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号不是企业主账号负责人"
      });
    }

    const data =
      aigcAccountModel.listAdminData();

    const masterAccount =
      data.masters.find(
        master =>
          String(master.id) ===
            String(
              ownerMapping
                .masterAccountId
            ) &&
          master.status === "active"
      );

    if (!masterAccount) {
      return res.status(404).json({
        success: false,
        message:
          "未找到当前负责人所属的企业主账号"
      });
    }

    const subAccounts =
      data.subs
        .filter(
          subAccount =>
            String(
              subAccount
                .masterAccountId
            ) ===
            String(masterAccount.id)
        )
        .map(
          (
            subAccount,
            index
          ) => {
            const configuredLimit =
              Math.max(
                toNumber(
                  subAccount.tokenLimit,
                  0
                ),
                0
              );

            const demoTokenLimit =
              configuredLimit > 0
                ? configuredLimit
                : (
                    index + 1
                  ) * 10000;

            const demoUsedTokens =
              Math.min(
                Math.max(
                  toNumber(
                    subAccount.usedTokens,
                    0
                  ),
                  0
                ),
                demoTokenLimit
              );

            return {
              id: subAccount.id,
              subAccountName:
                subAccount
                  .subAccountName,
              platformLogin:
                subAccount
                  .platformLogin,
              tokenLimit:
                demoTokenLimit,
              usedTokens:
                demoUsedTokens,
              remainingTokens:
                Math.max(
                  demoTokenLimit -
                    demoUsedTokens,
                  0
                ),
              warningThreshold:
                Math.max(
                  toNumber(
                    subAccount
                      .warningThreshold,
                    10
                  ),
                  0
                ),
              status:
                subAccount.status ||
                "disabled"
            };
          }
        );

    return res.json({
      success: true,
      data: {
        dataMode: "demo",
        enterpriseName:
          masterAccount
            .enterpriseName ||
          "未命名企业",
        masterAccountId:
          masterAccount.id,
        subAccounts
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "企业子账号读取失败"
    });
  }
}

function getDashboardAnalytics(
  req,
  res
) {
  try {
    const isAdmin =
      req.user?.role === "admin";

    const ownerMapping =
      !isAdmin && req.user?.id
        ? masterOwnerModel
            .getActiveMappingByUserId(
              req.user.id
            )
        : null;

    if (
      !isAdmin &&
      !ownerMapping
    ) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号没有仪表盘访问权限"
      });
    }

    const requestedMasterAccountId =
      String(
        req.query?.masterAccountId ||
        ""
      ).trim();

    if (
      ownerMapping &&
      requestedMasterAccountId &&
      requestedMasterAccountId !==
        String(
          ownerMapping.masterAccountId
        )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "不能查看其他企业的仪表盘数据"
      });
    }

    const masterAccountIds =
      ownerMapping
        ? [
            ownerMapping
              .masterAccountId
          ]
        : requestedMasterAccountId
          ? [
              requestedMasterAccountId
            ]
          : [];

    const analytics =
      aigcDashboardService
        .buildDashboardAnalytics({
          masterAccountIds,
          scope:
            isAdmin
              ? "admin"
              : "master_owner"
        });

    return res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "仪表盘数据读取失败"
    });
  }
}

async function syncDashboardUserData(
  req,
  res
) {
  const isAdmin =
    req.user?.role === "admin";

  const requestedMasterAccountId =
    String(
      req.body?.masterAccountId ||
      ""
    ).trim();

  let masterAccountId =
    requestedMasterAccountId;

  if (!isAdmin) {
    const ownerMapping =
      req.user?.id
        ? masterOwnerModel
            .getActiveMappingByUserId(
              req.user.id
            )
        : null;

    if (!ownerMapping) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号没有仪表盘同步权限"
      });
    }

    if (
      requestedMasterAccountId &&
      requestedMasterAccountId !==
        String(
          ownerMapping.masterAccountId
        )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "不能同步其他企业的创作记录"
      });
    }

    masterAccountId =
      ownerMapping.masterAccountId;
  }

  if (!masterAccountId) {
    return res.status(400).json({
      success: false,
      message:
        "请选择需要同步的企业主账号"
    });
  }

  req.params = {
    ...req.params,
    masterAccountId
  };

  return syncMasterUserData(
    req,
    res
  );
}

async function syncMyWorkspaceUserData(
  req,
  res
) {
  const mapping =
    aigcAccountModel.getMyMapping(
      req.user.id
    );

  const masterAccountId =
    String(
      mapping?.mapping
        ?.masterAccountId ||
      mapping?.aigcSubAccount
        ?.masterAccountId ||
      mapping?.masterAccount?.id ||
      ""
    ).trim();

  if (
    !mapping?.aigcSubAccount ||
    !masterAccountId
  ) {
    return res.status(403).json({
      success: false,
      message:
        "当前 Harson-Base 账号尚未绑定 AIGC 子账号"
    });
  }

  req.params = {
    ...req.params,
    masterAccountId
  };

  let forwardedStatus = 200;
  let forwardedPayload = null;

  const privateResponse = {
    status(statusCode) {
      forwardedStatus = statusCode;
      return this;
    },

    json(payload) {
      forwardedPayload = payload;
      return payload;
    }
  };

  await syncMasterUserData(
    req,
    privateResponse
  );

  if (!forwardedPayload?.success) {
    return res
      .status(forwardedStatus)
      .json({
        success: false,
        message:
          forwardedPayload?.message ||
          "最新创作记录读取失败",
        data: {
          timing:
            forwardedPayload?.data
              ?.timing ||
            null
        }
      });
  }

  return res.json({
    success: true,
    message:
      "最新 Token 点数和本人创作记录读取成功",
    data: {
      timing:
        forwardedPayload?.data
          ?.timing ||
        null
    }
  });
}

async function createMasterOwnerMapping(
  req,
  res
) {
  try {
    const {
      masterAccountId,
      clBaseUserId
    } = req.body;

    if (
      !masterAccountId ||
      !clBaseUserId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "企业主账号和 Harson-Base 负责人不能为空"
      });
    }

    const adminData =
      aigcAccountModel.listAdminData();

    const master =
      adminData.masters.find(
        item =>
          item.id ===
          String(masterAccountId)
      );

    if (
      !master ||
      master.status !== "active"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "未找到可用的 AIGC 企业主账号"
      });
    }

    const user =
      await userCsvModel.findById(
        clBaseUserId
      );

    if (
      !user ||
      !user.isActive
    ) {
      return res.status(400).json({
        success: false,
        message:
          "未找到可用的 Harson-Base 用户"
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message:
          "管理员账号不能绑定为企业主账号负责人"
      });
    }

    if (
      aigcAccountModel.getMyMapping(
        user.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "该 Harson-Base 用户已经绑定了 AIGC 子账号，请先解除子账号映射"
      });
    }

    const mapping =
      masterOwnerModel.createMapping({
        masterAccountId:
          master.id,
        clBaseUserId:
          user.id,
        clBaseEmail:
          user.email
      });

    return res.status(201).json({
      success: true,
      message:
        "企业主账号负责人绑定成功",
      data: mapping
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

function unbindMasterOwnerMapping(
  req,
  res
) {
  try {
    const mapping =
      masterOwnerModel.unbindMapping(
        req.params.mappingId
      );

    return res.json({
      success: true,
      message:
        "企业主账号负责人绑定已解除",
      data: mapping
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
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

async function unbindMapping(req, res) {
  try {
    const mapping =
      aigcAccountModel.unbindMapping(
        req.params.mappingId
      );

    let sessionCleanup = null;

    try {
      sessionCleanup =
        await aigcSessionService
          .logoutUserAigcSession(
            mapping.clBaseUserId
          );
    } catch (error) {
      console.warn(
        "解除账号映射后的 AIGC 会话清理失败：",
        error.message
      );
    }

    const sessionWarning =
      sessionCleanup &&
      sessionCleanup.success === false
        ? "，但 YiBai 外部注销未完成，请稍后检查共享 Session"
        : sessionCleanup
          ? ""
          : "，但 AIGC 会话清理未完成，请稍后检查共享 Session";

    return res.json({
      success: true,
      message:
        `Harson-Base 与 AIGC 子账号映射已解除${sessionWarning}`,
      data: mapping
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
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
  const syncStartedAt = Date.now();
  const timing = {
    taskSyncMs: 0,
    workspaceRestoreMs: 0,
    totalMs: 0
  };

  console.info(
    "[YiBai 创作记录同步] 开始",
    {
      masterAccountId
    }
  );

  const taskSyncStartedAt =
    Date.now();
  try {
    taskSyncResult =
      await aigcUserDataService
        .syncCompanyTaskSnapshot(
          masterAccountId
        );
  } catch (error) {
    taskSyncError = error;
  } finally {
    timing.taskSyncMs =
      Date.now() -
      taskSyncStartedAt;
  }

  const workspaceRestoreStartedAt =
    Date.now();
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
    timing.workspaceRestoreMs =
      Date.now() -
      workspaceRestoreStartedAt;

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
        "清理用户端 Token 缓存失败：",
        error.message
      );
    }
  }

  timing.totalMs =
    Date.now() -
    syncStartedAt;

  const syncLogDetails = {
    masterAccountId,
    ...timing,
    taskSyncSuccess:
      !taskSyncError,
    workspaceRestoreSuccess:
      !workspaceRestoreError
  };

  if (
    taskSyncError ||
    workspaceRestoreError
  ) {
    console.warn(
      "[YiBai 创作记录同步] 完成但存在失败阶段",
      syncLogDetails
    );
  } else {
    console.info(
      "[YiBai 创作记录同步] 完成",
      syncLogDetails
    );
  }

  if (workspaceRestoreError) {
    return res.status(500).json({
      success: false,

      message:
        taskSyncError
          ? `用户数据同步失败，且 Workspace 登录状态恢复失败：${workspaceRestoreError.message}`
          : `真实创作记录已同步，但 Workspace 登录状态恢复失败：${workspaceRestoreError.message}`,

      data: {
        timing
      }
    });
  }

  if (taskSyncError) {
    /*
     * 详细技术错误仅保留在服务器日志中，
     * 不返回给页面用户。
     */
    console.error(
      "[CL-AIGC 创作记录同步] 详细错误",
      {
        masterAccountId,
        message:
          taskSyncError.message
      }
    );

    return res.status(400).json({
      success: false,

      message:
        "显示异常，请稍后联系管理员再试。",

      data: {
        timing
      }
    });
  }

  return res.json({
    success: true,

    message:
      "真实创作记录同步成功，Workspace 登录状态已恢复",

    data: {
      taskSync:
        taskSyncResult,

      workspaceRestored:
        true,

      timing
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
  const subMapping =
  aigcAccountModel
    .getMyMapping(
      req.user.id
    );

const ownerMapping =
  masterOwnerModel
    .getActiveMappingByUserId(
      req.user.id
    );

/*
 * 正常情况下，同一个 Harson-Base 用户
 * 不应该同时绑定企业主账号和子账号。
 */
if (
  subMapping?.mapping &&
  ownerMapping
) {
  return res.status(409).json({
    success: false,

    message:
      "当前 Harson-Base 账号同时绑定了企业主账号和子账号，请联系管理员检查账号映射"
  });
}

/*
 * 企业主账号负责人：
 * 直接读取负责人绑定的 masterAccountId。
 *
 * 普通用户：
 * 继续通过子账号映射找到所属企业主账号。
 */
const masterAccountId =
  String(
    ownerMapping
      ?.masterAccountId ||
    subMapping
      ?.masterAccount
      ?.id ||
    subMapping
      ?.mapping
      ?.masterAccountId ||
    ""
  ).trim();

if (!masterAccountId) {
  return res.status(404).json({
    success: false,

    message:
      "当前 Harson-Base 账号尚未绑定可用的 AIGC 企业账号"
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
        "清理用户端 Token 缓存失败：",
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

    deductedTokens:
      task.point,

    refundedTokens:
      task.refundedPoint,

    netUsedTokens:
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
          currentUser: {
            email:
              req.user.email || ""
          },

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
        currentUser: {
          email:
            req.user.email || ""
        },

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
  getMyEnterpriseSubAccounts,
  getDashboardAnalytics,
  syncDashboardUserData,
  syncMyWorkspaceUserData,
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
  unbindMapping,
  createMasterOwnerMapping,
  unbindMasterOwnerMapping,
  listClBaseUsers,
  myAigcWorkspace,
  addMyWork,
  unbindMasterProvider,
  getMyRechargeRecords
};
