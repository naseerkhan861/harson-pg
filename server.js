require("dotenv").config();

const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./src/routes/authRoutes");
const aigcAccountRoutes = require("./src/routes/aigcAccountRoutes");
const masterOwnerModel = require(
  "./src/models/aigcMasterOwnerCsvModel"
);

const connectDB = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

// App runs behind nginx, which sets X-Forwarded-For. Trust one proxy hop so
// express-rate-limit sees the real client IP instead of erroring out.
app.set("trust proxy", 1);

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
        "img-src": [
          "'self'",
          "data:",
          "https://www.zhihuiyunji.com",
          "https://yb-ai.oss-accelerate.aliyuncs.com"
        ],
        "connect-src": ["'self'"],
        "frame-src": [
          "'self'",
          "blob:",
          "https://ai.harson-base.com"
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

app.get(
  "/dashboard-black-gold.html",
  (req, res) => {
    return sendDashboardPage(
      req,
      res,
      "dashboard-black-gold.html"
    );
  }
);

app.get(
  "/dashboard-mecha.html",
  (req, res) => {
    return sendDashboardPage(
      req,
      res,
      "dashboard-mecha.html"
    );
  }
);

app.use(express.static(path.join(__dirname, "public")));

function sendAdminOnlyPage(req, res, filename) {
  const token = req.cookies?.harson_token;

  if (!token) {
    return res.status(200).send("");
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);

    if (!user || user.role !== "admin") {
      return res.status(200).send("");
    }

    return res.sendFile(path.join(__dirname, "public", filename));
  } catch {
    return res.status(200).send("");
  }
}

function sendDashboardPage(
  req,
  res,
  filename
) {
  const token =
    req.cookies?.harson_token;

  if (!token) {
    return res.status(200).send("");
  }

  try {
    const user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const ownerMapping =
      user?.role !== "admin" &&
      user?.id
        ? masterOwnerModel
            .getActiveMappingByUserId(
              user.id
            )
        : null;

    if (
      user?.role !== "admin" &&
      !ownerMapping
    ) {
      return res.status(200).send("");
    }

    return res.sendFile(
      path.join(
        __dirname,
        "public",
        filename
      )
    );
  } catch {
    return res.status(200).send("");
  }
}

function sendAuthenticatedPage(
  req,
  res,
  filename
) {
  const token = req.cookies?.harson_token;

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!user?.id) {
      return res.redirect("/login");
    }

    return res.sendFile(
      path.join(
        __dirname,
        "public",
        filename
      )
    );
  } catch {
    return res.redirect("/login");
  }
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

  Dashboard pages are available to administrators
  and bound enterprise master-account owners.
*/

app.get("/dashboard", (req, res) => {
  res.redirect("/dashboard-black-gold");
});

app.get("/dashboard-black-gold", (req, res) => {
  return sendDashboardPage(req, res, "dashboard-black-gold.html");
});

app.get("/dashboard-mecha", (req, res) => {
  return sendDashboardPage(req, res, "dashboard-mecha.html");
});

app.get("/aigc", (req, res) => {
  return sendAdminOnlyPage(req, res, "aigc.html");
});

app.get(
  "/aigc-workspace",
  (req, res) => {
    return sendAuthenticatedPage(
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
