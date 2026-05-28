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
          <span class="hero-badge">AIGC Enterprise Account Center</span>
          <h1>企业主账号、子账号与 CL-Base 映射管理</h1>
          <p>实现企业主账号统一点数池、AIGC 子账号独立创作空间，以及 CL-Base 与 AIGC 的一对一身份绑定。</p>
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
        <p>主账号用于统一购买和管理平台点数。所有子账号共享该点数池。</p>
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
        <p>每个子账号独立运行，创作数据互相隔离，但共享企业主账号点数。</p>
        <form id="subAccountForm" class="management-form">
          <select name="masterAccountId" required>${this.masterOptions()}</select>
          <input name="subAccountName" placeholder="子账号名称，例如 Design Team A" required />
          <input name="platformLogin" type="email" placeholder="AIGC 子账号登录邮箱" required />
          <input name="platformPassword" type="password" placeholder="AIGC 子账号独立密码" required />
          <button type="submit">创建子账号</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>3. 建立 CL-Base ↔ AIGC 一对一映射</h2>
        <p>每个 CL-Base 用户只能绑定一个 AIGC 子账号；每个 AIGC 子账号也只能绑定一个 CL-Base 用户。</p>
        <form id="mappingForm" class="management-form">
          <select name="clBaseUserId" required>${this.userOptions()}</select>
          <select name="aigcSubAccountId" required>${this.subOptions()}</select>
          <button type="submit">创建账号映射</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>账号与点数总览</h2>
        <div class="table-wrap">${this.dashboardTables()}</div>
      </section>
    `;
  }

  renderUserWorkspace(data) {
    const app = document.getElementById("accountApp");
    const mapping = data.mapping;
    const works = data.works || [];

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <span class="hero-badge">My Isolated AIGC Workspace</span>
          <h1>我的 AIGC 独立创作空间</h1>
          <p>当前页面只显示与你的 CL-Base 账号绑定的 AIGC 子账号和作品，不会显示其他子账号的创作内容。</p>
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
          <div class="auth-message error">当前 CL-Base 账号尚未绑定 AIGC 子账号，请联系管理员建立一对一映射。</div>
        `}
      </section>

      <section class="account-panel">
        <h2>新增创作记录</h2>
        <p>这里模拟保存 AIGC 创作记录。保存后仅当前绑定子账号可见。</p>
        <form id="workForm" class="management-form">
          <input name="title" placeholder="作品标题" required />
          <input name="workType" placeholder="作品类型，例如 AI 模特图 / 品牌海报" required />
          <input name="creditCost" type="number" min="0" placeholder="消耗点数" />
          <textarea name="promptSummary" placeholder="提示词摘要 / 创作说明"></textarea>
          <button type="submit" ${mapping ? "" : "disabled"}>保存创作记录</button>
        </form>
      </section>

      <section class="account-panel">
        <h2>我的创作记录</h2>
        ${works.length ? this.worksTable(works) : `<p class="muted">暂无创作记录。</p>`}
      </section>
    `;
  }

  showGate() {
    document.getElementById("accountApp").innerHTML = `
      <section class="account-hero-card">
        <div>
          <h1>请先登录</h1>
          <p>你需要登录 CL-Base 账号后才能访问 AIGC 账号管理或个人创作空间。</p>
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
    this.bindForm("masterForm", async form => this.vm.createMaster(this.formToObject(form)));
    this.bindForm("subAccountForm", async form => this.vm.createSubAccount(this.formToObject(form)));
    this.bindForm("mappingForm", async form => this.vm.createMapping(this.formToObject(form)));
  }

  bindWorkForm() {
    this.bindForm("workForm", async form => this.vm.addWork(this.formToObject(form)));
  }

  bindForm(formId, action) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const result = await action(form);
      this.flash(result.message, result.success);
      if (result.success) await this.load();
    });
  }

  formToObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  flash(message, success) {
    const box = document.getElementById("globalMessage");
    box.textContent = message;
    box.className = success ? "auth-message success" : "auth-message error";
  }

  metricCard(label, value) {
    return `<div class="metric-card"><strong>${value}</strong><span>${label}</span></div>`;
  }

  masterOptions() {
    const masters = this.state.dashboard.masters;
    return [`<option value="">选择企业主账号</option>`, ...masters.map(item => `<option value="${item.id}">${item.enterpriseName} / ${item.platformLogin}</option>`)].join("");
  }

  subOptions() {
    const subs = this.state.dashboard.subs;
    return [`<option value="">选择 AIGC 子账号</option>`, ...subs.map(item => `<option value="${item.id}">${item.subAccountName} / ${item.platformLogin}</option>`)].join("");
  }

  userOptions() {
    return [`<option value="">选择 CL-Base 用户</option>`, ...this.state.users.map(item => `<option value="${item.id}">${item.name} / ${item.email}</option>`)].join("");
  }

  dashboardTables() {
    const data = this.state.dashboard;
    return `
      <h3>点数池</h3>
      <table>${this.rows(["企业", "总点数", "已用", "剩余"], data.creditSummary.map(item => [item.enterpriseName, item.totalCredits, item.usedCredits, item.remainingCredits]))}</table>
      <h3>子账号</h3>
      <table>${this.rows(["名称", "登录名", "主账号ID", "状态"], data.subs.map(item => [item.subAccountName, item.platformLogin, item.masterAccountId, item.status]))}</table>
      <h3>映射关系</h3>
      <table>${this.rows(["CL-Base 邮箱", "AIGC 子账号ID", "主账号ID", "状态"], data.mappings.map(item => [item.clBaseEmail, item.aigcSubAccountId, item.masterAccountId, item.mappingStatus]))}</table>
    `;
  }

  worksTable(works) {
    return `<table>${this.rows(["标题", "类型", "点数", "创建时间"], works.map(item => [item.title, item.workType, item.creditCost, item.createdAt]))}</table>`;
  }

  rows(headers, rows) {
    return `
      <thead><tr>${headers.map(item => `<th>${item}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell || ""}</td>`).join("")}</tr>`).join("")}</tbody>
    `;
  }
}
