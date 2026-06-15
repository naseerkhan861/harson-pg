export class HomeView {
  constructor(viewModel) {
    this.vm = viewModel;
  }

  render() {
    this.renderNav();
    this.renderPlatforms();
    this.renderInsights();
    this.bindEvents();
  }

  renderNav() {
    const nav = document.querySelector("[data-nav]");

    if (!nav) {
      return;
    }

    nav.innerHTML = this.vm
      .getNavItems()
      .map(item => `<li><a href="${item.href}">${item.label}</a></li>`)
      .join("");
  }

  renderPlatforms() {
    const container = document.querySelector("[data-platform-grid]");

    if (!container) {
      return;
    }

    container.innerHTML = this.vm
      .getPlatforms()
      .map(platform => this.platformTemplate(platform))
      .join("");
  }

  platformTemplate(platform) {
    const platformTitle = platform.link
      ? `<a href="${platform.link}" target="_blank" rel="noopener noreferrer">${platform.title}</a>`
      : platform.title;

    const actionButton = platform.link
      ? `
        <a class="platform-action" href="${platform.link}" target="_blank" rel="noopener noreferrer">
          ${platform.actionLabel || "进入平台"} <i class="fas fa-arrow-right"></i>
        </a>
      `
      : `
        <a class="platform-action" href="#${platform.id}">
          ${platform.actionLabel || "查看能力"} <i class="fas fa-arrow-right"></i>
        </a>
      `;

    return `
      <article class="platform-card platform-product-card" id="${platform.id}">
        <div class="platform-product-info">
          <div class="platform-product-top">
            <div class="platform-icon">
              <i class="${platform.icon}"></i>
            </div>

            <div class="platform-product-heading">
              <h2>${platformTitle}</h2>
              <p>${platform.subtitle}</p>
            </div>
          </div>

          <p class="platform-description">
            ${platform.description || ""}
          </p>

          <div class="platform-meta-row">
            <span class="platform-badge">
              <i class="${platform.badgeIcon}"></i> ${platform.badge}
            </span>
          </div>

          ${actionButton}
        </div>

        <div class="feature-list">
          ${platform.features.map(feature => `
            <div class="feature-item" data-feature="${feature[0]}">
              <div class="feature-icon">
                <i class="${feature[2]}"></i>
              </div>

              <div class="feature-text">
                <strong>${feature[0]}</strong>
                <span>${feature[1]}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  renderInsights() {
    const container = document.querySelector("[data-insight-grid]");

    if (!container) {
      return;
    }

    container.innerHTML = this.vm.getInsights().map(item => `
      <div class="insight-card">
        <i class="${item[2]}"></i>
        <h3>${item[0]}</h3>
        <p>${item[1]}</p>
      </div>
    `).join("");
  }

  bindEvents() {
    const exploreBtn = document.getElementById("explorePlatformsBtn");
    const contactBtn = document.getElementById("contactExpertBtn");

    if (exploreBtn) {
      exploreBtn.addEventListener("click", event => {
        event.preventDefault();
        document.getElementById("platforms")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }

    if (contactBtn) {
      contactBtn.addEventListener("click", event => {
        event.preventDefault();

        const footer = document.querySelector(".footer");

        if (footer) {
          footer.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
          return;
        }

        alert(this.vm.getContactMessage());
      });
    }

    document.querySelectorAll(".feature-item").forEach(item => {
      item.addEventListener("click", event => {
        event.stopPropagation();
        alert(this.vm.getFeatureMessage(item.dataset.feature));
      });
    });

    document.querySelectorAll(".nav-links a").forEach(link => {
      link.addEventListener("click", event => {
        const href = link.getAttribute("href");

        if (href && href.startsWith("#")) {
          event.preventDefault();

          if (href === "#") {
            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });
            return;
          }

          document.querySelector(href)?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      });
    });
  }
}