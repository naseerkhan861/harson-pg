const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { readCsv, writeCsv } = require("../utils/csvStore");

const MASTER_FILE = process.env.CSV_AIGC_MASTER_FILE || "./data/aigc_master_accounts.secure.csv";
const SUB_FILE = process.env.CSV_AIGC_SUB_FILE || "./data/aigc_sub_accounts.secure.csv";
const MAPPING_FILE = process.env.CSV_ACCOUNT_MAPPING_FILE || "./data/account_mappings.secure.csv";
const WORK_FILE = process.env.CSV_CREATIVE_WORK_FILE || "./data/creative_works.secure.csv";

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

function withoutPassword(row) {
  const clone = { ...row };
  delete clone.platformPasswordHash;
  return clone;
}

async function createMaster({ enterpriseName, platformName, platformLogin, platformPassword, totalCredits }) {
  const masters = readMasters();

  if (masters.some(item => item.platformLogin.toLowerCase() === String(platformLogin).toLowerCase())) {
    throw new Error("This AIGC master login already exists.");
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

async function createSubAccount({ masterAccountId, subAccountName, platformLogin, platformPassword }) {
  const masters = readMasters();
  const master = masters.find(item => item.id === masterAccountId && item.status === "active");

  if (!master) {
    throw new Error("Active enterprise master account was not found.");
  }

  const subs = readSubs();

  if (subs.some(item => item.platformLogin.toLowerCase() === String(platformLogin).toLowerCase())) {
    throw new Error("This AIGC sub-account login already exists.");
  }

  const record = {
    id: nanoid(16),
    masterAccountId,
    subAccountName,
    platformLogin: String(platformLogin).toLowerCase(),
    platformPasswordHash: await bcrypt.hash(platformPassword, 12),
    status: "active",
    createdAt: now(),
    updatedAt: now()
  };

  subs.push(record);
  writeSubs(subs);
  return withoutPassword(record);
}

function createMapping({ clBaseUserId, clBaseEmail, aigcSubAccountId }) {
  const subs = readSubs();
  const sub = subs.find(item => item.id === aigcSubAccountId && item.status === "active");

  if (!sub) {
    throw new Error("Active AIGC sub-account was not found.");
  }

  const mappings = readMappings();

  if (mappings.some(item => item.clBaseUserId === clBaseUserId && item.mappingStatus === "active")) {
    throw new Error("This CL-Base account already has an active AIGC mapping.");
  }

  if (mappings.some(item => item.aigcSubAccountId === aigcSubAccountId && item.mappingStatus === "active")) {
    throw new Error("This AIGC sub-account is already mapped to another CL-Base account.");
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
  const subs = readSubs().map(withoutPassword);
  const mappings = readMappings();
  const works = readWorks();

  return {
    masters,
    subs,
    mappings,
    works,
    creditSummary: buildCreditSummary(masters, works)
  };
}

function buildCreditSummary(masters, works) {
  return masters.map(master => {
    const masterWorks = works.filter(work => {
      const mapping = readMappings().find(item => item.aigcSubAccountId === work.aigcSubAccountId);
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

function getMyMapping(clBaseUserId) {
  const mapping = readMappings().find(
    item => item.clBaseUserId === clBaseUserId && item.mappingStatus === "active"
  );

  if (!mapping) return null;

  const sub = readSubs().find(item => item.id === mapping.aigcSubAccountId);
  const master = readMasters().find(item => item.id === mapping.masterAccountId);

  return {
    mapping,
    aigcSubAccount: sub ? withoutPassword(sub) : null,
    masterAccount: master ? withoutPassword(master) : null
  };
}

function listMyWorks(clBaseUserId) {
  return readWorks().filter(item => item.clBaseUserId === clBaseUserId);
}

function addMyWork({ clBaseUserId, title, workType, promptSummary, creditCost }) {
  const mapping = getMyMapping(clBaseUserId);

  if (!mapping || !mapping.aigcSubAccount) {
    throw new Error("No active AIGC sub-account mapping exists for this CL-Base user.");
  }

  const works = readWorks();

  const record = {
    id: nanoid(16),
    clBaseUserId,
    aigcSubAccountId: mapping.aigcSubAccount.id,
    title,
    workType,
    promptSummary,
    creditCost: String(Number(creditCost || 0)),
    createdAt: now()
  };

  works.push(record);
  writeWorks(works);
  return record;
}

module.exports = {
  createMaster,
  createSubAccount,
  createMapping,
  listAdminData,
  getMyMapping,
  listMyWorks,
  addMyWork
};
