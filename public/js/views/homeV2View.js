export class HomeV2View {
  constructor(viewModel) {
    this.vm = viewModel;
  }

  render() {
    this.renderNav();
    this.renderPlatforms();
    this.renderEcosystem();
    this.initScrollReveal();
  }

  renderNav() {
    const nav = document.querySelector(
      "[data-nav]"
    );

    if (!nav) {
      return;
    }

    nav.innerHTML = this.vm
      .getNavItems()
      .map(
        item => `
          <li>
            <a href="${item.href}">
              ${item.label}
            </a>
          </li>
        `
      )
      .join("");
  }

  renderPlatforms() {
    const container =
      document.querySelector(
        "[data-v2-platform-grid]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = this.vm
      .getPlatforms()
      .map(
        platform =>
          this.platformTemplate(platform)
      )
      .join("");
  }

  renderEcosystem() {
    const container =
        document.querySelector(
        "[data-v2-ecosystem-grid]"
        );

        if (!container) {
            return;
        }

        container.innerHTML = this.vm
            .getInsights()
            .map(
            item => `
                <article
                class="v2-ecosystem-card"
                >

                <div
                    class="v2-ecosystem-dot"
                    aria-hidden="true"
                ></div>

                <h3>
                    ${item[0]}
                </h3>

                <p>
                    ${item[1]}
                </p>

                </article>
            `
        )
        .join("");
    }

  initScrollReveal() {
    const sectionHeader =
      document.querySelector(
        ".platform-section .section-header"
      );

    const featuredCards =
      document.querySelectorAll(
        ".v2-platform-featured"
      );

    const capabilityFlows =
      document.querySelectorAll(
        ".v2-capability-flow"
      );

    const ecosystemHeader =
      document.querySelector(
        ".v2-ecosystem .section-header"
      );

    const ecosystemCards =
      document.querySelectorAll(
        ".v2-ecosystem-card"
      );


    if (sectionHeader) {
      sectionHeader.classList.add(
        "home-reveal-unit"
      );
    }


    featuredCards.forEach(card => {
      card.classList.add(
        "home-reveal-unit"
      );
    });


    capabilityFlows.forEach(flow => {
      flow.classList.add(
        "home-reveal-flow"
      );
    });

    if (ecosystemHeader) {
      ecosystemHeader.classList.add(
        "home-reveal-unit"
      );
    }

    ecosystemCards.forEach(
      (card, index) => {
        card.classList.add(
          "home-ecosystem-reveal"
        );

        card.style.setProperty(
          "--reveal-index",
          index
        );
      }
    );


    const revealElements =
    document.querySelectorAll(
      `
        .home-reveal-unit,
        .home-reveal-flow,
        .home-ecosystem-reveal
      `
    );


    if (!revealElements.length) {
      return;
    }


    /* 系统设置了“减少动态效果”时直接显示 */
    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;


    if (
      reduceMotion ||
      !("IntersectionObserver" in window)
    ) {
      revealElements.forEach(element => {
        element.classList.add(
          "is-visible"
        );
      });

      return;
    }


    document.body.classList.add(
      "reveal-ready"
    );


    const observer =
      new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) {
              return;
            }


            entry.target.classList.add(
              "is-visible"
            );


            observer.unobserve(
              entry.target
            );
          });
        },
        {
          threshold: 0.15,

          rootMargin:
            "0px 0px -60px 0px"
        }
      );


    revealElements.forEach(element => {
      observer.observe(element);
    });
  }

  platformTemplate(platform) {
    const actionLink =
      platform.link ||
      `#${platform.id}`;

    const actionLabel =
      platform.actionLabel ||
      "查看平台能力";

    const displayTitle =
      platform.title.replace(
        "（BETA）",
        " (BETA)"
      );

    const capabilityEnglish = {
      "AI 模特生成":
        "AI Model Generation",

      "服装上身融合":
        "Clothing Fusion",

      "商品视觉扩展":
        "Product Visual Expansion",

      "营销素材生产":
        "Production of Marketing Materials",

      "需求预测":
        "Demand Forecasting",

      "库存优化":
        "Inventory Optimization",

      "订单与交付协同":
        "Order & Delivery Collaboration",

      "供应链可视化":
        "Supply Chain Visualization",

      "移动机器人调度":
        "Mobile Robot Scheduling",

      "仓储与物料搬运":
        "Warehousing & Material Handling",

      "协作机器人应用":
        "Collaborative Robot Applications",

      "远程运维管理":
        "Remote Operation & Maintenance",

      "门店经营分析":
        "Store Operations Analysis",

      "智能客流洞察":
        "Intelligent Customer Flow Insights",

      "会员与私域运营":
        "Membership & Private Domain Operations",

      "全渠道零售支持":
        "Omnichannel Retail Support"
    };

    const capabilityCards =
      platform.features
        .map((feature, index) => {
          const title = feature[0];
          const description = feature[1];

          const english =
            capabilityEnglish[title] || "";

          const card = `
            <article
              class="v2-capability-card"
            >

              <div
                class="v2-capability-visual"
                aria-hidden="true"
              >

                <div
                  class="v2-capability-overlay"
                >

                  <h4>
                    ${title}
                  </h4>

                  ${
                    english
                      ? `
                        <span
                          class="v2-capability-en"
                        >
                          ${english}
                        </span>
                      `
                      : ""
                  }

                </div>

              </div>


              <div
                class="v2-capability-copy"
              >

                <p>
                  ${description}
                </p>

              </div>

            </article>
          `;

          if (
            index ===
            platform.features.length - 1
          ) {
            return card;
          }

          return `
            ${card}

            <div
              class="v2-capability-arrow"
              aria-hidden="true"
            ></div>
          `;
        })
        .join("");

    return `
      <article
        class="
          v2-platform-block
          v2-platform-${platform.id}
        "
        id="${platform.id}"
      >

        <!-- =================================
             Main platform card
             ================================= -->

        <div
          class="v2-platform-featured"
        >

          <!--
            左侧主视觉区域。

            设计中心图片后续直接作为
            background-image 放这里。
          -->
          <div
            class="v2-platform-visual"
          >

            <div
              class="v2-platform-visual-overlay"
            >

              <span
                class="v2-platform-eyebrow"
              >
                ${platform.subtitle}
              </span>

              <h3>
                ${displayTitle}
              </h3>

            </div>

          </div>


          <!-- 右侧说明 -->

          <div
            class="v2-platform-copy"
          >

            <p
              class="v2-platform-description"
            >
              ${platform.description || ""}
            </p>


            <div
              class="v2-platform-actions"
            >

              <a
                class="v2-platform-primary"
                href="${actionLink}"
              >
                ${actionLabel}
              </a>


              <span
                class="v2-platform-secondary"
              >
                ${platform.badge}
              </span>

            </div>

          </div>

        </div>


        <!-- =================================
             Capability flow
             ================================= -->

        <div
          class="v2-capability-flow"
        >
          ${capabilityCards}
        </div>

      </article>
    `;
  }
}