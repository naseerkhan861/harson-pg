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

const videoController =
  require(
    "../controllers/videoController"
  );

const {
  requireAuth
} =
  require(
    "../middleware/authMiddleware"
  );

const router =
  express.Router();


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


router.post(
  "/image",
  requireAuth,
  upload.single(
    "image"
  ),
  imageController.generateImage
);


/*
  PoC 视频生成接口：
  POST /api/ai/video

  当前：
  - Seedance 1.5 Pro
  - 文生视频
  - 4 秒默认
  - 720p 默认
  - draft 样片模式
*/
router.post(
  "/video",
  requireAuth,
  videoController.generateVideo
);


module.exports =
  router;