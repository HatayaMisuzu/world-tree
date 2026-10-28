/**
 * S4-6 角色互动模块① — NPC 自主意愿（规则层）
 *
 * Present NPCs decide cooperate / refuse / leave from goals, schedule,
 * attitude (relations.js), and known info. Refusal is a legitimate
 * rules-layer result — not LLM cosplay. Refused requests must NOT be
 * marked Canon「已完成」.
 *
 * Pure decision helpers + thin evaluators. No I/O. No LLM.
 */

import { findRelation } from "../data/relations.js";

export const NPC_DECISION = Object.freeze({
  COOPERATE: "cooperate",
  REFUSE: "refuse",
  LEAVE: "leave"
});

/** Goal ↔ request opposing patterns (deterministic keyword conflict). */
const CONFLICT_PAIRS = Object.freeze([
  { goal: /封锁|压下|隐瞒|压制|掩盖|封口|讳莫如深/, request: /公开|泄露|透露|公布|声张|宣扬|传开|告知全城|告诉大家/ },
  { goal: /保住|守护|维持|控制|管辖/, request: /交出|移交|放弃|让出|拱手|拱让|拱送|交给议会|让议会接管/ },
  { goal: /追查|查清|弄清|调查/, request: /销毁|抹除|毁掉证据|烧掉记录|销毁证据/ },
  { goal: /确认来人不是|防备|提防|戒备|不是风议会密探/, request: /替风议会|为风议会|当密探|当内应|刺探航线/ },
  { goal: /垄断|独占|高价/, request: /免费|白送|无偿|公开市场|分享给所有人/ },
  { goal: /试探|开放云墙/, request: /永久封锁云墙|彻底关闭云墙|永不开放/ },
  { goal: /多挣|搬运费/, request: /无偿搬运|白干活|不要报酬/ }
]);

const REQUEST_VERBS = /请|让|要求|命令|逼|求|叫|请求|说服/;
const LEAVE_HOSTILE = /杀|捅|威胁|绑架|勒索|逮捕|关进/;

const MOTIVE_KEYS = Object.freeze([
  "goals", "goal", "motive", "motivation", "currentGoal", "desire", "agenda", "wants"
]);

function textOf(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return String(value.title || value.description || value.summary || value.name || "").trim();
}

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

/**
 * Collect NPC goal / motive strings from character fields (PRD reuse).
 * @param {object} npc
 * @returns {string[]}
 */
