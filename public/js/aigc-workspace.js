"use strict";

const FRAME_LOGIN_INVALID =
  "AIGC_LOGIN_INVALID";

const MEMBER_INFO =
  "MEMBER_INFO";

const TOKEN_BALANCE_STORAGE_KEY =
  "clBaseTokenBalance";

const DEFAULT_MODULE =
  "image-generator";

const DEFAULT_VIEW =
  "home";

const HOME_BANNER_INTERVAL_MS =
  4500;

const BACKGROUND_TOKEN_WAIT_MS =
  5000;

const ALL_TOOLS = Object.freeze([
  {
    name: "全能图片 pro",
    subtitle: "IMAGE LAB",
    cover:
      "/images/all-tools/01-quanneng-tupian-pro.png"
  },
  {
    name: "Seedream 5.0 Pro",
    subtitle: "DREAM STUDIO",
    cover:
      "/images/all-tools/02-seedream-5-pro.png"
  },
  {
    name: "批量换主体",
    subtitle: "SUBJECT SWAP",
    cover:
      "/images/all-tools/03-subject-swap.png"
  },
  {
    name: "爆款视频复刻",
    subtitle: "VIDEO REMIX",
    cover:
      "/images/all-tools/04-video-remix.png"
  },
  {
    name: "image-2",
    subtitle: "IMAGE ENGINE",
    cover:
      "/images/all-tools/05-image-2.png"
  },
  {
    name: "Seedance 2.0 视频",
    subtitle: "MOTION LAB",
    cover:
      "/images/all-tools/06-seedance-video.png"
  },
  {
    name: "批量换衣",
    subtitle: "OUTFIT SWAP",
    cover:
      "/images/all-tools/07-outfit-swap.png"
  },
  {
    name: "AI 商品主图",
    subtitle: "PRODUCT HERO",
    cover:
      "/images/all-tools/08-product-hero.png"
  },
  {
    name: "智能仿商品图 / 详情图",
    subtitle: "PRODUCT REPLICA",
    cover:
      "/images/all-tools/09-product-replica.png"
  },
  {
    name: "AI 商品详情页",
    subtitle: "DETAIL PAGE",
    cover:
      "/images/all-tools/10-detail-page.png"
  },
  {
    name: "Seedream 4.5",
    subtitle: "DREAM STUDIO",
    cover:
      "/images/all-tools/11-seedream-4.5.png"
  },
  {
    name: "家纺主图裂变",
    subtitle: "HOME TEXTILE",
    cover:
      "/images/all-tools/12-home-textile.png"
  },
  {
    name: "高清放大 2.0",
    subtitle: "UPSCALER",
    cover:
      "/images/all-tools/13-upscaler.png"
  },
  {
    name: "悠船 MJ V7",
    subtitle: "VISUAL MODEL",
    cover:
      "/images/all-tools/14-visual-model.png"
  },
  {
    name: "提取花纹 · 高级版",
    subtitle: "PATTERN EXTRACT",
    cover:
      "/images/all-tools/15-pattern-extract.png"
  },
  {
    name: "一键同款",
    subtitle: "STYLE MATCH",
    cover:
      "/images/all-tools/16-style-match.png"
  },
  {
    name: "服装主图裂变",
    subtitle: "FASHION HERO",
    cover:
      "/images/all-tools/17-fashion-hero.png"
  },
  {
    name: "风格转换",
    subtitle: "STYLE TRANSFER",
    cover:
      "/images/all-tools/18-style-transfer.png"
  },
  {
    name: "服装主图姿势裂变",
    subtitle: "POSE VARIATION",
    cover:
      "/images/all-tools/19-pose-variation.png"
  },
  {
    name: "AI 服装视频（测试版）",
    subtitle: "FASHION VIDEO",
    cover:
      "/images/all-tools/20-fashion-video.png"
  },
  {
    name: "图案接版（四方连续）",
    subtitle: "SEAMLESS TILE",
    cover:
      "/images/all-tools/21-seamless-tile.png"
  },
  {
    name: "转矢量",
    subtitle: "VECTORIZE",
    cover:
      "/images/all-tools/22-vectorize.png"
  },
  {
    name: "去水印",
    subtitle: "CLEAN IMAGE",
    cover:
      "/images/all-tools/23-clean-image.png"
  },
  {
    name: "服装详情图裂变",
    subtitle: "DETAIL VARIATION",
    cover:
      "/images/all-tools/24-detail-variation.png"
  },
  {
    name: "抠图移除背景",
    subtitle: "BACKGROUND REMOVE",
    cover:
      "/images/all-tools/25-background-remove.png"
  },
  {
    name: "混图",
    subtitle: "IMAGE BLEND",
    cover:
      "/images/all-tools/26-image-blend.png"
  },
  {
    name: "FLUX.1 Kontext",
    subtitle: "CONTEXT MODEL",
    cover:
      "/images/all-tools/27-flux-kontext.png"
  },
  {
    name: "AI 服装视频 · 元素替换",
    subtitle: "ELEMENT SWAP",
    cover:
      "/images/all-tools/28-element-swap.png"
  },
  {
    name: "提取线稿",
    subtitle: "LINE ART",
    cover:
      "/images/all-tools/29-line-art.png"
  },
  {
    name: "风格绘画",
    subtitle: "STYLE PAINT",
    cover:
      "/images/all-tools/30-style-paint.png"
  },
  {
    name: "去布纹",
    subtitle: "TEXTURE CLEAN",
    cover:
      "/images/all-tools/31-texture-clean.png"
  },
  {
    name: "图案配色",
    subtitle: "COLOR MATCH",
    cover:
      "/images/all-tools/32-color-match.png"
  },
  {
    name: "图案接版（跳接）",
    subtitle: "HALF DROP",
    cover:
      "/images/all-tools/33-half-drop.png"
  },
  {
    name: "FLUX Krea",
    subtitle: "CREATIVE MODEL",
    cover:
      "/images/all-tools/34-flux-krea.png"
  },
  {
    name: "爱马仕文生图",
    subtitle: "TEXT TO IMAGE",
    cover:
      "/images/all-tools/35-text-to-image.png"
  },
  {
    name: "指定风格造型",
    subtitle: "STYLE SHAPING",
    cover:
      "/images/all-tools/36-style-shaping.png"
  },
  {
    name: "爱马仕图生图",
    subtitle: "IMAGE TO IMAGE",
    cover:
      "/images/all-tools/37-image-to-image.png"
  },
  {
    name: "图片混合",
    subtitle: "IMAGE MIX",
    cover:
      "/images/all-tools/38-image-mix.png"
  },
  {
    name: "平面转立体",
    subtitle: "2D TO 3D",
    cover:
      "/images/all-tools/39-2d-to-3d.png"
  }
]);

