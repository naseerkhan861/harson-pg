const express = require("express");

/*
 * 安装最小运行时补丁：
 * - 主账号负责人继续使用原主账号 Session；
 * - 普通用户改用其内部子账号绑定的外部子账号 Session；
 * - 仪表盘优先按绑定保存的外部 memberId 归属任务。
 */
require("../services/aigcSubProviderRuntimePatch").install();


const controller = require("../controllers/aigcAccountController");

const {
  sanitizeAigcResponseForUser
} = require(
  "../utils/publicAigcMessage"
);

const subProviderController = require(
  "../controllers/aigcSubProviderController"
);
const sessionController = require(
  "../controllers/aigcSessionController"
);
const {
  requireAuth,
  requireAdmin
} = require("../middleware/authMiddleware");

const downloadController =
  require(
    "../controllers/aigcDownloadController"
  );

const router = express.Router();


/*
 * CL-AIGC 接口统一响应脱敏。
 *
 * 该中间件在路由处理前包装 res.json，
 * 真正返回响应时 req.user 已由 requireAuth 写入。
 *
 * 管理员保留内部原文；
 * 其他用户只处理 message、error、warning 等展示字段。
 */
router.use((req, res, next) => {
  const originalJson =
    res.json.bind(res);

  res.json = payload => {
    const safePayload =
      sanitizeAigcResponseForUser(
        req,
        payload
      );

    return originalJson(
      safePayload
    );
  };

  next();
});

router.get(
  "/session",
  requireAuth,
  sessionController.getSession
);

router.get(
  "/session/token-balance",
  requireAuth,
  sessionController.getTokenBalance
);

router.post(
  "/session/refresh",
  requireAuth,
  sessionController.refreshSession
);

router.get(
  "/my-workspace/recharge-records",
  requireAuth,
  controller.getMyRechargeRecords
);

router.get(
  "/my-enterprise/sub-accounts",
  requireAuth,
  controller.getMyEnterpriseSubAccounts
);

router.post(
  "/my-workspace/sync",
  requireAuth,
  controller.syncMyWorkspaceUserData
);

router.get(
  "/dashboard/analytics",
  requireAuth,
  controller.getDashboardAnalytics
);

router.post(
  "/dashboard/sync",
  requireAuth,
  controller.syncDashboardUserData
);

router.get(
  "/admin/dashboard",
  requireAuth,
  requireAdmin,
  controller.dashboard
);

router.get(
  "/admin/aigc-center",
  requireAuth,
  requireAdmin,
  controller.aigcCenter
);

router.post(
  "/admin/token-purchases",
  requireAuth,
  requireAdmin,
  controller.purchaseTokens
);

router.get(
  "/admin/clbase-users",
  requireAuth,
  requireAdmin,
  controller.listClBaseUsers
);

router.post(
  "/admin/master-accounts",
  requireAuth,
  requireAdmin,
  controller.createMaster
);

router.get(
  "/admin/master-provider-bindings",
  requireAuth,
  requireAdmin,
  controller.listMasterProviderBindings
);

router.post(
  "/admin/master-provider-bindings",
  requireAuth,
  requireAdmin,
  controller.bindMasterProvider
);

router.post(
  "/admin/master-provider-bindings/:masterAccountId/sync",
  requireAuth,
  requireAdmin,
  controller.syncMasterProvider
);

router.post(
  "/admin/master-provider-bindings/:masterAccountId/unbind",
  requireAuth,
  requireAdmin,
  controller.unbindMasterProvider
);

router.post(
  "/admin/master-provider-bindings/:masterAccountId/user-data-sync",
  requireAuth,
  requireAdmin,
  controller.syncMasterUserData
);

router.post(
  "/admin/sub-accounts",
  requireAuth,
  requireAdmin,
  controller.createSubAccount
);

/*
 * 新增：内部 AIGC 子账号与外部子账号的独立绑定。
 */
router.get(
  "/admin/sub-provider-bindings",
  requireAuth,
  requireAdmin,
  subProviderController.listBindings
);

router.post(
  "/admin/sub-provider-bindings",
  requireAuth,
  requireAdmin,
  subProviderController.bindProvider
);

router.post(
  "/admin/sub-provider-bindings/:subAccountId/sync",
  requireAuth,
  requireAdmin,
  subProviderController.syncProvider
);

router.post(
  "/admin/sub-provider-bindings/:subAccountId/unbind",
  requireAuth,
  requireAdmin,
  subProviderController.unbindProvider
);

router.post(
  "/admin/sub-accounts/token-settings",
  requireAuth,
  requireAdmin,
  controller.updateSubAccountTokenSettings
);

router.post(
  "/admin/mappings",
  requireAuth,
  requireAdmin,
  controller.createMapping
);

router.post(
  "/admin/master-owner-mappings",
  requireAuth,
  requireAdmin,
  controller.createMasterOwnerMapping
);

router.post(
  "/admin/master-owner-mappings/:mappingId/unbind",
  requireAuth,
  requireAdmin,
  controller.unbindMasterOwnerMapping
);

router.post(
  "/admin/mappings/:mappingId/unbind",
  requireAuth,
  requireAdmin,
  controller.unbindMapping
);

router.get(
  "/my-workspace",
  requireAuth,
  controller.myAigcWorkspace
);

router.post(
  "/my-workspace/works",
  requireAuth,
  controller.addMyWork
);

router.get(
  "/download",
  requireAuth,
  downloadController.proxyDownload
);

module.exports = router;
