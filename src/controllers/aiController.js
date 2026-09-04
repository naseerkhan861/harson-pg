const deepseekProvider =
  require("../services/ai/deepseekProvider");

const ALLOWED_ROLES =
  new Set(["user", "assistant"]);

function normalizeMessages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  /*
    开发阶段限制最近 30 条消息，
    防止一次请求带入过多历史导致成本失控。
  */
  return value
    .slice(-30)
    .map(item => {
      const role =
        String(item?.role || "")
          .trim()
          .toLowerCase();

      const content =
        String(item?.content || "")
          .trim();

      return {
        role,
        content
      };
    })
    .filter(item => {
      return (
        ALLOWED_ROLES.has(item.role) &&
        item.content &&
        item.content.length <= 5000
      );
    });
}

async function chat(req, res) {
  try {
    const provider =
      String(
        req.body?.provider || ""
      )
        .trim()
        .toLowerCase();

    const message =
      String(
        req.body?.message || ""
      ).trim();

    const messages =
      normalizeMessages(
        req.body?.messages
      );

    if (
      !message &&
      !messages.length
    ) {
      return res.status(400).json({
        success: false,
        message: "请输入创作需求。"
      });
    }

    if (
      message &&
      message.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "输入内容过长。"
      });
    }

    if (
      provider !== "deepseek"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "当前暂不支持该 AI 模型。"
      });
    }

    const result =
      await deepseekProvider.chat({
        message,
        messages
      });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error(
      "[AI Chat Error]",
      error.message
    );

    return res.status(502).json({
      success: false,
      message:
        "AI 服务暂时不可用，请稍后重试。"
    });
  }
}

module.exports = {
  chat
};
