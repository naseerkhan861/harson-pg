require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./src/routes/authRoutes");
const aigcAccountRoutes = require("./src/routes/aigcAccountRoutes");

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
        "frame-ancestors": ["'self'"]
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
    message: { success: false, message: "Too many requests. Please try again later." }
  }),
  authRoutes
);

app.use(
  "/api/aigc",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { success: false, message: "Too many requests. Please try again later." }
  }),
  aigcAccountRoutes
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/account-management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "account-management.html"));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

connectDB();

app.listen(PORT, () => {
  console.log(`HARSON app running at http://localhost:${PORT}`);
});
