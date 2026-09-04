const DEEPSEEK_BASE_URL =
  "https://api.deepseek.com";

const SYSTEM_PROMPT =
  "你是 CL-AIGC 的鞋履行业 AI 助手。" +
  "你的任务是理解用户关于鞋履设计、商品视觉、模特展示、" +
  "电商图片、营销内容和视频创作的需求。" +
  "回答使用中文，表达清晰、简洁、专业。" +
  "在多轮对话中，要结合此前聊天内容理解用户的追问，" +
  "不要把每一句追问当成完全独立的新问题。" +
  "如果用户需求不完整，可以指出还缺少哪些关键信息。";

function buildConversationMessages({
  message,
  messages
}) {
  if (
    Array.isArray(messages) &&
    messages.length
  ) {
    return messages.map(item => ({
      role: item.role,
      content: item.content
    }));
  }

  return [
    {
      role: "user",
      content: message
    }
  ];
}

async function chat({
  message,
  messages = []
}) {
  const apiKey =
    process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY 未配置"
    );
  }

  const model =
    process.env.DEEPSEEK_MODEL ||
    "deepseek-v4-flash";

  const conversationMessages =
    buildConversationMessages({
      message,
      messages
    });

  const response =
    await fetch(
      `${DEEPSEEK_BASE_URL}/chat/completions`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: "system",
              content:
                SYSTEM_PROMPT
            },

            ...conversationMessages
          ],

          stream: false
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      `DeepSeek 请求失败：${response.status}`;

    throw new Error(
      errorMessage
    );
  }

  const content =
    data?.choices?.[0]
      ?.message
      ?.content;

  if (!content) {
    throw new Error(
      "DeepSeek 未返回有效内容"
    );
  }

  return {
    provider: "deepseek",

    model:
      data.model ||
      model,

    content,

    usage: {
      promptTokens:
        data?.usage
          ?.prompt_tokens || 0,

      completionTokens:
        data?.usage
          ?.completion_tokens || 0,

      totalTokens:
        data?.usage
          ?.total_tokens || 0
    }
  };
}

module.exports = {
  chat
};
