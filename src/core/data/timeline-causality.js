// ===== 时间线与因果链 v1 =====
// 构建于现有 timeline.js 之上。
// 新增：事件依赖图(DAG)、因果链、改动影响回溯、命运回响(echoes)、伏笔追踪。
//
// 核心能力：
//   "如果用户改变某事 X，哪些事件受影响？" → traceImpact()
//   "事件 Y 是由什么导致的？" → traceCauses()
//   "事件 Z 在未来的回响是什么？" → getEchoes()

// ═══════════════════════════════════════════════════════════════
//  事件类型
// ═══════════════════════════════════════════════════════════════

export const EVENT_TYPE = {
  PAST:          "past",           // 历史事件
  PRESENT:       "present",        // 当前事件
  FUTURE:        "future",         // 计划中的未来事件
  FORESHADOWING: "foreshadowing",  // 伏笔（隐式未来影响）
  BRANCH:        "branch",         // 分支事件
  ECHO:          "echo"            // 回响（延迟触发）
};

export const EVENT_STATUS = {
  CONFIRMED: "confirmed",   // 已确认发生
  LIKELY:    "likely",      // 很可能发生
  POSSIBLE:  "possible",    // 可能发生
  ABANDONED: "abandoned"    // 已废弃/未发生
};

// ═══════════════════════════════════════════════════════════════
//  事件存储
// ═══════════════════════════════════════════════════════════════

const TIMELINE_STORE = {
  events: [],               // 所有事件
  edges: [],                // 因果关系边 { fromEventId, toEventId, type, description }
  echoes: [],               // 命运回响 { eventId, trigger, effect, chapter }
  maxEvents: 500
};

let eventIdCounter = 0;

// ═══════════════════════════════════════════════════════════════
//  事件创建
// ═══════════════════════════════════════════════════════════════

/**
 * 创建一个时间线事件
 * @param {Object} opts
 * @param {string} opts.title - 事件标题
 * @param {string} opts.time - 事件时间
 * @param {string} opts.type - 事件类型 (past/present/future/foreshadowing/branch)
 * @param {string} [opts.status] - confirmed/likely/possible/abandoned
 * @param {string} [opts.description] - 事件描述
 * @param {string[]} [opts.dependsOn] - 前置事件 ID 列表（这些事件必须先发生）
 * @param {string[]} [opts.affects] - 受此事件影响的后续事件 ID
 * @param {Object[]} [opts.consequences] - 事件后果
 * @param {Object[]} [opts.echoes] - 命运回响
 * @param {Object} [opts.relatedEntities] - 关联实体
 * @param {string} [opts.branchId] - 分支 ID
 * @returns {Object}
 */