const state = {
  currentView:
    DEFAULT_VIEW,

  currentModule:
    DEFAULT_MODULE,

  currentFrameOrigin:
    "",

  loading:
    false,

  tokenBalance:
    null,

  requestVersion:
    0,

  homeBannerIndex:
    0,

  homeBannerTimerId:
    null,

  backgroundRefreshId:
    0,

  backgroundRefreshing:
    false,

  awaitingMemberInfo:
    false,

  memberInfoTimeoutId:
    null,

  refreshFeedbackTimerId:
    null
};

const elements = {
  frame:
    document.getElementById(
      "aigcFrame"
    ),

  homePanel:
    document.getElementById(
      "homePanel"
    ),

  allToolsPanel:
    document.getElementById(
      "allToolsPanel"
    ),

  allToolsGrid:
    document.getElementById(
      "allToolsGrid"
    ),

  loadingPanel:
    document.getElementById(
      "loadingPanel"
    ),

  errorPanel:
    document.getElementById(
      "errorPanel"
    ),

  errorMessage:
    document.getElementById(
      "errorMessage"
    ),

  mockPanel:
    document.getElementById(
      "mockPanel"
    ),

  mockSessionDetails:
    document.getElementById(
      "mockSessionDetails"
    ),

  tokenBalanceButton:
    document.getElementById(
      "tokenBalanceButton"
    ),

  tokenBalanceValue:
    document.getElementById(
      "tokenBalanceValue"
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
    document.getElementById(
      "retryButton"
    ),

  moduleNavigation:
    document.getElementById(
      "moduleNavigation"
    ),

  exploreAllToolsButton:
    document.getElementById(
      "exploreAllToolsBtn"
    ),

  homeBanner:
    document.getElementById(
      "homeBanner"
    ),

  homeBannerPrevButton:
    document.getElementById(
      "homeBannerPrevBtn"
    ),

  homeBannerNextButton:
    document.getElementById(
      "homeBannerNextBtn"
    ),

  homeBannerSlides:
    Array.from(
      document.querySelectorAll(
        ".home-banner-slide"
      )
    ),

  homeBannerDots:
    Array.from(
      document.querySelectorAll(
        ".home-banner-dot"
      )
    )
};

function renderAllTools() {
  if (
    !elements.allToolsGrid
  ) {
    return;
  }

  const fragment =
    document.createDocumentFragment();

  ALL_TOOLS.forEach(tool => {
    const card =
      document.createElement(
        "article"
      );

    card.className =
      "catalog-card";

    const cover =
      document.createElement(
        "div"
      );

    cover.className =
      "catalog-cover";

    if (
      typeof tool.cover === "string" &&
      tool.cover.trim() !== ""
    ) {
      const image =
        document.createElement(
          "img"
        );

      image.className =
        "catalog-cover-image";

      image.src =
        tool.cover;

      image.alt =
        tool.name;

      image.loading =
        "lazy";

      image.addEventListener(
        "error",
        () => {
          image.hidden =
            true;

          cover.classList.add(
            "catalog-cover-missing"
          );
        },
        {
          once: true
        }
      );

      cover.append(
        image
      );
    } else {
      cover.classList.add(
        "catalog-cover-missing"
      );
    }

    const title =
      document.createElement(
        "h3"
      );

    title.textContent =
      tool.name;

    card.append(
      cover,
      title
    );

    fragment.append(
      card
    );
  });

  elements.allToolsGrid
    .replaceChildren(
      fragment
    );
}

function setConnectionStatus(
  text,
  className = ""
) {
  if (
    !elements.connectionStatus
  ) {
    return;
  }

  elements.connectionStatus
    .textContent =
      text;

  elements.connectionStatus
    .className =
      `connection-status ${className}`
        .trim();
}

function formatTokenBalance(
  balance
) {
  return new Intl.NumberFormat(
    "zh-CN",
    {
      maximumFractionDigits:
        2
    }
  ).format(
    balance
  );
}

function updateTokenBalance(
  balance
) {
  const normalizedBalance =
    Number(
      balance
    );

  if (
    !Number.isFinite(
      normalizedBalance
    ) ||
    normalizedBalance < 0
  ) {
    return false;
  }

  state.tokenBalance =
    normalizedBalance;

  if (
    elements.tokenBalanceValue
  ) {
    elements.tokenBalanceValue
      .textContent =
        formatTokenBalance(
          normalizedBalance
        );
  }

  try {
    sessionStorage.setItem(
      TOKEN_BALANCE_STORAGE_KEY,
      String(
        normalizedBalance
      )
    );
  } catch {
    // 浏览器禁用存储时，
    // 仅保留当前页面展示。
  }

  return true;
}

function restoreTokenBalance() {
  try {
    const savedBalance =
      sessionStorage.getItem(
        TOKEN_BALANCE_STORAGE_KEY
      );

    if (
      savedBalance !== null
    ) {
      updateTokenBalance(
        savedBalance
      );
    }
  } catch {
    // 浏览器禁用存储时，
    // 保留默认占位符。
  }
}

function hideAllPanels() {
  const panels = [
    elements.homePanel,
    elements.allToolsPanel,
    elements.loadingPanel,
    elements.errorPanel,
    elements.mockPanel,
    elements.frame
  ];

  panels.forEach(panel => {
    if (panel) {
      panel.hidden =
        true;
    }
  });
}

function updateActiveNavigation() {
  if (
    !elements.moduleNavigation
  ) {
    return;
  }

  const buttons =
    elements.moduleNavigation
      .querySelectorAll(
        "[data-view], [data-module]"
      );

  buttons.forEach(button => {
    const viewMatches =
      Boolean(
        button.dataset.view
      ) &&
      state.currentView ===
        button.dataset.view;

    const moduleMatches =
      Boolean(
        button.dataset.module
      ) &&
      state.currentView ===
        "module" &&
      state.currentModule ===
        button.dataset.module;

    button.classList.toggle(
      "active",
      viewMatches ||
      moduleMatches
    );
  });
}

function clearRefreshFeedbackTimer() {
  if (
    state.refreshFeedbackTimerId ===
    null
  ) {
    return;
  }

  window.clearTimeout(
    state.refreshFeedbackTimerId
  );

  state.refreshFeedbackTimerId =
    null;
}

function clearMemberInfoTimeout() {
  if (
    state.memberInfoTimeoutId ===
    null
  ) {
    return;
  }

  window.clearTimeout(
    state.memberInfoTimeoutId
  );

  state.memberInfoTimeoutId =
    null;
}

function setRefreshButton(
  text,
  {
    disabled = false,
    restoreAfter = 0
  } = {}
) {
  if (
    !elements.refreshButton
  ) {
    return;
  }

  clearRefreshFeedbackTimer();

  elements.refreshButton
    .textContent =
      text;

  elements.refreshButton
    .disabled =
      disabled;

  if (
    restoreAfter > 0
  ) {
    state.refreshFeedbackTimerId =
      window.setTimeout(
        () => {
          state.refreshFeedbackTimerId =
            null;

          elements.refreshButton
            .textContent =
              "刷新";

          elements.refreshButton
            .disabled =
              Boolean(
                state.loading ||
                state.backgroundRefreshing ||
                state.awaitingMemberInfo
              );
        },
        restoreAfter
      );
  }
}

function resetRefreshButton() {
  setRefreshButton(
    "刷新",
    {
      disabled:
        Boolean(
          state.loading ||
          state.backgroundRefreshing ||
          state.awaitingMemberInfo
        )
    }
  );
}

function cancelBackgroundTokenSync({
  resetButton = true
} = {}) {
  state.backgroundRefreshId +=
    1;

  state.backgroundRefreshing =
    false;

  state.awaitingMemberInfo =
    false;

  clearMemberInfoTimeout();

  if (
    resetButton
  ) {
    resetRefreshButton();
  }
}

function finishBackgroundTokenSync() {
  state.awaitingMemberInfo =
    false;

  clearMemberInfoTimeout();

  resetRefreshButton();
}

function showLocalView(
  viewName
) {
  state.requestVersion +=
    1;

  state.currentView =
    viewName;

  state.loading =
    false;

  state.currentFrameOrigin =
    "";

  hideAllPanels();

  if (
    viewName ===
    "all-tools"
  ) {
    if (
      elements.allToolsPanel
    ) {
      elements.allToolsPanel
        .hidden =
          false;
    }

    setConnectionStatus(
      "工具总览",
      "connected"
    );

    stopHomeBannerAutoPlay();
  } else {
    state.currentView =
      "home";

    if (
      elements.homePanel
    ) {
      elements.homePanel
        .hidden =
          false;
    }

    setConnectionStatus(
      "平台首页",
      "connected"
    );

    startHomeBannerAutoPlay();
  }

  resetRefreshButton();
  updateActiveNavigation();
}

function showLoading() {
  hideAllPanels();
  stopHomeBannerAutoPlay();

  if (
    elements.loadingPanel
  ) {
    elements.loadingPanel
      .hidden =
        false;
  }

  setConnectionStatus(
    "正在连接"
  );

  state.loading =
    true;

  setRefreshButton(
    "刷新中...",
    {
      disabled:
        true
    }
  );
}

function showError(
  message
) {
  hideAllPanels();

  if (
    elements.errorMessage
  ) {
    elements.errorMessage
      .textContent =
        message;
  }

  if (
    elements.errorPanel
  ) {
    elements.errorPanel
      .hidden =
        false;
  }

  setConnectionStatus(
    "连接失败",
    "error"
  );

  state.loading =
    false;

  resetRefreshButton();
}

function showMockSession(
  result
) {
  hideAllPanels();

  if (
    elements.mockSessionDetails
  ) {
    elements.mockSessionDetails
      .textContent =
        [
          `module: ${result.module}`,
          `provider: ${result.providerAccount}`,
          `token source: ${result.tokenSource}`
        ].join(
          " | "
        );
  }

  if (
    elements.mockPanel
  ) {
    elements.mockPanel
      .hidden =
        false;
  }

  setConnectionStatus(
    "模拟连接成功",
    "connected"
  );

  state.loading =
    false;

  resetRefreshButton();
}

function showFrame(
  frameUrl
) {
  let parsedUrl;

  try {
    parsedUrl =
      new URL(
        frameUrl
      );
  } catch {
    throw new Error(
      "后端返回了无效的 iframe 地址"
    );
  }

  state.currentFrameOrigin =
    parsedUrl.origin;

  if (
    elements.frame
  ) {
    elements.frame.src =
      frameUrl;
  }

  hideAllPanels();

  if (
    elements.frame
  ) {
    elements.frame.hidden =
      false;
  }

  setConnectionStatus(
    "已连接",
    "connected"
  );

  state.loading =
    false;

  resetRefreshButton();
}

async function readJsonResponse(
  response
) {
  try {
    return await response.json();
  } catch {
    throw new Error(
      "服务器返回了无效数据"
    );
  }
}

async function requestSession({
  refresh = false
} = {}) {
  if (
    state.loading
  ) {
    return;
  }

  cancelBackgroundTokenSync({
    resetButton:
      false
  });

  state.currentView =
    "module";

  state.requestVersion +=
    1;

  stopHomeBannerAutoPlay();

  const currentRequestVersion =
    state.requestVersion;

  updateActiveNavigation();
  showLoading();

  try {
    const endpoint =
      refresh
        ? "/api/aigc/session/refresh"
        : `/api/aigc/session?module=${encodeURIComponent(
            state.currentModule
          )}`;

    const response =
      await fetch(
        endpoint,
        {
          method:
            refresh
              ? "POST"
              : "GET",

          credentials:
            "include",

          headers:
            refresh
              ? {
                  "Content-Type":
                    "application/json"
                }
              : undefined,

          body:
            refresh
              ? JSON.stringify({
                  module:
                    state.currentModule
                })
              : undefined
        }
      );

    const data =
      await readJsonResponse(
        response
      );

    if (
      currentRequestVersion !==
      state.requestVersion
    ) {
      return;
    }

    if (
      response.status ===
      401
    ) {
      window.location.href =
        "/login";

      return;
    }

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "CL-AIGC session 获取失败"
      );
    }

    /*
     * 后端现在直接返回最新余额。
     * 无须等待 iframe 发送 MEMBER_INFO。
     */
    updateTokenBalance(
      data.result?.tokenBalance
    );

    if (
      data.result?.mockMode
    ) {
      showMockSession(
        data.result
      );

      return;
    }

    showFrame(
      data.result?.frameUrl
    );
  } catch (error) {
    if (
      currentRequestVersion !==
      state.requestVersion
    ) {
      return;
    }

    showError(
      error instanceof Error
        ? error.message
        : "CL-AIGC 加载失败"
    );
  }
}

