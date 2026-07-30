"use strict";

const TOKEN_BALANCE_STORAGE_KEY =
  "clBaseTokenBalance";

const TOKEN_BALANCE_POLL_INTERVAL_MS =
  30 * 1000;

const DEFAULT_TAB =
  "token";

const MEMBERSHIPS = [
  {
    name: "免费用户",
    price: 0,
    levelClass: "is-free",
    buttonText: "当前方案",
    disabled: true,
    benefits: [
      "每日签到赠送 10 Token",
      "基础创作能力",
      "作品仅限个人用途",
      "标准任务队列"
    ]
  },
  {
    name: "黄金会员",
    price: 59,
    levelClass: "is-gold",
    buttonText: "立即成为黄金会员",
    benefits: [
      "开通即获得 590 Token",
      "每日签到赠送 20 Token",
      "开放全部基础 AI 工具",
      "支持无水印下载",
      "作品可用于商业场景",
      "会员 Token 有效期 31 天"
    ]
  },
  {
    name: "铂金会员",
    price: 299,
    levelClass: "is-platinum",
    buttonText: "立即成为铂金会员",
    benefits: [
      "开通即获得 3,000 Token",
      "每日签到赠送 30 Token",
      "开放全部 AI 创作能力",
      "支持无水印下载",
      "作品可用于商业场景",
      "更高任务优先级"
    ]
  },
  {
    name: "钻石会员",
    price: 899,
    levelClass: "is-diamond",
    buttonText: "立即成为钻石会员",
    recommended: true,
    benefits: [
      "开通即获得 9,000 Token",
      "每日签到赠送 50 Token",
      "开放全部 AI 创作能力",
      "支持无水印下载",
      "作品可用于商业场景",
      "最高任务优先级"
    ]
  }
];

const PACKAGES = [
  {
    baseToken: 100,
    bonusToken: 0,
    price: 10
  },
  {
    baseToken: 500,
    bonusToken: 0,
    price: 50
  },
  {
    baseToken: 1000,
    bonusToken: 0,
    price: 100
  },
  {
    baseToken: 2000,
    bonusToken: 100,
    price: 200,
    promotion:
      "限时特惠 · 多送 5%"
  },
  {
    baseToken: 5000,
    bonusToken: 250,
    price: 500,
    promotion:
      "限时特惠 · 多送 5%"
  },
  {
    baseToken: 10000,
    bonusToken: 1000,
    price: 1000,
    promotion:
      "旗舰加油包 · 多送 10%",
    selected: true
  }
];

const state = {
  selectedPackage:
    PACKAGES.find(
      item => item.selected
    ) || PACKAGES[0],

  balanceRequestActive:
    false,

  balanceTimerId:
    null,

  toastTimerId:
    null,

  rechargeRequestActive:
    false,

  lastFocusedElement:
    null
};

const elements = {
  tabs:
    Array.from(
      document.querySelectorAll(
        "[data-tab]"
      )
    ),

  panels:
    Array.from(
      document.querySelectorAll(
        "[data-panel]"
      )
    ),

  membershipGrid:
    document.getElementById(
      "membershipGrid"
    ),

  packageGrid:
    document.getElementById(
      "packageGrid"
    ),

  currentBalance:
    document.getElementById(
      "currentTokenBalance"
    ),

  accountBalance:
    document.getElementById(
      "accountTokenBalance"
    ),

  bonusBalance:
    document.getElementById(
      "bonusTokenBalance"
    ),

  selectedToken:
    document.getElementById(
      "selectedToken"
    ),

  selectedPrice:
    document.getElementById(
      "selectedPrice"
    ),

  agreementCheckbox:
    document.getElementById(
      "agreementCheckbox"
    ),

  enterpriseConsultButton:
    document.getElementById(
      "enterpriseConsultButton"
    ),

  tokenDetailsButton:
    document.getElementById(
      "tokenDetailsButton"
    ),

  tokenDetailsModal:
    document.getElementById(
      "tokenDetailsModal"
    ),

  tokenDetailsCloseButton:
    document.getElementById(
      "tokenDetailsCloseButton"
    ),

  tokenDetailsLoading:
    document.getElementById(
      "tokenDetailsLoading"
    ),

  tokenDetailsError:
    document.getElementById(
      "tokenDetailsError"
    ),

  tokenDetailsEmpty:
    document.getElementById(
      "tokenDetailsEmpty"
    ),

  tokenDetailsContent:
    document.getElementById(
      "tokenDetailsContent"
    ),

  tokenDetailsOrderCount:
    document.getElementById(
      "tokenDetailsOrderCount"
    ),

  tokenDetailsPaidAmount:
    document.getElementById(
      "tokenDetailsPaidAmount"
    ),

  tokenDetailsTokenAmount:
    document.getElementById(
      "tokenDetailsTokenAmount"
    ),

  tokenDetailsTableBody:
    document.getElementById(
      "tokenDetailsTableBody"
    ),

  tokenDetailsRefreshButton:
    document.getElementById(
      "tokenDetailsRefreshButton"
    ),

  toast:
    document.getElementById(
      "purchaseToast"
    )
};

