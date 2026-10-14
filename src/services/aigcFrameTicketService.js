"use strict";

/*
  单次用途 frame 启动票据（in-memory）。

  用于把 YiBai iframe 的入口从“长期携带 provider token 的 URL”
  换成“60 秒内一次性有效的启动票据”：

  - 主应用签发票据（buildFrameUrl，仅当 YIBAI_FRAME_PUBLIC_ORIGIN
    配置时）；
  - 网关 /__harson/launch 通过内部接口赎回票据，换取 provider
    token 后重定向到上游；
  - 赎回即作废（Map 先删后读，单进程内原子）。

  进程重启会丢失未赎回的票据：影响仅为该次 iframe 加载失败一次，
  前端重试 requestSession() 会重新签发，可自愈。
*/

const crypto = require("crypto");

const DEFAULT_TTL_SECONDS = 60;
const SWEEP_INTERVAL_MS = 60 * 1000;
const GATEWAY_REVOKE_TIMEOUT_MS = 2000;

const tickets = new Map();
const userTickets = new Map();

function getTtlMs() {
  const seconds = Number(
    process.env.YIBAI_FRAME_TICKET_TTL_SECONDS ||
      DEFAULT_TTL_SECONDS
  );

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return DEFAULT_TTL_SECONDS * 1000;
  }

  return seconds * 1000;
}

function issueTicket({
  userId,
  module,
  providerToken
}) {
  const normalizedUserId = String(
    userId || ""
  ).trim();

  if (!normalizedUserId) {
    throw new Error(
      "启动票据签发需要 userId"
    );
  }

  const ticket = crypto
    .randomBytes(32)
    .toString("hex");

  const record = {
    userId: normalizedUserId,
    module: String(module || ""),
    providerToken: String(
      providerToken || ""
    ),
    expiresAt:
      Date.now() + getTtlMs()
  };

  tickets.set(ticket, record);

  if (
    !userTickets.has(normalizedUserId)
  ) {
    userTickets.set(
      normalizedUserId,
      new Set()
    );
  }

  userTickets
    .get(normalizedUserId)
    .add(ticket);

  ensureSweeper();

  return {
    ticket,
    expiresAt: record.expiresAt
  };
}

/*
  Map.delete 先执行，保证同一票据即使并发赎回也只有一次成功。
*/
function redeemTicket(ticket) {
  const key = String(ticket || "");

  if (!key) {
    return null;
  }

  const record = tickets.get(key);

  if (!record) {
    return null;
  }

  tickets.delete(key);

  const owned =
    userTickets.get(record.userId);

  if (owned) {
    owned.delete(key);

    if (owned.size === 0) {
      userTickets.delete(
        record.userId
      );
    }
  }

  if (record.expiresAt <= Date.now()) {
    return null;
  }

  return {
    userId: record.userId,
    module: record.module,
    providerToken:
      record.providerToken
  };
}

function revokeTicketsForUser(
  userId
) {
  const normalizedUserId = String(
    userId || ""
  ).trim();

  const owned = userTickets.get(
    normalizedUserId
  );

  if (!owned) {
    return 0;
  }

  const count = owned.size;

  for (const ticket of owned) {
    tickets.delete(ticket);
  }

  userTickets.delete(
    normalizedUserId
  );

  return count;
}

function sweepExpired() {
  const now = Date.now();

  for (const [
    ticket,
    record
  ] of tickets) {
    if (record.expiresAt <= now) {
      tickets.delete(ticket);

      const owned =
        userTickets.get(
          record.userId
        );

      if (owned) {
        owned.delete(ticket);

        if (owned.size === 0) {
          userTickets.delete(
            record.userId
          );
        }
      }
    }
  }
}

let sweeper = null;

function ensureSweeper() {
  if (sweeper) {
    return;
  }

  sweeper = setInterval(
    sweepExpired,
    SWEEP_INTERVAL_MS
  );

  if (
    sweeper &&
    typeof sweeper.unref ===
      "function"
  ) {
    sweeper.unref();
  }
}

/*
  用户登出时调用：作废本地票据，并尽力通知网关清除其会话。
  静默失败 —— 网关未部署或不可达时绝不阻断登出流程。
*/
function revokeGatewayAccessQuietly(
  userId
) {
  const normalizedUserId = String(
    userId || ""
  ).trim();

  if (!normalizedUserId) {
    return;
  }

  try {
    revokeTicketsForUser(
      normalizedUserId
    );
  } catch (error) {
    console.warn(
      "清除用户启动票据失败（不影响登出）：",
      error.message
    );
  }

  const secret = String(
    process.env.HARSON_INTERNAL_API_SECRET ||
      ""
  );

  if (!secret) {
    return;
  }

  const origin = String(
    process.env.YIBAI_GATEWAY_INTERNAL_ORIGIN ||
      "http://gateway:3001"
  ).replace(/\/+$/, "");

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    GATEWAY_REVOKE_TIMEOUT_MS
  );

  fetch(
    `${origin}/__harson/internal/revoke`,
    {
      method: "POST",
      headers: {
        "content-type":
          "application/json",
        "x-harson-internal-secret":
          secret
      },
      body: JSON.stringify({
        userId: normalizedUserId
      }),
      signal: controller.signal
    }
  ).catch(() => {
    /* 网关不可达时忽略 */
  }).finally(() => {
    clearTimeout(timer);
  });
}

module.exports = {
  issueTicket,
  redeemTicket,
  revokeTicketsForUser,
  revokeGatewayAccessQuietly
};
