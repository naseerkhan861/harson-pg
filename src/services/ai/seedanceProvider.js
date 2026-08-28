const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const SEEDANCE_CREATE_URL =
  "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";

const SEEDANCE_TASK_URL =
  "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";

const DEFAULT_MODEL =
  "doubao-seedance-1-0-pro-250528";

const OUTPUT_DIR = path.join(
  process.cwd(),
  "public",
  "generated",
  "aigc"
);

function normalizePrompt(prompt) {
  const text = String(prompt || "").trim();

  if (!text) {
    throw new Error("视频生成提示词不能为空");
  }

  if (text.length > 3000) {
    throw new Error("视频生成提示词过长");
  }

  return text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, {
    recursive: true
  });
}

async function downloadVideoFile(videoUrl) {
  if (!videoUrl) {
    throw new Error("Seedance 未返回有效视频地址");
  }

  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`生成视频下载失败：${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await ensureOutputDir();

  const filename = `cl-aigc-video-${Date.now()}-${crypto.randomUUID()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  await fs.writeFile(outputPath, buffer);

  return {
    filename,
    publicUrl: `/generated/aigc/${filename}`
  };
}

async function createTask({ prompt, imageUrl }) {
  const apiKey = process.env.ARK_API_KEY;

  if (!apiKey) {
    throw new Error("ARK_API_KEY 未配置");
  }

  const model =
    process.env.SEEDANCE_MODEL || DEFAULT_MODEL;

  const content = [
    {
      type: "text",
      text: prompt
    }
  ];

  if (imageUrl) {
    content.push({
      type: "image_url",
      image_url: {
        url: imageUrl
      }
    });
  }

  const response = await fetch(SEEDANCE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      content,
      ratio: "16:9",
      duration: 5,
      watermark: false
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Seedance 请求失败：${response.status}`;

    throw new Error(message);
  }

  if (!data?.id) {
    throw new Error("Seedance 未返回任务 ID");
  }

  return {
    taskId: data.id,
    model
  };
}

async function getTask(taskId) {
  const apiKey = process.env.ARK_API_KEY;

  if (!apiKey) {
    throw new Error("ARK_API_KEY 未配置");
  }

  const response = await fetch(
    `${SEEDANCE_TASK_URL}/${taskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Seedance 查询任务失败：${response.status}`;

    throw new Error(message);
  }

  return data;
}

function extractVideoUrl(taskResult) {
  if (!taskResult) {
    return "";
  }

  // 火山方舟视频生成任务的正式返回结构：
  // content: {
  //   video_url: "https://..."
  // }
  if (
    taskResult.content &&
    typeof taskResult.content === "object" &&
    !Array.isArray(taskResult.content) &&
    taskResult.content.video_url
  ) {
    return String(
      taskResult.content.video_url
    );
  }

  // 兼容可能出现的数组形式
  if (Array.isArray(taskResult.content)) {
    for (const item of taskResult.content) {
      if (
        item?.type === "video_url" &&
        item?.video_url?.url
      ) {
        return item.video_url.url;
      }

      if (
        typeof item?.video_url === "string"
      ) {
        return item.video_url;
      }
    }
  }

  // 其它兼容返回格式
  if (Array.isArray(taskResult.data)) {
    for (const item of taskResult.data) {
      if (item?.url) {
        return item.url;
      }
    }
  }

  if (
    typeof taskResult.video_url === "string"
  ) {
    return taskResult.video_url;
  }

  if (taskResult?.video_url?.url) {
    return taskResult.video_url.url;
  }

  if (taskResult?.url) {
    return taskResult.url;
  }

  return "";
}

async function waitForTaskSuccess(taskId) {
  const maxAttempts = 24;

  for (let i = 0; i < maxAttempts; i += 1) {
    const task = await getTask(taskId);
    const status = task?.status;

    if (status === "succeeded") {
      return task;
    }

    if (status === "failed") {
      const message =
        task?.error?.message ||
        "视频生成任务失败";
      throw new Error(message);
    }

    await sleep(5000);
  }

  throw new Error("视频生成超时，请稍后重试");
}

async function generate({
  prompt,
  imageUrl = ""
}) {
  const finalPrompt = normalizePrompt(prompt);

  const { taskId, model } = await createTask({
    prompt: finalPrompt,
    imageUrl
  });

  const taskResult = await waitForTaskSuccess(taskId);
  const remoteVideoUrl = extractVideoUrl(taskResult);
  const saved = await downloadVideoFile(remoteVideoUrl);

  return {
    provider: "seedance",
    model,
    type: "video",
    content: "视频已生成。",
    media: {
      url: saved.publicUrl,
      status: "completed",
      prompt: finalPrompt,
      model,
      taskId
    }
  };
}

module.exports = {
  generate
};