function formatNumber(value) {
  return new Intl.NumberFormat(
    "zh-CN",
    {
      maximumFractionDigits: 2
    }
  ).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "zh-CN",
    {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0
    }
  ).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  if (!elements.toast) {
    window.alert(message);
    return;
  }

  if (state.toastTimerId !== null) {
    window.clearTimeout(
      state.toastTimerId
    );
  }

  elements.toast.textContent =
    message;

  elements.toast.classList.add(
    "is-visible"
  );

  state.toastTimerId =
    window.setTimeout(
      () => {
        elements.toast.classList.remove(
          "is-visible"
        );

        state.toastTimerId =
          null;
      },
      3200
    );
}

function renderMemberships() {
  if (!elements.membershipGrid) {
    return;
  }

  elements.membershipGrid.innerHTML =
    MEMBERSHIPS.map(item => {
      const benefits =
        item.benefits
          .map(benefit => `
            <li>${escapeHtml(benefit)}</li>
          `)
          .join("");

      const recommended =
        item.recommended
          ? `
            <span class="membership-recommend">
              推荐
            </span>
          `
          : "";

      const disabled =
        item.disabled
          ? "disabled"
          : "";

      const dataName =
        item.disabled
          ? ""
          : `data-membership="${escapeHtml(item.name)}"`;

      return `
        <article
          class="membership-card ${escapeHtml(item.levelClass)}"
        >
          ${recommended}

          <span class="membership-name">
            ${escapeHtml(item.name)}
          </span>

          <strong class="membership-price">
            <span>¥</span>
            ${formatNumber(item.price)}
            <small>/月</small>
          </strong>

          <button
            class="membership-button"
            type="button"
            ${dataName}
            ${disabled}
          >
            ${escapeHtml(item.buttonText)}
          </button>

          <ul class="benefit-list">
            ${benefits}
          </ul>
        </article>
      `;
    }).join("");
}

function renderPackages() {
  if (!elements.packageGrid) {
    return;
  }

  elements.packageGrid.innerHTML =
    PACKAGES.map(item => {
      const isSelected =
        item === state.selectedPackage;

      const promotion =
        item.promotion
          ? `
            <span class="package-promotion">
              ${escapeHtml(item.promotion)}
            </span>
          `
          : "";

      const bonus =
        item.bonusToken > 0
          ? `
            <small>
              +${formatNumber(item.bonusToken)}
            </small>
          `
          : "";

      return `
        <button
          class="package-card${isSelected ? " is-selected" : ""}"
          type="button"
          data-base-token="${item.baseToken}"
          data-bonus-token="${item.bonusToken}"
          data-price="${item.price}"
          aria-pressed="${String(isSelected)}"
        >
          ${promotion}

          <span class="package-token">
            <span
              class="token-icon package-token-icon"
              aria-hidden="true"
            >
              ⚡
            </span>

            <strong>
              ${formatNumber(item.baseToken)}
            </strong>

            ${bonus}
          </span>

          <span class="package-price">
            ${formatCurrency(item.price)}
          </span>
        </button>
      `;
    }).join("");
}

function normalizeTab(value) {
  const normalizedValue =
    String(value || "")
      .trim()
      .toLowerCase();

  return [
    "personal",
    "enterprise",
    "token"
  ].includes(normalizedValue)
    ? normalizedValue
    : DEFAULT_TAB;
}

function showTab(tabName) {
  const normalizedTab =
    normalizeTab(tabName);

  elements.tabs.forEach(tab => {
    const active =
      tab.dataset.tab ===
      normalizedTab;

    tab.classList.toggle(
      "is-active",
      active
    );

    tab.setAttribute(
      "aria-selected",
      String(active)
    );

    tab.tabIndex =
      active
        ? 0
        : -1;
  });

  elements.panels.forEach(panel => {
    const active =
      panel.dataset.panel ===
      normalizedTab;

    panel.hidden =
      !active;

    panel.classList.toggle(
      "is-active",
      active
    );
  });

  window.history.replaceState(
    null,
    "",
    `#${normalizedTab}`
  );
}

