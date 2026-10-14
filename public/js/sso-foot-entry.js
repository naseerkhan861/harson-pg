/**
 * HARSON → HarsonFOOT（3D 足型测量平台）SSO 免登录跳转绑定
 *
 * 用法：给任意可点击元素挂上
 *   data-sso-url="/api/sso/foot-entry"
 *   data-sso-external="https://harson-base-health.com"   （可选，兜底地址）
 *
 * 点击后请求同源接口 /api/sso/foot-entry：
 *   - 已登录：接口返回带签名的免登录跳转 URL → 整页跳转目标平台
 *   - 未登录：接口返回 401 → 跳转本系统登录页 /login
 *   - 接口异常 / 未配置：降级为直接打开目标平台官网
 *
 * 行为与首页 HomeV2View.bindSsoEntries 完全一致，可直接复用于静态页面。
 * 注意：服务端 CSP 为 script-src 'self'，因此本逻辑必须放在外部文件里，
 * 不能用内联 <script>。
 */
(function (global) {
  "use strict";

  function bindSsoEntries(root) {
    var scope = root || document;

    var ssoLinks = scope.querySelectorAll("[data-sso-url]");

    if (!ssoLinks.length) {
      return;
    }

    Array.prototype.forEach.call(ssoLinks, function (link) {
      // 避免重复绑定
      if (link.dataset.ssoBound === "1") {
        return;
      }

      link.dataset.ssoBound = "1";

      link.addEventListener("click", async function (event) {
        event.preventDefault();

        var ssoUrl = link.dataset.ssoUrl;

        var fallbackUrl =
          link.dataset.ssoExternal || link.getAttribute("href");

        var isValidAbsolute =
          typeof fallbackUrl === "string" &&
          /^https?:\/\//i.test(fallbackUrl);

        try {
          var response = await fetch(ssoUrl, {
            method: "GET",

            credentials: "include",

            headers: {
              Accept: "application/json"
            }
          });

          if (response.status === 401) {
            window.location.href = "/login";

            return;
          }

          var result = await response.json().catch(function () {
            return null;
          });

          if (response.ok && result && result.url) {
            window.location.href = result.url;

            return;
          }

          console.warn("SSO 跳转接口返回异常，降级为直接跳转", result);

          if (isValidAbsolute) {
            window.location.href = fallbackUrl;

            return;
          }

          alert(
            (result && result.message) ||
              "跳转失败，请稍后重试或直接登录目标系统。"
          );
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

  function autoBind() {
    bindSsoEntries(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoBind);
  } else {
    autoBind();
  }

  // 供动态渲染的视图（如 HomeV2View）在渲染完成后手动调用
  global.HarsonSso =
    global.HarsonSso || {};

  global.HarsonSso.bind = bindSsoEntries;
})(window);