async function refreshSessionInBackground() {
  if (
    state.loading ||
    state.backgroundRefreshing
  ) {
    return;
  }

  const startingView =
    state.currentView;

  const jobId =
    state.backgroundRefreshId +
    1;

  state.backgroundRefreshId =
    jobId;

  state.backgroundRefreshing =
    true;

  setRefreshButton(
    "刷新中...",
    {
      disabled:
        true
    }
  );

  try {
    const response =
      await fetch(
        "/api/aigc/session/refresh",
        {
          method:
            "POST",

          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              module:
                state.currentModule ||
                DEFAULT_MODULE
            })
        }
      );

    const data =
      await readJsonResponse(
        response
      );

    if (
      response.status ===
      401
    ) {
      window.location.href =
        "/login";

      return;
    }

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "刷新登录状态失败"
      );
    }

    const isStale =
      jobId !==
        state.backgroundRefreshId ||
      state.currentView !==
        startingView ||
      ![
        "home",
        "all-tools"
      ].includes(
        state.currentView
      );

    if (
      isStale
    ) {
      return;
    }

    /*
     * 直接使用 refresh 接口返回的最新余额。
     * 页面仍停留在首页或全部工具。
     */
    updateTokenBalance(
      data.result?.tokenBalance
    );
  } catch (error) {
    if (
      jobId !==
      state.backgroundRefreshId
    ) {
      return;
    }

    /*
     * 页面不显示额外错误文字，
     * 只在开发者控制台记录。
     */
    console.error(
      "后台刷新登录状态失败：",
      error
    );
  } finally {
    if (
      jobId ===
      state.backgroundRefreshId
    ) {
      state.backgroundRefreshing =
        false;

      state.awaitingMemberInfo =
        false;

      clearMemberInfoTimeout();

      resetRefreshButton();
    }
  }
}

