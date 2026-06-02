const express = require("express");
const controller = require("../controllers/aigcAccountController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/admin/dashboard", requireAuth, requireAdmin, controller.dashboard);
router.get("/admin/aigc-center", requireAuth, requireAdmin, controller.aigcCenter);
router.post("/admin/token-purchases", requireAuth, requireAdmin, controller.purchaseTokens);

router.get("/admin/clbase-users", requireAuth, requireAdmin, controller.listClBaseUsers);
router.post("/admin/master-accounts", requireAuth, requireAdmin, controller.createMaster);
router.post("/admin/sub-accounts", requireAuth, requireAdmin, controller.createSubAccount);
router.post("/admin/sub-accounts/token-settings", requireAuth, requireAdmin, controller.updateSubAccountTokenSettings);
router.post("/admin/mappings", requireAuth, requireAdmin, controller.createMapping);

router.get("/my-workspace", requireAuth, controller.myAigcWorkspace);
router.post("/my-workspace/works", requireAuth, controller.addMyWork);

module.exports = router;