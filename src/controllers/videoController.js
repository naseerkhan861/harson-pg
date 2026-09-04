const seedanceProvider = require("../services/ai/seedanceProvider");

async function generateVideo(req, res) {
  try {
    const prompt = String(
      req.body?.prompt || ""
    ).trim();

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "请输入视频生成描述。"
      });
    }

    if (prompt.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "视频生成描述过长。"
      });
    }

    const result =
      await seedanceProvider.generate({
        prompt
      });

    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    console.error(
      "[AI Video Error]",
      error?.message || error
    );

    const message =
      String(error?.message || "");

    if (
      message.includes(
        "ARK_API_KEY 未配置"
      )
    ) {
      return res.status(503).json({
        success: false,
        message:
          "视频生成服务暂未配置。"
      });
    }

    return res.status(502).json({
      success: false,
      message:
        "视频生成失败，请稍后重试。"
    });
  }
}

module.exports = {
  generateVideo
};