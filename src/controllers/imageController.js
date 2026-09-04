const seedreamProvider =
  require(
    "../services/ai/seedreamProvider"
  );


const ALLOWED_SIZES =
  new Set([
    "2K",
    "4K",
    "1024x1024",
    "1536x1024",
    "1024x1536"
  ]);


async function generateImage(
  req,
  res
) {

  try {

    const prompt =
      String(
        req.body?.prompt || ""
      ).trim();


    const size =
      String(
        req.body?.size ||
        "2K"
      ).trim();


    if (!prompt) {

      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "请输入图片生成或修改需求。"

        });

    }


    if (
      prompt.length >
      3000
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "图片生成或修改需求过长。"

        });

    }


    if (
      !ALLOWED_SIZES.has(
        size
      )
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "不支持该图片尺寸。"

        });

    }


    /*
      req.file 不存在：
      -> 普通文生图

      req.file 存在：
      -> 把上传图片交给 Seedream 做参考图编辑
    */
    const imageBuffer =
      req.file?.buffer ||
      null;


    const imageMimeType =
      req.file?.mimetype ||
      null;


    const result =
      await seedreamProvider
        .generate({

          prompt,

          size,

          imageBuffer,

          imageMimeType

        });


    return res.json({

      success:
        true,

      result

    });

  } catch (error) {

    console.error(
      "[AI Image Error]",
      error.message
    );


    const missingKey =
      error.message ===
      "ARK_API_KEY 未配置";


    return res
      .status(
        missingKey
          ? 503
          : 502
      )
      .json({

        success:
          false,

        message:
          missingKey
            ? "图片生成服务尚未配置。"
            : "图片生成或修改失败，请稍后重试。"

      });

  }

}


module.exports = {
  generateImage
};
