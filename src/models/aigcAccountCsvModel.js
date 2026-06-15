const path = require("path");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { readCsv, writeCsv } = require("../utils/csvStore");

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(__dirname, "../../data");

const MASTER_FILE = path.join(DATA_DIR, "aigc_master_accounts.secure.csv");
const SUB_FILE = path.join(DATA_DIR, "aigc_sub_accounts.secure.csv");
const MAPPING_FILE = path.join(DATA_DIR, "account_mappings.secure.csv");
const WORK_FILE = path.join(DATA_DIR, "creative_works.secure.csv");
const PURCHASE_FILE = path.join(DATA_DIR, "token_purchases.secure.csv");

console.log("[HARSON] DATA_DIR =", DATA_DIR);
console.log("[HARSON] MASTER_FILE =", MASTER_FILE);
console.log("[HARSON] SUB_FILE =", SUB_FILE);
console.log("[HARSON] MAPPING_FILE =", MAPPING_FILE);
console.log("[HARSON] WORK_FILE =", WORK_FILE);
console.log("[HARSON] PURCHASE_FILE =", PURCHASE_FILE);

const MASTER_HEADERS = [
  "id",
  "enterpriseName",
  "platformName",
  "platformLogin",
  "platformPasswordHash",
  "totalCredits",
  "usedCredits",
  "status",
  "createdAt",
  "updatedAt"
];

const SUB_HEADERS = [
  "id",
  "masterAccountId",
  "subAccountName",
  "platformLogin",
  "platformPasswordHash",
  "tokenLimit",
  "warningThreshold",
  "status",
  "createdAt",
  "updatedAt"
];

const MAPPING_HEADERS = [
  "id",
  "clBaseUserId",
  "clBaseEmail",
  "aigcSubAccountId",
  "masterAccountId",
  "mappingStatus",
  "createdAt",
  "updatedAt"
];

const WORK_HEADERS = [
  "id",
  "clBaseUserId",
  "aigcSubAccountId",
  "title",
  "workType",
  "promptSummary",
  "creditCost",
  "createdAt"
];

const PURCHASE_HEADERS = [
  "id",
  "masterAccountId",
  "packageName",
  "tokens",
  "amount",
  "paymentStatus",
  "createdAt"
];

function now() {
  return new Date().toISOString();
}

function readMasters() {
  return readCsv(MASTER_FILE, MASTER_HEADERS);
}

function writeMasters(rows) {
  writeCsv(MASTER_FILE, rows, MASTER_HEADERS);
}

function readSubs() {
  return readCsv(SUB_FILE, SUB_HEADERS);
}

function writeSubs(rows) {
  writeCsv(SUB_FILE, rows, SUB_HEADERS);
}

function readMappings() {
  return readCsv(MAPPING_FILE, MAPPING_HEADERS);
}

function writeMappings(rows) {
  writeCsv(MAPPING_FILE, rows, MAPPING_HEADERS);
}

function readWorks() {
  return readCsv(WORK_FILE, WORK_HEADERS);
}

function writeWorks(rows) {
  writeCsv(WORK_FILE, rows, WORK_HEADERS);
}

function readPurchases() {
  return readCsv(PURCHASE_FILE, PURCHASE_HEADERS);
}

function writePurchases(rows) {
  writeCsv(PURCHASE_FILE, rows, PURCHASE_HEADERS);
}

