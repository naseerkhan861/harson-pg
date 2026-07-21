"use strict";

const FRAME_LOGIN_INVALID =
  "AIGC_LOGIN_INVALID";

const DEFAULT_MODULE =
  "image-generator";

const state = {
  currentModule: DEFAULT_MODULE,
  currentFrameOrigin: "",
  loading: false
};

const elements = {
  frame:
    document.getElementById("aigcFrame"),

  loadingPanel:
    document.getElementById("loadingPanel"),

  errorPanel:
    document.getElementById("errorPanel"),

  errorMessage:
    document.getElementById("errorMessage"),

  mockPanel:
    document.getElementById("mockPanel"),

  mockSessionDetails:
    document.getElementById(
      "mockSessionDetails"
    ),

  connectionStatus:
    document.getElementById(
      "connectionStatus"
    ),

  refreshButton:
    document.getElementById(
      "refreshSessionBtn"
    ),

  retryButton:
    document.getElementById("retryButton"),

  moduleNavigation:
    document.getElementById(
      "moduleNavigation"
    )
};

function setConnectionStatus(
  text,
  className = ""
) {
  elements.connectionStatus.textContent =
    text;

  elements.connectionStatus.className =
    `connection-status ${className}`.trim();
}

function hideAllPanels() {
  elements.loadingPanel.hidden = true;
  elements.errorPanel.hidden = true;
  elements.mockPanel.hidden = true;
  elements.frame.hidden = true;
}

function showLoading() {
  hideAllPanels();

  elements.loadingPanel.hidden = false;

  setConnectionStatus("正在连接");

  state.loading = true;
  elements.refreshButton.disabled = true;
}

function showError(message) {
  hideAllPanels();

  elements.errorMessage.textContent =
    message;

  elements.errorPanel.hidden = false;

  setConnectionStatus("连接失败", "error");

  state.loading = false;
  elements.refreshButton.disabled = false;
}

function showMockSession(result) {
  hideAllPanels();

  elements.mockSessionDetails.textContent =
    [
      `module: ${result.module}`,
      `provider: ${result.providerAccount}`,
      `token source: ${result.tokenSource}`
    ].join(" | ");

  elements.mockPanel.hidden = false;

  setConnectionStatus(
    "模拟连接成功",
    "connected"
  );

  state.loading = false;
  elements.refreshButton.disabled = false;
}

function showFrame(frameUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(frameUrl);
  } catch {
    throw new Error(
      "后端返回了无效的 iframe 地址"
    );
  }

  state.currentFrameOrigin =
    parsedUrl.origin;

  elements.frame.src = frameUrl;

  hideAllPanels();
  elements.frame.hidden = false;

  setConnectionStatus(
    "已连接",
    "connected"
  );

  state.loading = false;
  elements.refreshButton.disabled = false;
}

function updateActiveModuleButton() {
  const buttons =
    elements.moduleNavigation
      .querySelectorAll("[data-module]");

  buttons.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.module ===
        state.currentModule
    );
  });
}

async function requestSession({
  refresh = false
} = {}) {
  if (state.loading) {
    return;
  }

  showLoading();

  try {
    const endpoint = refresh
      ? "/api/aigc/session/refresh"
      : `/api/aigc/session?module=${encodeURIComponent(
          state.currentModule
        )}`;

    const response = await fetch(endpoint, {
      method: refresh ? "POST" : "GET",
      credentials: "include",
      headers: refresh
        ? {
            "Content-Type":
              "application/json"
          }
        : undefined,
      body: refresh
        ? JSON.stringify({
            module: state.currentModule
          })
        : undefined
    });

    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "CL-AIGC session 获取失败"
      );
    }

    if (data.result.mockMode) {
      showMockSession(data.result);
      return;
    }

    showFrame(data.result.frameUrl);
  } catch (error) {
    showError(
      error.message ||
      "CL-AIGC 加载失败"
    );
  }
}

function handleModuleClick(event) {
  const button =
    event.target.closest("[data-module]");

  if (!button || state.loading) {
    return;
  }

  const nextModule =
    button.dataset.module;

  if (!nextModule) {
    return;
  }

  state.currentModule = nextModule;

  updateActiveModuleButton();
  requestSession();
}

function handleIframeMessage(event) {
  if (
    event.source !==
    elements.frame.contentWindow
  ) {
    return;
  }

  if (
    !state.currentFrameOrigin ||
    event.origin !==
      state.currentFrameOrigin
  ) {
    return;
  }

  if (
    event.data?.type ===
    FRAME_LOGIN_INVALID
  ) {
    requestSession({
      refresh: true
    });
  }
}

elements.moduleNavigation.addEventListener(
  "click",
  handleModuleClick
);

elements.refreshButton.addEventListener(
  "click",
  () => {
    requestSession({
      refresh: true
    });
  }
);

elements.retryButton.addEventListener(
  "click",
  () => {
    requestSession();
  }
);

window.addEventListener(
  "message",
  handleIframeMessage
);

requestSession();