export class AccountManagementViewModel {
  async getAdminDashboard() {
    return this.getJson(
      "/api/aigc/admin/dashboard"
    );
  }

  async getClBaseUsers() {
    return this.getJson(
      "/api/aigc/admin/clbase-users"
    );
  }

  /**
   * 获取：
   * 内部 AIGC 企业主账号
   * → YiBai 外部账号
   * 的绑定列表。
   */
  async getMasterProviderBindings() {
    return this.getJson(
      "/api/aigc/admin/master-provider-bindings"
    );
  }

  async getMyWorkspace() {
    return this.getJson(
      "/api/aigc/my-workspace"
    );
  }

  async createMaster(payload) {
    return this.postJson(
      "/api/aigc/admin/master-accounts",
      payload
    );
  }

  /**
   * 创建或修改企业主账号的 YiBai 绑定，
   * 并立即同步外部账号点数。
   */
  async bindMasterProvider(payload) {
    return this.postJson(
      "/api/aigc/admin/master-provider-bindings",
      payload
    );
  }

  /**
   * 对已经绑定的企业主账号
   * 重新同步 YiBai 点数。
   */
  async syncMasterProvider(
    masterAccountId
  ) {
    const normalizedMasterAccountId =
      encodeURIComponent(
        String(
          masterAccountId || ""
        ).trim()
      );

    return this.postJson(
      `/api/aigc/admin/master-provider-bindings/${normalizedMasterAccountId}/sync`,
      {}
    );
  }

  async createSubAccount(payload) {
    return this.postJson(
      "/api/aigc/admin/sub-accounts",
      payload
    );
  }

  async updateSubTokenSettings(
    payload
  ) {
    return this.postJson(
      "/api/aigc/admin/sub-accounts/token-settings",
      payload
    );
  }

  async createMapping(payload) {
    return this.postJson(
      "/api/aigc/admin/mappings",
      payload
    );
  }

  async addWork(payload) {
    return this.postJson(
      "/api/aigc/my-workspace/works",
      payload
    );
  }

  async logout() {
    return this.postJson(
      "/api/auth/logout",
      {}
    );
  }

  async getJson(url) {
    try {
      const response = await fetch(url);

      const result =
        await response.json();

      if (
        !response.ok &&
        result.success !== false
      ) {
        return {
          success: false,
          message:
            result.message ||
            `请求失败：${response.status}`
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message:
          error.message ||
          "网络请求失败"
      };
    }
  }

  async postJson(url, payload) {
    try {
      const response = await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify(
            payload || {}
          )
        }
      );

      const result =
        await response.json();

      if (
        !response.ok &&
        result.success !== false
      ) {
        return {
          success: false,
          message:
            result.message ||
            `请求失败：${response.status}`
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message:
          error.message ||
          "网络请求失败"
      };
    }
  }
}