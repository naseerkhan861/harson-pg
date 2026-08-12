"use strict";

const https = require("https");
const path = require("path");

const ALLOWED_HOSTS = new Set([
  "image.yibaiaigc.com",
  "yb-ai.oss-cn-hangzhou.aliyuncs.com",
  "yb-ai.oss-accelerate.aliyuncs.com"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4"
]);

function sanitizeFilename(filename, targetUrl) {
  let safeName = String(
    filename ||
      path.basename(targetUrl.pathname) ||
      "harson-aigc-file"
  ).trim();

  safeName = safeName.replace(
    /[\\/:*?"<>|\r\n]/g,
    "_"
  );

  return safeName || "harson-aigc-file";
}

function proxyDownload(req, res) {
  const rawUrl = String(
    req.query.url || ""
  ).trim();

  const requestedFilename = String(
    req.query.filename || ""
  ).trim();

  if (!rawUrl) {
    return res.status(400).json({
      success: false,
      message: "缺少下载地址"
    });
  }

  let targetUrl;

  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({
      success: false,
      message: "下载地址无效"
    });
  }

  if (
    targetUrl.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(
      targetUrl.hostname
    )
  ) {
    return res.status(403).json({
      success: false,
      message: "该文件地址不允许下载"
    });
  }

  const extension = path
    .extname(targetUrl.pathname)
    .toLowerCase();

  if (
    !ALLOWED_EXTENSIONS.has(extension)
  ) {
    return res.status(400).json({
      success: false,
      message: "暂不支持该文件类型"
    });
  }

  const filename =
    sanitizeFilename(
      requestedFilename,
      targetUrl
    );

  const upstreamRequest = https.get(
    targetUrl,
    {
      headers: {
        Accept: "*/*"
      }
    },
    upstreamResponse => {
      const statusCode =
        upstreamResponse.statusCode || 500;

      if (
        statusCode < 200 ||
        statusCode >= 300
      ) {
        upstreamResponse.resume();

        return res.status(502).json({
          success: false,
          message:
            `文件获取失败（${statusCode}）`
        });
      }

      res.status(200);

      res.setHeader(
        "Content-Type",
        upstreamResponse.headers[
          "content-type"
        ] || "application/octet-stream"
      );

      const contentLength =
        upstreamResponse.headers[
          "content-length"
        ];

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`
      );

      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );

      upstreamResponse.pipe(res);
    }
  );

  upstreamRequest.on(
    "error",
    error => {
      console.error(
        "Harson-Base 文件下载失败：",
        error
      );

      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: "文件下载失败"
        });
      } else {
        res.destroy();
      }
    }
  );
}

module.exports = {
  proxyDownload
};