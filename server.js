require("dotenv").config();

const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const {
  USER_ROLES,
  normalizeUserRole
} = require("./src/constants/userRoles");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./src/routes/authRoutes");

const aigcAccountRoutes = require("./src/routes/aigcAccountRoutes");
const userCsvModel = require(
  "./src/models/userCsvModel"
);

const connectDB = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://cdnjs.cloudflare.com"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],
        "img-src": ["'self'", "data:", "https://www.zhihuiyunji.com"],
        "connect-src": ["'self'"],
        "frame-src": [
          "'self'",
          "https://cl-base.yibaiaigc.com",
          "https://yibaiaigc.com"
        ],
        "frame-ancestors": ["'self'"],
        "upgrade-insecure-requests": null
      }
    }
  })
);

app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: {
      success: false,
      message: "Too many requests. Please try again later."
    }
  }),
  authRoutes
);

app.use(
  "/api/aigc",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: {
      success: false,
      message: "Too many requests. Please try again later."
    }
  }),
  aigcAccountRoutes
);

app.use(express.static(path.join(__dirname, "public")));


async function getCurrentPageUser(
  req
) {
  const token =
    req.cookies?.harson_token;

  if (!token) {
    return null;
  }

  try {
    const tokenUser =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    if (!tokenUser?.id) {
      return null;
    }

    const currentUser =
      await userCsvModel.findById(
        tokenUser.id
      );

    if (
      !currentUser ||
      !currentUser.isActive
    ) {
      return null;
    }

    return {
      ...tokenUser,
      ...currentUser,

      role:
        normalizeUserRole(
          currentUser.role
        )
    };
  } catch {
    return null;
  }
}



async function sendAdminOnlyPage(
  req,
  res,
  filename
) {
  const user =
    await getCurrentPageUser(
      req
    );

  if (
    !user ||
    user.role !==
      USER_ROLES.PLATFORM_ADMIN
  ) {
    return res
      .status(200)
      .send("");
  }

  return res.sendFile(
    path.join(
      __dirname,
      "public",
      filename
    )
  );
}

async function sendEnterpriseMemberPage(
  req,
  res,
  filename
) {
  const user =
    await getCurrentPageUser(
      req
    );

  if (!user) {
    return res.redirect(
      "/login"
    );
  }

  const masterAccountId =
    String(
      user.masterAccountId || ""
    ).trim();

  const subAccountId =
    String(
      user.subAccountId || ""
    ).trim();

  if (
    user.role !==
      USER_ROLES.MEMBER ||
    !masterAccountId ||
    !subAccountId
  ) {
    return res.redirect(
      "/account-management"
    );
  }

  return res.sendFile(
    path.join(
      __dirname,
      "public",
      filename
    )
  );
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/account-management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "account-management.html"));
});

/*
  Dashboard style routes

  /dashboard             -> default dashboard entrance
  /dashboard-black-gold  -> black-gold style dashboard
  /dashboard-mecha       -> mecha style dashboard

  All dashboard pages are still admin-only.
*/

app.get("/dashboard", (req, res) => {
  res.redirect("/dashboard-black-gold");
});

app.get("/dashboard-black-gold", (req, res) => {
  return sendAdminOnlyPage(req, res, "dashboard-black-gold.html");
});

app.get("/dashboard-mecha", (req, res) => {
  return sendAdminOnlyPage(req, res, "dashboard-mecha.html");
});

app.get("/aigc", (req, res) => {
  return sendAdminOnlyPage(req, res, "aigc.html");
});

app.get(
  "/aigc-workspace",
  (req, res) => {
    return sendEnterpriseMemberPage(
      req,
      res,
      "aigc-workspace.html"
    );
  }
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

connectDB();

app.listen(PORT, () => {
  console.log(`HARSON app running at http://localhost:${PORT}`);
});