/* 首页 Banner */

function normalizeHomeBannerIndex(
  index
) {
  const slideCount =
    elements.homeBannerSlides
      .length;

  if (
    slideCount === 0
  ) {
    return 0;
  }

  return (
    (
      index %
      slideCount
    ) +
    slideCount
  ) % slideCount;
}

function showHomeBannerSlide(
  index
) {
  if (
    elements.homeBannerSlides
      .length === 0
  ) {
    return;
  }

  const normalizedIndex =
    normalizeHomeBannerIndex(
      index
    );

  state.homeBannerIndex =
    normalizedIndex;

  elements.homeBannerSlides
    .forEach(
      (
        slide,
        slideIndex
      ) => {
        const isActive =
          slideIndex ===
          normalizedIndex;

        slide.classList.toggle(
          "is-active",
          isActive
        );

        slide.setAttribute(
          "aria-hidden",
          String(
            !isActive
          )
        );
      }
    );

  elements.homeBannerDots
    .forEach(
      (
        dot,
        dotIndex
      ) => {
        const isActive =
          dotIndex ===
          normalizedIndex;

        dot.classList.toggle(
          "is-active",
          isActive
        );

        dot.setAttribute(
          "aria-current",
          String(
            isActive
          )
        );
      }
    );
}

function stopHomeBannerAutoPlay() {
  if (
    state.homeBannerTimerId ===
    null
  ) {
    return;
  }

  window.clearInterval(
    state.homeBannerTimerId
  );

  state.homeBannerTimerId =
    null;
}

