export class AuthView {
  constructor(viewModel) {
    this.vm = viewModel;
  }

  render() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
      loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const result = await this.vm.login({
          email: loginForm.email.value,
          password: loginForm.password.value
        });

        this.showMessage(result.message, result.success);

        if (result.success) {
          window.location.href = "/";
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        const result = await this.vm.register({
          name: registerForm.name.value,
          email: registerForm.email.value,
          password: registerForm.password.value,
          gender: registerForm.gender.value,
          ageGroup: registerForm.ageGroup.value
        });

        this.showMessage(result.message, result.success);

        if (result.success) {
          window.location.href = "/";
        }
      });
    }
  }

  showMessage(message, success) {
    const box = document.getElementById("authMessage");

    if (!box) {
      return;
    }

    box.textContent = message;
    box.className = success ? "auth-message success" : "auth-message error";
  }
}