function withoutPassword(row) {
  const clone = { ...row };
  delete clone.platformPasswordHash;
  return clone;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function calculateSubTokenUsage(sub, works) {
  const tokenLimit = toNumber(sub.tokenLimit, 0);

  /*
   * New business logic:
   * warningThreshold now means remaining-token percentage threshold.
   * Example:
   * warningThreshold = 10 means warning when remaining token percentage <= 10%.
   */
  const warningThreshold = toNumber(sub.warningThreshold, 10);

  const usedTokens = works
    .filter(work => work.aigcSubAccountId === sub.id)
    .reduce((sum, work) => sum + toNumber(work.creditCost, 0), 0);

  const remainingTokens = Math.max(tokenLimit - usedTokens, 0);
  const usageRate = tokenLimit > 0 ? Math.round((usedTokens / tokenLimit) * 100) : 0;
  const remainingRate = tokenLimit > 0 ? Math.round((remainingTokens / tokenLimit) * 100) : 100;

  let warningStatus = "normal";

  if (tokenLimit > 0 && usedTokens >= tokenLimit) {
    warningStatus = "exceeded";
  } else if (tokenLimit > 0 && remainingRate <= warningThreshold) {
    warningStatus = "warning";
  }

  return {
    tokenLimit,
    warningThreshold,
    usedTokens,
    remainingTokens,
    usageRate,
    remainingRate,
    warningStatus
  };
}

function enrichSubAccount(sub, works = readWorks()) {
  if (!sub) return null;

  return {
    ...withoutPassword(sub),
    ...calculateSubTokenUsage(sub, works)
  };
}

function getAllocatedTokensForMaster(subs, masterAccountId, excludedSubAccountId = null) {
  return subs
    .filter(sub => sub.masterAccountId === masterAccountId)
    .filter(sub => !excludedSubAccountId || sub.id !== excludedSubAccountId)
    .reduce((sum, sub) => sum + toNumber(sub.tokenLimit, 0), 0);
}

function validateMasterTokenCapacity({ master, subs, newTokenLimit, excludedSubAccountId = null }) {
  const masterTotalCredits = toNumber(master.totalCredits, 0);

  const alreadyAllocatedTokens = getAllocatedTokensForMaster(
    subs,
    master.id,
    excludedSubAccountId
  );

  const nextAllocatedTokens = alreadyAllocatedTokens + newTokenLimit;

  if (nextAllocatedTokens > masterTotalCredits) {
    const availableTokens = Math.max(masterTotalCredits - alreadyAllocatedTokens, 0);

    throw new Error(
      `Token 配额分配失败，当前主账号总点数为 ${masterTotalCredits}，其他子账号已分配 ${alreadyAllocatedTokens}，本次最多只能再分配 ${availableTokens} tokens，请重新调整子账号 token 配额`
    );
  }
}

async function createMaster({ enterpriseName, platformName, platformLogin, platformPassword, totalCredits }) {
  const masters = readMasters();

  if (masters.some(item => item.platformLogin.toLowerCase() === String(platformLogin).toLowerCase())) {
    throw new Error("该 AIGC 主账号登录邮箱已存在");
  }

  const record = {
    id: nanoid(16),
    enterpriseName,
    platformName,
    platformLogin: String(platformLogin).toLowerCase(),
    platformPasswordHash: await bcrypt.hash(platformPassword, 12),
    totalCredits: String(Number(totalCredits || 0)),
    usedCredits: "0",
    status: "active",
    createdAt: now(),
    updatedAt: now()
  };

  masters.push(record);
  writeMasters(masters);
  return withoutPassword(record);
}

async function createSubAccount({
  masterAccountId,
  subAccountName,
  platformLogin,
  platformPassword,
  tokenLimit,
  warningThreshold
}) {
  const masters = readMasters();
  const master = masters.find(item => item.id === masterAccountId && item.status === "active");

  if (!master) {
    throw new Error("未找到可用的 AIGC 企业主账号");
  }

  const numericTokenLimit = toNumber(tokenLimit, 0);
  const numericWarningThreshold = toNumber(warningThreshold, 10);

  if (numericTokenLimit < 0) {
    throw new Error("token 配额不能为负数");
  }

  if (numericWarningThreshold <= 0 || numericWarningThreshold > 100) {
    throw new Error("剩余预警阈值必须在 1 到 100 之间");
  }

  const subs = readSubs();

  validateMasterTokenCapacity({
    master,
    subs,
    newTokenLimit: numericTokenLimit
  });

  if (subs.some(item => item.platformLogin.toLowerCase() === String(platformLogin).toLowerCase())) {
    throw new Error("该 AIGC 子账号登录邮箱已存在");
  }

  const record = {
    id: nanoid(16),
    masterAccountId,
    subAccountName,
    platformLogin: String(platformLogin).toLowerCase(),
    platformPasswordHash: await bcrypt.hash(platformPassword, 12),
    tokenLimit: String(numericTokenLimit),
    warningThreshold: String(numericWarningThreshold),
    status: "active",
    createdAt: now(),
    updatedAt: now()
  };

  subs.push(record);
  writeSubs(subs);

  return enrichSubAccount(record, readWorks());
}

function updateSubAccountTokenSettings({ subAccountId, tokenLimit, warningThreshold }) {
  const subs = readSubs();
  const sub = subs.find(item => item.id === subAccountId);

  if (!sub) {
    throw new Error("未找到对应的 AIGC 子账号");
  }

  const masters = readMasters();
  const master = masters.find(item => item.id === sub.masterAccountId);

  if (!master) {
    throw new Error("未找到对应的 AIGC 主账号");
  }

  const works = readWorks();
  const currentSubUsage = calculateSubTokenUsage(sub, works);

  const numericTokenLimit = toNumber(tokenLimit, 0);
  const numericWarningThreshold = toNumber(warningThreshold, 10);

  if (numericTokenLimit < 0) {
    throw new Error("token 配额不能为负数");
  }

  if (numericWarningThreshold <= 0 || numericWarningThreshold > 100) {
    throw new Error("剩余预警阈值必须在 1 到 100 之间");
  }

  if (numericTokenLimit < currentSubUsage.usedTokens) {
    throw new Error(
      `Token 配额调整失败，当前子账号已使用 ${currentSubUsage.usedTokens} tokens，新配额不能低于已使用 token 数，请设置为 ${currentSubUsage.usedTokens} 或更高`
    );
  }

  validateMasterTokenCapacity({
    master,
    subs,
    newTokenLimit: numericTokenLimit,
    excludedSubAccountId: sub.id
  });

  sub.tokenLimit = String(numericTokenLimit);
  sub.warningThreshold = String(numericWarningThreshold);
  sub.updatedAt = now();

  writeSubs(subs);

  return enrichSubAccount(sub, works);
}

function createMapping({ clBaseUserId, clBaseEmail, aigcSubAccountId }) {
  const subs = readSubs();
  const sub = subs.find(item => item.id === aigcSubAccountId && item.status === "active");

  if (!sub) {
    throw new Error("未找到可用的 AIGC 子账号");
  }

  const mappings = readMappings();

  if (mappings.some(item => item.clBaseUserId === clBaseUserId && item.mappingStatus === "active")) {
    throw new Error("该 CL-Base 账号已经绑定了一个 AIGC 子账号");
  }

  if (mappings.some(item => item.aigcSubAccountId === aigcSubAccountId && item.mappingStatus === "active")) {
    throw new Error("该 AIGC 子账号已经绑定到其他 CL-Base 账号");
  }

  const record = {
    id: nanoid(16),
    clBaseUserId,
    clBaseEmail: String(clBaseEmail).toLowerCase(),
    aigcSubAccountId,
    masterAccountId: sub.masterAccountId,
    mappingStatus: "active",
    createdAt: now(),
    updatedAt: now()
  };

  mappings.push(record);
  writeMappings(mappings);
  return record;
}

function listAdminData() {
  const masters = readMasters().map(withoutPassword);
  const works = readWorks();
  const subs = readSubs().map(sub => enrichSubAccount(sub, works));
  const mappings = readMappings();

  return {
    masters,
    subs,
    mappings,
    works,
    creditSummary: buildCreditSummary(masters, works)
  };
}

function listAigcCenterData() {
  const masters = readMasters().map(withoutPassword);
  const works = readWorks();
  const subs = readSubs().map(sub => enrichSubAccount(sub, works));
  const purchases = readPurchases();

  return {
    masters,
    subs,
    purchases,
    creditSummary: buildCreditSummary(masters, works)
  };
}

function buildCreditSummary(masters, works) {
  const mappings = readMappings();

  return masters.map(master => {
    const masterWorks = works.filter(work => {
      const mapping = mappings.find(item => item.aigcSubAccountId === work.aigcSubAccountId);
      return mapping && mapping.masterAccountId === master.id;
    });

    const usedFromWorks = masterWorks.reduce((sum, work) => sum + Number(work.creditCost || 0), 0);
    const totalCredits = Number(master.totalCredits || 0);

    return {
      masterAccountId: master.id,
      enterpriseName: master.enterpriseName,
      totalCredits,
      usedCredits: usedFromWorks,
      remainingCredits: Math.max(totalCredits - usedFromWorks, 0)
    };
  });
}

function purchaseTokens({ masterAccountId, packageName, tokens, amount }) {
  const masters = readMasters();
  const master = masters.find(item => item.id === masterAccountId && item.status === "active");

  if (!master) {
    throw new Error("未找到可用的 AIGC 企业主账号");
  }

  const numericTokens = toNumber(tokens, 0);
  const numericAmount = toNumber(amount, 0);

  if (numericTokens <= 0) {
    throw new Error("请选择有效的 token 套餐");
  }

  if (numericAmount < 0) {
    throw new Error("套餐金额不能为负数");
  }

  const currentTotalCredits = toNumber(master.totalCredits, 0);
  master.totalCredits = String(currentTotalCredits + numericTokens);
  master.updatedAt = now();

  writeMasters(masters);

  const purchases = readPurchases();

  const record = {
    id: nanoid(16),
    masterAccountId,
    packageName,
    tokens: String(numericTokens),
    amount: String(numericAmount),
    paymentStatus: "paid",
    createdAt: now()
  };

  purchases.push(record);
  writePurchases(purchases);

  return {
    purchase: record,
    master: withoutPassword(master)
  };
}

function getMyMapping(clBaseUserId) {
  const mapping = readMappings().find(
    item => item.clBaseUserId === clBaseUserId && item.mappingStatus === "active"
  );

  if (!mapping) return null;

  const works = readWorks();
  const sub = readSubs().find(item => item.id === mapping.aigcSubAccountId);
  const master = readMasters().find(item => item.id === mapping.masterAccountId);

  return {
    mapping,
    aigcSubAccount: sub ? enrichSubAccount(sub, works) : null,
    masterAccount: master ? withoutPassword(master) : null
  };
}

function listMyWorks(clBaseUserId) {
  return readWorks().filter(item => item.clBaseUserId === clBaseUserId);
}

function addMyWork({ clBaseUserId, title, workType, promptSummary, creditCost }) {
  const mapping = getMyMapping(clBaseUserId);

  if (!mapping || !mapping.aigcSubAccount) {
    throw new Error("当前 CL-Base 账号尚未绑定可用的 AIGC 子账号");
  }

  const tokenCost = toNumber(creditCost, 0);

  if (tokenCost < 0) {
    throw new Error("消耗 token 不能为负数");
  }

  const subAccount = mapping.aigcSubAccount;
  const tokenLimit = toNumber(subAccount.tokenLimit, 0);
  const currentUsedTokens = toNumber(subAccount.usedTokens, 0);
  const nextUsedTokens = currentUsedTokens + tokenCost;

  if (tokenLimit > 0 && nextUsedTokens > tokenLimit) {
    const remainingTokens = Math.max(tokenLimit - currentUsedTokens, 0);

    throw new Error(
      `本次创作需要 ${tokenCost} tokens，但当前 AIGC 子账号仅剩 ${remainingTokens} tokens，已超出 token 配额，无法生成，请联系管理员增加配额`
    );
  }

  const works = readWorks();

  const record = {
    id: nanoid(16),
    clBaseUserId,
    aigcSubAccountId: subAccount.id,
    title,
    workType,
    promptSummary,
    creditCost: String(tokenCost),
    createdAt: now()
  };

  works.push(record);
  writeWorks(works);

  const updatedSubAccount = enrichSubAccount(
    readSubs().find(item => item.id === subAccount.id),
    works
  );

  return {
    work: record,
    tokenUsage: {
      tokenLimit: updatedSubAccount.tokenLimit,
      usedTokens: updatedSubAccount.usedTokens,
      remainingTokens: updatedSubAccount.remainingTokens,
      usageRate: updatedSubAccount.usageRate,
      remainingRate: updatedSubAccount.remainingRate,
      warningThreshold: updatedSubAccount.warningThreshold,
      warningStatus: updatedSubAccount.warningStatus
    }
  };
}

module.exports = {
  createMaster,
  createSubAccount,
  updateSubAccountTokenSettings,
  createMapping,
  listAdminData,
  listAigcCenterData,
  purchaseTokens,
  getMyMapping,
  listMyWorks,
  addMyWork
};