function startHomeBannerAutoPlay() {
  stopHomeBannerAutoPlay();

  if (
    state.currentView !==
      "home" ||
    document.hidden ||
    elements.homeBannerSlides
      .length <= 1
  ) {
    return;
  }

  state.homeBannerTimerId =
    window.setInterval(
      () => {
        showHomeBannerSlide(
          state.homeBannerIndex +
            1
        );
      },
      HOME_BANNER_INTERVAL_MS
    );
}

function showPreviousHomeBanner() {
  showHomeBannerSlide(
    state.homeBannerIndex -
      1
  );

  startHomeBannerAutoPlay();
}

function showNextHomeBanner() {
  showHomeBannerSlide(
    state.homeBannerIndex +
      1
  );

  startHomeBannerAutoPlay();
}

function handleHomeBannerDotClick(
  event
) {
  const button =
    event.target.closest(
      "[data-banner-target]"
    );

  if (
    !button
  ) {
    return;
  }

  const targetIndex =
    Number(
      button.dataset
        .bannerTarget
    );

  if (
    !Number.isInteger(
      targetIndex
    )
  ) {
    return;
  }

  showHomeBannerSlide(
    targetIndex
  );

  startHomeBannerAutoPlay();
}

function handleHomeBannerVisibilityChange() {
  if (
    document.hidden
  ) {
    stopHomeBannerAutoPlay();

    return;
  }

  startHomeBannerAutoPlay();
}

