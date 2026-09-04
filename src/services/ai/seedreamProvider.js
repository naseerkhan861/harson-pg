const fs =
  require("fs/promises");

const path =
  require("path");

const crypto =
  require("crypto");


const SEEDREAM_URL =
  "https://ark.cn-beijing.volces.com/api/v3/images/generations";

const DEFAULT_MODEL =
  "doubao-seedream-5-0-260128";

const DEFAULT_SIZE =
  "2K";

const OUTPUT_DIR =
  path.join(
    process.cwd(),
    "public",
    "generated",
    "aigc"
  );


function normalizePrompt(
  prompt
) {

  const text =
    String(
      prompt || ""
    ).trim();

  if (!text) {

    throw new Error(
      "图片生成提示词不能为空"
    );

  }

  if (
    text.length >
    3000
  ) {

    throw new Error(
      "图片生成提示词过长"
    );

  }

  return text;

}


function createImageDataUrl({
  buffer,
  mimetype
}) {

  if (
    !buffer ||
    !Buffer.isBuffer(
      buffer
    )
  ) {

    return null;

  }

  const finalMimeType =
    String(
      mimetype ||
      "image/png"
    ).toLowerCase();

  if (
    !finalMimeType.startsWith(
      "image/"
    )
  ) {

    throw new Error(
      "上传文件不是有效图片"
    );

  }

  return (
    `data:${finalMimeType};base64,` +
    buffer.toString(
      "base64"
    )
  );

}


async function downloadGeneratedImage(
  imageUrl
) {

  if (!imageUrl) {

    throw new Error(
      "Seedream 未返回有效图片地址"
    );

  }

  const response =
    await fetch(
      imageUrl
    );

  if (
    !response.ok
  ) {

    throw new Error(
      `生成图片下载失败：${response.status}`
    );

  }

  const arrayBuffer =
    await response
      .arrayBuffer();

  const buffer =
    Buffer.from(
      arrayBuffer
    );

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive:
        true
    }
  );

  const filename =
    `cl-aigc-${Date.now()}-${crypto.randomUUID()}.png`;

  const outputPath =
    path.join(
      OUTPUT_DIR,
      filename
    );

  await fs.writeFile(
    outputPath,
    buffer
  );

  return {
    filename,

    publicUrl:
      `/generated/aigc/${filename}`
  };

}


async function generate({

  prompt,

  size =
    DEFAULT_SIZE,

  imageBuffer =
    null,

  imageMimeType =
    null

}) {

  const apiKey =
    process.env
      .ARK_API_KEY;

  if (!apiKey) {

    throw new Error(
      "ARK_API_KEY 未配置"
    );

  }

  const finalPrompt =
    normalizePrompt(
      prompt
    );

  const model =
    process.env
      .SEEDREAM_MODEL ||
    DEFAULT_MODEL;

  const imageDataUrl =
    createImageDataUrl({
      buffer:
        imageBuffer,

      mimetype:
        imageMimeType
    });


  /*
    Seedream 5.0-lite 的同一个图片生成 API
    同时支持：

    1. 只有 prompt
       -> 文生图

    2. prompt + image[]
       -> 参考图 / 图片编辑
  */
  const requestBody = {

    model,

    prompt:
      finalPrompt,

    size,

    output_format:
      "png",

    response_format:
      "url",

    sequential_image_generation:
      "disabled",

    stream:
      false,

    watermark:
      false

  };


  if (
    imageDataUrl
  ) {

    requestBody.image =
      [
        imageDataUrl
      ];

  }


  const response =
    await fetch(

      SEEDREAM_URL,

      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`

        },

        body:
          JSON.stringify(
            requestBody
          )

      }

    );


  const data =
    await response
      .json();


  if (
    !response.ok
  ) {

    const message =
      data?.error?.message ||
      `Seedream 请求失败：${response.status}`;

    throw new Error(
      message
    );

  }


  const remoteUrl =
    data?.data?.[0]?.url;

  const remoteSize =
    data?.data?.[0]?.size ||
    size;


  const saved =
    await downloadGeneratedImage(
      remoteUrl
    );


  return {

    provider:
      "seedream",

    model,

    type:
      "image",

    content:
      imageDataUrl
        ? "图片修改已完成。"
        : "图片已生成。",

    media: {

      url:
        saved.publicUrl,

      status:
        "completed",

      prompt:
        finalPrompt,

      model,

      size:
        remoteSize,

      operation:
        imageDataUrl
          ? "image-edit"
          : "text-to-image"

    },

    usage: {

      generatedImages:
        data?.usage
          ?.generated_images ||
        1,

      outputTokens:
        data?.usage
          ?.output_tokens ||
        0,

      totalTokens:
        data?.usage
          ?.total_tokens ||
        0

    }

  };

}


module.exports = {

  generate

};
