const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

const PORT = process.env.PORT || 3000;
const APP_URL = `http://localhost:${PORT}`;

function loadEnvFileIfExists() {
  const possibleEnvFiles = [
    path.join(__dirname, ".env"),
    path.join(process.resourcesPath || "", ".env"),
    path.join(process.cwd(), ".env")
  ];

  const envFile = possibleEnvFiles.find(filePath => filePath && fs.existsSync(filePath));

  if (!envFile) {
    console.warn("[HARSON] No .env file found for Electron app.");
    return;
  }

  try {
    require("dotenv").config({ path: envFile });
    console.log("[HARSON] Loaded .env from:", envFile);
  } catch (error) {
    console.warn("[HARSON] Failed to load .env:", error.message);
  }
}

function copyFileIfMissing(source, target) {
  if (!fs.existsSync(source)) {
    console.warn("[HARSON] Source file missing, skipped:", source);
    return;
  }

  if (fs.existsSync(target)) {
    return;
  }

  const content = fs.readFileSync(source);
  fs.writeFileSync(target, content);
  console.log("[HARSON] Copied:", source, "=>", target);
}

function prepareUserDataFolder() {
  const userDataPath = app.getPath("userData");
  const runtimeDataPath = path.join(userDataPath, "data");

  if (!fs.existsSync(runtimeDataPath)) {
    fs.mkdirSync(runtimeDataPath, { recursive: true });
  }

  const packagedDataPath = path.join(__dirname, "data");

  const csvFiles = [
    "users.secure.csv",
    "users.example.csv",
    "account_mappings.secure.csv",
    "aigc_master_accounts.secure.csv",
    "aigc_sub_accounts.secure.csv",
    "creative_works.secure.csv"
  ];

  for (const fileName of csvFiles) {
    copyFileIfMissing(
      path.join(packagedDataPath, fileName),
      path.join(runtimeDataPath, fileName)
    );
  }

  process.env.HARSON_DATA_DIR = runtimeDataPath;

  // Force absolute runtime CSV paths for any older code that may still read CSV_* variables.
  process.env.CSV_USER_FILE = path.join(runtimeDataPath, "users.secure.csv");
  process.env.CSV_AIGC_MASTER_FILE = path.join(runtimeDataPath, "aigc_master_accounts.secure.csv");
  process.env.CSV_AIGC_SUB_FILE = path.join(runtimeDataPath, "aigc_sub_accounts.secure.csv");
  process.env.CSV_ACCOUNT_MAPPING_FILE = path.join(runtimeDataPath, "account_mappings.secure.csv");
  process.env.CSV_CREATIVE_WORK_FILE = path.join(runtimeDataPath, "creative_works.secure.csv");

  console.log("[HARSON] HARSON_DATA_DIR =", process.env.HARSON_DATA_DIR);
}

function startExpressServer() {
  try {
    loadEnvFileIfExists();
    prepareUserDataFolder();
    require("./server.js");
  } catch (error) {
    dialog.showErrorBox("Server Error", error.stack || error.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: "HARSON CL_Base Platform",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  setTimeout(() => {
    mainWindow.loadURL(APP_URL);
  }, 1500);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startExpressServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
