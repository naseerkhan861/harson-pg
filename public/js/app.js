import { HomeViewModel } from "./viewmodels/homeViewModel.js";
import { HomeView } from "./views/homeView.js";
import { AuthViewModel } from "./viewmodels/authViewModel.js";
import { AuthView } from "./views/authView.js";
import { AccountManagementViewModel } from "./viewmodels/accountManagementViewModel.js";
import { AccountManagementView } from "./views/accountManagementView.js";

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "home") {
    forceHomeTopOnRefresh();

    const vm = new HomeViewModel();
    const view = new HomeView(vm);
    view.render();

    initHomeAnchorNavigation();
    initHomeNavScroll();

    requestAnimationFrame(() => {
      forceHomeTopOnRefresh();
      initHomeScrollReveal();
    });

    setTimeout(() => {
      forceHomeTopOnRefresh();
    }, 80);
  }

  if (document.body.dataset.page === "auth") {
    const vm = new AuthViewModel();
    const view = new AuthView(vm);
    view.render();
  }

  if (document.body.dataset.page === "account-management") {
    const vm = new AccountManagementViewModel();
    const view = new AccountManagementView(vm);
    view.render();
  }

  if (document.body.dataset.page === "dashboard") {
    initAppActionButtons();
    initAigcLaunchCard();
    initEnterpriseDashboardAnalytics();
  }

  if (document.body.dataset.page === "aigc") {
    initAigcPurchasePage();
  }

  initAccountAvatar();

  console.log("HARSON MVVM application loaded.");
});

function forceHomeTopOnRefresh() {
  if (document.body.dataset.page !== "home") {
    return;
  }

  if (window.location.hash) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }

  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto"
  });
}

function initHomeAnchorNavigation() {
  if (document.body.dataset.page !== "home") {
    return;
  }

  function clearHashFromUrl() {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }

  function scrollToTarget(selector) {
    if (!selector || selector === "#") {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      clearHashFromUrl();
      return;
    }

    const target = document.querySelector(selector);

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    clearHashFromUrl();
  }

  const hashLinks = document.querySelectorAll('a[href^="#"]');

  hashLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");

      if (!href) {
        return;
      }

      event.preventDefault();
      scrollToTarget(href);
    });
  });

  const exploreButton = document.getElementById("explorePlatformsBtn");

  if (exploreButton) {
    exploreButton.addEventListener("click", () => {
      scrollToTarget("#platforms");
    });
  }

  const contactButton = document.getElementById("contactExpertBtn");

  if (contactButton) {
    contactButton.addEventListener("click", () => {
      const footer = document.querySelector(".footer");

      if (!footer) {
        return;
      }

      footer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      clearHashFromUrl();
    });
  }
}


function initHomeNavScroll() {
  const topBar = document.querySelector(
    'body[data-page="home"] .top-bar'
  );

  if (!topBar) {
    return;
  }

  const updateNav = () => {
    if (window.scrollY > 20) {
      topBar.classList.add("is-scrolled");
    } else {
      topBar.classList.remove("is-scrolled");
    }
  };

  updateNav();

  window.addEventListener(
    "scroll",
    updateNav,
    { passive: true }
  );
}

function initHomeScrollReveal() {
  if (document.body.dataset.page !== "home") {
    return;
  }

  injectScrollRevealStyles();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealGroups = [
    {
      selector: ".platform-story-kicker",
      effectClass: "reveal-up",
      stagger: 0,
      delayOffset: 0
    },
    {
      selector: ".platform-story-line",
      effectClass: "reveal-up",
      stagger: 130,
      delayOffset: 100
    },
    {
      selector: ".platform-story-lead",
      effectClass: "reveal-up",
      stagger: 0,
      delayOffset: 360
    },
    {
      selector: ".platform-story-description",
      effectClass: "reveal-up",
      stagger: 0,
      delayOffset: 500
    },
    {
      selector: ".platform-story-link",
      effectClass: "reveal-up",
      stagger: 0,
      delayOffset: 640
    },
    {
      selector: ".featured-app-card",
      effectClass: "reveal-app",
      stagger: 120,
      delayOffset: 80
    },
    {
      selector:
        ".app-ecosystem-kicker, " +
        ".app-ecosystem-header h2, " +
        ".app-ecosystem-header p",
      effectClass: "reveal-up",
      stagger: 140,
      delayOffset: 80
    },
    {
      selector: ".hero-access-card, .hero-summary-card, .hero-suite-card",
      effectClass: "reveal-right",
      stagger: 0
    },
    {
      selector: ".section-header",
      effectClass: "reveal-up",
      stagger: 0
    },
    {
      selector: ".platform-card",
      effectClass: "reveal-up",
      stagger: 110
    },
    {
      selector: ".insight-card",
      effectClass: "reveal-up",
      stagger: 100
    },
    {
      selector: ".footer-col",
      effectClass: "reveal-up",
      stagger: 70
    }
  ];

  const revealElements = [];

  revealGroups.forEach((group) => {
    const elements = Array.from(
      document.querySelectorAll(group.selector)
    );

    const delayOffset = group.delayOffset || 0;

    elements.forEach((element, index) => {
      element.classList.add(
        "scroll-reveal",
        group.effectClass
      );

      element.style.setProperty(
        "--reveal-delay",
        `${delayOffset + index * group.stagger}ms`
      );

      revealElements.push(element);
    });
  });

  if (!revealElements.length) {
    return;
  }

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => {
      element.classList.add("is-visible");
    });

    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");

      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.14,
    rootMargin: "0px 0px -10% 0px"
  });

  revealElements.forEach((element) => {
    observer.observe(element);
  });
}

