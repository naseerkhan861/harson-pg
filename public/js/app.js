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
    initBossAnalytics();
  }

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

function initBossAnalytics() {
  const globalPeriodSelect = document.getElementById("globalPeriodSelect");
  const localUserSelect = document.getElementById("localUserSelect");
  const localPeriodSelect = document.getElementById("localPeriodSelect");

  const globalData = {
    daily: {
      purchased: "120,000",
      consumed: "82,000",
      remaining: "38,000",
      money: "¥26,800",
      appsUsed: "4"
    },
    weekly: {
      purchased: "420,000",
      consumed: "286,000",
      remaining: "134,000",
      money: "¥92,500",
      appsUsed: "4"
    },
    monthly: {
      purchased: "1,250,000",
      consumed: "860,000",
      remaining: "390,000",
      money: "¥268,000",
      appsUsed: "4"
    },
    threeMonths: {
      purchased: "3,820,000",
      consumed: "2,610,000",
      remaining: "1,210,000",
      money: "¥806,000",
      appsUsed: "4"
    },
    sixMonths: {
      purchased: "7,460,000",
      consumed: "5,080,000",
      remaining: "2,380,000",
      money: "¥1,586,000",
      appsUsed: "4"
    }
  };

  const localData = {
    zhangchen: {
      daily: {
        purchased: "18,000",
        consumed: "12,600",
        remaining: "5,400",
        money: "¥3,600",
        appsUsed: "3",
        topApp: "CL-AIGC",
        usedPercent: 70
      },
      weekly: {
        purchased: "72,000",
        consumed: "49,000",
        remaining: "23,000",
        money: "¥14,400",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 68
      },
      monthly: {
        purchased: "180,000",
        consumed: "126,000",
        remaining: "54,000",
        money: "¥36,000",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 70
      },
      threeMonths: {
        purchased: "520,000",
        consumed: "366,000",
        remaining: "154,000",
        money: "¥104,000",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 70
      },
      sixMonths: {
        purchased: "980,000",
        consumed: "705,000",
        remaining: "275,000",
        money: "¥196,000",
        appsUsed: "4",
        topApp: "CL-AIGC",
        usedPercent: 72
      }
    },

    liwen: {
      daily: {
        purchased: "22,000",
        consumed: "16,000",
        remaining: "6,000",
        money: "¥4,400",
        appsUsed: "3",
        topApp: "CL-iShop",
        usedPercent: 73
      },
      weekly: {
        purchased: "88,000",
        consumed: "62,000",
        remaining: "26,000",
        money: "¥17,600",
        appsUsed: "4",
        topApp: "CL-iShop",
        usedPercent: 70
      },
      monthly: {
        purchased: "220,000",
        consumed: "160,000",
        remaining: "60,000",
        money: "¥44,000",
        appsUsed: "4",
        topApp: "CL-iShop",
        usedPercent: 73
      },
      threeMonths: {
        purchased: "640,000",
        consumed: "458,000",
        remaining: "182,000",
        money: "¥128,000",
        appsUsed: "4",
        topApp: "CL-iShop",
        usedPercent: 72
      },
      sixMonths: {
        purchased: "1,180,000",
        consumed: "860,000",
        remaining: "320,000",
        money: "¥236,000",
        appsUsed: "4",
        topApp: "CL-iShop",
        usedPercent: 73
      }
    },

    wanglei: {
      daily: {
        purchased: "14,500",
        consumed: "9,100",
        remaining: "5,400",
        money: "¥2,900",
        appsUsed: "2",
        topApp: "CL-SCM",
        usedPercent: 63
      },
      weekly: {
        purchased: "58,000",
        consumed: "36,500",
        remaining: "21,500",
        money: "¥11,600",
        appsUsed: "3",
        topApp: "CL-SCM",
        usedPercent: 63
      },
      monthly: {
        purchased: "145,000",
        consumed: "91,000",
        remaining: "54,000",
        money: "¥29,000",
        appsUsed: "4",
        topApp: "CL-SCM",
        usedPercent: 63
      },
      threeMonths: {
        purchased: "390,000",
        consumed: "254,000",
        remaining: "136,000",
        money: "¥78,000",
        appsUsed: "4",
        topApp: "CL-SCM",
        usedPercent: 65
      },
      sixMonths: {
        purchased: "720,000",
        consumed: "482,000",
        remaining: "238,000",
        money: "¥144,000",
        appsUsed: "4",
        topApp: "CL-SCM",
        usedPercent: 67
      }
    },

    chenyu: {
      daily: {
        purchased: "9,600",
        consumed: "7,200",
        remaining: "2,400",
        money: "¥1,920",
        appsUsed: "2",
        topApp: "CL-iRobot",
        usedPercent: 75
      },
      weekly: {
        purchased: "38,000",
        consumed: "28,000",
        remaining: "10,000",
        money: "¥7,600",
        appsUsed: "3",
        topApp: "CL-iRobot",
        usedPercent: 74
      },
      monthly: {
        purchased: "96,000",
        consumed: "72,000",
        remaining: "24,000",
        money: "¥19,200",
        appsUsed: "3",
        topApp: "CL-iRobot",
        usedPercent: 75
      },
      threeMonths: {
        purchased: "260,000",
        consumed: "192,000",
        remaining: "68,000",
        money: "¥52,000",
        appsUsed: "4",
        topApp: "CL-iRobot",
        usedPercent: 74
      },
      sixMonths: {
        purchased: "510,000",
        consumed: "382,000",
        remaining: "128,000",
        money: "¥102,000",
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

    if (purchasedEl) purchasedEl.innerHTML = `${data.purchased} <span>tokens</span>`;
    if (consumedEl) consumedEl.innerHTML = `${data.consumed} <span>tokens</span>`;
    if (remainingEl) remainingEl.innerHTML = `${data.remaining} <span>tokens</span>`;
    if (moneyEl) moneyEl.textContent = data.money;
    if (appsUsedEl) appsUsedEl.innerHTML = `${data.appsUsed} <span>个应用</span>`;
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

    if (purchasedEl) purchasedEl.innerHTML = `${user.purchased} <span>tokens</span>`;
    if (consumedEl) consumedEl.innerHTML = `${user.consumed} <span>tokens</span>`;
    if (remainingEl) remainingEl.innerHTML = `${user.remaining} <span>tokens</span>`;
    if (moneyEl) moneyEl.textContent = user.money;
    if (appsUsedEl) appsUsedEl.innerHTML = `${user.appsUsed} <span>个应用</span>`;
    if (topAppEl) topAppEl.textContent = user.topApp;
    if (periodLabelEl) periodLabelEl.textContent = periodLabelMap[period] || "今日";

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