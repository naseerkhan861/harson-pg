export class AccountManagementView {
  constructor(viewModel) {
    this.vm = viewModel;

    this.state = {
      dashboard: null,
      users: [],
      providerBindings: []
    };
  }

  async render() {
    this.bindGlobalEvents();
    await this.load();
  }

  async load() {
    this.renderLoadingState();

    const dashboardResult =
      await this.vm.getAdminDashboard();

    if (dashboardResult.success) {
      this.state.dashboard =
        dashboardResult.data;

      const [
        usersResult,
        bindingsResult
      ] = await Promise.all([
        this.vm.getClBaseUsers(),
        this.vm.getMasterProviderBindings()
      ]);

      this.state.users =
        usersResult.success
          ? usersResult.data
          : [];

      this.state.providerBindings =
        bindingsResult.success
          ? bindingsResult.data
          : [];

      this.renderAdminDashboard();
      this.bindAdminForms();
      return;
    }

    const ownerResult =
      await this.vm
        .getMyEnterpriseSubAccounts();

    if (ownerResult.success) {
      this.renderOwnerSubAccountManagement(
        ownerResult.data
      );

      return;
    }

    const workspaceResult =
      await this.vm.getMyWorkspace();

    if (workspaceResult.success) {
      const mappingReady =
        Boolean(
          workspaceResult.data
            ?.mapping
            ?.aigcSubAccount &&
          workspaceResult.data
            ?.mapping
            ?.masterAccount
        );

      if (!mappingReady) {
        this.renderUnboundUser(
          workspaceResult.data
        );

        return;
      }

      this.renderUserWorkspace(
        workspaceResult.data,
        {
          isLoading: true
        }
      );

      const syncResult =
        await this.vm
          .syncMyWorkspace();

      const refreshedWorkspaceResult =
        await this.vm
          .getMyWorkspace();

      const tokenBalanceResult =
        await this.vm
          .getMyTokenBalance();

      const displaySyncResult =
        syncResult.success &&
        !refreshedWorkspaceResult.success
          ? {
              success: false,
              message:
                refreshedWorkspaceResult
                  .message ||
                "最新数据已同步，但页面刷新失败，当前保留上次记录。"
            }
          : syncResult;

      this.renderUserWorkspace(
        refreshedWorkspaceResult.success
          ? refreshedWorkspaceResult.data
          : workspaceResult.data,
        {
          syncResult:
            displaySyncResult,
          tokenBalanceResult
        }
      );

      return;
    }

    this.showGate();
  }

  renderLoadingState() {
    const app =
      document.getElementById(
        "accountApp"
      );

    if (!app) {
      return;
    }

    app.innerHTML = `
      <section class="account-hero-card account-loading-card">
        <div>
          <span class="hero-badge">
            AIGC 账号管理
          </span>

          <h1>
            正在读取账号信息
          </h1>

          <p>
            系统正在确认当前账号身份与可用服务。
          </p>
        </div>

        <span class="account-loading-dot" aria-hidden="true"></span>
      </section>
    `;
  }

  renderAdminDashboard() {
    const app =
      document.getElementById(
        "accountApp"
      );

    const data = this.state.dashboard;

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <span class="hero-badge">
            AIGC企业客户中心
          </span>

          <h1>
            企业主账号、YiBai 绑定、子账号与
            Harson-Base 映射管理
          </h1>

          <p>
            管理员通过 YiBai 真实账号密码完成验证，
            系统自动建立企业主账号绑定、同步总点数
            并安全缓存登录状态，再向内部子账号分配
            配额并建立 Harson-Base 用户映射
          </p>
        </div>

        <button
          id="logoutBtn"
          class="btn-outline"
        >
          退出登录
        </button>
      </section>

      <section class="account-grid-three">
        ${this.metricCard(
          "企业主账号",
          data.masters.length
        )}

        ${this.metricCard(
          "YiBai 外部绑定",
          this.state.providerBindings.length
        )}

        ${this.metricCard(
          "AIGC 子账号",
          data.subs.length
        )}

        ${this.metricCard(
          "账号映射",
          data.mappings.filter(
            mapping =>
              mapping.mappingStatus ===
              "active"
          ).length
        )}

        ${this.metricCard(
          "主账号负责人",
          (
            data.masterOwnerMappings || []
          ).length
        )}
      </section>

      <section class="account-panel">
        <h2>
          1. 创建 AIGC 企业主账号
        </h2>

        <p>
          先创建内部企业主账号。初始总点数为
          0，绑定 YiBai 外部账号后会自动同步
          真实点数
        </p>

        <div
          id="masterMessage"
          class="auth-message"
        ></div>

        <form
          id="masterForm"
          class="management-form"
        >
          <input
            name="enterpriseName"
            placeholder="企业名称，例如 HARSON"
            required
          />

          <input
            name="platformName"
            placeholder="平台名称，例如 AIGC平台"
            required
          />

          <input
            name="platformLogin"
            type="email"
            placeholder="内部主账号管理邮箱"
            required
          />

          <input
            name="platformPassword"
            type="password"
            placeholder="内部主账号独立密码"
            required
          />

          <input
            name="totalCredits"
            type="hidden"
            value="0"
          />

          <button type="submit">
            创建主账号
          </button>
        </form>
      </section>

      <section class="account-panel">
        <h2>
          2. 绑定 YiBai 外部账号并同步总点数
        </h2>

        <p>
            管理员填写 YiBai 提供的真实账号和密码。
            系统会先向 YiBai 验证登录，验证成功后
            才建立绑定。密码只会加密保存，页面不会
            回显真实密码
        </p>

        <div
          id="providerBindingMessage"
          class="auth-message"
        ></div>

        <form
          id="providerBindingForm"
          class="management-form"
        >
          <select
            name="masterAccountId"
            required
          >
            ${this.masterOptions()}
          </select>

          <input
            name="providerAccount"
            placeholder="YiBai 外部账号，例如 哈森001"
            required
          />

          <input
            name="providerPassword"
            type="password"
            placeholder="请输入 YiBai 登录密码"
            autocomplete="new-password"
            required
          />

          <select
            name="pointsField"
            required
          >
            <option value="balance">
              balance（当前账号余额）
            </option>

            <option value="companyBalance">
              companyBalance（企业余额）
            </option>

            <option value="mpoint">
              mpoint（成员点数）
            </option>

            <option value="companyMpoint">
              companyMpoint（企业点数）
            </option>
          </select>

          <button type="submit">
            验证账号并完成绑定
          </button>
        </form>

        <div
          class="table-wrap provider-binding-table-wrap"
        >
          ${this.providerBindingsTable()}
        </div>
      </section>

      <section class="account-panel">
        <h2>
          3. 创建 AIGC 子账号
        </h2>

        <p>
          每个子账号独立运行，创作数据互相隔离。
          管理员可为每个子账号设置独立 token
          配额，并按剩余 token 百分比设置
          预警阈值
        </p>

        <div
          id="subAccountMessage"
          class="auth-message"
        ></div>

        <form
          id="subAccountForm"
          class="management-form"
        >
          <select
            name="masterAccountId"
            required
          >
            ${this.masterOptions()}
          </select>

          <input
            name="subAccountName"
            placeholder="子账号名称，例如 Design Team A"
            required
          />

          <input
            name="platformLogin"
            type="email"
            placeholder="AIGC 子账号登录邮箱"
            required
          />

          <input
            name="platformPassword"
            type="password"
            placeholder="AIGC 子账号独立密码"
            required
          />

          <input
            name="tokenLimit"
            type="number"
            min="0"
            placeholder="Token 配额，例如 5000"
            required
          />

          <input
            name="warningThreshold"
            type="number"
            min="1"
            max="100"
            placeholder="剩余预警阈值%，例如 10"
          />

          <button type="submit">
            创建子账号
          </button>
        </form>
      </section>

      <section class="account-panel">
        <h2>
          4. 调整 AIGC 子账号 Token 配额
        </h2>

        <p>
          管理员可以为已创建的子账号重新设置
          token 配额和剩余预警阈值。比如设置
          10，表示剩余 token 低于或等于
          10% 时预警
        </p>

        <div
          id="tokenSettingsMessage"
          class="auth-message"
        ></div>

        <form
          id="tokenSettingsForm"
          class="management-form"
        >
          <select
            name="subAccountId"
            required
          >
            ${this.subOptions(
              "选择需要调整的 AIGC 子账号"
            )}
          </select>

          <input
            name="tokenLimit"
            type="number"
            min="0"
            placeholder="新的 Token 配额，例如 10000"
            required
          />

          <input
            name="warningThreshold"
            type="number"
            min="1"
            max="100"
            placeholder="新的剩余预警阈值%，例如 10"
          />

          <button type="submit">
            保存配额设置
          </button>
        </form>
      </section>

      <section class="account-panel">
        <h2>
          5. 绑定企业主账号负责人
        </h2>

        <p>
          每个企业主账号只能绑定一个
          Harson-Base 负责人。负责人后续可在
          导航栏查看该企业下全部子账号的
          Token 使用仪表盘
        </p>

        <div
          id="masterOwnerMessage"
          class="auth-message"
        ></div>

        <form
          id="masterOwnerForm"
          class="management-form"
        >
          <select
            name="masterAccountId"
            required
          >
            ${this.masterOwnerOptions()}
          </select>

          <select
            name="clBaseUserId"
            required
          >
            ${this.masterOwnerUserOptions()}
          </select>

          <button type="submit">
            绑定主账号负责人
          </button>
        </form>
      </section>

      <section class="account-panel">
        <h2>
          6. 建立 Harson-Base ↔ AIGC 子账号映射
        </h2>

        <p>
          每个 Harson-Base 用户只能绑定一个
          AIGC 子账号；同一个 AIGC 子账号可以
          绑定多个 Harson-Base 用户。已建立的
          映射可在页面下方总览中解除
        </p>

        <div
          id="mappingMessage"
          class="auth-message"
        ></div>

        <form
          id="mappingForm"
          class="management-form"
        >
          <select
            name="clBaseUserId"
            required
          >
            ${this.userOptions()}
          </select>

          <select
            name="aigcSubAccountId"
            required
          >
            ${this.subOptions(
              "选择 AIGC 子账号"
            )}
          </select>

          <button type="submit">
            创建账号映射
          </button>
        </form>
      </section>

      <section class="account-panel">
        <h2>
          账号、点数与 Token 配额总览
        </h2>

        <div class="table-wrap">
          ${this.dashboardTables()}
        </div>
      </section>
    `;
  }

  renderOwnerSubAccountManagement(
    data
  ) {
    const app =
      document.getElementById(
        "accountApp"
      );

    const subAccounts =
      Array.isArray(
        data?.subAccounts
      )
        ? data.subAccounts
        : [];

    const activeCount =
      subAccounts.filter(
        item =>
          item.status === "active"
      ).length;

    const totalTokenLimit =
      subAccounts.reduce(
        (total, item) =>
          total +
          Number(
            item.tokenLimit || 0
          ),
        0
      );

    const remainingTokens =
      subAccounts.reduce(
        (total, item) =>
          total +
          Number(
            item.remainingTokens || 0
          ),
        0
      );

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <span class="hero-badge">
            企业主账号
          </span>

          <h1>
            企业子账号管理
          </h1>

          <p>
            ${this.escapeHtml(
              data?.enterpriseName ||
              "当前企业"
            )} · 这里只展示本企业的 AIGC 子账号。
            用户映射与外部账号凭据仍由系统管理员管理。
          </p>
        </div>

        <div class="account-hero-actions">
          <a
            href="/dashboard"
            class="btn-primary"
          >
            查看企业仪表盘
          </a>

          <button
            id="logoutBtn"
            class="btn-outline"
          >
            退出登录
          </button>
        </div>
      </section>

      <div class="account-demo-notice">
        <strong>
          演示数据
        </strong>
        <span>
          真实额度管理功能待接入，当前修改操作不会写入系统数据。
        </span>
      </div>

      <section class="account-grid-three">
        ${this.metricCard(
          "子账号总数",
          subAccounts.length
        )}

        ${this.metricCard(
          "启用子账号",
          activeCount
        )}

        ${this.metricCard(
          "演示分配额度",
          this.formatToken(
            totalTokenLimit
          )
        )}

        ${this.metricCard(
          "演示剩余额度",
          this.formatToken(
            remainingTokens
          )
        )}
      </section>

      <section class="account-panel">
        <div class="account-panel-heading">
          <div>
            <h2>
              子账号 Token 管理
            </h2>

            <p>
              额度、消耗、剩余和预警阈值目前均为演示展示。
            </p>
          </div>

          <span class="account-data-badge">
            DEMO
          </span>
        </div>

        <div
          id="ownerDemoMessage"
          class="auth-message"
        ></div>

        ${
          subAccounts.length
            ? `
              <div class="table-wrap">
                <table>
                  ${this.rows(
                    [
                      "子账号名称",
                      "AIGC 登录名",
                      "分配额度",
                      "已使用",
                      "剩余",
                      "预警阈值",
                      "状态",
                      "操作"
                    ],
                    subAccounts.map(
                      item => [
                        this.escapeHtml(
                          item.subAccountName ||
                          "未命名子账号"
                        ),
                        this.escapeHtml(
                          item.platformLogin ||
                          "-"
                        ),
                        this.formatToken(
                          item.tokenLimit
                        ),
                        this.formatToken(
                          item.usedTokens
                        ),
                        this.formatToken(
                          item.remainingTokens
                        ),
                        `${this.formatToken(
                          item.warningThreshold
                        )}%`,
                        item.status === "active"
                          ? "启用"
                          : "停用",
                        `
                          <button
                            type="button"
                            class="btn-outline demo-token-edit-btn"
                            data-sub-account-id="${this.escapeHtml(
                              item.id || ""
                            )}"
                          >
                            修改额度
                          </button>
                        `
                      ]
                    )
                  )}
                </table>
              </div>
            `
            : `
              <div class="account-empty-state">
                当前企业暂未创建 AIGC 子账号。
              </div>
            `
        }
      </section>
    `;
  }

  renderUnboundUser(data) {
    const app =
      document.getElementById(
        "accountApp"
      );

    const email =
      data?.currentUser?.email ||
      "-";

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <span class="hero-badge">
            普通用户
          </span>

          <h1>
            我的 AIGC 账号
          </h1>

          <p>
            查看当前 Harson-Base 账号的 AIGC 服务绑定状态。
          </p>
        </div>

        <button
          id="logoutBtn"
          class="btn-outline"
        >
          退出登录
        </button>
      </section>

      <section class="account-panel account-unbound-panel">
        <div class="account-status-icon" aria-hidden="true">
          !
        </div>

        <span class="account-data-badge account-data-badge-muted">
          未绑定
        </span>

        <h2>
          尚未开通 AIGC 服务
        </h2>

        <div class="account-unbound-details">
          <span>
            Harson-Base 登录邮箱
          </span>
          <strong>
            ${this.escapeHtml(email)}
          </strong>

          <span>
            AIGC 子账号
          </span>
          <strong>
            尚未分配
          </strong>
        </div>

        <p class="account-purchase-copy">
          当前 Harson-Base 账号尚未绑定 AIGC 子账号，
          因此暂时无法进入 CL-AIGC、查看 Token 点数或创作记录。
          请自行购买 AIGC 相关服务，或联系管理员进行购买。
        </p>

        <div class="account-unbound-actions">
          <button
            id="refreshBindingBtn"
            class="btn-primary"
          >
            刷新绑定状态
          </button>

          <a
            href="/"
            class="btn-outline"
          >
            返回首页
          </a>
        </div>
      </section>
    `;
  }

  renderUserWorkspace(
    data,
    {
      isLoading = false,
      syncResult = null,
      tokenBalanceResult = null
    } = {}
  ) {
    const app =
      document.getElementById(
        "accountApp"
      );

    const mapping =
      data?.mapping || null;

    const subAccount =
      mapping?.aigcSubAccount ||
      null;

    const masterAccount =
      mapping?.masterAccount ||
      null;

    if (!subAccount || !masterAccount) {
      this.renderUnboundUser(data);
      return;
    }

    const works =
      Array.isArray(data?.works)
        ? data.works
        : [];

    const taskSummary = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      processingTasks: 0,
      deductedTokens: 0,
      refundedTokens: 0,
      netUsedTokens: 0,
      ...(data?.taskSummary || {})
    };

    const taskSync = {
      latestSyncedAt: null,
      ...(data?.taskSync || {})
    };

    const tokenBalance =
      tokenBalanceResult?.success
        ? tokenBalanceResult.result
        : null;

    const tokenBalanceValue =
      tokenBalance?.available &&
      tokenBalance.tokenBalance !== null &&
      tokenBalance.tokenBalance !== undefined
        ? this.formatToken(
            tokenBalance.tokenBalance
          )
        : "--";

    app.innerHTML = `
      <section class="account-hero-card">
        <div>
          <span class="hero-badge">
            已绑定普通用户
          </span>

          <h1>
            我的 AIGC 账号
          </h1>

          <p>
            进入页面后自动读取最新 Token 点数与本人创作记录，
            页面不会展示其他子账号的数据。
          </p>
        </div>

        <div class="account-hero-actions">
          <a
            href="/aigc-workspace"
            class="btn-primary"
          >
            进入 CL-AIGC
          </a>

          <button
            id="logoutBtn"
            class="btn-outline"
          >
            退出登录
          </button>
        </div>
      </section>

      ${this.userAutoSyncNotice({
        isLoading,
        syncResult,
        tokenBalance,
        latestSyncedAt:
          taskSync.latestSyncedAt
      })}

      <section class="account-panel">
        <div class="account-panel-heading">
          <div>
            <h2>
              我的账号
            </h2>

            <p>
              当前 Harson-Base 用户只读查看自己的绑定信息。
            </p>
          </div>

          <span class="account-data-badge account-data-badge-success">
            已绑定
          </span>
        </div>

        <div class="account-identity-grid">
          <div>
            <span>AIGC 子账号</span>
            <strong>
              ${this.escapeHtml(
                subAccount.subAccountName ||
                "-"
              )}
            </strong>
          </div>

          <div>
            <span>AIGC 登录名</span>
            <strong>
              ${this.escapeHtml(
                subAccount.platformLogin ||
                "-"
              )}
            </strong>
          </div>

          <div>
            <span>所属企业</span>
            <strong>
              ${this.escapeHtml(
                masterAccount.enterpriseName ||
                "-"
              )}
            </strong>
          </div>

          <div>
            <span>账号状态</span>
            <strong>
              ${
                subAccount.status === "active"
                  ? "正常"
                  : "停用"
              }
            </strong>
          </div>
        </div>
      </section>

      <section class="account-grid-three account-user-metrics">
        ${this.metricCard(
          "当前 Token 点数（实时）",
          isLoading
            ? "读取中"
            : tokenBalanceValue
        )}

        ${this.metricCard(
          "真实净消耗 Token",
          this.formatToken(
            taskSummary.netUsedTokens
          )
        )}

        ${this.metricCard(
          "创作任务总数",
          this.formatToken(
            taskSummary.totalTasks
          )
        )}

        ${this.metricCard(
          "成功任务",
          this.formatToken(
            taskSummary.successfulTasks
          )
        )}
      </section>

      <section class="account-panel">
        <div class="account-panel-heading">
          <div>
            <h2>
              我的创作记录
            </h2>

            <p>
              仅显示当前绑定 AIGC 子账号对应的真实记录。
            </p>
          </div>

          <span class="account-data-badge">
            ${this.formatToken(
              works.length
            )} 条
          </span>
        </div>

        ${
          works.length
            ? `
              <div class="table-wrap">
                ${this.worksTable(
                  works
                )}
              </div>
            `
            : `
              <div class="account-empty-state">
                暂无已同步的真实创作记录。
              </div>
            `
        }
      </section>
    `;

    app
      .querySelectorAll(
        ".account-work-thumbnail"
      )
      .forEach(image => {
        image.addEventListener(
          "error",
          () => {
            const button =
              image.closest(
                ".account-work-preview-btn"
              );

            if (button) {
              const placeholder =
                document.createElement(
                  "span"
                );

              placeholder.className =
                "account-work-no-image";

              placeholder.textContent =
                "图片加载失败";

              button.replaceWith(
                placeholder
              );
            }
          },
          {
            once: true
          }
        );
      });
  }

  userAutoSyncNotice({
    isLoading,
    syncResult,
    tokenBalance,
    latestSyncedAt
  }) {
    if (isLoading) {
      return `
        <div class="account-sync-banner is-loading">
          <span class="account-loading-dot" aria-hidden="true"></span>
          <div>
            <strong>正在读取最新数据</strong>
            <span>
              正在同步 Token 点数与本人创作记录，请稍候。
            </span>
          </div>
        </div>
      `;
    }

    if (!syncResult?.success) {
      return `
        <div class="account-sync-banner is-error">
          <strong>实时读取失败</strong>
          <span>
            ${this.escapeHtml(
              syncResult?.message ||
              "暂时无法读取最新数据，页面已保留上次记录。"
            )}
          </span>
        </div>
      `;
    }

    if (!tokenBalance?.available) {
      return `
        <div class="account-sync-banner is-warning">
          <strong>创作记录已更新</strong>
          <span>
            Token 点数暂不可用：${this.escapeHtml(
              tokenBalance?.message ||
              "未读取到可用余额"
            )}
          </span>
        </div>
      `;
    }

    return `
      <div class="account-sync-banner is-success">
        <strong>最新数据已读取</strong>
        <span>
          Token 点数和本人创作记录已更新
          ${
            latestSyncedAt
              ? ` · ${this.formatDateTime(
                  latestSyncedAt
                )}`
              : ""
          }
        </span>
      </div>
    `;
  }

  showGate() {
    document.getElementById(
      "accountApp"
    ).innerHTML = `
      <section class="account-hero-card">
        <div>
          <h1>
            请先登录
          </h1>

          <p>
            你需要登录 Harson-Base 账号后
            才能访问 AIGC 账号管理或个人
            创作空间
          </p>
        </div>

        <a
          href="/login"
          class="btn-primary"
        >
          前往登录
        </a>
      </section>
    `;
  }

  bindGlobalEvents() {
    document.addEventListener(
      "click",
      async event => {
        if (
          event.target &&
          event.target.id ===
            "logoutBtn"
        ) {
          await this.vm.logout();
          window.location.href = "/";
        }

        if (
          event.target &&
          event.target.id ===
            "refreshBindingBtn"
        ) {
          const button =
            event.target;

          button.disabled = true;
          button.textContent =
            "刷新中...";

          await this.load();
        }

        const previewButton =
          event.target instanceof Element
            ? event.target.closest(
                ".account-work-preview-btn"
              )
            : null;

        if (previewButton) {
          this.openWorkImagePreview(
            previewButton.dataset.imageUrl,
            previewButton.dataset.imageTitle
          );

          return;
        }

        if (
          event.target &&
          event.target.classList
            ?.contains(
              "demo-token-edit-btn"
            )
        ) {
          this.showLocalMessage(
            "ownerDemoMessage",
            "当前为演示数据，真实额度修改功能尚未接入。",
            false
          );
        }
      }
    );
  }

  bindAdminForms() {
    this.bindForm(
      "providerBindingForm",
      async form => {
        const payload =
          this.formToObject(form);

        const result =
          await this.vm
            .bindMasterProvider(
              payload
            );

        const passwordInput =
          form.querySelector(
            '[name="providerPassword"]'
          );

        if (passwordInput) {
          passwordInput.value = "";
        }

        return result;
      },
      "providerBindingMessage"
    );

    this.bindForm(
      "masterForm",
      async form =>
        this.vm.createMaster(
          this.formToObject(form)
        ),
      "masterMessage"
    );

    this.bindForm(
      "subAccountForm",
      async form =>
        this.vm.createSubAccount(
          this.formToObject(form)
        ),
      "subAccountMessage"
    );

    this.bindForm(
      "tokenSettingsForm",
      async form =>
        this.vm.updateSubTokenSettings(
          this.formToObject(form)
        ),
      "tokenSettingsMessage"
    );

    this.bindForm(
      "masterOwnerForm",
      async form =>
        this.vm.createMasterOwnerMapping(
          this.formToObject(form)
        ),
      "masterOwnerMessage"
    );

    this.bindForm(
      "mappingForm",
      async form =>
        this.vm.createMapping(
          this.formToObject(form)
        ),
      "mappingMessage"
    );

    this.bindProviderSyncButtons();
    this.bindUserDataSyncButtons();
    this.bindProviderUnbindButtons();
    this.bindMappingUnbindButtons();
    this.bindMasterOwnerUnbindButtons();
  }

  bindMasterOwnerUnbindButtons() {
    document
      .querySelectorAll(
        ".unbind-master-owner-btn"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const mappingId = String(
              button.dataset.mappingId || ""
            ).trim();

            if (!mappingId) {
              this.showLocalMessage(
                "masterOwnerMessage",
                "缺少负责人绑定 ID",
                false
              );
              return;
            }

            const confirmed =
              window.confirm(
                "解除后，该用户将失去企业负责人仪表盘权限。确定解除绑定吗？"
              );

            if (!confirmed) {
              return;
            }

            button.disabled = true;
            button.textContent =
              "解绑中...";

            const result =
              await this.vm
                .unbindMasterOwnerMapping(
                  mappingId
                );

            this.showLocalMessage(
              "masterOwnerMessage",
              result.message,
              result.success
            );

            if (result.success) {
              setTimeout(
                async () => {
                  await this.load();
                },
                800
              );
            }
          }
        );
      });
  }

  bindProviderSyncButtons() {
    document
      .querySelectorAll(
        ".sync-provider-btn"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const masterAccountId =
              String(
                button.dataset
                  .masterAccountId || ""
              ).trim();

            if (!masterAccountId) {
              this.showLocalMessage(
                "providerBindingMessage",
                "缺少企业主账号 ID",
                false
              );

              return;
            }

            const originalText =
              button.textContent;

            button.disabled = true;
            button.textContent =
              "同步中...";

            const result =
              await this.vm
                .syncMasterProvider(
                  masterAccountId
                );

            this.showLocalMessage(
              "providerBindingMessage",
              result.message,
              result.success
            );

            if (result.success) {
              setTimeout(
                async () => {
                  await this.load();
                },
                800
              );

              return;
            }

            button.disabled = false;
            button.textContent =
              originalText;
          }
        );
      });
  }

  bindUserDataSyncButtons() {
    document
      .querySelectorAll(
        ".sync-user-data-btn"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const masterAccountId =
              String(
                button.dataset
                  .masterAccountId || ""
              ).trim();

            if (!masterAccountId) {
              this.showLocalMessage(
                "providerBindingMessage",
                "缺少企业主账号 ID",
                false
              );

              return;
            }

            const confirmed =
              window.confirm(
                "同步真实创作记录期间，系统会临时切换登录状态，并在完成后恢复 Workspace。是否继续？"
              );

            if (!confirmed) {
              return;
            }

            const originalText =
              button.textContent;

            button.disabled = true;
            button.textContent =
              "同步创作记录中...";

            const result =
              await this.vm
                .syncMasterUserData(
                  masterAccountId
                );

            this.showLocalMessage(
              "providerBindingMessage",
              result.message,
              result.success
            );

            if (result.success) {
              setTimeout(
                async () => {
                  await this.load();
                },
                800
              );

              return;
            }

            button.disabled = false;
            button.textContent =
              originalText;
          }
        );
      });
  }

  bindProviderUnbindButtons() {
    document
      .querySelectorAll(
        ".unbind-provider-btn"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const masterAccountId =
              String(
                button.dataset
                  .masterAccountId || ""
              ).trim();

            if (!masterAccountId) {
              this.showLocalMessage(
                "providerBindingMessage",
                "缺少企业主账号 ID",
                false
              );

              return;
            }

            const confirmed =
              window.confirm(
                "解绑后，当前企业的 YiBai 登录状态、真实任务快照、主账号点数和所有子账号 Token 配额都会清零。Harson-Base 账号映射不会自动解除；如不再使用，请在下方映射总览中手动解除。确定继续吗？"
              );

            if (!confirmed) {
              return;
            }

            const secondConfirmed =
              window.confirm(
                "此操作会删除已保存的 YiBai 加密凭据。重新绑定时需要再次填写 YiBai 账号和密码。确认解绑？"
              );

            if (!secondConfirmed) {
              return;
            }

            const originalText =
              button.textContent;

            button.disabled = true;
            button.textContent =
              "解绑中...";

            const result =
              await this.vm
                .unbindMasterProvider(
                  masterAccountId
                );

            this.showLocalMessage(
              "providerBindingMessage",
              result.message,
              result.success
            );

            if (result.success) {
              setTimeout(
                async () => {
                  await this.load();
                },
                800
              );

              return;
            }

            button.disabled = false;
            button.textContent =
              originalText;
          }
        );
      });
  }

  bindMappingUnbindButtons() {
    document
      .querySelectorAll(
        ".unbind-mapping-btn"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const mappingId =
              String(
                button.dataset.mappingId ||
                ""
              ).trim();

            if (!mappingId) {
              this.showLocalMessage(
                "mappingMessage",
                "缺少账号映射 ID",
                false
              );

              return;
            }

            const confirmed =
              window.confirm(
                "解除后，该 Harson-Base 用户将无法继续通过此映射访问 AIGC 子账号，但企业主账号、AIGC 子账号和历史创作记录不会被删除。确定解除映射吗？"
              );

            if (!confirmed) {
              return;
            }

            const originalText =
              button.textContent;

            button.disabled = true;
            button.textContent =
              "解绑中...";

            const result =
              await this.vm
                .unbindMapping(
                  mappingId
                );

            this.showLocalMessage(
              "mappingMessage",
              result.message,
              result.success
            );

            if (result.success) {
              setTimeout(
                async () => {
                  await this.load();
                },
                800
              );

              return;
            }

            button.disabled = false;
            button.textContent =
              originalText;
          }
        );
      });
  }

  bindForm(
    formId,
    action,
    messageElementId = null
  ) {
    const form =
      document.getElementById(
        formId
      );

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const submitButton =
          form.querySelector(
            'button[type="submit"]'
          );

        const originalText =
          submitButton
            ? submitButton.textContent
            : "";

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent =
            "处理中...";
        }

        const result =
          await action(form);

        if (messageElementId) {
          this.showLocalMessage(
            messageElementId,
            result.message,
            result.success
          );
        } else {
          this.flash(
            result.message,
            result.success
          );
        }

        if (result.success) {
          setTimeout(
            async () => {
              await this.load();
            },
            800
          );

          return;
        }

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            originalText;
        }
      }
    );
  }

  formToObject(form) {
    return Object.fromEntries(
      new FormData(form).entries()
    );
  }

  flash(message, success) {
    const box =
      document.getElementById(
        "globalMessage"
      );

    if (!box) {
      return;
    }

    box.textContent =
      message ||
      "操作失败，请稍后重试";

    box.className =
      success
        ? "auth-message success"
        : "auth-message error";

    box.style.display = "block";
  }

  showLocalMessage(
    elementId,
    message,
    success
  ) {
    const box =
      document.getElementById(
        elementId
      );

    if (!box) {
      return;
    }

    box.textContent =
      message ||
      "操作失败，请稍后重试";

    box.className =
      success
        ? "auth-message success"
        : "auth-message error";

    box.style.display = "block";
  }

  metricCard(label, value) {
    return `
      <div class="metric-card">
        <strong>
          ${value}
        </strong>

        <span>
          ${label}
        </span>
      </div>
    `;
  }

  masterOptions() {
    const masters =
      this.state.dashboard.masters;

    return [
      `
        <option value="">
          选择企业主账号
        </option>
      `,
      ...masters.map(
        item => `
          <option value="${item.id}">
            ${item.enterpriseName}
            /
            ${item.platformLogin}
          </option>
        `
      )
    ].join("");
  }

  masterOwnerOptions() {
    const ownerMasterIds = new Set(
      (
        this.state.dashboard
          ?.masterOwnerMappings || []
      ).map(
        mapping =>
          mapping.masterAccountId
      )
    );

    const availableMasters =
      (
        this.state.dashboard
          ?.masters || []
      ).filter(
        master =>
          !ownerMasterIds.has(
            master.id
          )
      );

    return [
      `<option value="">
        选择企业主账号
      </option>`,
      ...availableMasters.map(
        master => `
          <option value="${master.id}">
            ${master.enterpriseName}
            /
            ${master.platformLogin}
          </option>
        `
      )
    ].join("");
  }

  masterOwnerUserOptions() {
    const users =
      this.state.users || [];

    const subMappedUserIds = new Set(
      (
        this.state.dashboard
          ?.mappings || []
      )
        .filter(
          mapping =>
            mapping.mappingStatus ===
            "active"
        )
        .map(
          mapping =>
            mapping.clBaseUserId
        )
    );

    const ownerUserIds = new Set(
      (
        this.state.dashboard
          ?.masterOwnerMappings || []
      ).map(
        mapping =>
          mapping.clBaseUserId
      )
    );

    const availableUsers =
      users.filter(
        user =>
          user.role !== "admin" &&
          !subMappedUserIds.has(
            user.id
          ) &&
          !ownerUserIds.has(
            user.id
          )
      );

    return [
      `<option value="">
        选择 Harson-Base 负责人
      </option>`,
      ...availableUsers.map(
        user => `
          <option value="${user.id}">
            ${user.name || "未命名用户"}
            （${user.email || "无登录邮箱"}）
          </option>
        `
      )
    ].join("");
  }

  subOptions(
    label = "选择 AIGC 子账号"
  ) {
    const subs =
      this.state.dashboard?.subs || [];

    return [
      `<option value="">
        ${label}
      </option>`,

      ...subs.map(item => {
        const subAccountName =
          item.subAccountName ||
          "未命名子账号";

        const platformLogin =
          item.platformLogin || "无";

        const tokenLimit =
          item.tokenLimit ?? 0;

        const warningThreshold =
          item.warningThreshold ?? 10;

        return `
          <option value="${item.id}">
            ${subAccountName}
            （AIGC 登录：${platformLogin}，
            Token 配额：${tokenLimit}，
            剩余预警：${warningThreshold}%）
          </option>
        `;
      })
    ].join("");
  }

  userOptions() {
    const users =
      this.state.users || [];

    const normalUsers =
      users.filter(
        item => item.role !== "admin"
      );

    const activeMappedUserIds =
      new Set(
        (
          this.state.dashboard
            ?.mappings || []
        )
          .filter(
            mapping =>
              mapping.mappingStatus ===
              "active"
          )
          .map(
            mapping =>
              mapping.clBaseUserId
          )
      );

    const activeOwnerUserIds =
      new Set(
        (
          this.state.dashboard
            ?.masterOwnerMappings || []
        ).map(
          mapping =>
            mapping.clBaseUserId
        )
      );

    const availableUsers =
      normalUsers.filter(
        item =>
          !activeMappedUserIds.has(
            item.id
          ) &&
          !activeOwnerUserIds.has(
            item.id
          )
      );

    return [
      `<option value="">
        选择 Harson-Base 用户
      </option>`,

      ...availableUsers.map(item => {
        const userName =
          item.name || "未命名用户";

        const email =
          item.email || "无登录邮箱";

        return `
          <option value="${item.id}">
            ${userName}（${email}）
          </option>
        `;
      })
    ].join("");
  }

  providerBindingsTable() {
    const bindings =
      this.state.providerBindings ||
      [];

    if (!bindings.length) {
      return `
        <p class="muted">
          暂无 YiBai 外部账号绑定。
          请先创建企业主账号，再完成绑定和
          点数同步。
        </p>
      `;
    }

    const rows = bindings.map(
      binding => {
        const master =
          this.state.dashboard.masters.find(
            item =>
              item.id ===
              binding.masterAccountId
          );

        const masterLabel =
          master
            ? `${master.enterpriseName} / ${master.platformName}`
            : binding.masterAccountId;

        return [
          masterLabel,
          binding.providerAccount,
          binding.providerCompanyName ||
            "-",
          binding.pointsField,
          binding.syncedTotalCredits,
          binding.credentialConfigured
            ? "已配置"
            : "未配置",
          binding.lastSyncedAt ||
            "尚未同步",
          `
            <div
              class="provider-action-group"
            >
              <button
                type="button"
                class="btn-outline sync-provider-btn"
                data-master-account-id="${binding.masterAccountId}"
              >
                重新同步点数
              </button>

              <button
                type="button"
                class="btn-outline sync-user-data-btn"
                data-master-account-id="${binding.masterAccountId}"
              >
                同步创作记录
              </button>

              <button
                type="button"
                class="btn-outline unbind-provider-btn"
                data-master-account-id="${binding.masterAccountId}"
              >
                解绑 YiBai
              </button>
            </div>
          `
        ];
      }
    );

    return `
      <table>
        ${this.rows(
          [
            "内部企业主账号",
            "YiBai 外部账号",
            "外部企业",
            "点数字段",
            "已同步总点数",
            "登录凭据",
            "最近同步时间",
            "操作"
          ],
          rows
        )}
      </table>
    `;
  }

  dashboardTables() {
    const data =
      this.state.dashboard || {};

    const masters =
      data.masters || [];

    const subs =
      data.subs || [];

    const mappings =
      data.mappings || [];

    const masterOwnerMappings =
      data.masterOwnerMappings || [];

    const users =
      this.state.users || [];

    const creditSummary =
      data.creditSummary || [];

    const mappingRows =
      mappings
        .filter(
          mapping =>
            mapping.mappingStatus ===
            "active"
        )
        .map(mapping => {
          const harsonUser =
            users.find(
              user =>
                user.id ===
                mapping.clBaseUserId
            ) ||
            users.find(
              user =>
                user.email ===
                mapping.clBaseEmail
            );

          const subAccount =
            subs.find(
              sub =>
                sub.id ===
                mapping.aigcSubAccountId
            );

          const masterAccountId =
            subAccount?.masterAccountId ||
            mapping.masterAccountId;

          const masterAccount =
            masters.find(
              master =>
                master.id ===
                masterAccountId
            );

          return [
            harsonUser?.name ||
              "未命名用户",

            mapping.clBaseEmail ||
              harsonUser?.email ||
              "-",

            subAccount?.subAccountName ||
              "未找到对应子账号",

            subAccount?.platformLogin ||
              "-",

            masterAccount
              ? `${masterAccount.enterpriseName} / ${masterAccount.platformName}`
              : "未找到所属企业",

            subAccount?.tokenLimit ??
              "-",

            subAccount?.remainingTokens ??
              "-",

            "已绑定",

            `
              <button
                type="button"
                class="btn-outline unbind-mapping-btn"
                data-mapping-id="${mapping.id}"
              >
                解除映射
              </button>
            `
          ];
        });

    const masterOwnerRows =
      masterOwnerMappings.map(
        mapping => {
          const user = users.find(
            item =>
              item.id ===
              mapping.clBaseUserId
          );

          const master = masters.find(
            item =>
              item.id ===
              mapping.masterAccountId
          );

          return [
            user?.name ||
              "未命名用户",
            mapping.clBaseEmail ||
              user?.email ||
              "-",
            master
              ? `${master.enterpriseName} / ${master.platformName}`
              : "未找到企业主账号",
            "已绑定",
            `
              <button
                type="button"
                class="btn-outline unbind-master-owner-btn"
                data-mapping-id="${mapping.id}"
              >
                解除负责人绑定
              </button>
            `
          ];
        }
      );

    return `
      <h3>
        企业点数池
      </h3>

      <table>
        ${this.rows(
          [
            "企业名称",
            "总点数",
            "已使用",
            "剩余点数"
          ],
          creditSummary.map(item => [
            item.enterpriseName,
            item.totalCredits,
            item.usedCredits,
            item.remainingCredits
          ])
        )}
      </table>

      <h3>
        AIGC 子账号 Token 使用情况
      </h3>

      <table>
        ${this.rows(
          [
            "子账号名称",
            "AIGC 登录邮箱",
            "Token 配额",
            "已使用",
            "剩余",
            "已使用率",
            "剩余率",
            "剩余预警阈值",
            "使用状态"
          ],
          subs.map(item => [
            item.subAccountName,
            item.platformLogin,
            item.tokenLimit,
            item.usedTokens,
            item.remainingTokens,
            `${item.usageRate}%`,
            `${
              item.remainingRate ??
              this.calculateRemainingRate(
                item
              )
            }%`,
            `${item.warningThreshold}%`,
            this.tokenStatusLabel(
              item.warningStatus
            )
          ])
        )}
      </table>

      <h3>
        企业主账号负责人绑定
      </h3>

      <p class="muted">
        负责人后续只能查看自己所属企业及其
        子账号的 Token 使用仪表盘。
      </p>

      ${
        masterOwnerRows.length
          ? `
            <table>
              ${this.rows(
                [
                  "Harson-Base 负责人",
                  "登录邮箱",
                  "所属企业 / 平台",
                  "绑定状态",
                  "操作"
                ],
                masterOwnerRows
              )}
            </table>
          `
          : `
            <p class="muted">
              暂无企业主账号负责人绑定。
            </p>
          `
      }

      <h3>
        Harson-Base 与 AIGC 绑定情况
      </h3>

      <p class="muted">
        每一行表示一个 Harson-Base
        用户当前使用的 AIGC 子账号。
        同一个 AIGC 子账号可以分配给多个
        Harson-Base 用户。
      </p>

      ${
        mappingRows.length
          ? `
            <table>
              ${this.rows(
                [
                  "Harson-Base 用户",
                  "Harson-Base 登录邮箱",
                  "绑定的 AIGC 子账号",
                  "AIGC 登录邮箱",
                  "所属企业 / 平台",
                  "Token 配额",
                  "剩余 Token",
                  "绑定状态",
                  "操作"
                ],
                mappingRows
              )}
            </table>
          `
          : `
            <p class="muted">
              暂无账号绑定记录。请先选择
              Harson-Base 用户和 AIGC
              子账号建立绑定。
            </p>
          `
      }
    `;
  }

      taskSyncMessage(
    taskSync
  ) {
    const status =
      String(
        taskSync?.status ||
        "not_synced"
      );

    const latestSyncedAt =
      taskSync?.latestSyncedAt ||
      "尚未同步";

    if (status === "resolved") {
      return `
        <div class="auth-message success">
          当前数据来自真实任务快照。
          最近同步时间：${latestSyncedAt}
        </div>
      `;
    }

    if (status === "mapping_missing") {
      return `
        <div class="auth-message error">
          当前账号尚未建立完整的
          Harson-Base 与 AIGC 子账号映射
        </div>
      `;
    }

    if (status === "identity_missing") {
      return `
        <div class="auth-message error">
          当前映射缺少 AIGC 登录名或
          子账号名称，无法匹配真实任务
        </div>
      `;
    }

    if (status === "member_unresolved") {
      return `
        <div class="auth-message error">
          已读取真实任务快照，但没有找到
          与当前账号匹配的真实成员
        </div>
      `;
    }

    if (status === "member_ambiguous") {
      return `
        <div class="auth-message error">
          当前账号匹配到多个成员，
          为防止数据泄露，暂不显示任务
        </div>
      `;
    }

    return `
      <div class="auth-message error">
        管理员尚未同步真实创作记录
      </div>
    `;
  }

  taskSummaryTable(
    taskSummary,
    taskSync
  ) {
    return `
      <div class="table-wrap">
        <table>
          ${this.rows(
            [
              "任务总数",
              "成功",
              "失败",
              "处理中",
              "累计扣除",
              "累计退回",
              "真实净消耗",
              "最近同步时间"
            ],
            [
              [
                taskSummary.totalTasks ?? 0,
                taskSummary.successfulTasks ?? 0,
                taskSummary.failedTasks ?? 0,
                taskSummary.processingTasks ?? 0,
                taskSummary.deductedTokens ?? 0,
                taskSummary.refundedTokens ?? 0,
                taskSummary.netUsedTokens ?? 0,
                taskSync.latestSyncedAt ||
                  "尚未同步"
              ]
            ]
          )}
        </table>
      </div>
    `;
  }

  openWorkImagePreview(
    imageUrl,
    title = "AIGC 创作任务"
  ) {
    const normalizedUrl =
      String(imageUrl || "").trim();

    if (!normalizedUrl) {
      return;
    }

    let preview =
      document.getElementById(
        "accountWorkImagePreview"
      );

    if (!preview) {
      preview =
        document.createElement("div");

      preview.id =
        "accountWorkImagePreview";

      preview.className =
        "account-work-image-preview";

      preview.hidden = true;

      const dialog =
        document.createElement("div");

      dialog.className =
        "account-work-preview-dialog";

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
        "account-work-preview-close";

      closeButton.textContent =
        "×";

      closeButton.setAttribute(
        "aria-label",
        "关闭图片预览"
      );

      const image =
        document.createElement("img");

      image.className =
        "account-work-preview-image";

      image.referrerPolicy =
        "no-referrer";

      image.decoding =
        "async";

      const caption =
        document.createElement("p");

      caption.className =
        "account-work-preview-caption";

      dialog.append(
        closeButton,
        image,
        caption
      );

      preview.append(dialog);

      document.body.append(
        preview
      );

      const closePreview = () => {
        preview.hidden = true;

        document.body.classList.remove(
          "account-work-preview-open"
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
        ".account-work-preview-image"
      );

    const caption =
      preview.querySelector(
        ".account-work-preview-caption"
      );

    image.src = normalizedUrl;

    image.alt =
      `${title || "AIGC 创作任务"}大图`;

    caption.textContent =
      title || "AIGC 创作任务";

    preview.hidden = false;

    document.body.classList.add(
      "account-work-preview-open"
    );

    preview
      .querySelector(
        ".account-work-preview-close"
      )
      ?.focus();
  }

  worksTable(works) {
    return `
      <table>
        ${this.rows(
          [
            "创作封面",
            "任务标题",
            "任务类型",
            "状态",
            "扣除 Token",
            "返还 Token",
            "净消耗",
            "完成或创建时间"
          ],
          works.map(
            item => [
              item.imageUrl
                ? `
                  <button
                    type="button"
                    class="account-work-preview-btn"
                    data-image-url="${this.escapeHtml(
                      item.imageUrl
                    )}"
                    data-image-title="${this.escapeHtml(
                      item.title ||
                      "AIGC 创作任务"
                    )}"
                    aria-label="放大查看创作封面"
                    title="点击放大查看"
                  >
                    <img
                      class="account-work-thumbnail"
                      src="${this.escapeHtml(
                        item.imageUrl
                      )}"
                      alt="${this.escapeHtml(
                        item.title ||
                        "AIGC 创作任务"
                      )}封面"
                      width="72"
                      height="72"
                      loading="lazy"
                      decoding="async"
                      referrerpolicy="no-referrer"
                    />
                  </button>
                `
                : `
                  <span class="account-work-no-image">
                    暂无图片
                  </span>
                `,

              item.title ||
                "AIGC 创作任务",

              item.workType ||
                "AIGC",

              item.statusLabel ||
                this.realTaskStatusLabel(
                  item.status
                ),

              this.formatToken(
                item.deductedTokens ??
                item.point ??
                0
              ),

              this.formatToken(
                item.refundedTokens ??
                item.refundedPoint ??
                0
              ),

              this.formatToken(
                item.creditCost ??
                item.netUsedTokens ??
                0
              ),

              this.formatDateTime(
                item.createdAt
              )
            ]
          )
        )}
      </table>
    `;
  }

  realTaskStatusLabel(
    status
  ) {
    if (status === "O") {
      return "成功";
    }

    if (status === "R") {
      return "失败";
    }

    return "处理中";
  }

  calculateRemainingRate(
    subAccount
  ) {
    const tokenLimit =
      Number(
        subAccount.tokenLimit || 0
      );

    const remainingTokens =
      Number(
        subAccount.remainingTokens || 0
      );

    if (tokenLimit <= 0) {
      return 100;
    }

    return Math.round(
      (
        remainingTokens /
        tokenLimit
      ) * 100
    );
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
    if (
      subAccount.warningStatus ===
      "exceeded"
    ) {
      return `
        <div class="auth-message error">
          当前 AIGC 子账号已达到 token
          上限，请联系管理员增加配额
        </div>
      `;
    }

    if (
      subAccount.warningStatus ===
      "warning"
    ) {
      const remainingRate =
        subAccount.remainingRate ??
        this.calculateRemainingRate(
          subAccount
        );

      return `
        <div class="auth-message error">
          当前 AIGC 子账号剩余 token 为
          ${remainingRate}%，请注意剩余额度
        </div>
      `;
    }

    return `
      <div class="auth-message success">
        当前 AIGC 子账号 token 使用状态正常
      </div>
    `;
  }

  formatToken(value) {
    const numericValue =
      Number(value);

    if (!Number.isFinite(numericValue)) {
      return "0";
    }

    return numericValue.toLocaleString(
      "zh-CN",
      {
        maximumFractionDigits: 2
      }
    );
  }

  formatDateTime(value) {
    const normalizedValue =
      String(value || "").trim();

    if (!normalizedValue) {
      return "-";
    }

    const parsedDate =
      new Date(normalizedValue);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return this.escapeHtml(
        normalizedValue
      );
    }

    return parsedDate.toLocaleString(
      "zh-CN",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    );
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  rows(headers, rows) {
    return `
      <thead>
        <tr>
          ${headers
            .map(
              item => `
                <th>
                  ${item}
                </th>
              `
            )
            .join("")}
        </tr>
      </thead>

      <tbody>
        ${rows
          .map(
            row => `
              <tr>
                ${row
                  .map(
                    cell => `
                      <td>
                        ${cell ?? ""}
                      </td>
                    `
                  )
                  .join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    `;
  }
}
