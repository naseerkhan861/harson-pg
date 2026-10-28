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

module.exports = {
  isAllowedReplicatorRequest,
  REPLICATOR_EXCEPTIONS
};
