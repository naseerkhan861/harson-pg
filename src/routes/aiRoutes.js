const express =
  require("express");

const multer =
  require("multer");

const aiController =
  require(
    "../controllers/aiController"
  );

const imageController =
  require(
    "../controllers/imageController"
  );

const {
  requireAuth
} =
  require(
    "../middleware/authMiddleware"
  );

const router =
  express.Router();


/*
  图片上传先暂存在服务器内存中。

  当前限制：
  - 最大 10 MB
  - 只允许图片 MIME 类型

  后续 imageController 会把这里收到的图片
  转交给 Seedream 做图片编辑。
*/
const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 * 1024 * 1024
    },

    fileFilter:
      (
        req,
        file,
        callback
      ) => {

        if (
          !file.mimetype ||
          !file.mimetype.startsWith(
            "image/"
          )
        ) {
          return callback(
            new Error(
              "只允许上传图片文件"
            )
          );
        }

        callback(
          null,
          true
        );
      }
  });


router.post(
  "/chat",

  requireAuth,

  aiController.chat
);


/*
  两种请求都继续使用同一个接口：

  纯文本：
  POST /api/ai/image
  Content-Type: application/json

  图片编辑：
  POST /api/ai/image
  Content-Type: multipart/form-data
  image = 上传图片
  prompt = 修改要求
*/
router.post(
  "/image",

  requireAuth,

  upload.single(
    "image"
  ),

  imageController.generateImage
);


module.exports =
  router;