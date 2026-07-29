const aigcAccountModel = require("../models/aigcAccountCsvModel");
const userCsvModel = require("../models/userCsvModel");
const aigcMasterProviderService = require(
  "../services/aigcMasterProviderService"
);
const accountHierarchyService = require(
  "../services/accountHierarchyService"
);
const {
  USER_ROLES,
  normalizeUserRole
} = require("../constants/userRoles");

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

/**
 * 平台管理员创建企业主账号。
 *
 * 同时创建：
 * 1. Harson-Base 登录账号；
 * 2. AIGC 企业主账号；
 * 3. 两者之间的层级关联。
 */
async function createEnterpriseMasterAccount(
  req,
  res
) {
  try {
    const body = req.body || {};

    const result =
      await accountHierarchyService
        .createEnterpriseMaster({
          name: body.name,
          email: body.email,
          password: body.password,

          enterpriseName:
            body.enterpriseName,

          platformName:
            body.platformName,

          platformLogin:
            body.platformLogin,

          platformPassword:
            body.platformPassword,

          totalCredits:
            body.totalCredits
        });

    return res.status(201).json({
      success: true,
      message:
        "Harson-Base 企业主账号创建成功。",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Harson-Base 企业主账号创建失败。"
    });
  }
}

/**
 * 创建企业子账号。
 *
 * platform_admin：
 * 可以通过请求体指定 masterAccountId。
 *
 * master_admin：
 * 只能在自己所属企业下创建子账号，
 * 请求体中的其他企业 ID 会被忽略。
 */
async function createEnterpriseMemberAccount(
  req,
  res
) {
  try {
    const body = req.body || {};

    const requesterRole =
      normalizeUserRole(
        req.user?.role
      );

    let masterAccountId = "";

    if (
      requesterRole ===
      USER_ROLES.PLATFORM_ADMIN
    ) {
      masterAccountId =
        String(
          body.masterAccountId || ""
        ).trim();
    } else if (
      requesterRole ===
      USER_ROLES.MASTER_ADMIN
    ) {
      masterAccountId =
        String(
          req.user?.masterAccountId || ""
        ).trim();
    } else {
      return res.status(403).json({
        success: false,
        message:
          "当前账号没有创建企业子账号的权限。"
      });
    }

    if (!masterAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "缺少企业主账号关联信息。"
      });
    }

    const result =
      await accountHierarchyService
        .createEnterpriseMember({
          masterAccountId,

          name: body.name,
          email: body.email,
          password: body.password,

          subAccountName:
            body.subAccountName,

          platformLogin:
            body.platformLogin,

          platformPassword:
            body.platformPassword,

          tokenLimit:
            body.tokenLimit,

          warningThreshold:
            body.warningThreshold
        });

    return res.status(201).json({
      success: true,
      message:
        "Harson-Base 企业子账号创建成功。",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Harson-Base 企业子账号创建失败。"
    });
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


async function listClBaseUsers(req, res) {
  try {
    const users = await userCsvModel.listUsers();
    const normalUsers = users.filter(user => user.role !== "admin");

    return res.json({ success: true, data: normalUsers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function myAigcWorkspace(req, res) {
  try {
    return res.json({
      success: true,
      data: {
        mapping: aigcAccountModel.getMyMapping(req.user.id),
        works: aigcAccountModel.listMyWorks(req.user.id)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

  createEnterpriseMasterAccount,
  createEnterpriseMemberAccount,

  updateSubAccountTokenSettings,

  listMasterProviderBindings,
  bindMasterProvider,
  syncMasterProvider,

  createMapping,
  listClBaseUsers,
  myAigcWorkspace,
  addMyWork
};