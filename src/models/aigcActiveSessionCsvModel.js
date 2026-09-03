const fs = require("fs");
const path = require("path");

const HEADERS = [
  "clBaseUserId",
  "aigcSubAccountId",
  "masterAccountId",
  "status",
  "loggedInAt",
  "lastActiveAt",
  "loggedOutAt"
];

const DATA_DIR =
  process.env.HARSON_DATA_DIR ||
  path.join(process.cwd(), "data");

const FILE_PATH = path.join(
  DATA_DIR,
  "aigc_active_sessions.secure.csv"
);

function now() {
  return new Date().toISOString();
}

function requireText(value, fieldName) {
  const normalized = String(
    value || ""
  ).trim();

  if (!normalized) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalized;
}

function escapeCsvValue(value) {
  const normalized = String(
    value ?? ""
  );

  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n") ||
    normalized.includes("\r")
  ) {
    return `"${normalized.replace(
      /"/g,
      '""'
    )}"`;
  }

  return normalized;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter =
        line[index + 1];

      if (
        insideQuotes &&
        nextCharacter === '"'
      ) {
        current += '"';
        index += 1;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);

  return values;
}

function ensureStore() {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true
    }
  );

  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(
      FILE_PATH,
      `${HEADERS.join(",")}\n`,
      "utf8"
    );
  }
}

function readRows() {
  ensureStore();

  const content = fs
    .readFileSync(
      FILE_PATH,
      "utf8"
    )
    .trim();

  if (!content) {
    return [];
  }

  const lines =
    content.split(/\r?\n/);

  if (lines.length <= 1) {
    return [];
  }

  const headers =
    parseCsvLine(lines[0]);

  return lines
    .slice(1)
    .filter(line =>
      line.trim()
    )
    .map(line => {
      const values =
        parseCsvLine(line);

      return headers.reduce(
        (
          record,
          header,
          index
        ) => {
          record[header] =
            values[index] || "";

          return record;
        },
        {}
      );
    });
}

function writeRows(rows) {
  ensureStore();

  const lines = [
    HEADERS.join(","),
    ...rows.map(row =>
      HEADERS
        .map(header =>
          escapeCsvValue(
            row[header]
          )
        )
        .join(",")
    )
  ];

  fs.writeFileSync(
    FILE_PATH,
    `${lines.join("\n")}\n`,
    "utf8"
  );
}

/**
 * 用户成功获得可用 YiBai token 后，
 * 将该用户标记为正在使用共享登录态。
 */
function markSessionActive({
  clBaseUserId,
  aigcSubAccountId,
  masterAccountId
}) {
  const normalizedUserId =
    requireText(
      clBaseUserId,
      "Harson-Base 用户 ID"
    );

  const normalizedSubAccountId =
    requireText(
      aigcSubAccountId,
      "AIGC 子账号 ID"
    );

  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "企业主账号 ID"
    );

  const rows = readRows();

  const currentTime = now();

  const existingIndex =
    rows.findIndex(
      row =>
        row.clBaseUserId ===
        normalizedUserId
    );

  const record = {
    clBaseUserId:
      normalizedUserId,

    aigcSubAccountId:
      normalizedSubAccountId,

    masterAccountId:
      normalizedMasterAccountId,

    status: "active",

    loggedInAt:
      existingIndex >= 0 &&
      rows[existingIndex]
        .loggedInAt
        ? rows[existingIndex]
            .loggedInAt
        : currentTime,

    lastActiveAt:
      currentTime,

    loggedOutAt: ""
  };

  if (existingIndex >= 0) {
    rows[existingIndex] =
      record;
  } else {
    rows.push(record);
  }

  writeRows(rows);

  return {
    ...record
  };
}

/**
 * 更新用户最后一次使用 AIGC 的时间。
 */
function touchSession(
  clBaseUserId
) {
  const normalizedUserId =
    requireText(
      clBaseUserId,
      "Harson-Base 用户 ID"
    );

  const rows = readRows();

  const index =
    rows.findIndex(
      row =>
        row.clBaseUserId ===
        normalizedUserId &&
        row.status ===
          "active"
    );

  if (index < 0) {
    return null;
  }

  rows[index] = {
    ...rows[index],
    lastActiveAt: now()
  };

  writeRows(rows);

  return {
    ...rows[index]
  };
}

/**
 * 将指定 Harson-Base 用户标记为已注销。
 */
function markSessionLoggedOut(
  clBaseUserId
) {
  const normalizedUserId =
    requireText(
      clBaseUserId,
      "Harson-Base 用户 ID"
    );

  const rows = readRows();

  const index =
    rows.findIndex(
      row =>
        row.clBaseUserId ===
        normalizedUserId
    );

  if (index < 0) {
    return null;
  }

  rows[index] = {
    ...rows[index],
    status: "logged_out",
    loggedOutAt: now(),
    lastActiveAt:
      rows[index].lastActiveAt ||
      now()
  };

  writeRows(rows);

  return {
    ...rows[index]
  };
}

/**
 * 查询某个企业主账号下，
 * 当前仍然处于 active 状态的用户。
 */
function listActiveSessionsByMasterAccountId(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "企业主账号 ID"
    );

  return readRows().filter(
    row =>
      row.masterAccountId ===
        normalizedMasterAccountId &&
      row.status === "active"
  );
}

function getSessionByUserId(
  clBaseUserId
) {
  const normalizedUserId =
    requireText(
      clBaseUserId,
      "Harson-Base 用户 ID"
    );

  const row =
    readRows().find(
      item =>
        item.clBaseUserId ===
        normalizedUserId
    );

  return row
    ? {
        ...row
      }
    : null;
}

/**
 * token 被彻底注销后，
 * 删除该企业主账号对应的会话记录。
 */
function removeSessionsByMasterAccountId(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "企业主账号 ID"
    );

  const rows = readRows();

  const remainingRows =
    rows.filter(
      row =>
        row.masterAccountId !==
        normalizedMasterAccountId
    );

  const removedCount =
    rows.length -
    remainingRows.length;

  if (removedCount > 0) {
    writeRows(
      remainingRows
    );
  }

  return removedCount;
}

function listSessions() {
  return readRows().map(
    row => ({
      ...row
    })
  );
}

module.exports = {
  markSessionActive,
  touchSession,
  markSessionLoggedOut,
  listActiveSessionsByMasterAccountId,
  getSessionByUserId,
  removeSessionsByMasterAccountId,
  listSessions
};