function injectScrollRevealStyles() {
  if (document.getElementById("scrollRevealStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "scrollRevealStyles";
  style.textContent = `
    .scroll-reveal {
      opacity: 0;
      transform: translateY(28px);
      transition:
        opacity 720ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 720ms cubic-bezier(0.22, 1, 0.36, 1),
        border-color 240ms ease,
        background 240ms ease,
        box-shadow 280ms ease;
      transition-delay: var(--reveal-delay, 0ms);
      will-change: opacity, transform;
    }

    .scroll-reveal.reveal-left {
      transform: translateX(-28px);
    }

    .scroll-reveal.reveal-right {
      transform: translateX(28px);
    }

    .scroll-reveal.reveal-up {
      transform: translateY(32px);
    }

    .scroll-reveal.is-visible {
      opacity: 1;
      transform: translateX(0) translateY(0);
    }

    @media (prefers-reduced-motion: reduce) {
      .scroll-reveal {
        opacity: 1;
        transform: none;
        transition: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function initAppActionButtons() {
  const actionButtons = document.querySelectorAll(".app-action-btn");

  if (!actionButtons.length) {
    return;
  }

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const appName = button.dataset.app;
      const card = button.closest(".app-card");

      if (!card) {
        return;
      }

      const status = card.querySelector(".app-status");

      if (!status) {
        return;
      }

      if (action === "start") {
        status.className = "app-status running";
        status.textContent = "运行中";
        showToast(`${appName} 应用已启动`);
      }

      if (action === "stop") {
        status.className = "app-status stopped";
        status.textContent = "已停止";
        showToast(`${appName} 应用已停止`);
      }
    });
  });
}

function initAigcLaunchCard() {
  const card = document.querySelector(".aigc-launch-card");

  if (!card) {
    return;
  }

  card.addEventListener("click", event => {
    if (event.target.closest("button")) {
      return;
    }

    window.location.href = card.dataset.openUrl || "/aigc";
  });
}

async function initEnterpriseDashboardAnalytics() {
  const masterSelect =
    document.getElementById(
      "dashboardMasterSelect"
    );

  const accountSelect =
    document.getElementById(
      "localUserSelect"
    );

  const syncStatus =
    document.getElementById(
      "dashboardSyncStatus"
    );

  const numberFormatter =
    new Intl.NumberFormat(
      "zh-CN",
      {
        maximumFractionDigits: 2
      }
    );

  const chartColors = [
    "var(--primary)",
    "#4caf50",
    "#2196f3",
    "#9c27b0",
    "#ff7043",
    "#26a69a"
  ];

  let currentData = null;
  let syncRequestId = 0;

  function formatNumber(value) {
    const numericValue =
      Number(value);

    return numberFormatter.format(
      Number.isFinite(
        numericValue
      )
        ? numericValue
        : 0
    );
  }

  function formatCompactNumber(value) {
    const numericValue =
      Number(value || 0);

    if (numericValue >= 1000000) {
      return `${(
        numericValue / 1000000
      ).toFixed(1)}M`;
    }

    if (numericValue >= 1000) {
      return `${(
        numericValue / 1000
      ).toFixed(1)}K`;
    }

    return formatNumber(
      numericValue
    );
  }

  function formatDateTime(value) {
    if (!value) {
      return "暂无同步";
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleString(
      "zh-CN",
      {
        hour12: false
      }
    );
  }

  function setText(id, value) {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        String(value);
    }
  }

  function setTokenValue(
    id,
    value
  ) {
    const element =
      document.getElementById(id);

    if (!element) {
      return;
    }

    const suffix =
      document.createElement(
        "span"
      );

    suffix.textContent = " tokens";

    element.replaceChildren(
      document.createTextNode(
        formatNumber(value)
      ),
      suffix
    );
  }

  function showDataMessage(
    message,
    isError = false
  ) {
    const messageElement =
      document.getElementById(
        "dashboardDataMessage"
      );

    if (!messageElement) {
      return;
    }

    messageElement.textContent =
      message;

    messageElement.classList.toggle(
      "error",
      isError
    );
  }

  function setSyncStatus(
    message,
    state = ""
  ) {
    if (!syncStatus) {
      return;
    }

    syncStatus.textContent =
      message;

    syncStatus.classList.remove(
      "is-loading",
      "is-success",
      "is-error"
    );

    if (state) {
      syncStatus.classList.add(
        `is-${state}`
      );
    }
  }

  function createEmptyState(
    message
  ) {
    const element =
      document.createElement("p");

    element.className =
      "dashboard-empty-state";

    element.textContent = message;

    return element;
  }

  function renderMasterSelect(data) {
    if (!masterSelect) {
      return;
    }

    const selectedIds =
      data.selectedMasterAccountIds ||
      [];

    masterSelect.replaceChildren();

    if (
      data.scope === "admin" &&
      data.masters.length > 1
    ) {
      const allOption =
        document.createElement(
          "option"
        );

      allOption.value = "";
      allOption.textContent =
        "全部企业";

      masterSelect.append(
        allOption
      );
    }

    data.masters.forEach(master => {
      const option =
        document.createElement(
          "option"
        );

      option.value = master.id;
      option.textContent =
        master.enterpriseName;

      masterSelect.append(option);
    });

    if (selectedIds.length === 1) {
      masterSelect.value =
        selectedIds[0];
    } else {
      masterSelect.value = "";
    }

    masterSelect.disabled =
      data.scope !== "admin" ||
      data.masters.length <= 1;
  }

  function renderOverview(data) {
    const summary =
      data.summary || {};

    setText(
      "overviewEnterprise",
      data.enterpriseName
    );

    setText(
      "overviewSubAccounts",
      `${summary.activeSubAccounts || 0} 个`
    );

    setText(
      "overviewTasks",
      `${formatNumber(
        summary.totalTasks
      )} 次`
    );

    setText(
      "overviewSync",
      formatDateTime(
        data.latestSyncedAt
      )
    );

    setText(
      "enterpriseAnalyticsTitle",
      `${data.enterpriseName} · CL-AIGC Token 分析`
    );

    setTokenValue(
      "globalBalance",
      summary.currentBalance
    );

    setTokenValue(
      "globalAllocated",
      summary.allocatedTokens
    );

    setTokenValue(
      "globalConsumed",
      summary.netUsedTokens
    );

    setTokenValue(
      "globalRemaining",
      summary.remainingTokens
    );

    setText(
      "globalTasks",
      `${formatNumber(
        summary.totalTasks
      )} 次`
    );

    showDataMessage(
      data.latestSyncedAt
        ? `当前图表来自真实任务快照，最近同步：${formatDateTime(
            data.latestSyncedAt
          )}`
        : "当前企业还没有同步真实任务记录，Token 消耗暂显示为 0。"
    );
  }

  function renderUsageBars(
    accounts
  ) {
    const container =
      document.getElementById(
        "subAccountUsageChart"
      );

    if (!container) {
      return;
    }

    container.replaceChildren();

    if (!accounts.length) {
      container.append(
        createEmptyState(
          "当前企业暂无可用子账号"
        )
      );

      return;
    }

    const maximumUsage =
      Math.max(
        ...accounts.map(account =>
          Number(
            account.netUsedTokens || 0
          )
        ),
        0
      );

    accounts.forEach(account => {
      const row =
        document.createElement("div");

      row.className = "bar-row";

      const label =
        document.createElement("span");

      label.textContent = account.name;
      label.title = account.name;

      const track =
        document.createElement("div");

      track.className = "bar-track";

      const fill =
        document.createElement("div");

      fill.className =
        "bar-fill aigc-bar";

      fill.style.width =
        maximumUsage > 0
          ? `${Math.max(
              account.netUsedTokens /
              maximumUsage *
              100,
              account.netUsedTokens > 0
                ? 2
                : 0
            )}%`
          : "0%";

      track.append(fill);

      const value =
        document.createElement("strong");

      value.textContent =
        formatCompactNumber(
          account.netUsedTokens
        );

      row.append(
        label,
        track,
        value
      );

      container.append(row);
    });
  }

  function renderUsageShare(
    accounts
  ) {
    const pie =
      document.getElementById(
        "subAccountSharePie"
      );

    const legend =
      document.getElementById(
        "subAccountShareLegend"
      );

    if (!pie || !legend) {
      return;
    }

    legend.replaceChildren();

    const usedAccounts =
      accounts.filter(account =>
        account.netUsedTokens > 0
      );

    if (!usedAccounts.length) {
      pie.style.background =
        "rgba(255, 255, 255, 0.08)";

      legend.append(
        createEmptyState(
          "暂无可计算的 Token 消耗占比"
        )
      );

      return;
    }

    let start = 0;

    const segments =
      usedAccounts.map(
        (account, index) => {
          const end =
            index ===
              usedAccounts.length - 1
              ? 100
              : start +
                account.sharePercent;

          const segment =
            `${chartColors[
              index %
              chartColors.length
            ]} ${start}% ${end}%`;

          start = end;

          return segment;
        }
      );

    pie.style.background =
      `conic-gradient(${segments.join(
        ", "
      )})`;

    usedAccounts.forEach(
      (account, index) => {
        const item =
          document.createElement(
            "div"
          );

        const dot =
          document.createElement(
            "span"
          );

        dot.className = "dot";
        dot.style.background =
          chartColors[
            index %
            chartColors.length
          ];

        item.append(
          dot,
          document.createTextNode(
            `${account.name}：${account.sharePercent}%`
          )
        );

        legend.append(item);
      }
    );
  }

  function renderWeeklyTrend(days) {
    const container =
      document.getElementById(
        "weeklyTokenChart"
      );

    if (!container) {
      return;
    }

    container.replaceChildren();

    const maximumUsage =
      Math.max(
        ...days.map(day =>
          Number(day.tokens || 0)
        ),
        0
      );

    days.forEach(day => {
      const bar =
        document.createElement("div");

      bar.className = "week-bar";
      bar.style.height =
        maximumUsage > 0
          ? `${Math.max(
              day.tokens /
              maximumUsage *
              100,
              day.tokens > 0
                ? 8
                : 2
            )}%`
          : "2%";

      const label =
        document.createElement("span");

      label.textContent = day.label;

      const value =
        document.createElement("strong");

      value.textContent =
        formatCompactNumber(
          day.tokens
        );

      bar.append(label, value);
      container.append(bar);
    });
  }

  function accountStatusLabel(status) {
    const labels = {
      resolved:
        "已匹配 CL-AIGC 成员",
      member_unresolved:
        "暂无可识别任务",
      member_ambiguous:
        "成员匹配冲突",
      identity_missing:
        "缺少账号标识"
    };

    return labels[status] ||
      "等待同步";
  }

  function taskStatusLabel(status) {
    const labels = {
      O: "已完成",
      R: "失败",
      P: "处理中",
      W: "等待中"
    };

    return labels[status] ||
      "处理中";
  }

  function openTaskImagePreview(
    imageUrl,
    title
  ) {
    if (!imageUrl) {
      return;
    }

    let preview =
      document.getElementById(
        "taskImagePreview"
      );

    if (!preview) {
      preview =
        document.createElement("div");

      preview.id =
        "taskImagePreview";

      preview.className =
        "task-image-preview";

      preview.hidden = true;

      const dialog =
        document.createElement("div");

      dialog.className =
        "task-image-preview-dialog";

      dialog.setAttribute(
        "role",
        "dialog"
      );

      dialog.setAttribute(
        "aria-modal",
        "true"
      );

      const closeButton =
        document.createElement("button");

      closeButton.type =
        "button";

      closeButton.className =
        "task-image-preview-close";

      closeButton.textContent =
        "×";

      closeButton.setAttribute(
        "aria-label",
        "关闭图片预览"
      );

      const image =
        document.createElement("img");

      image.className =
        "task-image-preview-content";

      image.referrerPolicy =
        "no-referrer";

      image.decoding =
        "async";

      const caption =
        document.createElement("p");

      caption.className =
        "task-image-preview-caption";

      dialog.append(
        closeButton,
        image,
        caption
      );

      preview.append(dialog);
      document.body.append(preview);

      const closePreview = () => {
        preview.hidden = true;
        document.body.classList.remove(
          "task-preview-open"
        );
      };

      closeButton.addEventListener(
        "click",
        closePreview
      );

      preview.addEventListener(
        "click",
        event => {
          if (event.target === preview) {
            closePreview();
          }
        }
      );

      document.addEventListener(
        "keydown",
        event => {
          if (
            event.key === "Escape" &&
            !preview.hidden
          ) {
            closePreview();
          }
        }
      );
    }

    const image =
      preview.querySelector(
        ".task-image-preview-content"
      );

    const caption =
      preview.querySelector(
        ".task-image-preview-caption"
      );

    image.src = imageUrl;
    image.alt = `${title}大图`;
    caption.textContent = title;

    preview.hidden = false;

    document.body.classList.add(
      "task-preview-open"
    );

    preview
      .querySelector(
        ".task-image-preview-close"
      )
      ?.focus();
  }

  function renderTaskRecords(
    tasks,
    bodyId,
    countId
  ) {
    const body =
      document.getElementById(
        bodyId
      );

    const safeTasks =
      Array.isArray(tasks)
        ? tasks
        : [];

    setText(
      countId,
      `${safeTasks.length} 条`
    );

    if (!body) {
      return;
    }

    body.replaceChildren();

    if (!safeTasks.length) {
      const row =
        document.createElement("tr");

      const cell =
        document.createElement("td");

      cell.colSpan = 5;
      cell.className =
        "task-empty-cell";
      cell.textContent =
        "当前账号暂无创作记录";

      row.append(cell);
      body.append(row);

      return;
    }

    safeTasks.forEach(task => {
      const row =
        document.createElement("tr");

      const titleCell =
        document.createElement("td");

      const taskSummary =
        document.createElement("div");

      taskSummary.className =
        "task-summary";

      const titleText =
        document.createElement("div");

      titleText.className =
        "task-title-text";

      if (task.imageUrl) {
        const thumbnail =
          document.createElement("img");

        thumbnail.className =
          "task-thumbnail";

        thumbnail.src =
          task.imageUrl;

        thumbnail.alt =
          `${task.title || "AIGC 创作任务"}封面`;

        thumbnail.loading =
          "lazy";

        thumbnail.decoding =
          "async";

        thumbnail.referrerPolicy =
          "no-referrer";

        thumbnail.width = 64;
        thumbnail.height = 64;

        thumbnail.addEventListener(
          "error",
          () => {
            thumbnail.remove();
          },
          {
            once: true
          }
        );

        const previewButton =
          document.createElement("button");

        previewButton.type =
          "button";

        previewButton.className =
          "task-thumbnail-button";

        previewButton.title =
          "点击放大查看";

        previewButton.setAttribute(
          "aria-label",
          `放大查看${task.title || "创作任务"}封面`
        );

        previewButton.append(
          thumbnail
        );

        previewButton.addEventListener(
          "click",
          () => {
            openTaskImagePreview(
              task.imageUrl,
              task.title ||
                "AIGC 创作任务"
            );
          }
        );

        taskSummary.append(
          previewButton
        );
      }

      const title =
        document.createElement("strong");

      title.textContent =
        task.title ||
        "AIGC 创作任务";

      const taskId =
        document.createElement("span");

      taskId.textContent =
        task.id
          ? `任务 ${task.id}`
          : "CL-AIGC 任务";

      titleText.append(
        title,
        taskId
      );

      taskSummary.append(
        titleText
      );

      titleCell.append(
        taskSummary
      );

      const statusCell =
        document.createElement("td");

      const status =
        document.createElement("span");

      status.className =
        `task-status task-status-${String(
          task.status || "processing"
        ).toLowerCase()}`;

      status.textContent =
        taskStatusLabel(
          task.status
        );

      statusCell.append(status);

      const pointCell =
        document.createElement("td");

      pointCell.textContent =
        `${formatNumber(
          task.deductedTokens
        )} / ${formatNumber(
          task.refundedTokens
        )}`;

      const netCell =
        document.createElement("td");

      netCell.textContent =
        formatNumber(
          task.netUsedTokens
        );

      const timeCell =
        document.createElement("td");

      timeCell.textContent =
        formatDateTime(
          task.completedAt ||
          task.createdAt
        );

      row.append(
        titleCell,
        statusCell,
        pointCell,
        netCell,
        timeCell
      );

      body.append(row);
    });
  }

  function renderMasterDetails(
    account
  ) {
    if (!account) {
      setText(
        "masterTaskCount",
        "0 次"
      );
      setText("masterDeducted", "0");
      setText("masterRefunded", "0");
      setText("masterConsumed", "0");
      setText(
        "masterSuccessRate",
        "0%"
      );
      setText(
        "masterResolutionStatus",
        "暂无主账号数据"
      );
      setText(
        "masterAccountStatus",
        "暂无数据"
      );

      renderTaskRecords(
        [],
        "masterTaskRecords",
        "masterTaskRecordCount"
      );

      return;
    }

    setText(
      "masterTaskCount",
      `${formatNumber(
        account.totalTasks
      )} 次`
    );
    setText(
      "masterDeducted",
      formatNumber(
        account.deductedTokens
      )
    );
    setText(
      "masterRefunded",
      formatNumber(
        account.refundedTokens
      )
    );
    setText(
      "masterConsumed",
      formatNumber(
        account.netUsedTokens
      )
    );
    setText(
      "masterSuccessRate",
      account.totalTasks > 0
        ? `${Number(
            account.successfulTasks /
            account.totalTasks *
            100
          ).toFixed(1)}%`
        : "0%"
    );
    setText(
      "masterResolutionStatus",
      accountStatusLabel(
        account.status
      )
    );
    setText(
      "masterAccountStatus",
      account.totalTasks > 0
        ? "已读取真实记录"
        : "暂无创作记录"
    );

    renderTaskRecords(
      account.tasks,
      "masterTaskRecords",
      "masterTaskRecordCount"
    );
  }

  function renderAccountDetails(
    accountId
  ) {
    const accounts =
      currentData?.accounts || [];

    const account =
      accounts.find(item =>
        String(item.id) ===
        String(accountId)
      ) || accounts[0];

    if (!account) {
      [
        "localLimit",
        "localDeducted",
        "localRefunded",
        "localConsumed",
        "localRemaining"
      ].forEach(id =>
        setTokenValue(id, 0)
      );

      setText(
        "localTaskCount",
        "0 次"
      );

      setText(
        "localSuccessRate",
        "0%"
      );

      setText(
        "localResolutionStatus",
        "暂无子账号"
      );

      renderTaskRecords(
        [],
        "subTaskRecords",
        "subTaskRecordCount"
      );

      return;
    }

    setTokenValue(
      "localLimit",
      account.tokenLimit
    );

    setTokenValue(
      "localDeducted",
      account.deductedTokens
    );

    setTokenValue(
      "localRefunded",
      account.refundedTokens
    );

    setTokenValue(
      "localConsumed",
      account.netUsedTokens
    );

    setTokenValue(
      "localRemaining",
      account.remainingTokens
    );

    setText(
      "localTaskCount",
      `${formatNumber(
        account.totalTasks
      )} 次`
    );

    setText(
      "localSuccessRate",
      account.totalTasks > 0
        ? `${Number(
            account.successfulTasks /
            account.totalTasks *
            100
          ).toFixed(1)}%`
        : "0%"
    );

    setText(
      "localResolutionStatus",
      accountStatusLabel(
        account.status
      )
    );

    renderTaskRecords(
      account.tasks,
      "subTaskRecords",
      "subTaskRecordCount"
    );

    const pie =
      document.getElementById(
        "localConsumptionPie"
      );

    if (pie) {
      const usageRate =
        Math.min(
          Math.max(
            Number(
              account.usageRate || 0
            ),
            0
          ),
          100
        );

      pie.style.background =
        `conic-gradient(
          var(--primary) 0 ${usageRate}%,
          rgba(255, 255, 255, 0.08) ${usageRate}% 100%
        )`;
    }
  }

  function renderAccountSelect(
    accounts
  ) {
    if (!accountSelect) {
      return;
    }

    const previousValue =
      accountSelect.value;

    accountSelect.replaceChildren();

    if (!accounts.length) {
      const option =
        document.createElement(
          "option"
        );

      option.value = "";
      option.textContent =
        "暂无子账号";

      accountSelect.append(option);
      accountSelect.disabled = true;

      renderAccountDetails("");

      return;
    }

    accounts.forEach(account => {
      const option =
        document.createElement(
          "option"
        );

      option.value = account.id;
      option.textContent =
        account.name;

      accountSelect.append(option);
    });

    accountSelect.disabled = false;

    const nextValue =
      accounts.some(account =>
        String(account.id) ===
        String(previousValue)
      )
        ? previousValue
        : accounts[0].id;

    accountSelect.value =
      nextValue;

    renderAccountDetails(
      nextValue
    );
  }

  function render(data) {
    currentData = data;

    renderMasterSelect(data);
    renderOverview(data);
    renderUsageBars(
      data.comparisonAccounts || []
    );
    renderUsageShare(
      data.comparisonAccounts || []
    );
    renderWeeklyTrend(
      data.weeklyTrend || []
    );
    renderAccountSelect(
      data.accounts || []
    );
    renderMasterDetails(
      data.masterAccount
    );
  }

  async function load(
    masterAccountId = ""
  ) {
    showDataMessage(
      "正在读取真实 Token 数据..."
    );

    const query =
      masterAccountId
        ? `?masterAccountId=${encodeURIComponent(
            masterAccountId
          )}`
        : "";

    try {
      const response = await fetch(
        `/api/aigc/dashboard/analytics${query}`,
        {
          credentials: "include"
        }
      );

      if (response.status === 401) {
        window.location.href =
          "/login";

        return;
      }

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
          "仪表盘数据读取失败"
        );
      }

      render(result.data);

      return result.data;
    } catch (error) {
      showDataMessage(
        error.message ||
        "仪表盘数据读取失败",
        true
      );

      return null;
    }
  }

  async function syncAndReload(data) {
    const masterAccountIds =
      data?.selectedMasterAccountIds ||
      [];

    if (masterAccountIds.length !== 1) {
      setSyncStatus(
        "请选择单个企业",
        ""
      );

      return;
    }

    const masterAccountId =
      masterAccountIds[0];

    const requestId =
      ++syncRequestId;

    setSyncStatus(
      "正在自动同步",
      "loading"
    );

    showDataMessage(
      "已显示上次数据，正在后台自动同步最新创作记录..."
    );

    try {
      const response = await fetch(
        "/api/aigc/dashboard/sync",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            masterAccountId
          })
        }
      );

      if (response.status === 401) {
        window.location.href =
          "/login";

        return;
      }

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
          "自动同步失败"
        );
      }

      if (requestId !== syncRequestId) {
        return;
      }

      const refreshedData =
        await load(
          masterAccountId
        );

      if (!refreshedData) {
        throw new Error(
          "同步成功，但最新仪表盘数据读取失败"
        );
      }

      const durationMs =
        Number(
          result.data?.timing
            ?.totalMs || 0
        );

      setSyncStatus(
        durationMs > 0
          ? `自动同步完成 · ${(durationMs / 1000).toFixed(1)} 秒`
          : "自动同步完成",
        "success"
      );

      showDataMessage(
        refreshedData.summary
          ?.totalTasks > 0
          ? `已自动同步最新创作记录，更新时间：${formatDateTime(
              refreshedData
                .latestSyncedAt
            )}`
          : "自动同步完成，当前企业暂无创作记录。"
      );
    } catch (error) {
      if (requestId !== syncRequestId) {
        return;
      }

      setSyncStatus(
        "自动同步失败",
        "error"
      );

      showDataMessage(
        `自动同步失败，当前仍显示上次保存的数据：${error.message || "请稍后重试"}`,
        true
      );
    }
  }

  async function loadAndSync(
    masterAccountId = ""
  ) {
    const data =
      await load(
        masterAccountId
      );

    if (data) {
      await syncAndReload(data);
    }
  }

  if (masterSelect) {
    masterSelect.addEventListener(
      "change",
      () => {
        loadAndSync(
          masterSelect.value
        );
      }
    );
  }

  if (accountSelect) {
    accountSelect.addEventListener(
      "change",
      () => {
        renderAccountDetails(
          accountSelect.value
        );
      }
    );
  }

  await loadAndSync();
}

/*
 * 保留旧方法名称，方便历史版本对照。
 * 当前仪表盘已经改由
 * initEnterpriseDashboardAnalytics()
 * 读取真实接口数据。
 */
async function initAigcPurchasePage() {
  const app = document.getElementById("aigcApp");
  const globalMessageBox = document.getElementById("aigcMessage");

  if (!app) {
    return;
  }

  const packages = [
    { name: "基础套餐", tokens: 10000, amount: 99 },
    { name: "标准套餐", tokens: 50000, amount: 399 },
    { name: "企业套餐", tokens: 100000, amount: 699 }
  ];

  function showMessage(message, success, elementId = "purchaseMessage") {
    const localBox = document.getElementById(elementId);
    const box = localBox || globalMessageBox;

    if (!box) {
      return;
    }

    box.textContent = message || "操作失败，请稍后重试";
    box.className = success ? "aigc-message success" : "aigc-message error";
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  async function getData() {
    const response = await fetch("/api/aigc/admin/aigc-center", {
      credentials: "include"
    });

    return response.json();
  }

  async function postPurchase(payload) {
    const response = await fetch("/api/aigc/admin/token-purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  function getRecordMasterId(record) {
    return String(
      record.masterAccountId ||
      record.masterId ||
      record.accountId ||
      record.enterpriseAccountId ||
      record.parentMasterAccountId ||
      record.parentId ||
      ""
    );
  }

  function getSummaryMasterId(record) {
    return String(
      record.masterAccountId ||
      record.masterId ||
      record.accountId ||
      record.enterpriseAccountId ||
      record.id ||
      ""
    );
  }

  function findCreditSummaryForMaster(summary, master) {
    if (!master) {
      return null;
    }

    return summary.find(item => {
      const summaryMasterId = getSummaryMasterId(item);

      if (summaryMasterId && summaryMasterId === String(master.id)) {
        return true;
      }

      if (item.platformLogin && master.platformLogin) {
        return String(item.platformLogin) === String(master.platformLogin);
      }

      if (item.enterpriseName && master.enterpriseName) {
        return String(item.enterpriseName) === String(master.enterpriseName);
      }

      return false;
    }) || null;
  }

  function isPurchaseForMaster(purchase, master, masters) {
    if (!purchase || !master) {
      return false;
    }

    const purchaseMasterId = getRecordMasterId(purchase);

    if (purchaseMasterId) {
      return purchaseMasterId === String(master.id);
    }

    if (purchase.platformLogin && master.platformLogin) {
      return String(purchase.platformLogin) === String(master.platformLogin);
    }

    if (purchase.enterpriseName && master.enterpriseName) {
      return String(purchase.enterpriseName) === String(master.enterpriseName);
    }

    return masters.length === 1;
  }

  function isSubAccountForMaster(sub, master, masters) {
    if (!sub || !master) {
      return false;
    }

    const subMasterId = getRecordMasterId(sub);

    if (subMasterId) {
      return subMasterId === String(master.id);
    }

    if (sub.masterPlatformLogin && master.platformLogin) {
      return String(sub.masterPlatformLogin) === String(master.platformLogin);
    }

    if (sub.masterAccountLogin && master.platformLogin) {
      return String(sub.masterAccountLogin) === String(master.platformLogin);
    }

    if (sub.enterpriseName && master.enterpriseName) {
      return String(sub.enterpriseName) === String(master.enterpriseName);
    }

    /*
     * Fallback:
     * 如果旧子账号数据没有保存 masterAccountId，
     * 只有在系统中只有一个主账号时才显示，避免多个主账号时混在一起。
     */
    return masters.length === 1;
  }

  function getSelectedMasterData(masterId, masters, summary, purchases, subs) {
    if (!masterId) {
      return {
        master: null,
        totalCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        totalPurchased: 0,
        filteredPurchases: [],
        filteredSubs: []
      };
    }

    const selectedMaster = masters.find(master => String(master.id) === String(masterId)) || null;

    if (!selectedMaster) {
      return {
        master: null,
        totalCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        totalPurchased: 0,
        filteredPurchases: [],
        filteredSubs: []
      };
    }

    const selectedSummary = findCreditSummaryForMaster(summary, selectedMaster);

    const totalCredits = toNumber(
      selectedSummary?.totalCredits ??
      selectedMaster.totalCredits ??
      selectedMaster.credits ??
      selectedMaster.tokenLimit
    );

    const usedCredits = toNumber(
      selectedSummary?.usedCredits ??
      selectedMaster.usedCredits ??
      selectedMaster.usedTokens
    );

    const remainingCredits = toNumber(
      selectedSummary?.remainingCredits ??
      selectedMaster.remainingCredits ??
      selectedMaster.remainingTokens ??
      Math.max(totalCredits - usedCredits, 0)
    );

    const filteredPurchases = purchases.filter(purchase => {
      return isPurchaseForMaster(purchase, selectedMaster, masters);
    });

    const filteredSubs = subs.filter(sub => {
      return isSubAccountForMaster(sub, selectedMaster, masters);
    });

    const totalPurchased = filteredPurchases.reduce((sum, item) => {
      return sum + toNumber(item.tokens);
    }, 0);

    return {
      master: selectedMaster,
      totalCredits,
      usedCredits,
      remainingCredits,
      totalPurchased,
      filteredPurchases,
      filteredSubs
    };
  }

  function renderSubRows(subs, hasSelectedMaster) {
    const tbody = document.getElementById("subAccountRowsBody");

    if (!tbody) {
      return;
    }

    if (!hasSelectedMaster) {
      tbody.innerHTML = `<tr><td colspan="7">请选择主账号</td></tr>`;
      return;
    }

    if (!subs.length) {
      tbody.innerHTML = `<tr><td colspan="7">当前主账号暂无子账号数据</td></tr>`;
      return;
    }

    tbody.innerHTML = subs.map(sub => `
      <tr>
        <td>${sub.subAccountName || "-"}</td>
        <td>${sub.platformLogin || "-"}</td>
        <td>${formatNumber(sub.tokenLimit)}</td>
        <td>${formatNumber(sub.usedTokens)}</td>
        <td>${formatNumber(sub.remainingTokens)}</td>
        <td>${sub.usageRate || 0}%</td>
        <td>${sub.warningStatus === "warning" ? "低余额预警" : sub.warningStatus === "exceeded" ? "已达到上限" : "正常"}</td>
      </tr>
    `).join("");
  }

  function renderPurchaseRows(purchases, hasSelectedMaster) {
    const tbody = document.getElementById("purchaseRecordsBody");

    if (!tbody) {
      return;
    }

    if (!hasSelectedMaster) {
      tbody.innerHTML = `<tr><td colspan="5">请选择主账号</td></tr>`;
      return;
    }

    if (!purchases.length) {
      tbody.innerHTML = `<tr><td colspan="5">当前主账号暂无采购记录</td></tr>`;
      return;
    }

    tbody.innerHTML = purchases.slice().reverse().map(item => `
      <tr>
        <td>${item.packageName || "-"}</td>
        <td>${formatNumber(item.tokens)}</td>
        <td>¥${item.amount || 0}</td>
        <td>${item.paymentStatus === "paid" ? "已完成" : item.paymentStatus || "-"}</td>
        <td>${item.createdAt || "-"}</td>
      </tr>
    `).join("");
  }

  function updateSelectedMasterSummary(masterId, masters, summary, purchases, subs) {
    const selectedData = getSelectedMasterData(masterId, masters, summary, purchases, subs);

    const totalCreditsEl = document.getElementById("selectedTotalCredits");
    const usedCreditsEl = document.getElementById("selectedUsedCredits");
    const remainingCreditsEl = document.getElementById("selectedRemainingCredits");
    const totalPurchasedEl = document.getElementById("selectedTotalPurchased");

    if (totalCreditsEl) {
      totalCreditsEl.textContent = formatNumber(selectedData.totalCredits);
    }

    if (usedCreditsEl) {
      usedCreditsEl.textContent = formatNumber(selectedData.usedCredits);
    }

    if (remainingCreditsEl) {
      remainingCreditsEl.textContent = formatNumber(selectedData.remainingCredits);
    }

    if (totalPurchasedEl) {
      totalPurchasedEl.textContent = formatNumber(selectedData.totalPurchased);
    }

    renderSubRows(selectedData.filteredSubs, Boolean(masterId));
    renderPurchaseRows(selectedData.filteredPurchases, Boolean(masterId));
  }

  function render(data, preferredMasterId = "") {
    const masters = data.masters || [];
    const subs = data.subs || [];
    const purchases = data.purchases || [];
    const summary = data.creditSummary || [];

    const defaultMasterId = preferredMasterId || "";

    app.innerHTML = `
      <section class="summary-grid">
        <article class="card">
          <span>当前主账号总点数</span>
          <strong id="selectedTotalCredits">0</strong>
        </article>
        <article class="card">
          <span>当前主账号已使用 token</span>
          <strong id="selectedUsedCredits">0</strong>
        </article>
        <article class="card">
          <span>当前主账号剩余 token</span>
          <strong id="selectedRemainingCredits">0</strong>
        </article>
        <article class="card">
          <span>当前主账号历史购买 token</span>
          <strong id="selectedTotalPurchased">0</strong>
        </article>
      </section>

      <section class="panel">
        <h2>Token 套餐购买</h2>
        <p>选择 AIGC 企业主账号和 token 套餐。上方数据、子账号分配和采购记录都会根据当前选中的主账号同步更新。</p>

        <div id="purchaseMessage" class="aigc-message"></div>

        <form id="purchaseForm" class="purchase-form">
          <select id="masterAccountSelect" name="masterAccountId" required>
            <option value="">选择 AIGC 企业主账号</option>
            ${masters.map(master => `
              <option value="${master.id}" ${String(master.id) === String(defaultMasterId) ? "selected" : ""}>
                ${master.enterpriseName || "-"} / ${master.platformLogin || "-"} / 当前 ${formatNumber(master.totalCredits)} tokens
              </option>
            `).join("")}
          </select>

          <select name="packageIndex" required>
            <option value="">选择 token 套餐</option>
            ${packages.map((pkg, index) => `
              <option value="${index}">
                ${pkg.name} / ${formatNumber(pkg.tokens)} tokens / ¥${pkg.amount}
              </option>
            `).join("")}
          </select>

          <button type="submit">购买 token</button>
        </form>
      </section>

      <section class="panel">
        <h2>当前主账号子账号 token 分配概览</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>子账号</th>
                <th>登录名</th>
                <th>Token 配额</th>
                <th>已使用</th>
                <th>剩余</th>
                <th>使用率</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody id="subAccountRowsBody">
              <tr><td colspan="7">请选择主账号</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>当前主账号采购记录</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>套餐</th>
                <th>tokens</th>
                <th>金额</th>
                <th>状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody id="purchaseRecordsBody">
              <tr><td colspan="5">请选择主账号</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    const masterSelect = document.getElementById("masterAccountSelect");
    const form = document.getElementById("purchaseForm");

    if (masterSelect) {
      updateSelectedMasterSummary(masterSelect.value, masters, summary, purchases, subs);

      masterSelect.addEventListener("change", () => {
        updateSelectedMasterSummary(masterSelect.value, masters, summary, purchases, subs);
      });
    }

    if (!form) {
      return;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const formData = new FormData(form);
      const selectedPackage = packages[Number(formData.get("packageIndex"))];
      const selectedMasterId = formData.get("masterAccountId");

      if (!selectedMasterId) {
        showMessage("请选择 AIGC 企业主账号", false);
        return;
      }

      if (!selectedPackage) {
        showMessage("请选择 token 套餐", false);
        return;
      }

      const result = await postPurchase({
        masterAccountId: selectedMasterId,
        packageName: selectedPackage.name,
        tokens: selectedPackage.tokens,
        amount: selectedPackage.amount
      });

      showMessage(result.message, result.success);

      if (result.success) {
        setTimeout(async () => {
          const refreshed = await getData();

          if (refreshed.success) {
            render(refreshed.data, selectedMasterId);
          }
        }, 2500);
      }
    });
  }

  const result = await getData();

  if (!result.success) {
    showMessage(result.message || "CL-AIGC 页面加载失败", false, "aigcMessage");
    return;
  }

  render(result.data);
}

