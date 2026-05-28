export const platformModel = {
  navItems: [
    { label: "首页", href: "#" },
    { label: "管理员仪表盘", href: "/dashboard" },
    { label: "账号管理", href: "/account-management" },
    { label: "核心平台", href: "#platforms" },
    { label: "CL-AIGC", href: "#cl-aigc" },
    { label: "CL-SCM", href: "#cl-scm" },
    { label: "CL-iRobot", href: "#cl-irobot" },
    { label: "CL-iShop", href: "#cl-ishop" },
    { label: "生态合作", href: "#ecosystem" }
  ],
  platforms: [
    {
      id: "cl-aigc",
      title: "CL-AIGC",
      link: "https://yibaiaigc.com/dashboard",
      subtitle: "时尚生成式AI · 品牌视觉引擎",
      badge: "鞋服专属模型",
      icon: "fas fa-tshirt",
      badgeIcon: "fas fa-magic",
      features: [
        ["AI 模特生成", "多肤色/体型/年龄，一键生成高质感模特图", "fas fa-user-astronaut"],
        ["服装上身融合", "平面衣服图 → 自然穿着效果，保留面料细节", "fas fa-vest"],
        ["场景智能扩展", "街拍/影棚/户外等风格，匹配品牌调性", "fas fa-image"],
        ["多角度生成", "正面/侧面/背面/细节特写，满足电商展示", "fas fa-camera-retro"],
        ["A/B 测试素材", "批量生成不同风格，智能筛选高点击率方案", "fas fa-chart-line"],
        ["品牌风格一致性", "学习品牌色/Logo/调性，统一输出视觉", "fas fa-palette"]
      ]
    },
    {
      id: "cl-scm",
      title: "CL-SCM",
      subtitle: "端到端智能供应链",
      badge: "韧性·可视·低碳",
      icon: "fas fa-network-wired",
      badgeIcon: "fas fa-globe",
      features: [
        ["需求预测大脑", "多维度时序预测准确率≥95%", "fas fa-chart-simple"],
        ["智能补货/调度", "动态库存优化与路径规划", "fas fa-truck-fast"],
        ["供应链控制塔", "端到端全链路实时可视化", "fas fa-eye"],
        ["碳足迹追踪", "Scope3碳排放智能核算", "fas fa-leaf"],
        ["供应商风险管理", "舆情/财务/ESG多维评估", "fas fa-handshake"],
        ["自动化订单履约", "RPA+AI 订单异常处理", "fas fa-robot"]
      ]
    },
    {
      id: "cl-irobot",
      title: "CL-iRobot",
      subtitle: "自主移动与协作机器人",
      badge: "柔性制造·无人化",
      icon: "fas fa-robot",
      badgeIcon: "fas fa-microchip",
      features: [
        ["SLAM导航系统", "动态场景高精度定位/避障", "fas fa-map-marked-alt"],
        ["协作机器人套件", "拖拽示教+力控装配", "fas fa-hand-peace"],
        ["智能仓储机器人", "AMR集群调度系统", "fas fa-warehouse"],
        ["自主充电/续航", "多机器人能源管理策略", "fas fa-charging-station"],
        ["机器人即服务(RaaS)", "按需租赁/远程运维", "fas fa-industry"],
        ["数字孪生调试", "虚实融合机器人编程", "fas fa-chalkboard"]
      ]
    },
    {
      id: "cl-ishop",
      title: "CL-iShop",
      subtitle: "数智化零售与体验",
      badge: "全渠道·精准营销",
      icon: "fas fa-store",
      badgeIcon: "fas fa-chart-line",
      features: [
        ["智能客流分析", "ReID热力图/动线优化", "fas fa-user-tag"],
        ["AI无感结算", "视觉识别+RFID快速收银", "fas fa-cart-shopping"],
        ["全域会员中台", "私域运营与智能推荐引擎", "fas fa-mobile-alt"],
        ["虚拟试穿/AR导航", "沉浸式购物体验", "fas fa-vr-cardboard"],
        ["门店库存智能盘点", "机器视觉+无人机协同", "fas fa-boxes"],
        ["店长数字驾驶舱", "实时经营指标与决策建议", "fas fa-chart-pie"]
      ]
    }
  ],
  insights: [
    ["CL-AIGC 时尚行业", "国内知名运动品牌利用AI模特生成技术，广告素材制作成本降低70%，上新月均款式增加3倍。", "fas fa-tshirt"],
    ["CL-SCM 韧性实践", "国际快消品牌部署供应链控制塔，库存周转率提升22%，缺货风险下降34%。", "fas fa-chart-line"],
    ["CL-iRobot 柔性升级", "3C电子工厂引入AMR集群，物料配送效率提升45%，人力成本降低30%。", "fas fa-robot"],
    ["CL-iShop 新零售标杆", "全国连锁便利店部署AI视觉盘点与会员中台，复购率提升18%。", "fas fa-store"]
  ]
};
