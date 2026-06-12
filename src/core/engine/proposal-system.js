// ===== 提案系统 v1 =====
// LLM 不直接改正式数据 → 生成提案 → JS 分级判定 → 自动提交或用户确认
// 构建于 overlay-store.js 之上，提供更安全的写入管道。
//
// 三级分级：
//   LIGHT   → 自动提交，用户零感知
//   MEDIUM  → 自动提交 + 写入日志
//   MAJOR   → 自动提交 + 非阻塞提示（用户可忽略，不影响叙事流）
//   CRITICAL → 止损窗口 + 用户确认才能写入
//
// 与现有 pending 队列 (health-check.js) 的关系：
//   本系统处理「内容变更提案」，pending 队列处理「系统诊断建议」。
//   两者共享 IPC 通道但数据隔离。

import { classifyChangeLevel, needsUserConfirmation, needsStopLoss, CHANGE_LEVEL, CONTENT_TYPES, findById, assessImpact, TYPE_INDEX } from "./content-registry.js";

// ═══════════════════════════════════════════════════════════════
//  提案存储
// ═══════════════════════════════════════════════════════════════

const PROPOSAL_STORE = {
  proposals: [],       // 所有提案
  history: [],         // 已处理的提案归档
  config: {
    maxActiveProposals: 20,     // 活跃提案上限
    autoExpireRounds: 3,        // MAJOR 级提案 N 轮后自动过期
    criticalTtlRounds: 5,       // CRITICAL 级提案 N 轮后仍未确认 → 视为拒绝
    maxHistorySize: 200,        // 历史记录上限
    autoCommitLog: [],          // 自动提交日志（最近 50 条）
    maxAutoCommitLog: 50
  }
};

let proposalIdCounter = 0;

// ═══════════════════════════════════════════════════════════════
//  提案创建
// ═══════════════════════════════════════════════════════════════

/**
 * 从 LLM 输出创建一条提案
 * @param {Object} opts
 * @param {string} opts.typeId - 内容类型 id（character/organization/scene/等）
 * @param {Object} opts.change - 变更内容 { field, oldValue, newValue, description }
 * @param {string} opts.source - 来源：director/writer/guardian/player
 * @param {string} opts.moduleKey - 所属模组
 * @param {number} opts.round - 当前轮次
 * @param {Object} [opts.metadata] - 附加元数据
 * @returns {Object} 提案对象
 */
export function createProposal({ typeId, change, source = "writer", moduleKey = "unknown", round = 0, metadata = {} }) {
  const typeDef = findById(typeId);
  if (!typeDef) return { error: `未知内容类型: ${typeId}` };

  // 清理旧提案
  evictIfFull();
  expireOldProposals(round);

  const changeDesc = change.description || change.field || "";
  const level = classifyChangeLevel(typeId, changeDesc);
  const impacts = level === CHANGE_LEVEL.MAJOR || level === CHANGE_LEVEL.CRITICAL
    ? assessImpact(typeId, change)
    : [];

  const proposal = {
    id: `proposal-${++proposalIdCounter}`,
    typeId,
    typeName: typeDef.name,
    change: {
      field: change.field || "",
      oldValue: change.oldValue ?? null,
      newValue: change.newValue ?? null,
      description: changeDesc,
      patch: change.patch || null       // overlay 格式的 patch
    },
    level,
    source,
    moduleKey,
    round,
    impacts,
    status: "pending",                   // pending | adopted | committed | rejected | expired | reversed
    needsConfirmation: needsUserConfirmation(level),
    needsStopLoss: needsStopLoss(level),
    autoCommit: !needsUserConfirmation(level),
    metadata: {
      ...metadata,
      contextRound: round,
      userPrompt: metadata.userPrompt || "",
      narrativeExcerpt: metadata.narrativeExcerpt || ""
    },
    createdAt: new Date().toISOString(),
    adoptedAt: null,
    committedAt: null,
    rejectedAt: null,
    reversedAt: null,
    confirmDeadline: level === CHANGE_LEVEL.CRITICAL
      ? `第 ${round + PROPOSAL_STORE.config.criticalTtlRounds} 轮前需确认`
      : null
  };

  PROPOSAL_STORE.proposals.push(proposal);

  // 自动提交逻辑
  if (proposal.autoCommit) {
    commitProposal(proposal.id, "auto");
    if (level === CHANGE_LEVEL.MEDIUM) {
      appendAutoCommitLog(proposal);
    }
  }

  return proposal;
}