async function initAccountAvatar() {
  const avatarButton = document.getElementById("accountAvatar");
  const avatarText = document.getElementById("accountAvatarText");

  setDashboardNavVisibility(false);

  let currentUser = null;

  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include"
    });

    if (response.ok) {
      const result = await response.json();

      if (result.success) {
        currentUser = result.user || result.data || null;
      }
    }
  } catch (error) {
    currentUser = null;
  }

  const canViewDashboard =
    Boolean(
      currentUser
        ?.dashboardAccess
        ?.allowed
    );

  setDashboardNavVisibility(
    canViewDashboard
  );

  configureDashboardAigcEntry(
    currentUser
  );

  if (!avatarButton || !avatarText) {
    return;
  }

  if (!currentUser) {
    avatarButton.classList.remove("logged-in");
    avatarButton.title = "用户登录";
    avatarText.innerHTML = `<i class="fa-regular fa-circle-user"></i>`;

    avatarButton.addEventListener("click", () => {
      window.location.href = "/login";
    });

    return;
  }

  const role = currentUser.role || "";
  const displayName = currentUser.name || currentUser.username || currentUser.email || "";
  const avatarValue = role === "admin" ? "A" : getUserInitial(displayName);

  avatarButton.classList.add("logged-in");
  avatarButton.title = role === "admin" ? "管理员账号，点击退出登录" : "用户账号，点击退出登录";
  avatarText.textContent = avatarValue;

  avatarButton.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } finally {
      window.location.href = "/";
    }
  });
}