function initializeHomeBanner() {
  if (
    !elements.homeBanner ||
    elements.homeBannerSlides
      .length === 0
  ) {
    return;
  }

  showHomeBannerSlide(
    0
  );

  elements.homeBannerPrevButton
    ?.addEventListener(
      "click",
      showPreviousHomeBanner
    );

  elements.homeBannerNextButton
    ?.addEventListener(
      "click",
      showNextHomeBanner
    );

  elements.homeBanner
    .addEventListener(
      "click",
      handleHomeBannerDotClick
    );

  elements.homeBanner
    .addEventListener(
      "mouseenter",
      stopHomeBannerAutoPlay
    );

  elements.homeBanner
    .addEventListener(
      "mouseleave",
      startHomeBannerAutoPlay
    );

  document.addEventListener(
    "visibilitychange",
    handleHomeBannerVisibilityChange
  );
}

/* 页面交互 */

function handleNavigationClick(
  event
) {
  const button =
    event.target.closest(
      "[data-view], [data-module]"
    );

  if (
    !button
  ) {
    return;
  }

  const nextView =
    button.dataset.view;

  if (
    nextView
  ) {
    showLocalView(
      nextView
    );

    return;
  }

  if (
    state.loading
  ) {
    return;
  }

  const nextModule =
    button.dataset.module;

  if (
    !nextModule
  ) {
    return;
  }

  state.currentModule =
    nextModule;

  requestSession();
}

