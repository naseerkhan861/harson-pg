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
    const appMeta = {
      "cl-aigc": {
        title: "CL-AIGC",
        tagline: "创意生成",
        link: "/aigc-workspace"
      },

      "cl-scm": {
        title: "CL-SCM",
        tagline: "供应协同",
        link: "#cl-scm"
      },

      "cl-irobot": {
        title: "CL-iRobot",
        tagline: "自动化执行",
        link: "#cl-irobot"
      },

      "cl-istore": {
        title: "CL-iStore",
        tagline: "零售体验",
        link: "#cl-istore"
      }
    };

    const app = appMeta[platform.id];

    if (!app) {
      return "";
    }

    return `
      <article
        class="featured-app-card featured-app-${platform.id}"
        id="${platform.id}"
      >
        <div class="featured-app-copy">
    

          <h3>${app.title}</h3>

          <p>${app.tagline}</p>
        </div>

        <div
          class="featured-app-visual"
          aria-hidden="true"
        ></div>

        <a
          class="featured-app-link"
          href="${app.link}"
        >
          探索 ${app.title}
          <i class="fas fa-arrow-right"></i>
        </a>
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