// ═══════════════════════════════════════════════════════════════
//  提案操作
// ═══════════════════════════════════════════════════════════════

/** 采纳提案：将提案标记为采纳（等待写入 overlay） */
export function adoptProposal(id) {
  const p = findProposal(id);
  if (!p) return { error: `提案 ${id} 不存在` };
  if (p.status !== "pending") return { error: `提案 ${id} 状态为 ${p.status}，无法采纳` };
  p.status = "adopted";
  p.adoptedAt = new Date().toISOString();
  return { ok: true, proposal: p };
}

/** 提交提案：将采纳的提案写入 overlay */
export function commitProposal(id, by = "user") {
  const p = findProposal(id);
  if (!p) return { error: `提案 ${id} 不存在` };
  // auto 来源的可以跳过 adopted 状态直接 commit
  if (p.status !== "adopted" && by !== "auto" && p.status !== "pending") {
    return { error: `提案 ${id} 状态为 ${p.status}，无法提交` };
  }
  p.status = "committed";
  p.committedAt = new Date().toISOString();
  p.committedBy = by;
  archiveProposal(p);
  return { ok: true, proposal: p, overlayPatch: p.change.patch };
}

/** 拒绝提案 */
export function rejectProposal(id, reason = "") {
  const p = findProposal(id);
  if (!p) return { error: `提案 ${id} 不存在` };
  p.status = "rejected";
  p.rejectedAt = new Date().toISOString();
  p.rejectReason = reason;
  archiveProposal(p);
  return { ok: true, proposal: p };
}

/**
 * 止损/挽回：撤销已提交的提案
 * 仅在提案已 committed 且 change 包含 oldValue 时可用
 */
export function reverseProposal(id, reason = "用户止损") {
  const p = findProposal(id);
  if (!p) return { error: `提案 ${id} 不存在` };
  if (p.status !== "committed") return { error: `提案 ${id} 状态为 ${p.status}，无法撤销（仅已提交的提案可止损）` };
  if (p.change.oldValue === null || p.change.oldValue === undefined) {
    return { error: "提案缺少旧值，无法自动止损。需手动处理。" };
  }
  p.status = "reversed";
  p.reversedAt = new Date().toISOString();
  p.reverseReason = reason;

  // 生成反向 patch（恢复旧值）
  const reversePatch = {
    field: p.change.field,
    newValue: p.change.oldValue,
    oldValue: p.change.newValue,
    description: `【止损】恢复: ${p.change.description || p.change.field}`,
    reversedFrom: p.id
  };

  archiveProposal(p);
  return { ok: true, proposal: p, reversePatch };
}

/** 获取指定时间范围内的止损窗口提案 */
export function getStopLossWindow(round, windowSize = 3) {
  return getByStatus("committed")
    .filter(p => p.needsStopLoss && p.round >= round - windowSize);
}

// ═══════════════════════════════════════════════════════════════
//  查询
// ═══════════════════════════════════════════════════════════════

function findProposal(id) {
  return PROPOSAL_STORE.proposals.find(p => p.id === id)
      || PROPOSAL_STORE.history.find(p => p.id === id)
      || null;
}

function allProposals() {
  return [...PROPOSAL_STORE.proposals, ...PROPOSAL_STORE.history];
}

/** 获取所有指定状态的提案 */
export function getByStatus(status = "pending") {
  return allProposals().filter(p => p.status === status);
}