function updateBalance(balance) {
  const normalizedBalance =
    Number(balance);

  if (
    !Number.isFinite(
      normalizedBalance
    ) ||
    normalizedBalance < 0
  ) {
    return false;
  }

  const formattedBalance =
    formatNumber(
      normalizedBalance
    );

  if (elements.currentBalance) {
    elements.currentBalance.textContent =
      formattedBalance;
  }

  if (elements.accountBalance) {
    elements.accountBalance.textContent =
      formattedBalance;
  }

  if (elements.bonusBalance) {
    elements.bonusBalance.textContent =
      "0";
  }

  try {
    sessionStorage.setItem(
      TOKEN_BALANCE_STORAGE_KEY,
      String(normalizedBalance)
    );
  } catch {
    // sessionStorage 不可用时忽略。
  }

  try {
    localStorage.setItem(
      TOKEN_BALANCE_STORAGE_KEY,
      String(normalizedBalance)
    );
  } catch {
    // localStorage 不可用时忽略。
  }

  return true;
}

function restoreCachedBalance() {
  const storageList = [
    window.sessionStorage,
    window.localStorage
  ];

  for (const storage of storageList) {
    try {
      const savedBalance =
        storage.getItem(
          TOKEN_BALANCE_STORAGE_KEY
        );

      if (savedBalance === null) {
        continue;
      }

      if (
        updateBalance(
          savedBalance
        )
      ) {
        return;
      }
    } catch {
      // 当前存储不可用时继续。
    }
  }
}

async function readJsonResponse(response) {
  const responseText =
    await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(
      responseText
    );
  } catch {
    throw new Error(
      `服务器返回了无法解析的响应，HTTP ${response.status}`
    );
  }
}

