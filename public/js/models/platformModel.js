export const platformModel = {
  navItems: [
    { label: "首页", href: "#" },
    { label: "仪表盘", href: "/dashboard" },
    { label: "账号管理", href: "/account-management" },
    { label: "核心平台", href: "#platforms" },
    { label: "CL-AIGC（BETA）", href: "#cl-aigc" },
    { label: "CL-3DLab", href: "#cl-3dlab" },
    { label: "CL-iRobot", href: "#cl-irobot" },
    { label: "CL-iStore", href: "#cl-istore" },
    { label: "生态合作", href: "#ecosystem" }
  ],

  platforms: [
    {
      id: "cl-aigc",
      title: "CL-AIGC（BETA）",
      link: "/aigc-workspace",
      subtitle: "时尚生成式 AI · 品牌视觉引擎",
      description: "面向鞋服品牌、电商团队与营销部门，支持快速生成模特图、商品图和广告素材，降低视觉内容制作成本。",
      badge: "内容生成",
      actionLabel: "进入 AIGC 平台",
      icon: "fas fa-tshirt",
      badgeIcon: "fas fa-magic",
      features: [
        [
          "AI 模特生成",
          "基于服装款式快速生成不同风格、姿态与人群特征的模特图。",
          "fas fa-user"
        ],
        [
          "服装上身融合",
          "将平面服装图转化为自然穿着效果，保留版型、面料与细节表现。",
          "fas fa-tshirt"
        ],
        [
          "商品视觉扩展",
          "生成街拍、影棚、户外等多场景视觉素材，适配品牌传播需求。",
          "fas fa-image"
        ],
        [
          "营销素材生产",
          "批量输出电商主图、社媒图和广告素材，提高内容生产效率。",
          "fas fa-bullhorn"
        ]
      ]
    },

    {
      id: "cl-3dlab",
      title: "CL-3DLab",
      subtitle: "三维设计与增材制造",
      description: "面向产品设计、研发打样与个性化制造场景，融合三维建模、模型处理与3D打印技术，实现从数字设计到实体产品的快速转化，提升产品开发效率与创新能力。",
      badge: "数字制造",
      actionLabel: "查看3D能力",
      icon: "fas fa-network-wired",
      badgeIcon: "fas fa-globe",
      features: [
        [
          "3D模型设计",
          "根据产品需求进行三维建模与结构设计，将创意构想转化为可编辑的数字模型。",
          "fas fa-chart-line"
        ],
        [
          "模型切片优化",
          "对三维模型进行切片处理与打印参数配置，优化打印精度、材料使用及成型效果。",
          "fas fa-boxes"
        ],
        [
          "3D打印成型",
          "通过增材制造技术将数字模型转化为实体产品，支持快速原型制作与个性化打样。",
          "fas fa-truck"
        ],
        [
          "成品后处理",
          "对打印成品进行支撑去除、表面处理与质量检查，提升产品外观及使用性能。",
          "fas fa-eye"
        ]
      ]
    },

    {
      id: "cl-irobot",
      title: "CL-iRobot",
      subtitle: "自主移动与协作机器人",
      description: "面向工厂、仓库和门店现场作业，支持机器人调度、物料搬运和重复性任务自动化执行。",
      badge: "自动化执行",
      actionLabel: "查看机器人能力",
      link: "/cl-irobot.html",
      icon: "fas fa-robot",
      badgeIcon: "fas fa-microchip",
      features: [
        [
          "移动机器人调度",
          "支持 AMR 任务分配、路径规划与多机器人协同运行。",
          "fas fa-route"
        ],
        [
          "仓储与物料搬运",
          "用于仓库、工厂和门店场景的物料配送与搬运自动化。",
          "fas fa-warehouse"
        ],
        [
          "协作机器人应用",
          "支持装配、分拣、检测等重复性任务，提升现场执行效率。",
          "fas fa-hands-helping"
        ],
        [
          "远程运维管理",
          "监控机器人状态、任务进度和异常信息，降低运维复杂度。",
          "fas fa-tools"
        ]
      ]
    },

    {
      id: "cl-istore",
      title: "CL-iStore",
      subtitle: "数智化零售与体验",
      description: "面向连锁门店、品牌零售和线上线下一体化运营，支持门店分析、会员运营与全渠道转化提升。",
      badge: "智慧零售",
      actionLabel: "查看零售能力",
      link: "/cl-istore.html",
      icon: "fas fa-store",
      badgeIcon: "fas fa-chart-line",
      features: [
        [
          "门店经营分析",
          "整合客流、销售、库存与会员数据，形成门店经营视图。",
          "fas fa-chart-pie"
        ],
        [
          "智能客流洞察",
          "通过热力图、动线分析和顾客行为识别优化门店运营。",
          "fas fa-users"
        ],
        [
          "会员与私域运营",
          "支持会员分层、精准推荐和复购运营，增强消费者连接。",
          "fas fa-mobile-alt"
        ],
        [
          "全渠道零售支持",
          "连接线上商城、线下门店和营销活动，提升零售转化效率。",
          "fas fa-shopping-cart"
        ]
      ]
    },
    
  ],

  insights: [
    [
      "设计与内容生产",
      "围绕商品图、模特图、广告图和社媒素材，帮助品牌提升内容生产速度与视觉一致性。",
      "fas fa-pen-nib"
    ],
    [
      "生产与供应协同",
      "连接需求、库存、生产和交付信息，减少部门之间的信息断层和协同成本。",
      "fas fa-network-wired"
    ],
    [
      "自动化运营执行",
      "通过机器人和自动化系统处理重复性任务，提升仓储、工厂和门店场景的执行效率。",
      "fas fa-robot"
    ],
    [
      "零售与消费者触达",
      "支持门店运营、会员管理、线上渠道和精准营销，帮助企业提升消费者转化与复购。",
      "fas fa-store"
    ]
  ]
};