/** 获取待用户确认的提案 */
export function getPendingUserConfirmations() {
  return PROPOSAL_STORE.proposals.filter(
    p => p.status === "pending" && p.needsConfirmation
  );
}

/** 获取可用于止损的提案（最近 N 轮内已提交的 critical 提案） */
export function getReversibleProposals(round, windowSize = 3) {
  return allProposals().filter(
    p => p.status === "committed"
      && p.needsStopLoss
      && p.round >= round - windowSize
  );
}

/** 获取自动提交日志 */
export function getAutoCommitLog(limit = 10) {
  return PROPOSAL_STORE.config.autoCommitLog.slice(-limit);
}

/** 获取提案统计 */
export function getProposalStats() {
  const all = allProposals();
  return {
    total: all.length,
    pending: all.filter(p => p.status === "pending").length,
    adopted: all.filter(p => p.status === "adopted").length,
    committed: all.filter(p => p.status === "committed").length,
    rejected: all.filter(p => p.status === "rejected").length,
    reversed: all.filter(p => p.status === "reversed").length,
    needsConfirmation: getPendingUserConfirmations().length,
    reversible: getReversibleProposals(Date.now()).length
  };
}

// ═══════════════════════════════════════════════════════════════
//  内部管理
// ═══════════════════════════════════════════════════════════════

/** 将已处理的提案移入历史 */
function archiveProposal(proposal) {
  PROPOSAL_STORE.history.push(proposal);
  if (PROPOSAL_STORE.history.length > PROPOSAL_STORE.config.maxHistorySize) {
    PROPOSAL_STORE.history = PROPOSAL_STORE.history.slice(-PROPOSAL_STORE.config.maxHistorySize);
  }
  // 从活跃列表中移除
  PROPOSAL_STORE.proposals = PROPOSAL_STORE.proposals.filter(p => p.id !== proposal.id);
}

/** 容量控制 */
function evictIfFull() {
  const active = PROPOSAL_STORE.proposals.filter(p => p.status !== "committed" && p.status !== "rejected");
  while (active.length >= PROPOSAL_STORE.config.maxActiveProposals) {
    const oldest = active.sort((a, b) => a.round - b.round)[0];
    if (oldest) {
      oldest.status = "expired";
      archiveProposal(oldest);
      active.splice(active.indexOf(oldest), 1);
    }
  }
}

/** 过期清理 */
function expireOldProposals(currentRound) {
  const pending = PROPOSAL_STORE.proposals.filter(p => p.status === "pending");
  for (const p of pending) {
    const age = currentRound - p.round;
    if (p.level === CHANGE_LEVEL.CRITICAL && age >= PROPOSAL_STORE.config.criticalTtlRounds) {
      p.status = "expired";
      p.expiredAt = new Date().toISOString();
      archiveProposal(p);
    } else if (p.level === CHANGE_LEVEL.MAJOR && age >= PROPOSAL_STORE.config.autoExpireRounds) {
      p.status = "expired";
      p.expiredAt = new Date().toISOString();
      archiveProposal(p);
    }
  }
}

/** 追加自动提交日志 */
function appendAutoCommitLog(proposal) {
  const log = PROPOSAL_STORE.config.autoCommitLog;
  log.push({
    id: proposal.id,
    typeId: proposal.typeId,
    description: proposal.change.description,
    level: proposal.level,
    round: proposal.round,
    at: new Date().toISOString()
  });
  if (log.length > PROPOSAL_STORE.config.maxAutoCommitLog) {
    log.splice(0, log.length - PROPOSAL_STORE.config.maxAutoCommitLog);
  }
}

/**
 * 每轮结束时调用：清理过期 + 生成用户提示消息
 * @returns {Object|null} 如果有需要用户关注的事项，返回提示对象；否则 null
 */
