const jwt = require("jsonwebtoken");
const {
  normalizeUserRole
} = require("../constants/userRoles");
const userCsvModel = require("../models/userCsvModel");
const aigcSessionService = require(
  "../services/aigcSessionService"
);

const VALID_GENDERS = ["Male", "Female", "Other"];
const VALID_AGE_GROUPS = [
  "0-10",
  "11-20",
  "21-30",
  "31-40",
  "41-50",
  "51-60",
  "61-70",
  "71-80",
  "81-90"
];

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,

      role: normalizeUserRole(user.role),

      masterAccountId:
        user.masterAccountId || null,

      subAccountId:
        user.subAccountId || null
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || "2h"
    }
  );
}

async function register(req, res) {
  try {
    const { name, email, password, gender, ageGroup } = req.body;

    if (!name || !email || !password || !gender || !ageGroup) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, gender and age group are required."
      });
    }

    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender selected."
      });
    }

    if (!VALID_AGE_GROUPS.includes(ageGroup)) {
      return res.status(400).json({
        success: false,
        message: "Invalid age group selected."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters."
      });
    }

    const user = await userCsvModel.createUser({
      name,
      email,
      password,
      gender,
      ageGroup
    });

    const token = createToken(user);

    res.cookie("harson_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Registration failed."
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await userCsvModel.verifyUser(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = createToken(user);

    res.cookie("harson_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: "Login successful.",
      user
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
}

async function logout(req, res) {
  let aigcLogoutResult = null;
  let aigcLogoutWarning = "";

  try {
    /*
     * requireAuth 已经将当前登录用户
     * 写入 req.user。
     */
    const userId =
      String(
        req.user?.id || ""
      ).trim();

    if (userId) {
      aigcLogoutResult =
        await aigcSessionService
          .logoutUserAigcSession(
            userId
          );

      /*
       * YiBai 注销失败不能阻止
       * Harson-Base 用户退出。
       */
      if (
        aigcLogoutResult &&
        aigcLogoutResult.success ===
          false
      ) {
        aigcLogoutWarning =
          aigcLogoutResult.message ||
          "AIGC 共享登录态注销失败";

        console.warn(
          "Harson-Base 用户已退出，但 AIGC 共享登录态处理失败：",
          aigcLogoutWarning
        );
      }
    }
  } catch (error) {
    /*
     * 外部 AIGC 服务异常时，
     * 仍然必须清除本地登录 Cookie。
     *
     * 不输出 token、密码或请求体。
     */
    aigcLogoutWarning =
      error.message ||
      "AIGC 共享登录态处理失败";

    console.warn(
      "Harson-Base 注销时处理 AIGC 登录态失败：",
      aigcLogoutWarning
    );
  } finally {
    res.clearCookie(
      "harson_token"
    );
  }

  return res.json({
    success: true,
    message:
      "Harson-Base 已退出登录。",

    aigcSession: {
      action:
        aigcLogoutResult?.action ||
        "not_processed",

      tokenRetained:
        aigcLogoutResult?.action ===
        "token_retained",

      providerLoggedOut:
        aigcLogoutResult?.action ===
        "provider_logged_out",

      warning:
        aigcLogoutWarning
    }
  });
}

async function me(req, res) {
  try {
    const userId = String(
      req.user?.id || ""
    ).trim();

    if (!userId) {
      res.clearCookie("harson_token");

      return res.status(401).json({
        success: false,
        message:
          "当前 Harson-Base 登录状态无效。"
      });
    }

    const user =
      await userCsvModel.findById(
        userId
      );

    if (
      !user ||
      user.isActive !== true
    ) {
      res.clearCookie("harson_token");

      return res.status(401).json({
        success: false,
        message:
          "当前 Harson-Base 账号不存在或已停用。"
      });
    }

    return res.json({
      success: true,
      user: {
        ...user,
        role:
          normalizeUserRole(
            user.role
          )
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "读取 Harson-Base 登录信息失败。"
    });
  }
}



module.exports = { register, login, logout, me };