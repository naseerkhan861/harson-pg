export class AccountManagementViewModel {
  async getCurrentUser() {
    return this.getJson(
      "/api/auth/me"
    );
  }

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

  /**
   * 企业主账号查看自己的企业资料、
   * 企业子账号列表和 token 汇总。
   */
  async getMyEnterpriseAccount() {
    return this.getJson(
      "/api/aigc/enterprise/my-account"
    );
  }

  /**
   * 企业成员查看自己的子账号
   * 和 token 使用情况。
   */
  async getMyEnterpriseMemberAccount() {
    return this.getJson(
      "/api/aigc/enterprise/member/my-account"
    );
  }

  /**
   * 平台管理员创建完整企业主账号：
   *
   * Harson-Base 登录账号
   * +
   * AIGC 企业主账号
   */
  async createEnterpriseMaster(payload) {
    return this.postJson(
      "/api/aigc/admin/enterprise-master-accounts",
      payload
    );
  }

  /**
   * 平台管理员或企业主账号
   * 创建完整企业成员账号。
   */
  async createEnterpriseMember(payload) {
    return this.postJson(
      "/api/aigc/enterprise/member-accounts",
      payload
    );
  }

  /**
   * 平台管理员或企业主账号
   * 调整企业成员 token 配额。
   */
  async updateEnterpriseMemberTokenSettings(
    payload
  ) {
    return this.patchJson(
      "/api/aigc/enterprise/member-accounts/token-settings",
      payload
    );
  }

  /**
   * 保留旧方法，避免页面改造期间
   * 其他现有代码立即报错。
   */
  async createMaster(payload) {
    return this.postJson(
      "/api/aigc/admin/master-accounts",
      payload
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

  async bindMasterProvider(payload) {
    return this.postJson(
      "/api/aigc/admin/master-provider-bindings",
      payload
    );
  }

  async syncMasterProvider(
    masterAccountId
  ) {
    const normalizedMasterAccountId =
      encodeURIComponent(
        String(
          masterAccountId || ""
        ).trim()
      );

    if (!normalizedMasterAccountId) {
      return {
        success: false,
        message:
          "企业主账号 ID 不能为空。"
      };
    }

    return this.postJson(
      `/api/aigc/admin/master-provider-bindings/${normalizedMasterAccountId}/sync`,
      {}
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
    return this.requestJson(
      url,
      {
        method: "GET"
      }
    );
  }

  async postJson(url, payload) {
    return this.requestJson(
      url,
      {
        method: "POST",
        body: payload
      }
    );
  }

  async patchJson(url, payload) {
    return this.requestJson(
      url,
      {
        method: "PATCH",
        body: payload
      }
    );
  }

  async requestJson(
    url,
    {
      method = "GET",
      body
    } = {}
  ) {
    try {
      const options = {
        method,
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      };

      if (
        body !== undefined &&
        method !== "GET"
      ) {
        options.headers[
          "Content-Type"
        ] = "application/json";

        options.body =
          JSON.stringify(
            body || {}
          );
      }

      const response =
        await fetch(
          url,
          options
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let result;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        result =
          await response.json();
      } else {
        const responseText =
          await response.text();

        result = {
          success: response.ok,
          message:
            responseText ||
            (
              response.ok
                ? "请求成功"
                : `请求失败：${response.status}`
            )
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message:
            result?.message ||
            `请求失败：${response.status}`,

          status:
            response.status,

          data:
            result?.data || null
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message:
          error.message ||
          "网络请求失败",

        status: 0,
        data: null
      };
    }
  }
}