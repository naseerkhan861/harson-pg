(() => {
  "use strict";

  const PANEL_ID = "subProviderBindingPanel";
  const STYLE_ID = "subProviderBindingAddonStyles";

  let rendering = false;
  let observer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateTime(value) {
    if (!value) {
      return "尚未同步";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("zh-CN", {
      hour12: false
    });
  }

  function formatNumber(value) {
    const numericValue = Number(value);

    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 2
    }).format(
      Number.isFinite(numericValue) ? numericValue : 0
    );
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let result;

    try {
      result = await response.json();
    } catch {
      result = {
        success: false,
        message: `服务器返回了无法解析的响应：${response.status}`
      };
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || `请求失败：${response.status}`
      );
    }

    return result;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .sub-provider-binding-note {
        margin: 10px 0 0;
        color: rgba(255, 255, 255, 0.66);
        font-size: 13px;
        line-height: 1.7;
      }

      .sub-provider-binding-table {
        width: 100%;
        border-collapse: collapse;
      }

      .sub-provider-binding-table th,
      .sub-provider-binding-table td {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        text-align: left;
        vertical-align: middle;
      }

      .sub-provider-binding-table th {
        color: rgba(255, 255, 255, 0.65);
        font-size: 12px;
        font-weight: 600;
      }

      .sub-provider-binding-table td {
        color: rgba(255, 255, 255, 0.9);
        font-size: 13px;
      }

      .sub-provider-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .sub-provider-action-button {
        min-width: auto;
        padding: 8px 12px;
        font-size: 12px;
      }

      .sub-provider-danger-button {
        border-color: rgba(255, 107, 107, 0.55) !important;
        color: #ffb3b3 !important;
      }

      .sub-provider-empty {
        padding: 18px;
        color: rgba(255, 255, 255, 0.58);
        text-align: center;
      }

      .sub-provider-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #8ee6aa;
      }

      .sub-provider-status::before {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        content: "";
      }

      @media (max-width: 860px) {
        .sub-provider-binding-table {
          min-width: 980px;
        }
      }
    `;

    document.head.append(style);
  }

  function renumberExistingPanels() {
    const headings = Array.from(
      document.querySelectorAll(".account-panel > h2")
    );

    const replacements = [
      ["4. 调整 AIGC 子账号 Token 配额", "5. 调整 AIGC 子账号 Token 配额"],
      ["5. 绑定企业主账号负责人", "6. 绑定企业主账号负责人"],
      [
        "6. 建立 Harson-Base ↔ AIGC 子账号映射",
        "7. 建立 Harson-Base ↔ AIGC 子账号映射"
      ]
    ];

    headings.forEach(heading => {
      const normalizedText = heading.textContent
        .replace(/\s+/g, " ")
        .trim();

      replacements.forEach(([from, to]) => {
        if (normalizedText === from) {
          heading.textContent = to;
        }
      });
    });
  }

  function buildSubOptions(subs, bindings) {
    const boundIds = new Set(
      bindings.map(binding => String(binding.subAccountId))
    );

    const options = [
      '<option value="">选择需要绑定的 AIGC 子账号</option>'
    ];

    subs
      .filter(sub => sub.status === "active")
      .forEach(sub => {
        const suffix = boundIds.has(String(sub.id))
          ? "（已绑定，可重新验证更新）"
          : "";

        options.push(`
          <option value="${escapeHtml(sub.id)}">
            ${escapeHtml(sub.subAccountName || sub.platformLogin || sub.id)}${suffix}
          </option>
        `);
      });

    return options.join("");
  }

  function buildBindingsTable(bindings) {
    if (!bindings.length) {
      return `
        <div class="sub-provider-empty">
          暂无外部子账号绑定。请先选择一个已创建的 AIGC 子账号完成绑定。
        </div>
      `;
    }

    const rows = bindings
      .map(binding => `
        <tr>
          <td>${escapeHtml(binding.enterpriseName || "-")}</td>
          <td>${escapeHtml(binding.subAccountName || binding.subAccountId)}</td>
          <td>${escapeHtml(binding.providerAccount || "-")}</td>
          <td>${escapeHtml(binding.providerMemberName || "-")}</td>
          <td>${escapeHtml(binding.providerMemberId || "-")}</td>
          <td>${formatNumber(binding.syncedTokenBalance)}</td>
          <td>${escapeHtml(binding.pointsField || "balance")}</td>
          <td>${formatDateTime(binding.lastSyncedAt)}</td>
          <td>
            <span class="sub-provider-status">已绑定</span>
          </td>
          <td>
            <div class="sub-provider-actions">
              <button
                type="button"
                class="btn-outline sub-provider-action-button"
                data-sub-provider-action="sync"
                data-sub-account-id="${escapeHtml(binding.subAccountId)}"
              >
                同步
              </button>

              <button
                type="button"
                class="btn-outline sub-provider-action-button sub-provider-danger-button"
                data-sub-provider-action="unbind"
                data-sub-account-id="${escapeHtml(binding.subAccountId)}"
              >
                解绑
              </button>
            </div>
          </td>
        </tr>
      `)
      .join("");

    return `
      <table class="sub-provider-binding-table">
        <thead>
          <tr>
            <th>企业</th>
            <th>AIGC 子账号</th>
            <th>外部子账号</th>
            <th>外部成员名称</th>
            <th>成员 ID</th>
            <th>同步点数</th>
            <th>点数字段</th>
            <th>最近同步</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function setMessage(panel, message, isError = false) {
    const element = panel.querySelector("#subProviderBindingMessage");

    if (!element) {
      return;
    }

    element.textContent = message;
    element.classList.toggle("error", isError);
    element.classList.toggle("success", !isError && Boolean(message));
  }

  async function loadData() {
    const [dashboardResult, bindingsResult] = await Promise.all([
      requestJson("/api/aigc/admin/dashboard"),
      requestJson("/api/aigc/admin/sub-provider-bindings")
    ]);

    return {
      subs: Array.isArray(dashboardResult.data?.subs)
        ? dashboardResult.data.subs
        : [],
      bindings: Array.isArray(bindingsResult.data)
        ? bindingsResult.data
        : []
    };
  }

  function bindPanelEvents(panel) {
    const form = panel.querySelector("#subProviderBindingForm");

    form?.addEventListener("submit", async event => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const payload = Object.fromEntries(new FormData(form).entries());

      submitButton.disabled = true;
      setMessage(panel, "正在验证外部子账号并建立绑定……");

      try {
        const result = await requestJson(
          "/api/aigc/admin/sub-provider-bindings",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );

        setMessage(panel, result.message || "外部子账号绑定成功");
        form.reset();
        await renderAddon(true);
      } catch (error) {
        setMessage(panel, error.message || "外部子账号绑定失败", true);
      } finally {
        submitButton.disabled = false;
      }
    });

    panel
      .querySelectorAll("[data-sub-provider-action]")
      .forEach(button => {
        button.addEventListener("click", async () => {
          const action = button.dataset.subProviderAction;
          const subAccountId = button.dataset.subAccountId;

          if (!subAccountId) {
            return;
          }

          if (
            action === "unbind" &&
            !window.confirm(
              "确认解除该外部子账号绑定吗？内部 AIGC 子账号及 Harson-Base 用户映射会继续保留。"
            )
          ) {
            return;
          }

          button.disabled = true;
          setMessage(
            panel,
            action === "sync"
              ? "正在同步外部子账号……"
              : "正在解除外部子账号绑定……"
          );

          try {
            const result = await requestJson(
              `/api/aigc/admin/sub-provider-bindings/${encodeURIComponent(
                subAccountId
              )}/${action}`,
              {
                method: "POST",
                body: "{}"
              }
            );

            setMessage(panel, result.message || "操作成功");
            await renderAddon(true);
          } catch (error) {
            setMessage(panel, error.message || "操作失败", true);
          } finally {
            button.disabled = false;
          }
        });
      });
  }

  async function renderAddon(force = false) {
    if (rendering) {
      return;
    }

    const subForm = document.getElementById("subAccountForm");

    /*
     * 只有系统管理员页面才存在该表单。
     * 普通用户和企业负责人不会看到此功能。
     */
    if (!subForm) {
      return;
    }

    const existingPanel = document.getElementById(PANEL_ID);

    if (existingPanel && !force) {
      renumberExistingPanels();
      return;
    }

    rendering = true;

    try {
      ensureStyles();
      const { subs, bindings } = await loadData();
      const subPanel = subForm.closest(".account-panel");

      if (!subPanel) {
        return;
      }

      existingPanel?.remove();

      const panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.className = "account-panel";
      panel.innerHTML = `
        <h2>4. 绑定外部子账号</h2>

        <p>
          将已创建的内部 AIGC 子账号绑定到对应的外部子账号。
          绑定成功后，映射到该 AIGC 子账号的 Harson-Base 用户将使用该外部子账号的独立 Session；
          仪表盘也会优先按照绑定保存的成员 ID 统计任务和 Token 消耗。
        </p>

        <div
          id="subProviderBindingMessage"
          class="auth-message"
        ></div>

        <form
          id="subProviderBindingForm"
          class="management-form"
        >
          <select name="subAccountId" required>
            ${buildSubOptions(subs, bindings)}
          </select>

          <input
            name="providerAccount"
            placeholder="外部子账号登录账号"
            autocomplete="username"
            required
          />

          <input
            name="providerPassword"
            type="password"
            placeholder="外部子账号登录密码"
            autocomplete="new-password"
            required
          />

          <select name="pointsField" required>
            <option value="balance">balance（账号余额）</option>
            <option value="mpoint">mpoint（成员点数）</option>
            <option value="companyBalance">companyBalance（企业余额）</option>
            <option value="companyMpoint">companyMpoint（企业点数）</option>
          </select>

          <button type="submit">
            验证并绑定外部子账号
          </button>
        </form>

        <p class="sub-provider-binding-note">
          密码只在后端加密保存，不会回显到页面，也不会写入普通账号 CSV。
          重新提交同一个 AIGC 子账号可更新其外部绑定。
        </p>

        <div class="table-wrap">
          ${buildBindingsTable(bindings)}
        </div>
      `;

      subPanel.insertAdjacentElement("afterend", panel);
      renumberExistingPanels();
      bindPanelEvents(panel);
    } catch (error) {
      console.error("外部子账号绑定模块加载失败：", error);
    } finally {
      rendering = false;
    }
  }

  function startObserver() {
    const app = document.getElementById("accountApp");

    if (!app || observer) {
      return;
    }

    observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        renderAddon(false);
      });
    });

    observer.observe(app, {
      childList: true,
      subtree: true
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    startObserver();
    renderAddon(false);
  });
})();
