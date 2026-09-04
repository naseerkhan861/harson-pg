(() => {
  "use strict";

  /*
    CL-AIGC Home capability switches

    文字：继续 Mock，避免开发阶段持续产生 DeepSeek 费用
    图片：真实调用 Seedream /api/ai/image
    视频：继续 Mock，等待后续接入 Seedance
  */
  const USE_MOCK_TEXT_AI = true;
  const USE_REAL_IMAGE_AI = false;
  const USE_MOCK_VIDEO_AI = true;

  const STORAGE_KEY = "clAigcConversationsV2";
  const CURRENT_ID_KEY = "clAigcCurrentConversationIdV2";

  const CREATION_MODES = {
    smart: {
      label: "智能模式",
      description: "自动判断文字、图片或视频任务",
      icon: "✦"
    },

    text: {
      label: "文字对话",
      description: "分析、策划、文案与设计建议",
      icon: "A"
    },

    image: {
      label: "图片生成",
      description: "商品图、效果图、上脚图与海报",
      icon: "▧"
    },

    video: {
      label: "视频生成",
      description: "鞋履展示、旋转动画与营销短片",
      icon: "▶"
    }
  };

  const form = document.getElementById("clPromptForm");
  const input = document.getElementById("clPromptInput");
  const submitButton = form?.querySelector(".cl-prompt__submit");

  const modelButton = document.getElementById("clModelButton");
  const modelMenu = document.getElementById("clModelMenu");
  const modelLabel = document.getElementById("clModelLabel");
  let modelOptions = [];

  const workspace = document.getElementById("clWorkspace");
  const workspacePrompt = document.getElementById("clWorkspacePrompt");
  const workspaceModel = document.getElementById("clWorkspaceModel");
  const resultPanel = document.getElementById("clAiResult");
  const workspaceComposer = document.getElementById("clWorkspaceComposer");

  const workspaceHeader = document.querySelector(
    "#clWorkspace .cl-workspace__header"
  );
  const workspaceSidebar = document.querySelector(
    "#clWorkspace .cl-workspace__sidebar"
  );
  const conversationHeader = document.querySelector(
    "#clWorkspace .cl-conversation-header"
  );

  const historyList = document.getElementById("clHistoryList");
  const historyClear = document.getElementById("clHistoryClear");
  const newChatButton = document.getElementById("clNewChatButton");

  const heroCopy = document.querySelector(".cl-hero__copy");
  const carouselStage = document.getElementById("carouselStage");
  const carouselDots = document.querySelector(".cl-carousel-dots");

  const slides = Array.from(document.querySelectorAll(".cl-slide"));
  const stage = carouselStage;
  const dots = Array.from(
    document.querySelectorAll(".cl-carousel-dots button")
  );

  let selectedMode = "smart";
  let currentIndex = 2;
  let carouselTimer = null;
  let isSending = false;
  let isTransitioning = false;

  /*
    当前待提交的参考图片。
    只保存在浏览器内存中，不写入 localStorage。
  */
  let selectedImageFile = null;
  let selectedImagePreviewUrl = "";


  function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("图片预览读取失败"));
    };

    reader.readAsDataURL(file);
  });
}

  /*
    上传图片控件直接插入唯一的 #clPromptForm。
    因为这个 form 会从 Hero 移动到 Workspace，
    所以上传按钮也会跟着同一个输入框一起移动，
    不需要新增第二套输入组件。
  */
  function setupImageUploadControl() {
  if (!form || !input) {
    return null;
  }

  const existing =
    document.getElementById(
      "clImageUploadControl"
    );

  if (existing) {
    return existing;
  }

  if (
    !document.getElementById(
      "clImageUploadStyles"
    )
  ) {
    const style =
      document.createElement(
        "style"
      );

    style.id =
      "clImageUploadStyles";

    style.textContent = `
      .cl-prompt.has-image-attachment {
        flex-wrap: wrap;
        row-gap: 10px;
        align-items: center;
      }

      .cl-upload-attachment-panel {
        order: -1;
        flex: 0 0 100%;
        width: 100%;
        display: none;
        align-items: center;
        padding: 0 4px 2px;
        box-sizing: border-box;
      }

      .cl-prompt.has-image-attachment
      .cl-upload-attachment-panel {
        display: flex;
      }

      .cl-upload-attachment-card {
        position: relative;
        width: 86px;
        height: 86px;
        flex: 0 0 86px;
        border-radius: 16px;
        overflow: hidden;
        background: #f8f8fb;
        border: 1px solid rgba(17,24,39,.08);
        box-shadow: 0 8px 20px rgba(17,24,39,.07);
      }

      .cl-upload-attachment-card__image {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        border-radius: 16px;
        opacity: 0;
        transition: opacity .18s ease;
        background: #f3f4f6;
      }

      .cl-upload-attachment-card__image.is-ready {
        opacity: 1;
      }

      .cl-upload-attachment-card__fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        color: #9ca3af;
        background: linear-gradient(
          180deg,
          rgba(248,248,251,1) 0%,
          rgba(242,243,247,1) 100%
        );
      }

      .cl-upload-attachment-remove {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: rgba(17,24,39,.9);
        color: #fff;
        cursor: pointer;
        font-size: 14px;
        line-height: 22px;
        text-align: center;
        box-shadow: 0 3px 8px rgba(17,24,39,.20);
        z-index: 4;
      }

      .cl-image-upload-control {
        position: relative;
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .cl-image-upload-button {
        width: 42px;
        height: 42px;
        padding: 0;
        border: 1px solid rgba(17,24,39,.08);
        border-radius: 12px;
        background: rgba(255,255,255,.92);
        color: #5f5bff;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        transition:
          border-color .18s ease,
          background-color .18s ease,
          box-shadow .18s ease,
          transform .18s ease;
      }

      .cl-image-upload-button:hover {
        border-color: rgba(95,91,255,.28);
        background: #f7f7ff;
        box-shadow: 0 6px 16px rgba(95,91,255,.10);
      }

      .cl-image-upload-button:active {
        transform: scale(.97);
      }

      .cl-image-upload-button:disabled {
        cursor: not-allowed;
        opacity: .55;
      }

      .cl-image-upload-button svg {
        display: block;
      }

      @media (max-width: 720px) {
        .cl-upload-attachment-card {
          width: 74px;
          height: 74px;
          flex-basis: 74px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  const attachmentPanel =
    document.createElement(
      "div"
    );

  attachmentPanel.className =
    "cl-upload-attachment-panel";

  const attachmentCard =
    document.createElement(
      "div"
    );

  attachmentCard.className =
    "cl-upload-attachment-card";

  const preview =
    document.createElement(
      "img"
    );

  preview.className =
    "cl-upload-attachment-card__image";

  preview.alt =
    "已选择的参考图片";

  preview.decoding =
    "async";

  const fallback =
    document.createElement(
      "div"
    );

  fallback.className =
    "cl-upload-attachment-card__fallback";

  fallback.textContent =
    "预览";

  const removeButton =
    document.createElement(
      "button"
    );

  removeButton.type =
    "button";

  removeButton.className =
    "cl-upload-attachment-remove";

  removeButton.textContent =
    "×";

  removeButton.title =
    "移除参考图片";

  removeButton.setAttribute(
    "aria-label",
    "移除参考图片"
  );

  attachmentCard.appendChild(
    fallback
  );

  attachmentCard.appendChild(
    preview
  );

  attachmentCard.appendChild(
    removeButton
  );

  attachmentPanel.appendChild(
    attachmentCard
  );

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.id =
    "clImageUploadControl";

  wrapper.className =
    "cl-image-upload-control";

  const fileInput =
    document.createElement(
      "input"
    );

  fileInput.type =
    "file";

  fileInput.accept =
    "image/png,image/jpeg,image/webp";

  fileInput.hidden =
    true;

  fileInput.setAttribute(
    "aria-label",
    "上传参考图片"
  );

  const uploadButton =
    document.createElement(
      "button"
    );

  uploadButton.type =
    "button";

  uploadButton.className =
    "cl-image-upload-button";

  uploadButton.title =
    "上传参考图片";

  uploadButton.setAttribute(
    "aria-label",
    "上传参考图片"
  );

  uploadButton.innerHTML =
    `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3"
        stroke="currentColor" stroke-width="1.7"/>
      <circle cx="9" cy="10" r="1.55"
        fill="currentColor"/>
      <path
        d="M5.5 17L10.1 12.7C10.7 12.1 11.7 12.1 12.3 12.7L14 14.3L15.4 13C16 12.5 16.9 12.5 17.5 13L20 15.4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"/>
      <path
        d="M21.8 0.2V4.2M19.8 2.2H23.8"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"/>
    </svg>`;

  function clearSelectedImage() {
    selectedImageFile = null;
    selectedImagePreviewUrl = "";
    fileInput.value = "";

    preview.classList.remove(
      "is-ready"
    );

    preview.removeAttribute("src");

    fallback.style.display = "flex";

    form.classList.remove(
      "has-image-attachment"
    );

    uploadButton.title =
      "上传参考图片";

    uploadButton.setAttribute(
      "aria-label",
      "上传参考图片"
    );
  }

  uploadButton.addEventListener(
    "click",
    () => {
      if (isSending) {
        return;
      }

      fileInput.click();
    }
  );

  removeButton.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      clearSelectedImage();

      input.placeholder =
        "描述你想创作的鞋履内容，例如：生成一组冬季德训鞋电商主图，米白色背景，轻奢风格...";

      input.focus({
        preventScroll: true
      });
    }
  );

  fileInput.addEventListener(
    "change",
    async () => {
      const file =
        fileInput.files?.[0];

      if (!file) {
        return;
      }

      if (
        !file.type ||
        !file.type.startsWith(
          "image/"
        )
      ) {
        window.alert(
          "请选择 PNG、JPG 或 WEBP 图片。"
        );

        clearSelectedImage();
        return;
      }

      if (
        file.size >
        10 * 1024 * 1024
      ) {
        window.alert(
          "参考图片不能超过 10 MB。"
        );

        clearSelectedImage();
        return;
      }

      try {
        selectedImageFile = file;

        const dataUrl =
          await readFileAsDataUrl(file);

        selectedImagePreviewUrl =
          dataUrl;

        preview.classList.remove(
          "is-ready"
        );

        preview.onload = () => {
          preview.classList.add(
            "is-ready"
          );
          fallback.style.display =
            "none";
        };

        preview.onerror = () => {
          preview.removeAttribute("src");
          preview.classList.remove(
            "is-ready"
          );
          fallback.style.display =
            "flex";
          fallback.textContent =
            "预览失败";
        };

        preview.src = dataUrl;

        fallback.style.display =
          "flex";
        fallback.textContent =
          "加载中...";

        form.classList.add(
          "has-image-attachment"
        );

        uploadButton.title =
          "更换参考图片";

        uploadButton.setAttribute(
          "aria-label",
          `当前参考图片：${file.name}，点击更换`
        );

        selectedMode = "image";
        updateCreationModePresentation();

        input.placeholder =
          "描述你希望如何修改这张图片，例如：保持鞋型不变，把鞋面改成米白色并增加浅金色细节...";

        input.focus({
          preventScroll: true
        });
      } catch (error) {
        console.error(
          "[CL-AIGC Preview Error]",
          error
        );

        window.alert(
          "图片预览加载失败，请重新选择。"
        );

        clearSelectedImage();
      }
    }
  );

  wrapper.appendChild(fileInput);
  wrapper.appendChild(uploadButton);

  form.insertBefore(
    attachmentPanel,
    form.firstChild
  );

  form.insertBefore(
    wrapper,
    input
  );

  return {
    wrapper,
    fileInput,
    uploadButton,
    attachmentPanel,
    preview,
    clearSelectedImage
  };
}

  const imageUploadControl =
    setupImageUploadControl();


  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function createId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(iso) {
    if (!iso) return "";

    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function makeConversationTitle(message) {
    const text = String(message || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return "新聊天";

    return text.length > 24
      ? `${text.slice(0, 24)}...`
      : text;
  }

  function getSelectedModelLabel() {
    return (
      CREATION_MODES[selectedMode]?.label ||
      "智能模式"
    );
  }

  function resolveTaskType(message) {
    if (selectedMode !== "smart") {
      return selectedMode;
    }

    const text =
      String(message || "")
        .trim();

    const wantsVideo =
      /(视频|动画|旋转展示|短片|影片|运镜|镜头|5秒|10秒|动态展示)/i
        .test(text);

    if (wantsVideo) {
      return "video";
    }

    const wantsImage =
      /(图片|主图|效果图|视觉图|海报|上脚图|商品图|渲染图|生成图|设计图|照片|图像)/i
        .test(text);

    if (wantsImage) {
      return "image";
    }

    return "text";
  }

  function getProviderForTask(taskType) {
    if (taskType === "image") {
      return "seedream";
    }

    if (taskType === "video") {
      return "seedance";
    }

    return "deepseek";
  }

  function getPublicAssistantLabel(taskType) {
    if (taskType === "image") {
      return "CL-AIGC · 图片生成";
    }

    if (taskType === "video") {
      return "CL-AIGC · 视频生成";
    }

    return "CL-AIGC · 文字对话";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMessageHtml(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function ensureWorkspaceVisible() {
    if (workspace) {
      workspace.hidden = false;
    }
  }

  function scrollWorkspaceIntoView() {
    if (!workspace) return;

    window.setTimeout(() => {
      workspace.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 120);
  }

  function scrollChatToBottom() {
    if (!resultPanel) return;

    const scrollToLatest = () => {
      resultPanel.scrollTop =
        resultPanel.scrollHeight;
    };

    /*
      第一次：DOM 插入后的下一帧。
    */
    window.requestAnimationFrame(() => {
      scrollToLatest();

      /*
        第二次：浏览器完成本轮布局后再次校正。
      */
      window.requestAnimationFrame(() => {
        scrollToLatest();
      });
    });

    /*
      图片、视频、字体等可能继续改变消息高度，
      再做两次轻量校正，确保最终停在最新消息。
    */
    window.setTimeout(
      scrollToLatest,
      80
    );

    window.setTimeout(
      scrollToLatest,
      250
    );
  }

  function isPromptDocked() {
    return Boolean(
      form &&
      workspaceComposer &&
      workspaceComposer.contains(form)
    );
  }

  /*
    Cinematic transition:
    Hero recedes -> prompt becomes floating HUD ->
    page dives into Workspace -> prompt softly docks.
  */
  async function enterWorkspaceCinematic() {
    if (
      !form ||
      !workspace ||
      !workspaceComposer
    ) {
      scrollWorkspaceIntoView();
      return;
    }

    if (
      isPromptDocked() ||
      isTransitioning
    ) {
      return;
    }

    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      ensureWorkspaceVisible();
      workspaceComposer.appendChild(form);

      workspace.scrollIntoView({
        behavior: "auto",
        block: "start"
      });

      scrollChatToBottom();
      return;
    }

    isTransitioning = true;

    /*
      这一版不再使用 Safari 原生 smooth scroll、
      多段 await、blur/backdrop-filter。

      整个转场由同一个 requestAnimationFrame
      时间轴控制，避免阶段交界处“顿一下”。
    */
    document.body.classList.remove(
      "cl-cinematic-active"
    );

    ensureWorkspaceVisible();
    stopCarousel();

    const startScrollY =
      window.scrollY;

    const startRect =
      form.getBoundingClientRect();

    const header =
      document.querySelector(
        ".cl-header"
      );

    const headerHeight =
      header?.getBoundingClientRect()
        .height || 0;

    const workspaceDocumentTop =
      workspace
        .getBoundingClientRect()
        .top +
      window.scrollY;

    const targetScrollY =
      Math.max(
        0,
        workspaceDocumentTop -
          headerHeight -
          14
      );

    /*
      先在真正的 Workspace Composer 里
      放一个不可见克隆，用来测量输入框最终尺寸和位置。

      这样最后一帧的几何位置可以完全对齐，
      不需要 Dock 完以后再“校正”一次。
    */
    const measureForm =
      form.cloneNode(true);

    measureForm
      .querySelectorAll("[id]")
      .forEach(element => {
        element.removeAttribute("id");
      });

    measureForm.removeAttribute("id");

    Object.assign(
      measureForm.style,
      {
        visibility: "hidden",
        pointerEvents: "none",
        animation: "none",
        transition: "none"
      }
    );

    workspaceComposer.appendChild(
      measureForm
    );

    const measuredRect =
      measureForm
        .getBoundingClientRect();

    const measuredDocumentTop =
      measuredRect.top +
      window.scrollY;

    const targetRect = {
      left:
        measuredRect.left,

      top:
        measuredDocumentTop -
        targetScrollY,

      width:
        measuredRect.width,

      height:
        measuredRect.height
    };

    measureForm.remove();

    /*
      首页原位置保留占位，
      防止 Hero 因 form 被提出而突然塌陷。
    */
    const placeholder =
      document.createElement(
        "div"
      );

    placeholder.className =
      "cl-prompt-travel-placeholder";

    placeholder.style.height =
      `${startRect.height}px`;

    form.parentNode?.insertBefore(
      placeholder,
      form
    );

    /*
      唯一真实输入框进入固定合成层。
      后续只动画 transform / opacity。
    */
    document.body.appendChild(
      form
    );

    Object.assign(
      form.style,
      {
        position: "fixed",
        top: `${startRect.top}px`,
        left: `${startRect.left}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`,
        margin: "0",
        zIndex: "1000",
        transformOrigin: "0 0",
        willChange:
          "transform, box-shadow"
      }
    );

    /*
      用真实 DOM 环境光代替 ::after + backdrop-filter。
      只改变 opacity，避免大面积 blur/backdrop-filter
      在 Safari 上产生合成停顿。
    */
    const ambient =
      document.createElement(
        "div"
      );

    Object.assign(
      ambient.style,
      {
        position: "fixed",
        inset: "0",
        zIndex: "900",
        pointerEvents: "none",
        opacity: "0",
        willChange: "opacity",
        background:
          "radial-gradient(circle at 50% 72%, rgba(111,76,255,0.145) 0%, rgba(111,76,255,0.07) 27%, rgba(111,76,255,0.022) 48%, rgba(111,76,255,0) 72%)"
      }
    );

    document.body.appendChild(
      ambient
    );

    /*
      Workspace 和内部区域初始状态。
      不使用 blur，只使用 transform + opacity。
    */
    workspace.style.opacity =
      "0";

    workspace.style.transform =
      "translate3d(0,56px,0) scale(0.986)";

    workspace.style.transformOrigin =
      "50% 0";

    workspace.style.willChange =
      "transform, opacity";

    const workspaceParts = [
      {
        element:
          workspaceHeader,
        start: 0.42,
        y: 10,
        x: 0
      },
      {
        element:
          workspaceSidebar,
        start: 0.47,
        y: 0,
        x: -14
      },
      {
        element:
          conversationHeader,
        start: 0.52,
        y: 9,
        x: 0
      },
      {
        element:
          resultPanel,
        start: 0.57,
        y: 12,
        x: 0
      }
    ];

    workspaceParts.forEach(
      part => {
        if (!part.element) {
          return;
        }

        part.element.style.opacity =
          "0";

        part.element.style.transform =
          `translate3d(${part.x}px, ${part.y}px, 0)`;

        part.element.style.willChange =
          "transform, opacity";
      }
    );

    if (heroCopy) {
      heroCopy.style.willChange =
        "transform, opacity";
    }

    if (carouselStage) {
      carouselStage.style.willChange =
        "transform, opacity";
    }

    if (carouselDots) {
      carouselDots.style.willChange =
        "transform, opacity";
    }

    function clamp01(value) {
      return Math.min(
        1,
        Math.max(
          0,
          value
        )
      );
    }

    function smoother(value) {
      const t =
        clamp01(value);

      return (
        t *
        t *
        (
          3 -
          2 * t
        )
      );
    }

    function localProgress(
      progress,
      from,
      to
    ) {
      return smoother(
        (
          progress -
          from
        ) /
        (
          to -
          from
        )
      );
    }

    function lerp(
      from,
      to,
      amount
    ) {
      return (
        from +
        (
          to -
          from
        ) *
        amount
      );
    }

    function cubicBezierPoint(
      startValue,
      control1,
      control2,
      endValue,
      t
    ) {
      const inverse =
        1 - t;

      return (
        inverse *
          inverse *
          inverse *
          startValue +
        3 *
          inverse *
          inverse *
          t *
          control1 +
        3 *
          inverse *
          t *
          t *
          control2 +
        t *
          t *
          t *
          endValue
      );
    }

    /*
      单一主时间轴。
      不再存在：
      “等输入框 -> 等滚动 -> 等 Workspace -> 等 Dock”
      这种阶段式暂停。
    */
    const duration =
      600;

    const startedAt =
      performance.now();

    await new Promise(resolve => {
      function frame(now) {
        const progress =
          clamp01(
            (
              now -
              startedAt
            ) /
            duration
          );

        /*
          页面镜头滑动独立计时。
          数值越小，页面向 Workspace 滑得越快。
        */
        const SCROLL_DURATION_MS =
          280;

        const scrollProgress =
          smoother(
            (
              now -
              startedAt
            ) /
            SCROLL_DURATION_MS
          );

        const currentScrollY =
          lerp(
            startScrollY,
            targetScrollY,
            scrollProgress
          );

        window.scrollTo(
          0,
          currentScrollY
        );

        /*
          Hero 退场。
          大面积 blur 已删除，只做 transform + opacity。
        */
        const heroProgress =
          localProgress(
            progress,
            0,
            0.54
          );

        if (heroCopy) {
          heroCopy.style.opacity =
            String(
              lerp(
                1,
                0.16,
                heroProgress
              )
            );

          heroCopy.style.transform =
            `translate3d(0, ${-14 * heroProgress}px, 0) scale(${lerp(
              1,
              0.978,
              heroProgress
            )})`;
        }

        const carouselProgress =
          localProgress(
            progress,
            0.05,
            0.61
          );

        if (carouselStage) {
          carouselStage.style.opacity =
            String(
              lerp(
                1,
                0.12,
                carouselProgress
              )
            );

          carouselStage.style.transform =
            `translate3d(0, ${18 * carouselProgress}px, 0) scale(${lerp(
              1,
              0.95,
              carouselProgress
            )})`;
        }

        if (carouselDots) {
          const dotsProgress =
            localProgress(
              progress,
              0.04,
              0.90
            );

          carouselDots.style.opacity =
            String(
              1 -
              dotsProgress
            );

          carouselDots.style.transform =
            `translate3d(0, ${8 * dotsProgress}px, 0)`;
        }

        /*
          环境光：
          同一时间轴中自然升起再退到 0。
          最后一帧本身就是透明，因此移除 DOM 不会闪白。
        */
        const ambientIn =
          localProgress(
            progress,
            0.05,
            0.38
          );

        const ambientOut =
          localProgress(
            progress,
            0.58,
            1
          );

        const ambientOpacity =
          ambientIn *
          (
            1 -
            ambientOut
          );

        ambient.style.opacity =
          String(
            ambientOpacity
          );

        /*
          Workspace 整体展开。
        */
        const workspaceProgress =
          localProgress(
            progress,
            0.0001,
            0.0001
          );

        workspace.style.opacity =
          String(
            workspaceProgress
          );

        workspace.style.transform =
          `translate3d(0, ${56 * (1 - workspaceProgress)}px, 0) scale(${lerp(
            0.986,
            1,
            workspaceProgress
          )})`;

        /*
          Workspace 内部按几十毫秒错峰，
          但全部仍由同一个 progress 驱动。
        */
        workspaceParts.forEach(
          part => {
            if (!part.element) {
              return;
            }

            const partProgress =
              localProgress(
                progress,
                part.start,
                part.start +
                  0.28
              );

            part.element.style.opacity =
              String(
                partProgress
              );

            part.element.style.transform =
              `translate3d(${part.x * (1 - partProgress)}px, ${part.y * (1 - partProgress)}px, 0)`;
          }
        );

        /*
          输入框使用一条连续三次贝塞尔轨迹。
          不再先悬浮结束、再开始 Dock。
        */
        const promptProgress =
          localProgress(
            progress,
            0.04,
            0.90
          );

        const startX =
          startRect.left;

        const startY =
          startRect.top;

        const endX =
          targetRect.left;

        const endY =
          targetRect.top;

        const control1X =
          lerp(
            startX,
            endX,
            0.18
          );

        const control2X =
          lerp(
            startX,
            endX,
            0.78
          );

        const control1Y =
          startY - 18;

        const control2Y =
          endY - 28;

        const visualX =
          cubicBezierPoint(
            startX,
            control1X,
            control2X,
            endX,
            promptProgress
          );

        const visualY =
          cubicBezierPoint(
            startY,
            control1Y,
            control2Y,
            endY,
            promptProgress
          );

        const targetScaleX =
          targetRect.width /
          startRect.width;

        const targetScaleY =
          targetRect.height /
          startRect.height;

        const scaleX =
          lerp(
            1,
            targetScaleX,
            promptProgress
          );

        const scaleY =
          lerp(
            1,
            targetScaleY,
            promptProgress
          );

        form.style.transform =
          `translate3d(${visualX - startX}px, ${visualY - startY}px, 0) scale(${scaleX}, ${scaleY})`;

        /*
          悬浮阴影在中段最明显，
          到最终位置自然收敛。
        */
        const shadowPeak =
          Math.sin(
            Math.PI *
            promptProgress
          );

        form.style.boxShadow =
          `0 ${lerp(
            14,
            24,
            shadowPeak
          )}px ${lerp(
            38,
            62,
            shadowPeak
          )}px rgba(20,22,28,${lerp(
            0.08,
            0.14,
            shadowPeak
          )})`;

        if (
          progress <
          1
        ) {
          window.requestAnimationFrame(
            frame
          );

          return;
        }

        resolve();
      }

      window.requestAnimationFrame(
        frame
      );
    });

    /*
      强制最终滚动位置精确对齐。
    */
    window.scrollTo(
      0,
      targetScrollY
    );

    /*
      最后一帧：
      transform 已经精确匹配 Composer 中测得的位置和尺寸。

      在同一个绘制周期内 appendChild + 清除临时样式，
      用户不会看到一个额外“校正帧”。
    */
    workspaceComposer.appendChild(
      form
    );

    Object.assign(
      form.style,
      {
        position: "",
        top: "",
        left: "",
        width: "",
        height: "",
        margin: "",
        zIndex: "",
        transform: "",
        transformOrigin: "",
        willChange: "",
        boxShadow: ""
      }
    );

    workspace.style.opacity =
      "";

    workspace.style.transform =
      "";

    workspace.style.transformOrigin =
      "";

    workspace.style.willChange =
      "";

    workspaceParts.forEach(
      part => {
        if (!part.element) {
          return;
        }

        part.element.style.opacity =
          "";

        part.element.style.transform =
          "";

        part.element.style.willChange =
          "";
      }
    );

    if (heroCopy) {
      heroCopy.style.opacity =
        "";

      heroCopy.style.transform =
        "";

      heroCopy.style.willChange =
        "";
    }

    if (carouselStage) {
      carouselStage.style.opacity =
        "";

      carouselStage.style.transform =
        "";

      carouselStage.style.willChange =
        "";
    }

    if (carouselDots) {
      carouselDots.style.opacity =
        "";

      carouselDots.style.transform =
        "";

      carouselDots.style.willChange =
        "";
    }

    /*
      ambient 此刻已经 opacity: 0，
      所以删除不会出现紫色 -> 白色瞬切。
    */
    ambient.remove();
    placeholder.remove();

    isTransitioning = false;

    startCarousel();
    scrollChatToBottom();
  }

  function getConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("[CL-AIGC Conversation Read Error]", error);
      return [];
    }
  }

  function saveConversations(conversations) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations)
      );
    } catch (error) {
      console.error("[CL-AIGC Conversation Save Error]", error);
    }
  }

  function getCurrentConversationId() {
    return localStorage.getItem(CURRENT_ID_KEY) || "";
  }

  function setCurrentConversationId(conversationId) {
    if (!conversationId) {
      localStorage.removeItem(CURRENT_ID_KEY);
      return;
    }

    localStorage.setItem(CURRENT_ID_KEY, conversationId);
  }

  function getConversationById(conversationId) {
    if (!conversationId) return null;

    return (
      getConversations().find(
        conversation => conversation.id === conversationId
      ) || null
    );
  }

  function getCurrentConversation() {
    return getConversationById(getCurrentConversationId());
  }

  function createConversation({
    firstMessage,
    provider,
    model,
    mode
  }) {
    const timestamp = nowIso();

    const conversation = {
      id: createId(),
      title: makeConversationTitle(firstMessage),
      provider: provider || "deepseek",
      mode: mode || selectedMode,
      model: model || getSelectedModelLabel(),
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: []
    };

    const conversations = getConversations();
    conversations.unshift(conversation);

    saveConversations(conversations);
    setCurrentConversationId(conversation.id);

    return conversation;
  }

  function ensureCurrentConversation(firstMessage) {
    const existing = getCurrentConversation();

    if (existing) return existing;

    const taskType =
      resolveTaskType(firstMessage);

    return createConversation({
      firstMessage,
      provider:
        getProviderForTask(taskType),
      mode:
        selectedMode,
      model:
        getSelectedModelLabel()
    });
  }

  function updateConversation(conversation) {
    const conversations = getConversations();
    const index = conversations.findIndex(
      item => item.id === conversation.id
    );

    if (index !== -1) {
      conversations.splice(index, 1);
    }

    conversations.unshift(conversation);
    saveConversations(conversations);

    return conversation;
  }

  function appendMessage({
    conversationId,
    role,
    content,
    provider,
    model,
    type = "text",
    media = null
  }) {
    const conversation = getConversationById(conversationId);
    if (!conversation) return null;

    const timestamp = nowIso();

    if (!Array.isArray(conversation.messages)) {
      conversation.messages = [];
    }

    conversation.messages.push({
      id: createId(),
      role,
      type,
      content,
      media,
      provider: provider || conversation.provider,
      model: model || conversation.model,
      createdAt: timestamp
    });

    conversation.provider = provider || conversation.provider;
    conversation.model = model || conversation.model;
    conversation.updatedAt = timestamp;

    return updateConversation(conversation);
  }

  function createMessageNode(message, fallbackModel) {
    const wrapper = document.createElement("div");
    wrapper.className =
      `cl-chat-message cl-chat-message--${message.role}`;

    const meta = document.createElement("div");
    meta.className = "cl-chat-message__meta";
    meta.textContent =
      message.role === "user"
        ? "你"
        : message.model || fallbackModel || "CL-AIGC";

    const bubble = document.createElement("div");
    bubble.className = "cl-chat-message__bubble";

    const messageType =
      message.type || "text";

    /*
      文字内容。
      text / image / video 都可以同时带说明文字。
    */
    if (message.content) {
      const content = document.createElement("div");
      content.className = "cl-chat-message__content";
      content.innerHTML = formatMessageHtml(message.content);

      bubble.appendChild(content);
    }

    /*
      图片消息。
    */
   if (
      messageType === "image" &&
      message.media?.url
    ) {
      const media =
        document.createElement("div");

      media.className =
        "cl-chat-media cl-chat-media--image";

      const image =
        document.createElement("img");

      image.src =
        message.media.url;

      image.alt =
        message.media.alt ||
        "CL-AIGC 生成的鞋履视觉";

      image.loading =
        "lazy";

      image.decoding =
        "async";

      const downloadButton =
        document.createElement("a");

      const filename =
        String(message.media.url)
          .split("/")
          .pop() ||
        "cl-aigc-image.png";

      downloadButton.href =
        message.media.url;

      downloadButton.download =
        filename;

      downloadButton.className =
        "cl-chat-media__download";

      downloadButton.setAttribute(
        "title",
        "下载图片"
      );

      downloadButton.setAttribute(
        "aria-label",
        "下载图片"
      );

      downloadButton.innerHTML = "↓";

      media.appendChild(image);
      media.appendChild(downloadButton);
      bubble.appendChild(media);
    }


    /*
      视频消息。
      真实 URL 存在时显示播放器；
      Mock 阶段显示视频任务占位卡。
    */
    if (messageType === "video") {
  const media = document.createElement("div");
  media.className =
    "cl-chat-media cl-chat-media--video";

  if (message.media?.url) {
    const video = document.createElement("video");
    video.src = message.media.url;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";

    media.appendChild(video);

    const downloadLink =
      document.createElement("a");

    downloadLink.className =
      "cl-chat-media__download";

    downloadLink.href = "#";

    downloadLink.addEventListener(
      "click",
      async event => {
        event.preventDefault();
        event.stopPropagation();

        try {
          const originalHtml =
            downloadLink.innerHTML;

          downloadLink.style.pointerEvents =
            "none";

          const response = await fetch(
            message.media.url
          );

          if (!response.ok) {
            throw new Error(
              `视频下载失败：${response.status}`
            );
          }

          const blob =
            await response.blob();

          const blobUrl =
            URL.createObjectURL(blob);

          const tempLink =
            document.createElement("a");

          tempLink.href =
            blobUrl;

          tempLink.download =
            `cl-aigc-video-${Date.now()}.mp4`;

          document.body.appendChild(
            tempLink
          );

          tempLink.click();
          tempLink.remove();

          window.setTimeout(() => {
            URL.revokeObjectURL(
              blobUrl
            );
          }, 1000);

          downloadLink.innerHTML =
            originalHtml;
        } catch (error) {
          console.error(
            "[CL-AIGC Video Download Error]",
            error
          );

          alert(
            "视频下载失败，请稍后重试。"
          );
        } finally {
          downloadLink.style.pointerEvents =
            "";
        }
      }
    );

    downloadLink.setAttribute(
      "aria-label",
      "下载视频"
    );

    downloadLink.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
        <path
          d="M12 4V14"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M8.5 10.5L12 14L15.5 10.5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M5 18H19"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    `;

    media.appendChild(downloadLink);
  } else {
    const placeholder =
      document.createElement("div");

    placeholder.className =
      "cl-chat-media__placeholder";

    const icon =
      document.createElement("span");
    icon.className =
      "cl-chat-media__icon";
    icon.textContent = "▶";

    const title =
      document.createElement("strong");
    title.textContent =
      "视频生成任务";

    const description =
      document.createElement("span");
    description.textContent =
      "当前为 Mock 模式，真实视频模型尚未接入。";

    placeholder.appendChild(icon);
    placeholder.appendChild(title);
    placeholder.appendChild(description);

    media.appendChild(placeholder);
  }

  bubble.appendChild(media);
}

    wrapper.appendChild(meta);
    wrapper.appendChild(bubble);

    return wrapper;
  }

  function renderEmptyConversation() {
    if (!resultPanel) return;

    resultPanel.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "cl-chat-empty";
    empty.textContent =
      "输入你的创作需求后，CL-AIGC 将在这里与你持续对话。";

    resultPanel.appendChild(empty);
  }

  function renderConversation(conversation, pendingText = "") {
    if (!resultPanel) return;

    if (!conversation) {
      if (workspacePrompt) {
        workspacePrompt.textContent = "新聊天";
      }

      if (workspaceModel) {
        workspaceModel.textContent = getSelectedModelLabel();
      }

      renderEmptyConversation();
      return;
    }

    if (workspacePrompt) {
      workspacePrompt.textContent =
        conversation.title || "新聊天";
    }

    if (workspaceModel) {
      const savedModeLabel =
        conversation.mode &&
        CREATION_MODES[
          conversation.mode
        ]
          ? CREATION_MODES[
              conversation.mode
            ].label
          : conversation.model;

      workspaceModel.textContent =
        savedModeLabel ||
        getSelectedModelLabel();
    }

    resultPanel.innerHTML = "";

    const messages = Array.isArray(conversation.messages)
      ? conversation.messages
      : [];

    if (!messages.length && !pendingText) {
      renderEmptyConversation();
      return;
    }

    const fragment = document.createDocumentFragment();

    messages.forEach(message => {
      fragment.appendChild(
        createMessageNode(message, conversation.model)
      );
    });

    if (pendingText) {
      fragment.appendChild(
        createMessageNode(
          {
            role: "assistant",
            content: pendingText,
            model: conversation.model
          },
          conversation.model
        )
      );
    }

    resultPanel.appendChild(fragment);
    scrollChatToBottom();
  }

  function renderConversationHistory() {
    if (!historyList) return;

    const conversations = getConversations();
    const currentId = getCurrentConversationId();

    historyList.innerHTML = "";

    if (!conversations.length) {
      const empty = document.createElement("div");
      empty.className = "cl-history__empty";
      empty.textContent = "暂无聊天记录";
      historyList.appendChild(empty);
      return;
    }

    conversations.forEach(conversation => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cl-history__item";

      if (conversation.id === currentId) {
        button.classList.add("is-active");
      }

      const title = document.createElement("span");
      title.className = "cl-history__title";
      title.textContent = conversation.title || "未命名聊天";

      const meta = document.createElement("span");
      meta.className = "cl-history__meta";
      const historyModeLabel =
        conversation.mode &&
        CREATION_MODES[
          conversation.mode
        ]
          ? CREATION_MODES[
              conversation.mode
            ].label
          : (
              conversation.model ===
              "DeepSeek"
                ? "文字对话"
                : (
                    conversation.model ||
                    "智能模式"
                  )
            );

      meta.textContent =
        `${historyModeLabel} · ` +
        formatTime(
          conversation.updatedAt
        );

      button.appendChild(title);
      button.appendChild(meta);

      button.addEventListener("click", async () => {
        setCurrentConversationId(conversation.id);
        ensureWorkspaceVisible();

        renderConversation(conversation);
        renderConversationHistory();

        if (!isPromptDocked()) {
          await enterWorkspaceCinematic();
        } else {
          scrollWorkspaceIntoView();
        }
      });

      historyList.appendChild(button);
    });
  }

  function startNewChat() {
    setCurrentConversationId("");

    imageUploadControl?.clearSelectedImage?.();

    if (workspacePrompt) {
      workspacePrompt.textContent = "新聊天";
    }

    if (workspaceModel) {
      workspaceModel.textContent = getSelectedModelLabel();
    }

    renderEmptyConversation();
    renderConversationHistory();

    input?.focus({
      preventScroll: true
    });
  }

  function closeModelMenu() {
    if (!modelMenu || !modelButton) return;

    modelMenu.hidden = true;
    modelButton.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function updateCreationModePresentation() {
    const config =
      CREATION_MODES[selectedMode] ||
      CREATION_MODES.smart;

    if (modelLabel) {
      modelLabel.textContent =
        config.label;
    }

    if (modelButton) {
      modelButton.setAttribute(
        "aria-label",
        `当前创作模式：${config.label}`
      );
    }

    if (workspaceModel) {
      workspaceModel.textContent =
        config.label;
    }

    modelOptions.forEach(option => {
      option.classList.toggle(
        "is-active",
        option.dataset.mode ===
          selectedMode
      );
    });
  }

  function buildCreationModeMenu() {
    if (!modelMenu) {
      return;
    }

    modelMenu.innerHTML = "";

    Object.entries(
      CREATION_MODES
    ).forEach(
      ([modeKey, config]) => {
        const option =
          document.createElement(
            "button"
          );

        option.type =
          "button";

        option.className =
          "cl-model-option";

        option.dataset.mode =
          modeKey;

        const icon =
          document.createElement(
            "span"
          );

        icon.className =
          "cl-mode-option__icon";

        icon.textContent =
          config.icon;

        const copy =
          document.createElement(
            "span"
          );

        copy.className =
          "cl-mode-option__copy";

        const title =
          document.createElement(
            "strong"
          );

        title.textContent =
          config.label;

        const description =
          document.createElement(
            "small"
          );

        description.textContent =
          config.description;

        const check =
          document.createElement(
            "span"
          );

        check.className =
          "cl-mode-option__check";

        check.textContent =
          "✓";

        copy.appendChild(
          title
        );

        copy.appendChild(
          description
        );

        option.appendChild(
          icon
        );

        option.appendChild(
          copy
        );

        option.appendChild(
          check
        );

        option.addEventListener(
          "click",
          event => {
            event.stopPropagation();

            selectedMode =
              modeKey;

            updateCreationModePresentation();
            closeModelMenu();
          }
        );

        modelMenu.appendChild(
          option
        );
      }
    );

    modelOptions =
      Array.from(
        modelMenu.querySelectorAll(
          ".cl-model-option"
        )
      );

    updateCreationModePresentation();
  }

  if (
    modelButton &&
    modelMenu
  ) {
    buildCreationModeMenu();

    modelButton.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        const isOpen =
          !modelMenu.hidden;

        modelMenu.hidden =
          isOpen;

        modelButton.setAttribute(
          "aria-expanded",
          String(!isOpen)
        );
      }
    );

    document.addEventListener(
      "click",
      event => {
        if (
          modelMenu.hidden ||
          modelButton.contains(
            event.target
          ) ||
          modelMenu.contains(
            event.target
          )
        ) {
          return;
        }

        closeModelMenu();
      }
    );
  }

  newChatButton?.addEventListener("click", () => {
    ensureWorkspaceVisible();
    startNewChat();
  });

  historyClear?.addEventListener("click", () => {
    const conversations = getConversations();
    if (!conversations.length) return;

    const confirmed = window.confirm(
      "确定清空全部聊天记录吗？"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setCurrentConversationId("");

    renderConversationHistory();
    renderConversation(null);
  });

  async function requestAi({
    message,
    conversation,
    taskType,
    imageFile = null
  }) {
    const resolvedTaskType =
      taskType ||
      resolveTaskType(message);

    const internalProvider =
      getProviderForTask(
        resolvedTaskType
      );

    /* =====================================================
       图片生成
       真实调用 Seedream
       ===================================================== */

    if (
      resolvedTaskType ===
      "image"
    ) {
      if (!USE_REAL_IMAGE_AI) {
        await wait(500);

        return {
          success: true,

          result: {
            provider:
              internalProvider,

            model:
              getPublicAssistantLabel(
                "image"
              ),

            type:
              "image",

            content:
              "已根据你的需求生成一版鞋履视觉预览。",

            media: {
              url:
                "/images/cl-aigc/shoe-product.png",

              alt:
                "CL-AIGC 鞋履商品视觉 Mock",

              status:
                "mock",

              prompt:
                message,

              model:
                "image-mock"
            }
          }
        };
      }

      let response;

      if (imageFile) {
        /*
          上传改图：
          不手动设置 Content-Type。
          浏览器会自动为 FormData 添加 multipart boundary。
        */
        const formData =
          new FormData();

        formData.append(
          "image",
          imageFile
        );

        formData.append(
          "prompt",
          message
        );

        formData.append(
          "size",
          "2K"
        );

        response =
          await fetch(
            "/api/ai/image",
            {
              method:
                "POST",

              body:
                formData
            }
          );
      } else {
        /*
          普通文生图仍保持原来的 JSON 请求。
        */
        response =
          await fetch(
            "/api/ai/image",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  prompt:
                    message,

                  size:
                    "2K"
                })
            }
          );
      }

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "图片生成失败"
        );
      }

      /*
        后端会返回 Seedream 的内部 provider / model，
        但前端用户可见名称统一保持 CL-AIGC。
      */
      return {
        success: true,

        result: {
          ...data.result,

          type:
            "image",

          model:
            getPublicAssistantLabel(
              "image"
            ),

          content:
            data.result.content ||
            "鞋履视觉已生成。",

          media: {
            ...data.result.media,

            alt:
              data.result.media?.alt ||
              "CL-AIGC 生成的鞋履视觉"
          }
        }
      };
    }


        if (
      resolvedTaskType ===
      "video"
    ) {
      /*
        Mock 模式：仅用于前端演示
      */
      if (USE_MOCK_VIDEO_AI) {
        await wait(500);

        return {
          success: true,

          result: {
            provider:
              internalProvider,

            model:
              getPublicAssistantLabel(
                "video"
              ),

            type:
              "video",

            content:
              "已识别为视频生成任务。当前为演示模式，真实视频服务暂未调用。",

            media: {
              status:
                "mock",

              prompt:
                message,

              model:
                "video-mock"
            }
          }
        };
      }

      /*
        真实模式：调用后端 /api/ai/video
      */
      const response =
        await fetch(
          "/api/ai/video",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                prompt:
                  message,

                duration: 5,
                resolution: "720p",
                ratio: "16:9"
              })
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "视频生成失败"
        );
      }

      return {
        success: true,

        result: {
          ...data.result,

          type:
            "video",

          model:
            getPublicAssistantLabel(
              "video"
            ),

          content:
            data.result.content ||
            "鞋履视频任务已创建。",

          media: {
            ...data.result.media,

            status:
              data.result.media?.status ||
              "submitted",

            prompt:
              data.result.media?.prompt ||
              message,

            model:
              data.result.media?.model ||
              data.result.model ||
              "seedance"
          }
        }
      };
    }


    /* =====================================================
       文字对话
       当前继续 Mock；以后可一键切回真实 DeepSeek
       ===================================================== */

    if (USE_MOCK_TEXT_AI) {
      await wait(500);

      return {
        success: true,

        result: {
          provider:
            "deepseek",

          model:
            getPublicAssistantLabel(
              "text"
            ),

          type:
            "text",

          content:
            `针对“${message}”这个需求，可以从以下几个方向展开：

1. 风格定位

整体建议先明确目标消费场景、鞋款风格以及品牌调性，保持设计语言统一。

2. 鞋型与楦型

根据目标用户选择合适的鞋头比例、楦型轮廓和鞋底结构，在舒适性和视觉表现之间取得平衡。

3. 材质与色彩

建议建立主色、辅助色和材质组合，并控制整体色彩饱和度，使鞋款更适合实际商品展示。

4. 商品视觉

可以进一步制作纯背景商品主图、模特上脚图、局部细节图和品牌氛围场景图。`
        }
      };
    }

    const response =
      await fetch(
        "/api/ai/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              provider:
                "deepseek",

              message,

              messages:
                conversation.messages.map(
                  item => ({
                    role:
                      item.role,

                    content:
                      item.content
                  })
                )
            })
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "AI 请求失败"
      );
    }

    return {
      success: true,

      result: {
        ...data.result,

        type:
          "text",

        model:
          getPublicAssistantLabel(
            "text"
          )
      }
    };
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSending) return;

    const message = input?.value?.trim() || "";

    if (!message) {
      input?.focus();
      return;
    }

    isSending = true;

    const model =
      getSelectedModelLabel();

    const imageFileForRequest =
      selectedImageFile;

    const taskType =
      imageFileForRequest
        ? "image"
        : resolveTaskType(message);

    const internalProvider =
      getProviderForTask(taskType);

    let conversation =
      ensureCurrentConversation(message);

    conversation.provider =
      internalProvider;

    conversation.mode =
      selectedMode;

    conversation.model =
      model;

    conversation =
      updateConversation(
        conversation
      );

    conversation =
      appendMessage({
        conversationId:
          conversation.id,

        role:
          "user",

        content:
          message,

        provider:
          internalProvider,

        model
      });

    ensureWorkspaceVisible();

    const pendingText =
      taskType === "image"
        ? (
            imageFileForRequest
              ? "CL-AIGC 正在根据参考图片进行修改，请稍候…"
              : "CL-AIGC 正在生成你的鞋履视觉，请稍候…"
          )
        : (
            taskType === "video"
              ? "CL-AIGC 正在准备视频生成任务…"
              : "CL-AIGC 正在理解并分析你的创作需求…"
          );

    renderConversation(
      conversation,
      pendingText
    );

        renderConversationHistory();

        /*
          用户点击发送后立即清空输入框。
          message 已经在上方保存，因此不会影响实际发送内容。
        */
        if (input) {
          input.value = "";
        }

        const originalButtonText =
          submitButton?.textContent || "→";

    if (input) {
      input.disabled = true;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "…";
    }

    if (
      imageUploadControl?.uploadButton
    ) {
      imageUploadControl.uploadButton.disabled =
        true;

      imageUploadControl.uploadButton.style.opacity =
        "0.55";

      imageUploadControl.uploadButton.style.cursor =
        "not-allowed";
    }

    try {
      /*
        AI 请求和转场同时开始。
        以前是“动画结束后才开始等 AI”，
        会在最后产生明显停顿。
      */
      const aiPromise =
        requestAi({
          message,
          conversation,
          taskType,
          imageFile:
            imageFileForRequest
        });

      if (!isPromptDocked()) {
        await enterWorkspaceCinematic();
      }

      const data =
        await aiPromise;

      conversation = appendMessage({
        conversationId: conversation.id,
        role: "assistant",
        type:
          data.result.type ||
          "text",
        content:
          data.result.content ||
          "",
        media:
          data.result.media ||
          null,
        provider:
          data.result.provider ||
          internalProvider,
        model:
          data.result.model ||
          getPublicAssistantLabel(
            taskType
          )
      });

      renderConversation(conversation);
      renderConversationHistory();

     

      if (
        imageFileForRequest &&
        input
      ) {
        /*
          改图成功后继续保留参考图缩略图，
          方便用户围绕同一张参考图继续修改。
        */
        input.placeholder =
          "继续描述你希望如何修改这张图片，例如：鞋底再厚一点，增加金属银细节...";
      }
    } catch (error) {
      console.error("[CL-AIGC Chat Error]", error);

      conversation = appendMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: "AI 服务暂时不可用，请稍后重试。",
        provider:
          internalProvider,
        model:
          getPublicAssistantLabel(
            taskType
          )
      });

      renderConversation(conversation);
      renderConversationHistory();
    } finally {
      isSending = false;

      if (input) {
        input.disabled = false;
        input.focus({
          preventScroll: true
        });
      }

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }

      if (
        imageUploadControl?.uploadButton
      ) {
        imageUploadControl.uploadButton.disabled =
          false;

        imageUploadControl.uploadButton.style.opacity =
          "1";

        imageUploadControl.uploadButton.style.cursor =
          "pointer";
      }
    }
  });

  function normalizeIndex(index) {
    const total = slides.length;
    if (!total) return 0;

    return ((index % total) + total) % total;
  }

  function updateDots(index) {
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle(
        "is-active",
        dotIndex === index
      );
    });
  }

  function updateCarousel(index) {
    if (!slides.length) return;

    currentIndex = normalizeIndex(index);

    const prevIndex = normalizeIndex(currentIndex - 1);
    const nextIndex = normalizeIndex(currentIndex + 1);
    const farPrevIndex = normalizeIndex(currentIndex - 2);
    const farNextIndex = normalizeIndex(currentIndex + 2);

    slides.forEach((slide, slideIndex) => {
      slide.className = "cl-slide";

      if (slideIndex === currentIndex) {
        slide.classList.add("is-active");
        return;
      }

      if (slideIndex === prevIndex) {
        slide.classList.add("is-prev");
        return;
      }

      if (slideIndex === nextIndex) {
        slide.classList.add("is-next");
        return;
      }

      if (slideIndex === farPrevIndex) {
        slide.classList.add("is-far-prev");
        return;
      }

      if (slideIndex === farNextIndex) {
        slide.classList.add("is-far-next");
      }
    });

    updateDots(currentIndex);
  }

  function stopCarousel() {
    if (!carouselTimer) return;

    window.clearInterval(carouselTimer);
    carouselTimer = null;
  }

  function startCarousel() {
    stopCarousel();

    if (!slides.length) return;

    carouselTimer = window.setInterval(() => {
      updateCarousel(currentIndex + 1);
    }, 2800);
  }

  slides.forEach((slide, index) => {
    slide.addEventListener("click", () => {
      updateCarousel(index);
      startCarousel();
    });
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      updateCarousel(index);
      startCarousel();
    });
  });

  stage?.addEventListener(
    "mouseenter",
    stopCarousel
  );

  stage?.addEventListener(
    "mouseleave",
    startCarousel
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopCarousel();
    } else {
      startCarousel();
    }
  });

  renderConversationHistory();

  const initialConversation =
    getCurrentConversation();

  if (initialConversation) {
    renderConversation(initialConversation);
  } else {
    renderConversation(null);
  }

  if (slides.length) {
    updateCarousel(currentIndex);
    startCarousel();
  }
})();
