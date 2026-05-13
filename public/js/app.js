import { HomeViewModel } from "./viewmodels/homeViewModel.js";
import { HomeView } from "./views/homeView.js";
import { AuthViewModel } from "./viewmodels/authViewModel.js";
import { AuthView } from "./views/authView.js";

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

  console.log("HARSON MVVM application loaded.");
});
