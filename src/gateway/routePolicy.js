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
  return COLOR_MATCH_EXCEPTIONS.some(entry =>
    entry.module === moduleName &&
    entry.method === req.method &&
    entry.path === req.path
  );
}

module.exports = {
  isAllowedReplicatorRequest,
  REPLICATOR_EXCEPTIONS,
  isAllowedColorMatchRequest,
  COLOR_MATCH_EXCEPTIONS
};