export function createTimelineEvent(opts = {}) {
  const {
    title = "",
    time = "",
    type = EVENT_TYPE.PRESENT,
    status = EVENT_STATUS.CONFIRMED,
    description = "",
    dependsOn = [],
    affects = [],
    consequences = [],
    echoes = [],
    relatedEntities = {},
    branchId = "main"
  } = opts;

  if (!title) return { error: "事件标题不能为空" };

  const event = {
    id: `event-${++eventIdCounter}`,
    title,
    time,
    type,
    status,
    description,
    dependsOn,
    affects,
    consequences,
    relatedEntities: {
      characters: relatedEntities.characters || [],
      organizations: relatedEntities.organizations || [],
      locations: relatedEntities.locations || []
    },
    branchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  TIMELINE_STORE.events.push(event);

  // 建立因果边
  for (const depId of dependsOn) {
    addCausalEdge(depId, event.id, "dependency", `「${title}」依赖于前置事件`);
  }
  for (const affId of affects) {
    addCausalEdge(event.id, affId, "causes", `「${title}」影响后续事件`);
  }

  // 注册回响
  for (const echo of echoes) {
    TIMELINE_STORE.echoes.push({
      id: `echo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventId: event.id,
      trigger: echo.trigger || "",
      effect: echo.effect || "",
      chapter: echo.chapter || "",
      fired: false,
      createdAt: new Date().toISOString()
    });
  }

  // 容量控制
  if (TIMELINE_STORE.events.length > TIMELINE_STORE.maxEvents) {
    TIMELINE_STORE.events = TIMELINE_STORE.events.slice(-TIMELINE_STORE.maxEvents);
  }

  return event;
}

// ═══════════════════════════════════════════════════════════════
//  因果边
// ═══════════════════════════════════════════════════════════════

function addCausalEdge(fromId, toId, type, description = "") {
  // 避免重复边
  const exists = TIMELINE_STORE.edges.find(
    e => e.fromEventId === fromId && e.toEventId === toId && e.type === type
  );
  if (exists) return;

  TIMELINE_STORE.edges.push({
    id: `edge-${fromId}-${toId}`,
    fromEventId: fromId,
    toEventId: toId,
    type,
    description,
    createdAt: new Date().toISOString()
  });
}

// ═══════════════════════════════════════════════════════════════
//  因果追溯（核心能力）
// ═══════════════════════════════════════════════════════════════

/**
 * 追溯事件的所有原因（向上游走因果图）
 * @param {string} eventId - 目标事件 ID
 * @param {number} maxDepth - 最大追溯深度
 * @returns {Object} 因果树
 */
export function traceCauses(eventId, maxDepth = 5) {
  const event = findEvent(eventId);
  if (!event) return { error: `事件 ${eventId} 不存在` };

  return _traceUpstream(eventId, 0, maxDepth, new Set());
}

function _traceUpstream(eventId, depth, maxDepth, visited) {
  if (depth >= maxDepth || visited.has(eventId)) return null;
  visited.add(eventId);

  const event = findEvent(eventId);
  if (!event) return null;

  // 查找所有指向此事件的边
  const incoming = TIMELINE_STORE.edges.filter(e => e.toEventId === eventId);
  const causes = incoming.map(edge => ({
    edge: { type: edge.type, description: edge.description },
    event: {
      id: edge.fromEventId,
      title: findEvent(edge.fromEventId)?.title || "(已删除)",
      type: findEvent(edge.fromEventId)?.type || "unknown"
    },
    upstream: _traceUpstream(edge.fromEventId, depth + 1, maxDepth, visited)
  }));

  return {
    event: { id: event.id, title: event.title, type: event.type, status: event.status },
    depth,
    causes
  };
}

/**
 * 追踪事件的影响链（向下游走因果图）
 * @param {string} eventId
 * @param {number} maxDepth
 * @returns {Object}
 */
export function traceImpact(eventId, maxDepth = 5) {
  const event = findEvent(eventId);
  if (!event) return { error: `事件 ${eventId} 不存在` };

  return _traceDownstream(eventId, 0, maxDepth, new Set());
}

function _traceDownstream(eventId, depth, maxDepth, visited) {
  if (depth >= maxDepth || visited.has(eventId)) return null;
  visited.add(eventId);

  const event = findEvent(eventId);
  if (!event) return null;

  // 查找此事件指向的所有边
  const outgoing = TIMELINE_STORE.edges.filter(e => e.fromEventId === eventId);
  const effects = outgoing.map(edge => ({
    edge: { type: edge.type, description: edge.description },
    event: {
      id: edge.toEventId,
      title: findEvent(edge.toEventId)?.title || "(已删除)",
      status: findEvent(edge.toEventId)?.status || "unknown"
    },
    downstream: _traceDownstream(edge.toEventId, depth + 1, maxDepth, visited)
  }));

  return {
    event: { id: event.id, title: event.title, type: event.type, status: event.status },
    depth,
    effects
  };
}

/**
 * "如果用户改变事件 X，哪些事件受影响？"
 * 返回所有可能受影响的后续事件列表（扁平化）
 */
export function whatWouldChange(eventId, maxDepth = 5) {
  const impact = traceImpact(eventId, maxDepth);
  if (impact?.error) return impact;

  const affected = [];
  function collect(node) {
    if (!node) return;
    if (node.effects) {
      for (const e of node.effects) {
        if (e.event.id !== eventId) affected.push(e.event);
        collect(e.downstream);
      }
    }
  }
  collect(impact);
  return { eventId, affectedEvents: affected, count: affected.length };
}

// ═══════════════════════════════════════════════════════════════
//  命运回响
// ═══════════════════════════════════════════════════════════════

/**
 * 获取某个事件的所有回响
 */
export function getEchoes(eventId) {
  return TIMELINE_STORE.echoes.filter(e => e.eventId === eventId && !e.fired);
}

/**
 * 检查当前章节是否有应该触发的回响
 * @param {string} chapter - 当前章节标识
 * @returns {Object[]} 待触发的回响列表
 */
export function checkEchoesForChapter(chapter) {
  return TIMELINE_STORE.echoes
    .filter(e => !e.fired && e.chapter === chapter)
    .map(e => {
      const event = findEvent(e.eventId);
      return {
        echoId: e.id,
        originEvent: event ? event.title : "(未知事件)",
        trigger: e.trigger,
        effect: e.effect
      };
    });
}

/**
 * 触发回响
 */
export function fireEcho(echoId) {
  const echo = TIMELINE_STORE.echoes.find(e => e.id === echoId);
  if (!echo) return { error: `回响 ${echoId} 不存在` };
  echo.fired = true;
  echo.firedAt = new Date().toISOString();

  const event = findEvent(echo.eventId);
  return {
    ok: true,
    echo,
    originEvent: event ? event.title : "(未知)",
    message: `💫 命运回响触发: ${echo.effect}`
  };
}

// ═══════════════════════════════════════════════════════════════
//  伏笔
// ═══════════════════════════════════════════════════════════════

/**
 * 创建伏笔事件
 */
export function plantForeshadowing({ title, description = "", time = "", payoffs = [], relatedEntities = {} }) {
  return createTimelineEvent({
    title,
    time: time || "未来",
    type: EVENT_TYPE.FORESHADOWING,
    status: EVENT_STATUS.POSSIBLE,
    description,
    consequences: payoffs.map(p => ({ target: p.target || "", effect: p, severity: "minor" })),
    relatedEntities
  });
}

/**
 * 获取所有未解决的伏笔
 */
export function getUnresolvedForeshadowings() {
  return TIMELINE_STORE.events.filter(
    e => e.type === EVENT_TYPE.FORESHADOWING && e.status !== EVENT_STATUS.ABANDONED
  );
}

/**
 * 将伏笔标记为已回收
 */
export function resolveForeshadowing(eventId, payoffDescription = "") {
  const event = findEvent(eventId);
  if (!event) return { error: `事件 ${eventId} 不存在` };
  if (event.type !== EVENT_TYPE.FORESHADOWING) return { error: "不是伏笔事件" };

  event.status = EVENT_STATUS.CONFIRMED;
  event.payoffDescription = payoffDescription;
  event.resolvedAt = new Date().toISOString();
  event.updatedAt = new Date().toISOString();

  return { ok: true, event, message: `📯 伏笔「${event.title}」已回收` };
}

// ═══════════════════════════════════════════════════════════════
//  时间线查询
// ═══════════════════════════════════════════════════════════════

function findEvent(id) {
  return TIMELINE_STORE.events.find(e => e.id === id) || null;
}

/** 按类型筛选 */
export function getEventsByType(type) {
  return TIMELINE_STORE.events.filter(e => e.type === type);
}

/** 获取完整因果图（用于可视化） */
export function getCausalGraph() {
  return {
    nodes: TIMELINE_STORE.events.map(e => ({
      id: e.id,
      title: e.title,
      type: e.type,
      status: e.status,
      time: e.time
    })),
    edges: TIMELINE_STORE.edges.map(e => ({
      id: e.id,
      from: e.fromEventId,
      to: e.toEventId,
      type: e.type,
      description: e.description
    }))
  };
}

/** 获取指定分支的时间线 */
export function getBranchTimeline(branchId = "main") {
  return TIMELINE_STORE.events
    .filter(e => e.branchId === branchId)
    .sort((a, b) => {
      // 按时间排序（简单字符串比较）
      return String(a.time || "").localeCompare(String(b.time || ""));
    });
}

/** 获取时间线摘要（紧凑格式，LLM 注入用） */
export function timelineSummary(limit = 10) {
  const events = TIMELINE_STORE.events
    .filter(e => e.status === EVENT_STATUS.CONFIRMED || e.status === EVENT_STATUS.LIKELY)
    .slice(-limit);

  if (!events.length) return "时间线为空。";

  return events.map(e => {
    const prefix = e.type === EVENT_TYPE.FORESHADOWING ? '🌱' :
                   e.type === EVENT_TYPE.PAST ? '📜' :
                   e.type === EVENT_TYPE.FUTURE ? '🔮' : '📍';
    return `${prefix} [${e.time || '?'}] ${e.title}${e.status === EVENT_STATUS.LIKELY ? '(可能)' : ''}`;
  }).join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  事件依赖验证
// ═══════════════════════════════════════════════════════════════

/**
 * 检查所有依赖是否满足（已确认的事件）
 * @returns {Object[]} 未满足的依赖列表
 */
export function checkDependencySatisfaction() {
  const issues = [];
  for (const event of TIMELINE_STORE.events) {
    for (const depId of event.dependsOn || []) {
      const dep = findEvent(depId);
      if (!dep || dep.status === EVENT_STATUS.ABANDONED) {
        issues.push({
          eventId: event.id,
          eventTitle: event.title,
          missingDependency: depId,
          severity: dep ? "abandoned" : "missing"
        });
      }
    }
  }
  return issues;
}

// ═══════════════════════════════════════════════════════════════
//  存储管理
// ═══════════════════════════════════════════════════════════════

export function resetTimeline() {
  TIMELINE_STORE.events = [];
  TIMELINE_STORE.edges = [];
  TIMELINE_STORE.echoes = [];
  eventIdCounter = 0;
}

export function importEvents(events = [], edges = [], echoes = []) {
  for (const e of events) {
    if (!e.error) {
      TIMELINE_STORE.events.push(e);
      if (e.id && parseInt(e.id.replace('event-', '')) > eventIdCounter) {
        eventIdCounter = parseInt(e.id.replace('event-', ''));
      }
    }
  }
  TIMELINE_STORE.edges.push(...edges);
  TIMELINE_STORE.echoes.push(...echoes);
}

export function exportTimeline() {
  return {
    events: TIMELINE_STORE.events,
    edges: TIMELINE_STORE.edges,
    echoes: TIMELINE_STORE.echoes,
    graph: getCausalGraph(),
    stats: {
      totalEvents: TIMELINE_STORE.events.length,
      totalEdges: TIMELINE_STORE.edges.length,
      foreshadowings: getUnresolvedForeshadowings().length,
      pendingEchoes: TIMELINE_STORE.echoes.filter(e => !e.fired).length,
      dependencyIssues: checkDependencySatisfaction().length
    },
    exportedAt: new Date().toISOString()
  };
}
