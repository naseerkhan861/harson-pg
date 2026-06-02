import { HomeViewModel } from "./viewmodels/homeViewModel.js";
import { HomeView } from "./views/homeView.js";
import { AuthViewModel } from "./viewmodels/authViewModel.js";
import { AuthView } from "./views/authView.js";
import { AccountManagementViewModel } from "./viewmodels/accountManagementViewModel.js";
import { AccountManagementView } from "./views/accountManagementView.js";

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "home") {
    const vm = new HomeViewModel();
    const view = new HomeView(vm);
    view.render();
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
    initDashboardMenu();
    initAppActionButtons();
    initAigcLaunchCard();
    initBossAnalytics();
  }

  if (document.body.dataset.page === "aigc") {
    initAigcPurchasePage();
  }

  initAccountAvatar();

  console.log("HARSON MVVM application loaded.");
});

function initDashboardMenu() {
  const menuItems = document.querySelectorAll(".menu-item");

  if (!menuItems.length) {
    return;
  }

  menuItems.forEach((item) => {
    item.addEventListener("click", function () {
      menuItems.forEach((menuItem) => menuItem.classList.remove("active"));
      this.classList.add("active");

      const pageMap = {
        home: "首页",
        market: "应用市场",
        myapps: "我的应用",
        analytics: "经营分析",
        messages: "消息中心",
        settings: "设置"
      };

      const pageName = pageMap[this.dataset.page] || "首页";
      showToast(`已切换到${pageName}`);
    });
  });
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

function initBossAnalytics() {
  const globalPeriodSelect = document.getElementById("globalPeriodSelect");
  const localUserSelect = document.getElementById("localUserSelect");
  const localPeriodSelect = document.getElementById("localPeriodSelect");

  /*
   * Business rule:
   * Only CL-AIGC consumes tokens.
   * CL-SCM, CL-iStore and CL-iRobot are tracked by usage count / active usage only.
   */
  const globalData = {
    daily: {
      aigcTokenPurchased: "120,000",
      aigcTokenConsumed: "82,000",
      aigcTokenRemaining: "38,000",
      aigcTokenMoney: "¥26,800",
      activeAppsUsed: "4"
    },
    weekly: {
      aigcTokenPurchased: "420,000",
      aigcTokenConsumed: "286,000",
      aigcTokenRemaining: "134,000",
      aigcTokenMoney: "¥92,500",
      activeAppsUsed: "4"
    },
    monthly: {
      aigcTokenPurchased: "1,250,000",
      aigcTokenConsumed: "860,000",
      aigcTokenRemaining: "390,000",
      aigcTokenMoney: "¥268,000",
      activeAppsUsed: "4"
    },
    threeMonths: {
      aigcTokenPurchased: "3,820,000",
      aigcTokenConsumed: "2,610,000",
      aigcTokenRemaining: "1,210,000",
      aigcTokenMoney: "¥806,000",
      activeAppsUsed: "4"
    },
    sixMonths: {
      aigcTokenPurchased: "7,460,000",
      aigcTokenConsumed: "5,080,000",
      aigcTokenRemaining: "2,380,000",
      aigcTokenMoney: "¥1,586,000",
      activeAppsUsed: "4"
    }
  };

  const localData = {
    zhangchen: {
      daily: {
        aigcTokenPurchased: "18,000",
        aigcTokenConsumed: "12,600",
        aigcTokenRemaining: "5,400",
        aigcTokenMoney: "¥3,600",
        appsUsed: "3",
        topApp: "CL-AIGC",
        usedPercent: 70
      },
      weekly: {
        aigcTokenPurchased: "72,000",
        aigcTokenConsumed: "49,000",
        aigcTokenRemaining: "23,000",
        aigcTokenMoney: "¥14,400",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 68
      },
      monthly: {
        aigcTokenPurchased: "180,000",
        aigcTokenConsumed: "126,000",
        aigcTokenRemaining: "54,000",
        aigcTokenMoney: "¥36,000",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 70
      },
      threeMonths: {
        aigcTokenPurchased: "520,000",
        aigcTokenConsumed: "366,000",
        aigcTokenRemaining: "154,000",
        aigcTokenMoney: "¥104,000",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 70
      },
      sixMonths: {
        aigcTokenPurchased: "980,000",
        aigcTokenConsumed: "705,000",
        aigcTokenRemaining: "275,000",
        aigcTokenMoney: "¥196,000",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 72
      }
    },

    liwen: {
      daily: {
        aigcTokenPurchased: "22,000",
        aigcTokenConsumed: "16,000",
        aigcTokenRemaining: "6,000",
        aigcTokenMoney: "¥4,400",
        appsUsed: "3",
        topApp: "CL-iStore",
        usedPercent: 73
      },
      weekly: {
        aigcTokenPurchased: "88,000",
        aigcTokenConsumed: "62,000",
        aigcTokenRemaining: "26,000",
        aigcTokenMoney: "¥17,600",
        appsUsed: "4",
        topApp: "CL-iStore",
        usedPercent: 70
      },
      monthly: {
        aigcTokenPurchased: "220,000",
        aigcTokenConsumed: "160,000",
        aigcTokenRemaining: "60,000",
        aigcTokenMoney: "¥44,000",
        appsUsed: "4",
        topApp: "CL-iStore",
        usedPercent: 73
      },
      threeMonths: {
        aigcTokenPurchased: "640,000",
        aigcTokenConsumed: "458,000",
        aigcTokenRemaining: "182,000",
        aigcTokenMoney: "¥128,000",
        appsUsed: "4",
        topApp: "CL-iStore",
        usedPercent: 72
      },
      sixMonths: {
        aigcTokenPurchased: "1,180,000",
        aigcTokenConsumed: "860,000",
        aigcTokenRemaining: "320,000",
        aigcTokenMoney: "¥236,000",
        appsUsed: "4",
        topApp: "CL-iStore",
        usedPercent: 73
      }
    },

    wanglei: {
      daily: {
        aigcTokenPurchased: "14,500",
        aigcTokenConsumed: "9,100",
        aigcTokenRemaining: "5,400",
        aigcTokenMoney: "¥2,900",
        appsUsed: "2",
        topApp: "CL-SCM",
        usedPercent: 63
      },
      weekly: {
        aigcTokenPurchased: "58,000",
        aigcTokenConsumed: "36,500",
        aigcTokenRemaining: "21,500",
        aigcTokenMoney: "¥11,600",
        appsUsed: "3",
        topApp: "CL-SCM",
        usedPercent: 63
      },
      monthly: {
        aigcTokenPurchased: "145,000",
        aigcTokenConsumed: "91,000",
        aigcTokenRemaining: "54,000",
        aigcTokenMoney: "¥29,000",
        appsUsed: "4",
        topApp: "CL-SCM",
        usedPercent: 63
      },
      threeMonths: {
        aigcTokenPurchased: "390,000",
        aigcTokenConsumed: "254,000",
        aigcTokenRemaining: "136,000",
        aigcTokenMoney: "¥78,000",
        appsUsed: "4",
        topApp: "CL-SCM",
        usedPercent: 65
      },
      sixMonths: {
        aigcTokenPurchased: "720,000",
        aigcTokenConsumed: "482,000",
        aigcTokenRemaining: "238,000",
        aigcTokenMoney: "¥144,000",
        appsUsed: "4",
        topApp: "CL-SCM",
        usedPercent: 67
      }
    },

    chenyu: {
      daily: {
        aigcTokenPurchased: "9,600",
        aigcTokenConsumed: "7,200",
        aigcTokenRemaining: "2,400",
        aigcTokenMoney: "¥1,920",
        appsUsed: "2",
        topApp: "CL-iRobot",
        usedPercent: 75
      },
      weekly: {
        aigcTokenPurchased: "38,000",
        aigcTokenConsumed: "28,000",
        aigcTokenRemaining: "10,000",
        aigcTokenMoney: "¥7,600",
        appsUsed: "3",
        topApp: "CL-iRobot",
        usedPercent: 74
      },
      monthly: {
        aigcTokenPurchased: "96,000",
        aigcTokenConsumed: "72,000",
        aigcTokenRemaining: "24,000",
        aigcTokenMoney: "¥19,200",
        appsUsed: "3",
        topApp: "CL-iRobot",
        usedPercent: 75
      },
      threeMonths: {
        aigcTokenPurchased: "260,000",
        aigcTokenConsumed: "192,000",
        aigcTokenRemaining: "68,000",
        aigcTokenMoney: "¥52,000",
        appsUsed: "4",
        topApp: "CL-iRobot",
        usedPercent: 74
      },
      sixMonths: {
        aigcTokenPurchased: "510,000",
        aigcTokenConsumed: "382,000",
        aigcTokenRemaining: "128,000",
        aigcTokenMoney: "¥102,000",
        appsUsed: "4",
        topApp: "CL-iRobot",
        usedPercent: 75
      }
    }
  };

  const periodLabelMap = {
    daily: "今日",
    weekly: "本周",
    monthly: "本月",
    threeMonths: "近三个月",
    sixMonths: "近六个月"
  };

  function updateGlobal(period) {
    const data = globalData[period];

    if (!data) {
      return;
    }

    const purchasedEl = document.getElementById("globalPurchased");
    const consumedEl = document.getElementById("globalConsumed");
    const remainingEl = document.getElementById("globalRemaining");
    const moneyEl = document.getElementById("globalMoney");
    const appsUsedEl = document.getElementById("globalAppsUsed");

    if (purchasedEl) {
      purchasedEl.innerHTML = `${data.aigcTokenPurchased} <span>tokens</span>`;
    }

    if (consumedEl) {
      consumedEl.innerHTML = `${data.aigcTokenConsumed} <span>tokens</span>`;
    }

    if (remainingEl) {
      remainingEl.innerHTML = `${data.aigcTokenRemaining} <span>tokens</span>`;
    }

    if (moneyEl) {
      moneyEl.textContent = data.aigcTokenMoney;
    }

    if (appsUsedEl) {
      appsUsedEl.innerHTML = `${data.activeAppsUsed} <span>个应用</span>`;
    }
  }

  function updateLocal(userKey, period) {
    const user = localData[userKey]?.[period];

    if (!user) {
      return;
    }

    const purchasedEl = document.getElementById("localPurchased");
    const consumedEl = document.getElementById("localConsumed");
    const remainingEl = document.getElementById("localRemaining");
    const moneyEl = document.getElementById("localMoney");
    const appsUsedEl = document.getElementById("localAppsUsed");
    const topAppEl = document.getElementById("localTopApp");
    const periodLabelEl = document.getElementById("localPeriodLabel");
    const pieEl = document.getElementById("localConsumptionPie");

    if (purchasedEl) {
      purchasedEl.innerHTML = `${user.aigcTokenPurchased} <span>tokens</span>`;
    }

    if (consumedEl) {
      consumedEl.innerHTML = `${user.aigcTokenConsumed} <span>tokens</span>`;
    }

    if (remainingEl) {
      remainingEl.innerHTML = `${user.aigcTokenRemaining} <span>tokens</span>`;
    }

    if (moneyEl) {
      moneyEl.textContent = user.aigcTokenMoney;
    }

    if (appsUsedEl) {
      appsUsedEl.innerHTML = `${user.appsUsed} <span>个应用</span>`;
    }

    if (topAppEl) {
      topAppEl.textContent = user.topApp;
    }

    if (periodLabelEl) {
      periodLabelEl.textContent = periodLabelMap[period] || "今日";
    }

    if (pieEl) {
      pieEl.style.background = `conic-gradient(
        var(--primary) 0 ${user.usedPercent}%,
        #4ECDC4 ${user.usedPercent}% 100%
      )`;
    }
  }

  if (globalPeriodSelect) {
    updateGlobal(globalPeriodSelect.value);

    globalPeriodSelect.addEventListener("change", () => {
      updateGlobal(globalPeriodSelect.value);
    });
  }

  if (localUserSelect && localPeriodSelect) {
    updateLocal(localUserSelect.value, localPeriodSelect.value);

    localUserSelect.addEventListener("change", () => {
      updateLocal(localUserSelect.value, localPeriodSelect.value);
    });

    localPeriodSelect.addEventListener("change", () => {
      updateLocal(localUserSelect.value, localPeriodSelect.value);
    });
  }
}

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

    if (!box) return;

    box.textContent = message || "操作失败，请稍后重试";
    box.className = success ? "aigc-message success" : "aigc-message error";
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
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

  function render(data) {
    const masters = data.masters || [];
    const subs = data.subs || [];
    const purchases = data.purchases || [];
    const summary = data.creditSummary || [];

    const totalCredits = summary.reduce((sum, item) => sum + Number(item.totalCredits || 0), 0);
    const usedCredits = summary.reduce((sum, item) => sum + Number(item.usedCredits || 0), 0);
    const remainingCredits = summary.reduce((sum, item) => sum + Number(item.remainingCredits || 0), 0);
    const totalPurchased = purchases.reduce((sum, item) => sum + Number(item.tokens || 0), 0);

    app.innerHTML = `
      <section class="summary-grid">
        <article class="card">
          <span>主账号总点数</span>
          <strong>${formatNumber(totalCredits)}</strong>
        </article>
        <article class="card">
          <span>已使用 token</span>
          <strong>${formatNumber(usedCredits)}</strong>
        </article>
        <article class="card">
          <span>剩余 token</span>
          <strong>${formatNumber(remainingCredits)}</strong>
        </article>
        <article class="card">
          <span>历史购买 token</span>
          <strong>${formatNumber(totalPurchased)}</strong>
        </article>
      </section>

      <section class="panel">
        <h2>Token 套餐购买</h2>
        <p>选择 AIGC 企业主账号和 token 套餐。当前版本为内部采购模拟，提交后会立即增加主账号总点数。</p>

        <div id="purchaseMessage" class="aigc-message"></div>

        <form id="purchaseForm" class="purchase-form">
          <select name="masterAccountId" required>
            <option value="">选择 AIGC 企业主账号</option>
            ${masters.map(master => `
              <option value="${master.id}">
                ${master.enterpriseName} / ${master.platformLogin} / 当前 ${formatNumber(master.totalCredits)} tokens
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
        <h2>子账号 token 分配概览</h2>
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
            <tbody>
              ${subs.map(sub => `
                <tr>
                  <td>${sub.subAccountName}</td>
                  <td>${sub.platformLogin}</td>
                  <td>${formatNumber(sub.tokenLimit)}</td>
                  <td>${formatNumber(sub.usedTokens)}</td>
                  <td>${formatNumber(sub.remainingTokens)}</td>
                  <td>${sub.usageRate}%</td>
                  <td>${sub.warningStatus === "warning" ? "低余额预警" : sub.warningStatus === "exceeded" ? "已达到上限" : "正常"}</td>
                </tr>
              `).join("") || `<tr><td colspan="7">暂无子账号数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>采购记录</h2>
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
            <tbody>
              ${purchases.slice().reverse().map(item => `
                <tr>
                  <td>${item.packageName}</td>
                  <td>${formatNumber(item.tokens)}</td>
                  <td>¥${item.amount}</td>
                  <td>${item.paymentStatus === "paid" ? "已完成" : item.paymentStatus}</td>
                  <td>${item.createdAt}</td>
                </tr>
              `).join("") || `<tr><td colspan="5">暂无采购记录</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const form = document.getElementById("purchaseForm");

    if (!form) {
      return;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const formData = new FormData(form);
      const selectedPackage = packages[Number(formData.get("packageIndex"))];

      if (!formData.get("masterAccountId")) {
        showMessage("请选择 AIGC 企业主账号", false);
        return;
      }

      if (!selectedPackage) {
        showMessage("请选择 token 套餐", false);
        return;
      }

      const result = await postPurchase({
        masterAccountId: formData.get("masterAccountId"),
        packageName: selectedPackage.name,
        tokens: selectedPackage.tokens,
        amount: selectedPackage.amount
      });

      showMessage(result.message, result.success);

      if (result.success) {
        setTimeout(async () => {
          const refreshed = await getData();

          if (refreshed.success) {
            render(refreshed.data);
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

  const isAdmin = currentUser && currentUser.role === "admin";
  setDashboardNavVisibility(isAdmin);

  if (!avatarButton || !avatarText) {
    return;
  }

  if (!currentUser) {
    avatarButton.classList.remove("logged-in");
    avatarButton.title = "用户登录";
    avatarText.innerHTML = `<i class="fas fa-user-circle"></i>`;

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