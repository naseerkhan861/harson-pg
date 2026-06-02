const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

let mainWindow;
let serverProcess;

const PORT = process.env.PORT || 3000;

function waitForServer(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function check() {
      const socket = new net.Socket();

      socket.setTimeout(1000);

      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - startTime > timeout) {
          reject(new Error("Server did not start in time."));
        } else {
          setTimeout(check, 500);
        }
      });

      socket.once("timeout", () => {
        socket.destroy();

        if (Date.now() - startTime > timeout) {
          reject(new Error("Server start timeout."));
        } else {
          setTimeout(check, 500);
        }
      });

      socket.connect(port, "127.0.0.1");
    }

    check();
  });
}

function startServer() {
  const serverPath = path.join(app.getAppPath(), "server.js");

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT)
    },
    stdio: "pipe"
  });

  serverProcess.stdout.on("data", data => {
    console.log(`[SERVER] ${data}`);
  });

  serverProcess.stderr.on("data", data => {
    console.error(`[SERVER ERROR] ${data}`);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "HARSON Platform",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await waitForServer(PORT);
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (error) {
    dialog.showErrorBox(
      "Startup Error",
      "HARSON Platform could not start. Please contact support."
    );
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});