function handleMemberInfo(
  messageData
) {
  let payload =
    messageData?.payload ??
    messageData?.data ??
    messageData;

  if (
    typeof payload ===
    "string"
  ) {
    try {
      payload =
        JSON.parse(
          payload
        );
    } catch {
      return;
    }
  }

  const balanceCandidates = [
    payload?.result?.balance,
    payload?.data?.balance,
    payload?.balance,
    payload?.result
      ?.member?.balance,
    payload?.result
      ?.memberInfo?.balance,
    payload?.member?.balance,
    payload?.memberInfo?.balance
  ];

  const validBalance =
    balanceCandidates.find(
      value => {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return false;
        }

        const numericValue =
          Number(
            value
          );

        return (
          Number.isFinite(
            numericValue
          ) &&
          numericValue >= 0
        );
      }
    );

  if (
    validBalance ===
    undefined
  ) {
    console.warn(
      "MEMBER_INFO 已收到，但没有找到有效的余额字段。"
    );

    return;
  }

  const updated =
    updateTokenBalance(
      Number(
        validBalance
      )
    );

  if (
    updated &&
    state.awaitingMemberInfo
  ) {
    finishBackgroundTokenSync(
      true
    );
  }
}

function handleIframeMessage(
  event
) {
  if (
    !elements.frame ||
    event.source !==
      elements.frame
        .contentWindow
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

  const messageType =
    event.data?.type;

  if (
    messageType ===
    FRAME_LOGIN_INVALID
  ) {
    if (
      state.currentView ===
      "module"
    ) {
      requestSession({
        refresh:
          true
      });
    }

    return;
  }

  if (
    messageType ===
    MEMBER_INFO
  ) {
    handleMemberInfo(
      event.data
    );
  }
}

function handleTokenBalanceClick() {
  window.location.href =
    "/cl-base-token-purchase.html";
}

function bindEvents() {
  elements.moduleNavigation
    ?.addEventListener(
      "click",
      handleNavigationClick
    );

  elements.exploreAllToolsButton
    ?.addEventListener(
      "click",
      () => {
        showLocalView(
          "all-tools"
        );
      }
    );

  elements.refreshButton
    ?.addEventListener(
      "click",
      () => {
        if (
          state.currentView ===
          "module"
        ) {
          requestSession({
            refresh:
              true
          });

          return;
        }

        refreshSessionInBackground();
      }
    );

  elements.retryButton
    ?.addEventListener(
      "click",
      () => {
        requestSession();
      }
    );

  elements.tokenBalanceButton
    ?.addEventListener(
      "click",
      handleTokenBalanceClick
    );

  window.addEventListener(
    "message",
    handleIframeMessage
  );

  window.addEventListener(
    "pagehide",
    () => {
      stopHomeBannerAutoPlay();

      cancelBackgroundTokenSync({
        resetButton:
          false
      });

      clearRefreshFeedbackTimer();
    }
  );
}

function initializeWorkspace() {
  renderAllTools();
  restoreTokenBalance();
  initializeHomeBanner();
  bindEvents();

  showLocalView(
    DEFAULT_VIEW
  );
}

initializeWorkspace();