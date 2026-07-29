const express = require("express");
const controller = require("../controllers/aigcAccountController");
const sessionController = require(
  "../controllers/aigcSessionController"
);
const {
  requireAuth,
  requireAdmin,
  requirePlatformAdmin,
  requirePlatformOrMasterAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();
router.get(
  "/session",
  requireAuth,
  sessionController.getSession
);

router.post(
  "/session/refresh",
  requireAuth,
  sessionController.refreshSession
);

router.get("/admin/dashboard", requireAuth, requireAdmin, controller.dashboard);
router.get("/admin/aigc-center", requireAuth, requireAdmin, controller.aigcCenter);
router.post("/admin/token-purchases", requireAuth, requireAdmin, controller.purchaseTokens);

router.get("/admin/clbase-users", requireAuth, requireAdmin, controller.listClBaseUsers);
router.post("/admin/master-accounts", requireAuth, requireAdmin, controller.createMaster);
/*
 * 新账号层级接口：
 *
 * 仅平台管理员可以创建
 * Harson-Base 企业主账号。
 */
router.post(
  "/admin/enterprise-master-accounts",
  requireAuth,
  requirePlatformAdmin,
  controller.createEnterpriseMasterAccount
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
router.post("/admin/sub-accounts", requireAuth, requireAdmin, controller.createSubAccount);
/*
 * 平台管理员和企业主账号
 * 都可以创建企业子账号。
 *
 * 企业主账号只能在自己的企业下创建。
 */
router.post(
  "/enterprise/member-accounts",
  requireAuth,
  requirePlatformOrMasterAdmin,
  controller.createEnterpriseMemberAccount
);
router.post("/admin/sub-accounts/token-settings", requireAuth, requireAdmin, controller.updateSubAccountTokenSettings);
router.post("/admin/mappings", requireAuth, requireAdmin, controller.createMapping);

router.get("/my-workspace", requireAuth, controller.myAigcWorkspace);
router.post("/my-workspace/works", requireAuth, controller.addMyWork);

module.exports = router;