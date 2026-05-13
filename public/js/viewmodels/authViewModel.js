export class AuthViewModel {
  async register(formData) {
    return this.request("/api/auth/register", formData);
  }

  async login(formData) {
    return this.request("/api/auth/login", formData);
  }

  async logout() {
    return this.request("/api/auth/logout", {});
  }

  async request(url, data) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return response.json();
  }
}
