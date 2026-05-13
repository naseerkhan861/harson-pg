import { platformModel } from "../models/platformModel.js";

export class HomeViewModel {
  constructor() {
    this.state = platformModel;
  }

  getNavItems() {
    return this.state.navItems;
  }

  getPlatforms() {
    return this.state.platforms;
  }

  getInsights() {
    return this.state.insights;
  }

  getFeatureMessage(featureName) {
    return `「${featureName}」详细能力即将开放体验，可预约辰瓴技术顾问获取鞋服行业成功案例。`;
  }

  getContactMessage() {
    return "辰瓴专家团队联系方式：400-882-6688 或 官网留言，我们将为您提供专属鞋服AI视觉方案咨询。";
  }
}
