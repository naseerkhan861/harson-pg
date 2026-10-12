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
      },

      "foot-measure": {
        title: "3D 足型测量",
        tagline: "足测数智",
        link: "https://harson-base-health.com",
        ssoUrl: "/api/sso/foot-entry"
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
          href="${app.link}"${
            app.ssoUrl
              ? ` data-sso-url="${app.ssoUrl}" data-sso-external="${app.link}"`
              : ""
          }
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

    this.bindSsoEntries();
  }

  /**
   * 绑定 SSO 免登录跳转入口（如「3D 足型测量」卡片）。
   *
   * 点击后请求同源接口 /api/sso/foot-entry：
   *  - 已登录：接口返回带签名的免登录跳转 URL，整页跳转到目标平台。
   *  - 未登录：接口返回 401，跳转到本系统登录页。
   *  - 接口异常 / 未配置：降级为直接打开目标平台官网。
   */
  bindSsoEntries() {
    const ssoLinks = document.querySelectorAll("[data-sso-url]");

    if (!ssoLinks.length) {
      return;
    }

    ssoLinks.forEach(link => {
      link.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const ssoUrl = link.dataset.ssoUrl;
        const fallbackUrl = link.dataset.ssoExternal || link.getAttribute("href");
        const isValidAbsolute =
          typeof fallbackUrl === "string" && /^https?:\/\//i.test(fallbackUrl);

        try {
          const response = await fetch(ssoUrl, {
            method: "GET",
            credentials: "include",
            headers: {
              "Accept": "application/json"
            }
          });

          if (response.status === 401) {
            window.location.href = "/login";
            return;
          }

          const result = await response.json().catch(() => null);

          if (response.ok && result && result.url) {
            window.location.href = result.url;
            return;
          }

          console.warn("SSO 跳转接口返回异常，降级为直接跳转", result);

          if (isValidAbsolute) {
            window.location.href = fallbackUrl;
            return;
          }

          alert((result && result.message) || "跳转失败，请稍后重试或直接登录目标系统。");
        } catch (error) {
          console.error("SSO 跳转失败", error);

          if (isValidAbsolute) {
            window.location.href = fallbackUrl;
            return;
          }

          alert("跳转失败，请稍后重试或直接登录目标系统。");
        }
      });
    });
  }
}