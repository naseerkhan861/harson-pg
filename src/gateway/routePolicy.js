"use strict";

/*
  Method- and module-aware gateway route exceptions
  (suggest_changes.md §3B, 28 October 2026).

  The generic YIBAI_GATEWAY_EXTRA_PATHS mechanism is prefix-based only.
  These reviewed exceptions admit EXACT (method, path, session-module)
  triples used by the 爆款视频复刻 (viral video replicator) nested
  sub-tool inside the video-generator module. Both entries were verified
  from gateway logs before being added.

  Never widen these into broad prefixes such as /app or /app/proxy:
  the gateway forwards authenticated provider traffic, and a broad
  prefix would unintentionally expose unrelated provider operations.
*/

const REPLICATOR_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/proxy/viralVideoTaskDetail",
    module: "video-generator",
    reason: "history task detail for the viral video replicator sub-tool"
  },
  {
    method: "POST",
    path: "/app/viral-video/pricing",
    module: "video-generator",
    reason: "pricing lookup for the viral video replicator sub-tool"
  },
  {
    method: "POST",
    path: "/app/viral-video/link/resolve",
    module: "video-generator",
    reason: "resolve a supported video link for the viral video replicator"
  }
]);

function isAllowedReplicatorRequest(req) {
  const session = req.harsonGatewaySession;

  if (!session || session.moduleName !== "video-generator") {
    return false;
  }

  return REPLICATOR_EXCEPTIONS.some(
    entry =>
      req.method === entry.method &&
      req.path === entry.path
  );
}

/*
  AI 服装 → 参考图校色 subtool exceptions (suggest_changes.md, 28–29 Oct).

  Entries carry RECORDED method/path pairs from the live gateway logs —
  never inferred from truncated screenshots. The local-repair pricing
  entry was recorded 2026-10-28 15:40–15:47Z; the four color-match
  entries (pricing + cast-correction sessions, both methods) were
  recorded 15:53–15:54Z after the pricing deploy, exactly the
  fresh-finish-log surfacing the previous guide prescribed. Still
  unrecorded and therefore NOT admitted: beginRepair and
  viralVideoRecords paths — they must surface with their own recorded
  method/path before admission.
*/
const COLOR_MATCH_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/local-repair/pricing",
    module: "clothing",
    reason: "pricing lookup for the reference color-match subtool"
  },
  {
    method: "POST",
    path: "/app/color-match/pricing",
    module: "clothing",
    reason: "pricing lookup for the color-match subtool (recorded 2026-10-28 15:53:43Z)"
  },
  {
    method: "GET",
    path: "/app/color-match/pricing",
    module: "clothing",
    reason: "pricing refresh by the color-match subtool (recorded 2026-10-28 15:54:45Z)"
  },
  {
    method: "POST",
    path: "/app/color-match/cast-correction-sessions",
    module: "clothing",
    reason: "cast-correction session list for 偏色校正 (recorded 2026-10-28 15:53:57Z)"
  },
  {
    method: "GET",
    path: "/app/color-match/cast-correction-sessions",
    module: "clothing",
    reason: "cast-correction session refresh for 偏色校正 (recorded 2026-10-28 15:54:50Z)"
  }
]);

function isAllowedColorMatchRequest(req) {
  const moduleName = req.harsonGatewaySession?.moduleName;
  if (COLOR_MATCH_EXCEPTIONS.some(entry =>
    entry.module === moduleName &&
    entry.method === req.method &&
    entry.path === req.path
  )) {
    return true;
  }

  /*
    Per-session cast-correction calls carry a dynamic UUID session id
    (recorded 2026-10-28 16:16:37Z: process) and 16:16:38Z: DELETE).
    Strictly shaped patterns — never broad prefixes.
  */
  return COLOR_MATCH_PATTERNS.some(entry =>
    entry.module === moduleName &&
    entry.method === req.method &&
    entry.pattern.test(req.path)
  );
}

const UUID_SEGMENT =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const COLOR_MATCH_PATTERNS = Object.freeze([
  {
    method: "POST",
    pattern: new RegExp(
      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}/process$`,
      "i"
    ),
    module: "clothing",
    reason: "run the 偏色校正 process for one recorded cast-correction session"
  },
  {
    method: "DELETE",
    pattern: new RegExp(
      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}$`,
      "i"
    ),
    module: "clothing",
    reason: "delete one recorded cast-correction session"
  }
]);

/*
  AI 服装 → 局部修复 submission (suggest_changes.md, 29 Oct): the exact
  POST was confirmed three ways — full console line
  (POST https://ai.harson-base.com/app/local-repair/beginRepair 404),
  the live gateway finish log (2026-10-28 16:17:02Z), and an isolated
  local reproduction (empty gateway 404 against a 200 mock upstream).
*/
const LOCAL_REPAIR_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/local-repair/beginRepair",
    module: "clothing",
    reason: "submit painted region for the clothing local-repair subtool"
  },
  {
    method: "POST",
    path: "/app/proxy/viralVideoRecords",
    module: "clothing",
    reason: "load the local-repair subtool's task history (recorded 2026-10-28 17:54-17:55Z: the page polls it on load; the provider reuses this records API for its sub-tool history, behind the 本地历史记录暂不可用 toast)"
  },
  {
    method: "POST",
    path: "/app/proxy/viralVideoTaskDetail",
    module: "clothing",
    reason: "poll task detail for the local-repair subtool (recorded 88x in the 2026-10-29 console export: the post-submit status poll that leaves the UI at 生成中)"
  }
]);

function isAllowedLocalRepairRequest(req) {
  return LOCAL_REPAIR_EXCEPTIONS.some(entry =>
    req.harsonGatewaySession?.moduleName === entry.module &&
    req.method === entry.method &&
    req.path === entry.path
  );
}

module.exports = {
  isAllowedReplicatorRequest,
  REPLICATOR_EXCEPTIONS,
  isAllowedColorMatchRequest,
  COLOR_MATCH_EXCEPTIONS,
  isAllowedLocalRepairRequest,
  LOCAL_REPAIR_EXCEPTIONS
};
