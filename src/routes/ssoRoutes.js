const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { createFootSsoUrl } = require("../sso/footSso");

const router = express.Router();

/**
 * GET /api/sso/foot-entry
 *
 * 为已登录用户生成本系统 → HarsonFOOT（3D 足型测量平台）
 * 的免登录跳转链接。
 *
 *  - 已登录：返回 { success: true, url }
 *  - 未登录：requireAuth 返回 401 { message: "Authentication required." }
 *  - 配置缺失：返回 500
 */
router.get("/foot-entry", requireAuth, (req, res) => {
  const url = createFootSsoUrl(req.user);

  if (!url) {
    return res.status(500).json({
      success: false,
      message:
        "SSO 跳转未配置：请检查 SSO_FOOT_BASE_URL 与 SSO_FOOT_SHARED_SECRET。"
    });
  }

  return res.json({
    success: true,
    url
  });
});

module.exports = router;