export function tickProposals(round) {
  expireOldProposals(round);

  const criticalPending = PROPOSAL_STORE.proposals.filter(
    p => p.status === "pending" && p.level === CHANGE_LEVEL.CRITICAL
  );
  const majorPending = PROPOSAL_STORE.proposals.filter(
    p => p.status === "pending" && p.level === CHANGE_LEVEL.MAJOR
  );
  const recentCommitted = allProposals().filter(
    p => p.status === "committed" && p.round >= round - 3
  );

  // 构建用户提示（非阻塞，仅展示）
  const notices = [];
  for (const p of criticalPending) {
    notices.push({
      type: "critical_confirmation",
      proposalId: p.id,
      message: `⚠️ 重大事件需要你确认: ${p.change.description}`,
      deadline: p.confirmDeadline
    });
  }
  for (const p of majorPending.slice(0, 3)) {
    notices.push({
      type: "major_notice",
      proposalId: p.id,
      message: `📋 ${p.typeName}已自动更新: ${p.change.description}`,
      canUndo: true
    });
  }

  if (notices.length > 0) {
    return { notices, count: notices.length };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  批量操作
// ═══════════════════════════════════════════════════════════════

/** 从 output-parser 的 marked sections 批量创建提案 */
export function proposalsFromSections(sections = [], opts = {}) {
  const proposals = [];
  for (const section of sections) {
    // 解析【状态建议】标记段
    if (section.type === "state_suggestion" && section.changes) {
      for (const change of section.changes) {
        const p = createProposal({
          typeId: change.typeId || inferTypeId(change),
          change: {
            field: change.field || "",
            oldValue: change.oldValue,
            newValue: change.newValue,
            description: change.description || change.field || "",
            patch: change.patch
          },
          source: opts.source || "writer",
          moduleKey: opts.moduleKey || "unknown",
          round: opts.round || 0,
          metadata: {
            userPrompt: opts.userPrompt || "",
            narrativeExcerpt: opts.narrativeExcerpt || ""
          }
        });
        if (!p.error) proposals.push(p);
      }
    }
  }
  return proposals;
}

/** 从字段名推断内容类型 */
function inferTypeId(change = {}) {
  const field = (change.field || "").toLowerCase();
  if (/角色|人物|character|name/.test(field)) return "character";
  if (/组织|势力|organization/.test(field)) return "organization";
  if (/场景|地点|scene|location/.test(field)) return "scene";
  if (/时间|timeline/.test(field)) return "timeline";
  if (/规则|rule/.test(field)) return "rule";
  if (/关系|relation/.test(field)) return "relation";
  return "character"; // 默认
}

// ═══════════════════════════════════════════════════════════════
//  导出管理 API
// ═══════════════════════════════════════════════════════════════

/** 重置提案存储（用于模组切换） */
export function resetProposalStore() {
  PROPOSAL_STORE.proposals = [];
  PROPOSAL_STORE.history = [];
  PROPOSAL_STORE.config.autoCommitLog = [];
  proposalIdCounter = 0;
}

/** 从快照恢复提案存储（用于存档加载） */
export function importProposalSnapshot(snapshot = {}) {
  PROPOSAL_STORE.proposals = snapshot.proposals || [];
  PROPOSAL_STORE.history = snapshot.history || [];
  PROPOSAL_STORE.config.autoCommitLog = snapshot.autoCommitLog || [];
  // 恢复计数器
  const maxId = PROPOSAL_STORE.proposals.reduce((max, p) => {
    const num = parseInt((p.id || "proposal-0").replace("proposal-", ""), 10);
    return num > max ? num : max;
  }, 0);
  proposalIdCounter = Math.max(proposalIdCounter, maxId);
}

/** 导出全文快照（用于存档） */
export function exportProposalSnapshot() {
  return {
    proposals: PROPOSAL_STORE.proposals,
    history: PROPOSAL_STORE.history.slice(-50),
    autoCommitLog: PROPOSAL_STORE.config.autoCommitLog.slice(-50),
    stats: getProposalStats(),
    exportedAt: new Date().toISOString()
  };
}