export function collectNpcGoals(npc = {}) {
  const out = [];
  const seen = new Set();
  for (const key of MOTIVE_KEYS) {
    for (const item of listOf(npc?.[key])) {
      const text = textOf(item);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

/**
 * Resolve attitude toward the requester via relations.js (-5..+5).
 * Missing edge → 0 (neutral).
 */
export function resolveAttitude(npc = {}, playerName = "玩家", relationLookup = findRelation) {
  const name = npc?.name || npc?.id || "";
  if (!name) return 0;
  const rel = typeof relationLookup === "function" ? relationLookup(name, playerName) : null;
  if (!rel || rel.status === "severed") return 0;
  const n = Number(rel.attitude);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-5, Math.min(5, n));
}

/**
 * Detect goal↔request conflicts. Returns matching goal texts.
 */
export function detectGoalConflicts(requestText = "", goals = []) {
  const request = String(requestText || "");
  if (!request.trim() || !goals.length) return [];
  const hits = [];
  for (const goal of goals) {
    const g = String(goal || "");
    for (const pair of CONFLICT_PAIRS) {
      if (pair.goal.test(g) && pair.request.test(request)) {
        hits.push(g);
        break;
      }
    }
  }
  return hits;
}

/**
 * Find NPCs named in player input (longest name first to avoid partials).
 */
export function findMentionedNpcs(input = "", characters = []) {
  const text = String(input || "");
  const list = Array.isArray(characters) ? characters.filter((c) => c?.name) : [];
  const sorted = [...list].sort((a, b) => String(b.name).length - String(a.name).length);
  const found = [];
  const seen = new Set();
  for (const npc of sorted) {
    const name = String(npc.name);
    if (!name || seen.has(name)) continue;
    if (text.includes(name)) {
      found.push(npc);
      seen.add(name);
    }
  }
  return found;
}

/**
 * True when input looks like asking an NPC to do something.
 */
export function isNpcRequestInput(input = "", npcName = "") {
  const text = String(input || "");
  if (!npcName || !text.includes(npcName)) return false;
  if (REQUEST_VERBS.test(text)) return true;
  // 「帮/替 + NPC」or「NPC + 去/做」
  const escaped = npcName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:帮|替)${escaped}|${escaped}(?:去|做|把|将)`).test(text);
}

/**
 * Schedule busy: NPC is mid-slot far from current location (optional).
 */
export function isScheduleBusy(npc = {}, npcRuntime = null, currentLocationId = "") {
  if (!npcRuntime || !currentLocationId) return false;
  const loc = npcRuntime.locationId || npcRuntime.location || "";
  if (!loc) return false;
  // Far from scene + has schedule → treat as busy (may refuse light asks)
  return loc !== currentLocationId && Array.isArray(npcRuntime.schedule) && npcRuntime.schedule.length > 0;
}

/**
 * Core rules decision for one NPC + one request.
 *
 * Attitude effect on refuse threshold (S4-6 nice-to-have):
 * - Hard goal conflict → always refuse (goals win); attitude ≤ -3 may escalate to leave
 * - Soft / no conflict → refuse if attitude < cooperateThreshold (default 0; raised when busy)
 * - Hostile ask → leave if attitude ≤ -2, else refuse
 *
 * @returns {{ decision, reason, conflictingGoals, attitude, requestFulfilled, canonMark, npcId, npcName, layer }}
 */
export function decideNpcAction({
  npc = {},
  requestText = "",
  attitude = 0,
  scheduleBusy = false,
  knownInfo = [],
  cooperateThreshold = 0
} = {}) {
  const npcName = npc?.name || npc?.id || "NPC";
  const npcId = npc?.id || npcName;
  const goals = collectNpcGoals(npc);
  const conflicts = detectGoalConflicts(requestText, goals);
  const att = Number.isFinite(Number(attitude)) ? Number(attitude) : 0;
  const threshold = scheduleBusy ? cooperateThreshold + 1 : cooperateThreshold;

  const base = {
    npcId,
    npcName,
    attitude: att,
    conflictingGoals: conflicts,
    goals,
    scheduleBusy: Boolean(scheduleBusy),
    knownInfo: Array.isArray(knownInfo) ? knownInfo.slice(0, 8) : [],
    requestFulfilled: false,
    canonMark: null, // never「已完成」on refuse/leave
    layer: "rules"
  };

  if (LEAVE_HOSTILE.test(String(requestText || ""))) {
    if (att <= -2) {
      return {
        ...base,
        decision: NPC_DECISION.LEAVE,
        reason: `敌对请求且态度(${att})过低：${npcName}选择离开`
      };
    }
    return {
      ...base,
      decision: NPC_DECISION.REFUSE,
      reason: `敌对请求：${npcName}拒绝配合`
    };
  }

  if (conflicts.length) {
    if (att <= -3) {
      return {
        ...base,
        decision: NPC_DECISION.LEAVE,
        reason: `请求与目标冲突且态度(${att})敌对：${npcName}离开（冲突目标：${conflicts.join("；")}）`
      };
    }
    // Hard goal conflict: refuse regardless of friendly attitude (goals bind)
    return {
      ...base,
      decision: NPC_DECISION.REFUSE,
      reason: `请求违背目标：${conflicts.join("；")}（态度=${att}不足以覆盖硬冲突）`
    };
  }

  // Soft path: attitude / schedule gate
  if (att < threshold) {
    return {
      ...base,
      decision: NPC_DECISION.REFUSE,
      reason: scheduleBusy
        ? `日程忙碌且态度(${att})低于配合阈值(${threshold})：${npcName}拒绝`
        : `态度(${att})低于配合阈值(${threshold})：${npcName}拒绝`
    };
  }

  return {
    ...base,
    decision: NPC_DECISION.COOPERATE,
    requestFulfilled: false, // fulfillment still needs narrative/world resolution; not Canon yet
    canonMark: null,
    reason: `态度(${att})与目标无冲突：${npcName}配合`
  };
}

/**
 * Evaluate player input against present / mentioned NPCs.
 * Prefer mentioned NPCs; if none named but request-like, skip (no invented target).
 */
export function evaluateNpcRequests({
  input = "",
  characters = [],
  playerName = "玩家",
  relationLookup = findRelation,
  npcStates = [],
  currentLocationId = "",
  cooperateThreshold = 0
} = {}) {
  const mentioned = findMentionedNpcs(input, characters).filter((npc) =>
    isNpcRequestInput(input, npc.name)
  );
  if (!mentioned.length) {
    return {
      input: String(input || ""),
      decisions: [],
      refusals: [],
      hasRefusal: false,
      requestFulfilled: false,
      canonMarks: []
    };
  }

  const runtimeById = new Map();
  const runtimeByName = new Map();
  for (const rt of Array.isArray(npcStates) ? npcStates : []) {
    if (rt?.id) runtimeById.set(rt.id, rt);
    if (rt?.name) runtimeByName.set(rt.name, rt);
  }

  const decisions = mentioned.map((npc) => {
    const runtime = runtimeById.get(npc.id) || runtimeByName.get(npc.name) || null;
    const attitude = resolveAttitude(npc, playerName, relationLookup);
    const scheduleBusy = isScheduleBusy(npc, runtime, currentLocationId);
    const knownInfo = listOf(npc.knowledge || npc.knownInfo || runtime?.knowledge)
      .map(textOf)
      .filter(Boolean);
    return decideNpcAction({
      npc,
      requestText: input,
      attitude,
      scheduleBusy,
      knownInfo,
      cooperateThreshold
    });
  });

  const refusals = decisions.filter(
    (d) => d.decision === NPC_DECISION.REFUSE || d.decision === NPC_DECISION.LEAVE
  );

  return {
    input: String(input || ""),
    decisions,
    refusals,
    hasRefusal: refusals.length > 0,
    // Refused requests are never Canon-completed
    requestFulfilled: false,
    canonMarks: refusals.map(() => null)
  };
}

/**
 * Strip / block Canon「已完成」stamps for refused requests.
 * Returns a new canon object (or null) plus scrub metadata.
 */
export function scrubCanonForRefusals(canon = null, decisions = []) {
  const refused = (decisions || []).filter(
    (d) => d.decision === NPC_DECISION.REFUSE || d.decision === NPC_DECISION.LEAVE
  );
  if (!refused.length) {
    return { canon: canon && typeof canon === "object" ? { ...canon } : canon, scrubbed: false, blockedMarks: [] };
  }

  const blockedMarks = [];
  const next = canon && typeof canon === "object" ? { ...canon } : {};
  const keys = ["confirmed", "implied", "proposed", "status", "quest", "objective"];

  for (const key of keys) {
    const val = next[key];
    if (typeof val === "string" && /已完成|completed|done/i.test(val)) {
      const touches = refused.some(
        (r) => val.includes(r.npcName) || (r.conflictingGoals || []).some((g) => val.includes(g))
      );
      if (touches || /已完成/.test(val)) {
        blockedMarks.push({ field: key, from: val, to: null });
        delete next[key];
      }
    }
  }

  // Explicit rules stamp: refused request is not Canon-complete
  next.requestStatus = "not_completed";
  next.refusalNote = refused.map((r) => `${r.npcName}:${r.decision}`).join(",");
  blockedMarks.push({ field: "requestStatus", from: "已完成", to: "not_completed" });

  return { canon: next, scrubbed: true, blockedMarks };
}

/**
 * Writer-facing block so LLM narrates the rules result (does not invent compliance).
 */
export function formatNpcDecisionsForWriter(evaluation = {}) {
  const decisions = evaluation.decisions || [];
  if (!decisions.length) return "";
  const lines = [
    "【NPC 自主意愿 — 规则层裁定（必须遵守，禁止改写为配合成功）】",
    "以下裁定由确定性规则层产生；叙事必须体现该结果，不得写成对方已照做或 Canon「已完成」。"
  ];
  for (const d of decisions) {
    const label =
      d.decision === NPC_DECISION.COOPERATE ? "配合" :
      d.decision === NPC_DECISION.LEAVE ? "离开" : "拒绝";
    lines.push(`- ${d.npcName}: ${label} — ${d.reason}`);
    if (d.conflictingGoals?.length) {
      lines.push(`  冲突目标: ${d.conflictingGoals.join("；")}`);
    }
    lines.push(`  requestFulfilled=false canonMark=null`);
  }
  if (evaluation.hasRefusal) {
    lines.push("禁止在【正史】/【状态建议】中将上述请求标为已完成。");
  }
  return lines.join("\n");
}
