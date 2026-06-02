const aigcAccountModel = require("../models/aigcAccountCsvModel");
const userCsvModel = require("../models/userCsvModel");

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
        message: "请选择 CL-Base 用户和 AIGC 子账号"
      });
    }

    const users = await userCsvModel.listUsers();
    const user = users.find(item => item.id === clBaseUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "未找到对应的 CL-Base 用户"
      });
    }

    const mapping = aigcAccountModel.createMapping({
      clBaseUserId,
      clBaseEmail: user.email,
      aigcSubAccountId
    });

    return res.status(201).json({
      success: true,
      message: "CL-Base 与 AIGC 子账号一对一映射创建成功",
      data: mapping
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
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
  updateSubAccountTokenSettings,
  createMapping,
  listClBaseUsers,
  myAigcWorkspace,
  addMyWork
};