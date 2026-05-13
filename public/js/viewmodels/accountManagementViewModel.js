export class AccountManagementViewModel {
  async getAdminDashboard() {
    return this.getJson("/api/aigc/admin/dashboard");
  }

  async getClBaseUsers() {
    return this.getJson("/api/aigc/admin/clbase-users");
  }

  async getMyWorkspace() {
    return this.getJson("/api/aigc/my-workspace");
  }

  async createMaster(payload) {
    return this.postJson("/api/aigc/admin/master-accounts", payload);
  }

  async createSubAccount(payload) {
    return this.postJson("/api/aigc/admin/sub-accounts", payload);
  }

  async createMapping(payload) {
    return this.postJson("/api/aigc/admin/mappings", payload);
  }

  async addWork(payload) {
    return this.postJson("/api/aigc/my-workspace/works", payload);
  }

  async logout() {
    return this.postJson("/api/auth/logout", {});
  }

  async getJson(url) {
    const response = await fetch(url);
    return response.json();
  }

  async postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    return response.json();
  }
}
