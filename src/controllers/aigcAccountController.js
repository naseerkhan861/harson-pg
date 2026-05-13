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

async function createMaster(req, res) {
  try {
    const { enterpriseName, platformName, platformLogin, platformPassword, totalCredits } = req.body;

    if (!enterpriseName || !platformName || !platformLogin || !platformPassword) {
      return res.status(400).json({
        success: false,
        message: "Enterprise name, platform name, login and password are required."
      });
    }

    const master = await aigcAccountModel.createMaster({
      enterpriseName,
      platformName,
      platformLogin,
      platformPassword,
      totalCredits
    });

    return res.status(201).json({ success: true, message: "AIGC master account created.", data: master });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function createSubAccount(req, res) {
  try {
    const { masterAccountId, subAccountName, platformLogin, platformPassword } = req.body;

    if (!masterAccountId || !subAccountName || !platformLogin || !platformPassword) {
      return res.status(400).json({
        success: false,
        message: "Master account, sub-account name, login and password are required."
      });
    }

    const subAccount = await aigcAccountModel.createSubAccount({
      masterAccountId,
      subAccountName,
      platformLogin,
      platformPassword
    });

    return res.status(201).json({ success: true, message: "AIGC sub-account created.", data: subAccount });
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
        message: "CL-Base user and AIGC sub-account are required."
      });
    }

    const users = await userCsvModel.listUsers();
    const user = users.find(item => item.id === clBaseUserId);

    if (!user) {
      return res.status(404).json({ success: false, message: "CL-Base user was not found." });
    }

    const mapping = aigcAccountModel.createMapping({
      clBaseUserId,
      clBaseEmail: user.email,
      aigcSubAccountId
    });

    return res.status(201).json({ success: true, message: "One-to-one mapping created.", data: mapping });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function listClBaseUsers(req, res) {
  try {
    const users = await userCsvModel.listUsers();
    return res.json({ success: true, data: users });
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
      return res.status(400).json({ success: false, message: "Work title and type are required." });
    }

    const work = aigcAccountModel.addMyWork({
      clBaseUserId: req.user.id,
      title,
      workType,
      promptSummary: promptSummary || "",
      creditCost: Number(creditCost || 0)
    });

    return res.status(201).json({ success: true, message: "Creative work saved in isolated workspace.", data: work });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = {
  dashboard,
  createMaster,
  createSubAccount,
  createMapping,
  listClBaseUsers,
  myAigcWorkspace,
  addMyWork
};
