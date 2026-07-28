"use strict";

const TOKEN_BALANCE_STORAGE_KEY =
  "clBaseTokenBalance";

const elements = {
  balance:
    document.getElementById(
      "currentTokenBalance"
    ),

  packageButtons:
    document.querySelectorAll(
      ".package-card"
    ),

  selectedToken:
    document.getElementById(
      "selectedToken"
    ),

  selectedPrice:
    document.getElementById(
      "selectedPrice"
    ),

  agreementCheckbox:
    document.getElementById(
      "agreementCheckbox"
    ),

  paymentButton:
    document.getElementById(
      "testPaymentButton"
    )
};

function formatNumber(value) {
  return new Intl.NumberFormat(
    "zh-CN"
  ).format(value);
}

function restoreBalance() {
  try {
    const savedBalance =
      localStorage.getItem(
        TOKEN_BALANCE_STORAGE_KEY
      );

    if (savedBalance === null) {
      elements.balance.textContent = "--";
      return;
    }

    const numericBalance =
      Number(savedBalance);

    if (!Number.isFinite(numericBalance)) {
      elements.balance.textContent = "--";
      return;
    }

    elements.balance.textContent =
      formatNumber(numericBalance);
  } catch {
    elements.balance.textContent = "--";
  }
}

function selectPackage(button) {
  elements.packageButtons.forEach(item => {
    item.classList.remove("selected");
  });

  button.classList.add("selected");

  const token =
    Number(button.dataset.token);

  const price =
    Number(button.dataset.price);

  if (
    !Number.isFinite(token) ||
    !Number.isFinite(price)
  ) {
    return;
  }

  elements.selectedToken.textContent =
    `${formatNumber(token)} Token`;

  elements.selectedPrice.textContent =
    `¥${formatNumber(price)}`;
}

function handlePackageClick(event) {
  const button =
    event.currentTarget;

  selectPackage(button);
}

function handlePaymentClick() {
  if (!elements.agreementCheckbox.checked) {
    window.alert(
      "请先阅读并同意相关服务协议。"
    );

    return;
  }

  const selectedPackage =
    document.querySelector(
      ".package-card.selected"
    );

  if (!selectedPackage) {
    window.alert("请先选择购买套餐。");
    return;
  }

  window.alert(
    "当前尚未接入真实支付和 Token 充值接口。"
  );
}

elements.packageButtons.forEach(button => {
  button.addEventListener(
    "click",
    handlePackageClick
  );
});

elements.paymentButton.addEventListener(
  "click",
  handlePaymentClick
);

restoreBalance();