async function fetchLatestBalance() {
  if (
    document.hidden ||
    state.balanceRequestActive
  ) {
    return;
  }

  state.balanceRequestActive =
    true;

  try {
    const response =
      await fetch(
        "/api/aigc/session/token-balance",
        {
          method: "GET",

          credentials:
            "include",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    const data =
      await readJsonResponse(
        response
      );

    if (
      response.status === 401
    ) {
      window.location.href =
        "/login";

      return;
    }

    if (
      !response.ok ||
      !data.success
    ) {
      console.warn(
        "Token 余额读取失败：",
        data.message ||
        response.status
      );

      return;
    }

    if (
      data.result?.available !==
      true
    ) {
      console.warn(
        "Token 余额暂不可用：",
        data.result?.reason ||
        "unknown"
      );

      return;
    }

    updateBalance(
      data.result.tokenBalance
    );
  } catch (error) {
    console.warn(
      "Token 余额读取失败：",
      error
    );
  } finally {
    state.balanceRequestActive =
      false;
  }
}

function startBalancePolling() {
  stopBalancePolling();

  fetchLatestBalance();

  state.balanceTimerId =
    window.setInterval(
      fetchLatestBalance,
      TOKEN_BALANCE_POLL_INTERVAL_MS
    );
}

function stopBalancePolling() {
  if (
    state.balanceTimerId ===
    null
  ) {
    return;
  }

  window.clearInterval(
    state.balanceTimerId
  );

  state.balanceTimerId =
    null;
}

function updateSelectedPackage() {
  const totalToken =
    state.selectedPackage.baseToken +
    state.selectedPackage.bonusToken;

  elements.selectedToken.textContent =
    `${formatNumber(totalToken)} Token`;

  elements.selectedPrice.textContent =
    formatCurrency(
      state.selectedPackage.price
    );
}

function selectPackage(button) {
  const baseToken =
    Number(
      button.dataset.baseToken
    );

  const bonusToken =
    Number(
      button.dataset.bonusToken
    );

  const price =
    Number(
      button.dataset.price
    );

  if (
    !Number.isFinite(baseToken) ||
    !Number.isFinite(bonusToken) ||
    !Number.isFinite(price)
  ) {
    showToast(
      "当前套餐数据无效。"
    );

    return;
  }

  state.selectedPackage = {
    baseToken,
    bonusToken,
    price
  };

  document
    .querySelectorAll(
      ".package-card"
    )
    .forEach(item => {
      const selected =
        item === button;

      item.classList.toggle(
        "is-selected",
        selected
      );

      item.setAttribute(
        "aria-pressed",
        String(selected)
      );
    });

  updateSelectedPackage();
}

function updatePaymentButtons() {
  const enabled =
    Boolean(
      elements.agreementCheckbox
        ?.checked
    );

  document
    .querySelectorAll(
      "[data-payment-method]"
    )
    .forEach(button => {
      button.disabled =
        !enabled;
    });
}


function setTokenDetailsView(
  viewName,
  message = ""
) {
  const views = {
    loading:
      elements.tokenDetailsLoading,

    error:
      elements.tokenDetailsError,

    empty:
      elements.tokenDetailsEmpty,

    content:
      elements.tokenDetailsContent
  };

  Object.entries(
    views
  ).forEach(
    ([
      name,
      element
    ]) => {
      if (!element) {
        return;
      }

      element.hidden =
        name !== viewName;
    }
  );

  if (
    viewName === "error" &&
    elements.tokenDetailsError
  ) {
    elements.tokenDetailsError
      .textContent =
        message ||
        "Token 明细读取失败。";
  }
}

function createTableCell(
  text,
  className = ""
) {
  const cell =
    document.createElement(
      "td"
    );

  cell.textContent =
    String(
      text ?? "--"
    );

  if (className) {
    cell.className =
      className;
  }

  return cell;
}

function createOrderCell(
  record
) {
  const cell =
    document.createElement(
      "td"
    );

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "token-details-order";

  const primary =
    document.createElement(
      "strong"
    );

  primary.textContent =
    record.orderSn ||
    record.orderId ||
    "--";

  const secondary =
    document.createElement(
      "small"
    );

  secondary.textContent =
    record.orderId &&
    record.orderSn
      ? `ID：${record.orderId}`
      : "CL-AIGC 充值订单";

  wrapper.append(
    primary,
    secondary
  );

  cell.appendChild(
    wrapper
  );

  return cell;
}

function createExpiryCell(
  record
) {
  const cell =
    document.createElement(
      "td"
    );

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "token-details-expiry";

  const begin =
    document.createElement(
      "span"
    );

  begin.textContent =
    record.dateBegin ||
    "--";

  const end =
    document.createElement(
      "small"
    );

  end.textContent =
    record.dateEnd
      ? `至 ${record.dateEnd}`
      : "未提供到期时间";

  wrapper.append(
    begin,
    end
  );

  cell.appendChild(
    wrapper
  );

  return cell;
}

function renderRechargeRecords(
  payload
) {
  const records =
    Array.isArray(
      payload?.records
    )
      ? payload.records
      : [];

  const summary =
    payload?.summary &&
    typeof payload.summary ===
      "object"
      ? payload.summary
      : {};

  if (
    elements.tokenDetailsOrderCount
  ) {
    elements.tokenDetailsOrderCount
      .textContent =
        formatNumber(
          Number(
            summary.totalOrders ??
            records.length
          ) || 0
        );
  }

  if (
    elements.tokenDetailsPaidAmount
  ) {
    elements.tokenDetailsPaidAmount
      .textContent =
        formatCurrency(
          Number(
            summary.totalPaidAmount
          ) || 0
        );
  }

  if (
    elements.tokenDetailsTokenAmount
  ) {
    elements.tokenDetailsTokenAmount
      .textContent =
        formatNumber(
          Number(
            summary.totalTokenAmount
          ) || 0
        );
  }

  if (
    elements.tokenDetailsTableBody
  ) {
    elements.tokenDetailsTableBody
      .replaceChildren();
  }

  if (records.length === 0) {
    setTokenDetailsView(
      "empty"
    );

    return;
  }

  const fragment =
    document.createDocumentFragment();

  records.forEach(record => {
    const row =
      document.createElement(
        "tr"
      );

    row.appendChild(
      createOrderCell(
        record
      )
    );

    row.appendChild(
      createTableCell(
        record.productName ||
        "--"
      )
    );

    row.appendChild(
      createTableCell(
        formatNumber(
          Number(
            record.tokenAmount
          ) || 0
        ),
        "token-details-token"
      )
    );

    row.appendChild(
      createTableCell(
        formatCurrency(
          Number(
            record.orderAmount
          ) || 0
        ),
        "token-details-amount"
      )
    );

    row.appendChild(
      createTableCell(
        record.payWay ||
        record.service ||
        "--"
      )
    );

    row.appendChild(
      createTableCell(
        record.datePay ||
        "--",
        "token-details-date"
      )
    );

    row.appendChild(
      createExpiryCell(
        record
      )
    );

    fragment.appendChild(
      row
    );
  });

  elements.tokenDetailsTableBody
    ?.appendChild(
      fragment
    );

  setTokenDetailsView(
    "content"
  );
}

async function loadRechargeRecords() {
  if (
    state.rechargeRequestActive
  ) {
    return;
  }

  state.rechargeRequestActive =
    true;

  if (
    elements.tokenDetailsRefreshButton
  ) {
    elements.tokenDetailsRefreshButton
      .disabled =
        true;

    elements.tokenDetailsRefreshButton
      .textContent =
        "读取中…";
  }

  setTokenDetailsView(
    "loading"
  );

  try {
    const response =
      await fetch(
        "/api/aigc/my-workspace/recharge-records?pageSize=100",
        {
          method: "GET",

          credentials:
            "include",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    const data =
      await readJsonResponse(
        response
      );

    if (
      response.status === 401
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
        "Token 明细读取失败"
      );
    }

    renderRechargeRecords(
      data.data
    );
  } catch (error) {
    setTokenDetailsView(
      "error",

      error instanceof Error
        ? error.message
        : "Token 明细读取失败"
    );
  } finally {
    state.rechargeRequestActive =
      false;

    if (
      elements.tokenDetailsRefreshButton
    ) {
      elements.tokenDetailsRefreshButton
        .disabled =
          false;

      elements.tokenDetailsRefreshButton
        .textContent =
          "重新读取";
    }
  }
}

function openTokenDetailsModal() {
  if (
    !elements.tokenDetailsModal
  ) {
    showToast(
      "Token 明细弹窗加载失败。"
    );

    return;
  }

  state.lastFocusedElement =
    document.activeElement;

  elements.tokenDetailsModal.hidden =
    false;

  document.body.classList.add(
    "token-details-open"
  );

  elements.tokenDetailsCloseButton
    ?.focus();

  loadRechargeRecords();
}

function closeTokenDetailsModal() {
  if (
    !elements.tokenDetailsModal
  ) {
    return;
  }

  elements.tokenDetailsModal.hidden =
    true;

  document.body.classList.remove(
    "token-details-open"
  );

  if (
    state.lastFocusedElement &&
    typeof state.lastFocusedElement
      .focus === "function"
  ) {
    state.lastFocusedElement
      .focus();
  }

  state.lastFocusedElement =
    null;
}


function bindEvents() {
  elements.tabs.forEach(tab => {
    tab.addEventListener(
      "click",
      () => {
        showTab(
          tab.dataset.tab
        );
      }
    );
  });

  elements.packageGrid
    ?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            ".package-card"
          );

        if (!button) {
          return;
        }

        selectPackage(button);
      }
    );

  elements.membershipGrid
    ?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-membership]"
          );

        if (!button) {
          return;
        }

        showToast(
          `${button.dataset.membership}购买功能尚未接入。`
        );
      }
    );

  elements.agreementCheckbox
    ?.addEventListener(
      "change",
      updatePaymentButtons
    );

  document
    .querySelectorAll(
      "[data-payment-method]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          showToast(
            `当前为测试版，${button.dataset.paymentMethod}支付和真实 Token 充值尚未接入。`
          );
        }
      );
    });

  document
    .querySelectorAll(
      "[data-agreement]"
    )
    .forEach(link => {
      link.addEventListener(
        "click",
        event => {
          event.preventDefault();

          showToast(
            `${link.dataset.agreement}页面尚未配置。`
          );
        }
      );
    });

  elements.enterpriseConsultButton
    ?.addEventListener(
      "click",
      () => {
        showToast(
          "企业会员咨询入口将在正式上线前配置。"
        );
      }
    );

  elements.tokenDetailsButton
    ?.addEventListener(
      "click",
      openTokenDetailsModal
    );

  document
    .querySelectorAll(
      "[data-close-token-details]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        closeTokenDetailsModal
      );
    });

  elements.tokenDetailsRefreshButton
    ?.addEventListener(
      "click",
      loadRechargeRecords
    );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape" &&
        elements.tokenDetailsModal &&
        !elements.tokenDetailsModal.hidden
      ) {
        closeTokenDetailsModal();
      }
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        fetchLatestBalance();
      }
    }
  );

  window.addEventListener(
    "pagehide",
    stopBalancePolling
  );
}

function initializePurchaseCenter() {
  renderMemberships();
  renderPackages();
  restoreCachedBalance();
  updateSelectedPackage();
  updatePaymentButtons();
  bindEvents();

  showTab(
    normalizeTab(
      window.location.hash
        .replace("#", "")
    )
  );

  startBalancePolling();
}

initializePurchaseCenter();