function setDashboardNavVisibility(visible) {
  const dashboardLinks = document.querySelectorAll('a[href="/dashboard"]');

  dashboardLinks.forEach((link) => {
    const navItem = link.closest("li") || link;
    navItem.style.display = visible ? "" : "none";
  });
}

function configureDashboardAigcEntry(
  currentUser
) {
  if (
    document.body.dataset.page !==
    "dashboard"
  ) {
    return;
  }

  const card =
    document.querySelector(
      ".aigc-launch-card"
    );

  const topbarLink =
    document.querySelector(
      "[data-dashboard-aigc-entry]"
    );

  if (!card && !topbarLink) {
    return;
  }

  const isMasterOwner =
    currentUser
      ?.dashboardAccess
      ?.scope ===
    "master_owner";

  if (isMasterOwner) {
    if (card) {
      card.dataset.openUrl =
        "/aigc-workspace";

      card.title =
        "点击进入 CL-AIGC Workspace";
    }

    if (topbarLink) {
      topbarLink.href =
        "/aigc-workspace";
    }

    return;
  }

  if (card) {
    card.dataset.openUrl =
      "/aigc";
  }

  if (topbarLink) {
    topbarLink.href =
      "/aigc";
  }
}

function getUserInitial(value) {
  if (!value) {
    return "U";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "U";
  }

  const beforeAt = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;

  const chineseMatch = beforeAt.match(/[\u4e00-\u9fa5]/);

  if (chineseMatch) {
    return chineseMatch[0];
  }

  const letterMatch = beforeAt.match(/[a-zA-Z]/);

  if (letterMatch) {
    return letterMatch[0].toUpperCase();
  }

  return "U";
}

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
