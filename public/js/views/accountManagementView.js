export class AccountManagementView {
  constructor(viewModel) {
    this.vm = viewModel;
    this.state = {
      dashboard: null,
      users: []
    };
  }

  async render() {
    this.bindGlobalEvents();
    await this.load();
  }

  async load() {
    const dashboardResult = await this.vm.getAdminDashboard();

    if (dashboardResult.success) {
      this.state.dashboard = dashboardResult.data;
      const usersResult = await this.vm.getClBaseUsers();
      this.state.users = usersResult.success ? usersResult.data : [];
      this.renderAdminDashboard();
      this.bindAdminForms();
      return;
    }

    const workspaceResult = await this.vm.getMyWorkspace();

    if (workspaceResult.success) {
      this.renderUserWorkspace(workspaceResult.data);
      this.bindWorkForm();
      return;
    }

    this.showGate();
  }

  renderAdminDashboard() {
    const app = document.getElementById("accountApp");
    const data = this.state.dashboard;

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <span class="hero-badge">AIGC企业客户中心</span>
          <h1>企业主账号、子账号与 CL-Base 映射管理</h1>
          <p>实现企业主账号统一点数池、AIGC 子账号独立创作空间，以及 CL-Base 与 AIGC 的一对一身份绑定</p>
        </div>
        <button id="logoutBtn" class="btn-outline">退出登录</button>
      </section>

      <section class="account-grid-three">
        ${this.metricCard("企业主账号", data.masters.length)}
        ${this.metricCard("AIGC 子账号", data.subs.length)}
        ${this.metricCard("账号映射", data.mappings.length)}
      </section>

      <section class="account-panel">
        <h2>1. 创建 AIGC 企业主账号</h2>
        <p>主账号用于统一购买和管理平台点数，所有子账号共享该点数池</p>
        <div id="masterMessage" class="auth-message"></div>
        <form id="masterForm" class="management-form">
          <input name="enterpriseName" placeholder="企业名称，例如 HARSON" required />
          <input name="platformName" placeholder="AIGC 平台名称，例如 yibaiaigc" required />
          <input name="platformLogin" type="email" placeholder="AIGC 主账号登录邮箱" required />
          <input name="platformPassword" type="password" placeholder="AIGC 主账号独立密码" required />
          <input name="totalCredits" type="number" min="0" placeholder="总点数，例如 10000" required />
          <button type="submit">创建主账号</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>2. 创建 AIGC 子账号</h2>
        <p>每个子账号独立运行，创作数据互相隔离。管理员可为每个子账号设置独立 token 配额，并按剩余 token 百分比设置预警阈值</p>
        <div id="subAccountMessage" class="auth-message"></div>
        <form id="subAccountForm" class="management-form">
          <select name="masterAccountId" required>${this.masterOptions()}</select>
          <input name="subAccountName" placeholder="子账号名称，例如 Design Team A" required />
          <input name="platformLogin" type="email" placeholder="AIGC 子账号登录邮箱" required />
          <input name="platformPassword" type="password" placeholder="AIGC 子账号独立密码" required />
          <input name="tokenLimit" type="number" min="0" placeholder="Token 配额，例如 5000" required />
          <input name="warningThreshold" type="number" min="1" max="100" placeholder="剩余预警阈值%，例如 10" />
          <button type="submit">创建子账号</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>3. 调整 AIGC 子账号 Token 配额</h2>
        <p>管理员可以为已创建的子账号重新设置 token 配额和剩余预警阈值。比如设置 10，表示剩余 token 低于或等于 10% 时预警</p>
        <div id="tokenSettingsMessage" class="auth-message"></div>
        <form id="tokenSettingsForm" class="management-form">
          <select name="subAccountId" required>${this.subOptions("选择需要调整的 AIGC 子账号")}</select>
          <input name="tokenLimit" type="number" min="0" placeholder="新的 Token 配额，例如 10000" required />
          <input name="warningThreshold" type="number" min="1" max="100" placeholder="新的剩余预警阈值%，例如 10" />
          <button type="submit">保存配额设置</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>4. 建立 CL-Base ↔ AIGC 一对一映射</h2>
        <p>每个 CL-Base 用户只能绑定一个 AIGC 子账号；每个 AIGC 子账号也只能绑定一个 CL-Base 用户</p>
        <div id="mappingMessage" class="auth-message"></div>
        <form id="mappingForm" class="management-form">
          <select name="clBaseUserId" required>${this.userOptions()}</select>
          <select name="aigcSubAccountId" required>${this.subOptions("选择 AIGC 子账号")}</select>
          <button type="submit">创建账号映射</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>账号、点数与 Token 配额总览</h2>
        <div class="table-wrap">${this.dashboardTables()}</div>
      </section>
    `;
  }

  renderUserWorkspace(data) {
    const app = document.getElementById("accountApp");
    const mapping = data.mapping;
    const works = data.works || [];
    const subAccount = mapping && mapping.aigcSubAccount ? mapping.aigcSubAccount : null;

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <h1>我的 AIGC 独立创作空间</h1>
          <p>当前页面只显示与你的 CL-Base 账号绑定的 AIGC 子账号和作品，不会显示其他子账号的创作内容</p>
        </div>
        <button id="logoutBtn" class="btn-outline">退出登录</button>
      </section>

      <section class="account-panel">
        <h2>我的账号映射</h2>
        ${mapping ? `
          <div class="mapping-card">
            <strong>AIGC 子账号：</strong>${mapping.aigcSubAccount.subAccountName}<br/>
            <strong>AIGC 登录名：</strong>${mapping.aigcSubAccount.platformLogin}<br/>
            <strong>企业主账号：</strong>${mapping.masterAccount.enterpriseName} / ${mapping.masterAccount.platformName}
          </div>
        ` : `
          <div class="auth-message error">当前 CL-Base 账号尚未绑定 AIGC 子账号，请联系管理员建立一对一映射</div>
        `}
      </section>

      ${subAccount ? `
        <section class="account-panel">
          <h2>我的 AIGC token 使用情况</h2>
          ${this.tokenWarningBox(subAccount)}
          <div class="table-wrap">
            <table>
              ${this.rows(
                ["Token 配额", "已使用", "剩余", "已使用率", "剩余率", "剩余预警阈值", "状态"],
                [[
                  subAccount.tokenLimit,
                  subAccount.usedTokens,
                  subAccount.remainingTokens,
                  `${subAccount.usageRate}%`,
                  `${subAccount.remainingRate ?? this.calculateRemainingRate(subAccount)}%`,
                  `${subAccount.warningThreshold}%`,
                  this.tokenStatusLabel(subAccount.warningStatus)
                ]]
              )}
            </table>
          </div>
        </section>
      ` : ""}

      <section class="account-panel">
        <h2>新增创作记录</h2>
        <p>这里模拟保存 AIGC 创作记录，保存后仅当前绑定子账号可见，并会计入当前子账号 token 使用量</p>
        <div id="workMessage" class="auth-message"></div>
        <form id="workForm" class="management-form">
          <input name="title" placeholder="作品标题" required />
          <input name="workType" placeholder="作品类型，例如 AI 模特图 / 品牌海报" required />
          <input name="creditCost" type="number" min="0" placeholder="消耗 token" />
          <textarea name="promptSummary" placeholder="提示词摘要 / 创作说明"></textarea>
          <button type="submit" ${mapping ? "" : "disabled"}>保存创作记录</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>我的创作记录</h2>
        ${works.length ? this.worksTable(works) : `<p class="muted">暂无创作记录</p>`}
      </section>
    `;
  }

  showGate() {
    document.getElementById("accountApp").innerHTML = `
      <section class="account-hero-card">
        <div>
          <h1>请先登录</h1>
          <p>你需要登录 CL-Base 账号后才能访问 AIGC 账号管理或个人创作空间</p>
        </div>
        <a href="/login" class="btn-primary">前往登录</a>
      </section>
    `;
  }

  bindGlobalEvents() {
    document.addEventListener("click", async event => {
      if (event.target && event.target.id === "logoutBtn") {
        await this.vm.logout();
        window.location.href = "/";
      }
    });
  }

  bindAdminForms() {
    this.bindForm(
      "masterForm",
      async form => this.vm.createMaster(this.formToObject(form)),
      "masterMessage"
    );

    this.bindForm(
      "subAccountForm",
      async form => this.vm.createSubAccount(this.formToObject(form)),
      "subAccountMessage"
    );

    this.bindForm(
      "tokenSettingsForm",
      async form => this.vm.updateSubTokenSettings(this.formToObject(form)),
      "tokenSettingsMessage"
    );

    this.bindForm(
      "mappingForm",
      async form => this.vm.createMapping(this.formToObject(form)),
      "mappingMessage"
    );
  }

  bindWorkForm() {
    const form = document.getElementById("workForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const result = await this.vm.addWork(this.formToObject(form));
      const box = document.getElementById("workMessage");

      if (box) {
        box.textContent = result.message || "操作失败，请稍后重试";
        box.className = result.success ? "auth-message success" : "auth-message error";
        box.style.display = "block";
      } else {
        this.flash(result.message, result.success);
      }

      if (result.success) {
        setTimeout(async () => {
          await this.load();
        }, 2000);
      }
    });
  }

  bindForm(formId, action, messageElementId = null) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const result = await action(form);

      if (messageElementId) {
        this.showLocalMessage(messageElementId, result.message, result.success);
      } else {
        this.flash(result.message, result.success);
      }

      if (result.success) {
        setTimeout(async () => {
          await this.load();
        }, 800);
      }
    });
  }

  formToObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  flash(message, success) {
    const box = document.getElementById("globalMessage");
    if (!box) return;

    box.textContent = message || "操作失败，请稍后重试";
    box.className = success ? "auth-message success" : "auth-message error";
    box.style.display = "block";
  }

  showLocalMessage(elementId, message, success) {
    const box = document.getElementById(elementId);
    if (!box) return;

    box.textContent = message || "操作失败，请稍后重试";
    box.className = success ? "auth-message success" : "auth-message error";
    box.style.display = "block";
  }

  metricCard(label, value) {
    return `<div class="metric-card"><strong>${value}</strong><span>${label}</span></div>`;
  }

  masterOptions() {
    const masters = this.state.dashboard.masters;
    return [
      `<option value="">选择企业主账号</option>`,
      ...masters.map(item => `<option value="${item.id}">${item.enterpriseName} / ${item.platformLogin}</option>`)
    ].join("");
  }

  subOptions(label = "选择 AIGC 子账号") {
    const subs = this.state.dashboard.subs;
    return [
      `<option value="">${label}</option>`,
      ...subs.map(item => `<option value="${item.id}">${item.subAccountName} / ${item.platformLogin} / 配额 ${item.tokenLimit} / 剩余预警 ${item.warningThreshold}%</option>`)
    ].join("");
  }

  userOptions() {
    const normalUsers = this.state.users.filter(item => item.role !== "admin");

    return [
      `<option value="">选择 CL-Base 用户</option>`,
      ...normalUsers.map(item => `<option value="${item.id}">${item.name} / ${item.email}</option>`)
    ].join("");
  }

  dashboardTables() {
    const data = this.state.dashboard;

    return `
      <h3>点数池</h3>
      <table>${this.rows(
        ["企业", "总点数", "已用", "剩余"],
        data.creditSummary.map(item => [
          item.enterpriseName,
          item.totalCredits,
          item.usedCredits,
          item.remainingCredits
        ])
      )}</table>

      <h3>子账号 Token 配额</h3>
      <table>${this.rows(
        ["名称", "登录名", "Token 配额", "已使用", "剩余", "已使用率", "剩余率", "剩余预警阈值", "状态"],
        data.subs.map(item => [
          item.subAccountName,
          item.platformLogin,
          item.tokenLimit,
          item.usedTokens,
          item.remainingTokens,
          `${item.usageRate}%`,
          `${item.remainingRate ?? this.calculateRemainingRate(item)}%`,
          `${item.warningThreshold}%`,
          this.tokenStatusLabel(item.warningStatus)
        ])
      )}</table>

      <h3>映射关系</h3>
      <table>${this.rows(
        ["CL-Base 邮箱", "AIGC 子账号ID", "主账号ID", "状态"],
        data.mappings.map(item => [
          item.clBaseEmail,
          item.aigcSubAccountId,
          item.masterAccountId,
          item.mappingStatus
        ])
      )}</table>
    `;
  }

  worksTable(works) {
    return `<table>${this.rows(
      ["标题", "类型", "消耗 token", "创建时间"],
      works.map(item => [
        item.title,
        item.workType,
        item.creditCost,
        item.createdAt
      ])
    )}</table>`;
  }

  calculateRemainingRate(subAccount) {
    const tokenLimit = Number(subAccount.tokenLimit || 0);
    const remainingTokens = Number(subAccount.remainingTokens || 0);

    if (tokenLimit <= 0) {
      return 100;
    }

    return Math.round((remainingTokens / tokenLimit) * 100);
  }

  tokenStatusLabel(status) {
    if (status === "exceeded") {
      return "已达到上限";
    }

    if (status === "warning") {
      return "低余额预警";
    }

    return "正常";
  }

  tokenWarningBox(subAccount) {
    if (subAccount.warningStatus === "exceeded") {
      return `<div class="auth-message error">当前 AIGC 子账号已达到 token 上限,请联系管理员增加配额</div>`;
    }

    if (subAccount.warningStatus === "warning") {
      const remainingRate = subAccount.remainingRate ?? this.calculateRemainingRate(subAccount);

      return `<div class="auth-message error">当前 AIGC 子账号剩余 token 为 ${remainingRate}%,请注意剩余额度</div>`;
    }

    return `<div class="auth-message success">当前 AIGC 子账号 token 使用状态正常</div>`;
  }

  rows(headers, rows) {
    return `
      <thead>
        <tr>${headers.map(item => `<th>${item}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ""}</td>`).join("")}</tr>`).join("")}
      </tbody>
    `;
  }
}