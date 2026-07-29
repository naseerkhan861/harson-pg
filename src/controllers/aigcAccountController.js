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

/**
 * 企业主账号查看自己的企业信息。
 *
 * 安全规则：
 * 1. 只能读取当前登录用户绑定的企业；
 * 2. 同时校验 JWT 中的 masterAccountId；
 * 3. 不返回任何密码或密码哈希。
 */
function myEnterpriseAccount(
  req,
  res
) {
  try {
    const userId = String(
      req.user?.id || ""
    ).trim();

    const tokenMasterAccountId =
      String(
        req.user?.masterAccountId || ""
      ).trim();

    if (
      !userId ||
      !tokenMasterAccountId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "当前登录账号缺少企业主账号关联信息。"
      });
    }

    const masterAccount =
      aigcAccountModel
        .getMasterByOwnerUserId(
          userId
        );

    if (!masterAccount) {
      return res.status(404).json({
        success: false,
        message:
          "未找到当前用户管理的企业主账号。"
      });
    }

    /*
     * 防止 JWT 中的企业 ID
     * 与真实企业归属不一致。
     */
    if (
      masterAccount.id !==
      tokenMasterAccountId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号的企业归属校验失败。"
      });
    }

    const memberAccounts =
      aigcAccountModel
        .listSubAccountsByMasterAccountId(
          masterAccount.id
        );

    const summary =
      memberAccounts.reduce(
        (result, member) => {
          result.memberCount += 1;

          result.totalAllocatedTokens +=
            Number(
              member.tokenLimit || 0
            );

          result.totalUsedTokens +=
            Number(
              member.usedTokens || 0
            );

          result.totalRemainingTokens +=
            Number(
              member.remainingTokens || 0
            );

          return result;
        },
        {
          memberCount: 0,
          totalAllocatedTokens: 0,
          totalUsedTokens: 0,
          totalRemainingTokens: 0
        }
      );

    return res.json({
      success: true,
      data: {
        masterAccount,
        memberAccounts,
        summary
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "读取企业账号信息失败。"
    });
  }
}

/**
 * 企业成员查看自己的账号信息。
 *
 * 安全校验：
 * 1. 根据当前登录用户 ID 查找子账号；
 * 2. 校验 JWT 中的 subAccountId；
 * 3. 校验 JWT 中的 masterAccountId；
 * 4. 不返回密码或密码哈希。
 */
function myEnterpriseMemberAccount(
  req,
  res
) {
  try {
    const userId = String(
      req.user?.id || ""
    ).trim();

    const tokenMasterAccountId =
      String(
        req.user?.masterAccountId || ""
      ).trim();

    const tokenSubAccountId =
      String(
        req.user?.subAccountId || ""
      ).trim();

    if (
      !userId ||
      !tokenMasterAccountId ||
      !tokenSubAccountId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "当前登录账号缺少企业成员关联信息。"
      });
    }

    const subAccount =
      aigcAccountModel
        .getSubAccountByUserId(
          userId
        );

    if (!subAccount) {
      return res.status(404).json({
        success: false,
        message:
          "未找到当前用户对应的企业子账号。"
      });
    }

    if (
      subAccount.id !==
      tokenSubAccountId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号的子账号归属校验失败。"
      });
    }

    if (
      subAccount.masterAccountId !==
      tokenMasterAccountId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号的企业归属校验失败。"
      });
    }

    const tokenLimit =
      Number(
        subAccount.tokenLimit || 0
      );

    const usedTokens =
      Number(
        subAccount.usedTokens || 0
      );

    const remainingTokens =
      Math.max(
        tokenLimit - usedTokens,
        0
      );

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

    return res.json({
      success: true,
      data: {
        subAccount,
        tokenUsage: {
          tokenLimit,
          usedTokens,
          remainingTokens,
          usageRate
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "读取企业成员账号信息失败。"
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

/**
 * 平台管理员或企业主账号调整子账号 token 配额。
 *
 * 安全规则：
 * platform_admin 可以调整任意企业子账号；
 * master_admin 只能调整自己企业下的子账号。
 */
function updateEnterpriseMemberTokenSettings(
  req,
  res
) {
  try {
    const body = req.body || {};

    const subAccountId = String(
      body.subAccountId || ""
    ).trim();

    if (!subAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "请选择需要调整的企业子账号。"
      });
    }

    if (
      body.tokenLimit === undefined ||
      body.tokenLimit === null ||
      body.tokenLimit === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "请输入新的 token 配额。"
      });
    }

    const requesterRole =
      normalizeUserRole(
        req.user?.role
      );

    if (
      requesterRole ===
      USER_ROLES.MASTER_ADMIN
    ) {
      const masterAccountId = String(
        req.user?.masterAccountId || ""
      ).trim();

      if (!masterAccountId) {
        return res.status(403).json({
          success: false,
          message:
            "当前账号缺少企业主账号关联信息。"
        });
      }

      const enterpriseMembers =
        aigcAccountModel
          .listSubAccountsByMasterAccountId(
            masterAccountId
          );

      const targetMember =
        enterpriseMembers.find(
          member =>
            member.id ===
            subAccountId
        );

      if (!targetMember) {
        return res.status(403).json({
          success: false,
          message:
            "无权修改其他企业的子账号。"
        });
      }
    } else if (
      requesterRole !==
      USER_ROLES.PLATFORM_ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message:
          "当前账号没有调整 token 配额的权限。"
      });
    }

    const updatedSubAccount =
      aigcAccountModel
        .updateSubAccountTokenSettings({
          subAccountId,

          tokenLimit:
            body.tokenLimit,

          warningThreshold:
            body.warningThreshold
        });

    return res.json({
      success: true,
      message:
        "企业子账号 token 配额已更新。",
      data: updatedSubAccount
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "企业子账号 token 配额更新失败。"
    });
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
  myEnterpriseAccount,
  myEnterpriseMemberAccount,

  updateSubAccountTokenSettings,
  updateEnterpriseMemberTokenSettings,

  listMasterProviderBindings,
  bindMasterProvider,
  syncMasterProvider,

  createMapping,
  listClBaseUsers,
  myAigcWorkspace,
  addMyWork
};