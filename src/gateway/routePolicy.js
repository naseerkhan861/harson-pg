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

/*
  AI 电商: exact shared-tool requests, scoped to the outer session module.
  Nested tools retain the outer e-commerce gateway session module.
  Color-match session POST is confirmed by the supplied screenshot;
  its follow-up operations mirror the reviewed clothing contract.
*/
const ECOMMERCE_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/proxy/viralVideoTaskDetail",
    module: "e-commerce",
    reason: "open a viral video replicator task from history"
  },
  {
    method: "POST",
    path: "/app/viral-video/pricing",
    module: "e-commerce",
    reason: "load viral video replicator billing prices"
  },
  {
    method: "POST",
    path: "/app/viral-video/link/resolve",
    module: "e-commerce",
    reason: "resolve a supported reference video link"
  },
  {
    method: "POST",
    path: "/app/color-match/pricing",
    module: "e-commerce",
    reason: "load color-match pricing during e-commerce navigation"
  },
  {
    method: "GET",
    path: "/app/color-match/pricing",
    module: "e-commerce",
    reason: "refresh color-match pricing"
  },
  {
    method: "POST",
    path: "/app/local-repair/pricing",
    module: "e-commerce",
    reason: "load the shared color-match/local-repair pricing contract"
  },
  {
    method: "POST",
    path: "/app/color-match/cast-correction-sessions",
    module: "e-commerce",
    reason: "allow the screenshot-confirmed cast-correction session operation"
  },
  {
    method: "GET",
    path: "/app/color-match/cast-correction-sessions",
    module: "e-commerce",
    reason: "refresh cast-correction sessions"
  },
  {
    method: "POST",
    path: "/app/local-repair/beginRepair",
    module: "e-commerce",
    reason: "submit the painted-region local-repair task"
  },
  {
    method: "POST",
    path: "/app/proxy/viralVideoRecords",
    module: "e-commerce",
    reason: "load local-repair history using the reviewed shared provider contract"
  }
]);

const ECOMMERCE_PATTERNS = Object.freeze([
  {
    method: "POST",
    pattern: new RegExp(
      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}/process$`,
      "i"
    ),
    module: "e-commerce"
  },
  {
    method: "DELETE",
    pattern: new RegExp(
      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}$`,
      "i"
    ),
    module: "e-commerce"
  }
]);

function isAllowedEcommerceRequest(req) {
  const moduleName = req.harsonGatewaySession?.moduleName;
  return ECOMMERCE_EXCEPTIONS.some(entry =>
    moduleName === entry.module &&
    req.method === entry.method &&
    req.path === entry.path
  ) || ECOMMERCE_PATTERNS.some(entry =>
    moduleName === entry.module &&
    req.method === entry.method &&
    entry.pattern.test(req.path)
  );
}

/*
  AI 图案设计 → 参考图校色 keeps the outer pattern-design session.
  The screenshot confirms POST pricing, history detail, and session calls;
  follow-up color-match operations mirror the reviewed shared contract.
*/
const PATTERN_COLOR_MATCH_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/proxy/viralVideoTaskDetail",
    module: "pattern-design",
    reason: "restore a reference color-match task from history"
  },
  {
    method: "POST",
    path: "/app/color-match/pricing",
    module: "pattern-design",
    reason: "load color-match pricing"
  },
  {
    method: "GET",
    path: "/app/color-match/pricing",
    module: "pattern-design",
    reason: "refresh color-match pricing"
  },
  {
    method: "POST",
    path: "/app/local-repair/pricing",
    module: "pattern-design",
    reason: "load shared color-match/local-repair pricing"
  },
  {
    method: "POST",
    path: "/app/color-match/cast-correction-sessions",
    module: "pattern-design",
    reason: "allow the screenshot-confirmed cast-correction session operation"
  },
  {
    method: "GET",
    path: "/app/color-match/cast-correction-sessions",
    module: "pattern-design",
    reason: "refresh cast-correction sessions"
  }
]);

const PATTERN_COLOR_MATCH_PATTERNS = Object.freeze([
  {
    method: "POST",
    pattern: new RegExp(
      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}/process$`,
      "i"
    ),
    module: "pattern-design"
  },
  {
    method: "DELETE",
    pattern: new RegExp(
      `^/app/color-match/cast-correction-sessions/${UUID_SEGMENT}$`,
      "i"
    ),
    module: "pattern-design"
  }
]);

function isAllowedPatternColorMatchRequest(req) {
  const moduleName = req.harsonGatewaySession?.moduleName;
  return PATTERN_COLOR_MATCH_EXCEPTIONS.some(entry =>
    moduleName === entry.module &&
    req.method === entry.method &&
    req.path === entry.path
  ) || PATTERN_COLOR_MATCH_PATTERNS.some(entry =>
    moduleName === entry.module &&
    req.method === entry.method &&
    entry.pattern.test(req.path)
  );
}

/* AI 图案设计 → 局部修复 uses the shared provider repair contract. */
const PATTERN_LOCAL_REPAIR_EXCEPTIONS = Object.freeze([
  {
    method: "POST",
    path: "/app/local-repair/beginRepair",
    module: "pattern-design",
    reason: "submit the painted-region local-repair task"
  },
  {
    method: "POST",
    path: "/app/proxy/viralVideoRecords",
    module: "pattern-design",
    reason: "load local-repair history using the reviewed shared provider contract"
  }
]);

function isAllowedPatternLocalRepairRequest(req) {
  return PATTERN_LOCAL_REPAIR_EXCEPTIONS.some(entry =>
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
  LOCAL_REPAIR_EXCEPTIONS,
  isAllowedEcommerceRequest,
  ECOMMERCE_EXCEPTIONS,
  isAllowedPatternColorMatchRequest,
  PATTERN_COLOR_MATCH_EXCEPTIONS,
  isAllowedPatternLocalRepairRequest,
  PATTERN_LOCAL_REPAIR_EXCEPTIONS
};
