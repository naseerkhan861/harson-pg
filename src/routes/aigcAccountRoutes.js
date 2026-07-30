const express = require("express");
const controller = require("../controllers/aigcAccountController");
const sessionController = require(
  "../controllers/aigcSessionController"
);
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();
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

router.get("/admin/dashboard", requireAuth, requireAdmin, controller.dashboard);
router.get("/admin/aigc-center", requireAuth, requireAdmin, controller.aigcCenter);
router.post("/admin/token-purchases", requireAuth, requireAdmin, controller.purchaseTokens);

router.get("/admin/clbase-users", requireAuth, requireAdmin, controller.listClBaseUsers);
router.post("/admin/master-accounts", requireAuth, requireAdmin, controller.createMaster);
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

router.post("/admin/sub-accounts", requireAuth, requireAdmin, controller.createSubAccount);
router.post("/admin/sub-accounts/token-settings", requireAuth, requireAdmin, controller.updateSubAccountTokenSettings);
router.post("/admin/mappings", requireAuth, requireAdmin, controller.createMapping);

router.get("/my-workspace", requireAuth, controller.myAigcWorkspace);
router.post("/my-workspace/works", requireAuth, controller.addMyWork);

module.exports = router;