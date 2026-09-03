"use strict";

const subProviderService = require(
  "../services/aigcSubProviderService"
);

function listBindings(req, res) {
  try {
    return res.json({
      success: true,
      data: subProviderService.listSubProviderBindings()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "外部子账号绑定列表读取失败"
    });
  }
}

async function bindProvider(req, res) {
  try {
    const {
      subAccountId,
      providerAccount,
      providerPassword,
      pointsField
    } = req.body || {};

    if (!subAccountId || !providerAccount || !providerPassword) {
      return res.status(400).json({
        success: false,
        message: "AIGC 子账号、外部子账号和登录密码不能为空"
      });
    }

    const result =
      await subProviderService.bindSubProviderAndSync({
        subAccountId,
        providerAccount,
        providerPassword,
        pointsField
      });

    return res.status(201).json({
      success: true,
      message: "外部子账号验证并绑定成功",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "外部子账号绑定失败"
    });
  }
}

async function syncProvider(req, res) {
  try {
    const result =
      await subProviderService.syncBoundSubProvider(
        req.params.subAccountId
      );

    return res.json({
      success: true,
      message: "外部子账号状态同步成功",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "外部子账号同步失败"
    });
  }
}

async function unbindProvider(req, res) {
  try {
    const result =
      await subProviderService.unbindSubProvider(
        req.params.subAccountId
      );

    return res.json({
      success: true,
      message:
        "外部子账号绑定已解除，内部 AIGC 子账号和 Harson-Base 映射均已保留",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "外部子账号解绑失败"
    });
  }
}

module.exports = {
  listBindings,
  bindProvider,
  syncProvider,
  unbindProvider
};
