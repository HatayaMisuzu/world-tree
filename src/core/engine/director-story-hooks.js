// Director 子模块：方案 A 剧情钩子、选取与导演决策日志。
// 由 director.js 拆出，行为不变；director.js 会重新导出。

import { rngFrom, stableId } from "../../shared/determinism.js";
import { scopedObject } from "./world-scope.js";

// ═══════════════════════════════════════════════════════════════
//  方案 A（PRD v0.3 §2/§3.1）：事件只从已有世界状态与 NPC 动机中引出
//  —— 不再用随机模板凭空生成冲突；节奏/情绪只决定"此刻是否适合叙述"，不决定"发生什么"。
// ═══════════════════════════════════════════════════════════════

const MOTIVE_KEYS = ["motive", "motivation", "goal", "goals", "desire", "agenda", "wants"];
const textOf = (v) => (typeof v === "string" ? v : v?.title || v?.description || v?.summary || v?.name || "").trim();
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * 从已有世界状态收集"可被叙述的钩子"：未解线索/未决事件 + NPC/组织动机。
 * 输出顺序稳定（与对象插入顺序无关），id 可复现。
 */
export function collectStoryHooks(moduleData = {}) {
  const hooks = [];
  const ws = moduleData?.worldState || {};
  for (const t of listOf(ws.openThreads)) {
    const title = textOf(t); if (title) hooks.push({ kind: "open_thread", title, ref: "worldState.openThreads", level: t?.severity === "major" ? "major" : "light" });
  }
  for (const e of [...listOf(ws.unresolvedEvents), ...listOf(ws.unresolved)]) {
    if (e?.status === "resolved") continue;
    const title = textOf(e); if (title) hooks.push({ kind: "unresolved_event", title, ref: "worldState.unresolvedEvents", level: e?.severity === "major" || e?.urgency === "high" ? "major" : "moderate" });
  }
  const actors = [...listOf(moduleData?.characters).map(c => ["npc", c]), ...listOf(moduleData?.organizations).map(o => ["faction", o])];
  for (const [kind, a] of actors) {
    const who = a?.name || a?.id; if (!who) continue;
    for (const k of MOTIVE_KEYS) for (const m of listOf(a?.[k])) {
      const motive = textOf(m); if (motive) hooks.push({ kind: `${kind}_motive`, actor: who, title: `${who}：${motive}`, ref: `${kind === "npc" ? "characters" : "organizations"}.${k}`, level: "moderate" });
    }
  }
  const seen = new Set();
  return hooks
    .map(h => ({ ...h, id: stableId("hook", h.kind, h.title) }))
    .filter(h => (seen.has(h.id) ? false : seen.add(h.id)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 导演决策日志（按世界隔离，进入 engineSnapshot → runtime/state.json，从而被状态哈希覆盖） */
const DIRECTOR_LOG = scopedObject("director.log", () => ({ decisions: [], max: 50 }));

export function exportDirectorLog() { return { decisions: DIRECTOR_LOG.decisions.slice(-DIRECTOR_LOG.max) }; }
export function importDirectorLog(data = {}) { DIRECTOR_LOG.decisions = Array.isArray(data?.decisions) ? data.decisions.slice(-DIRECTOR_LOG.max) : []; }
export function resetDirectorLog() { DIRECTOR_LOG.decisions = []; }
export function getDirectorDecisions() { return DIRECTOR_LOG.decisions.slice(); }

/** 本回合之前最近一次真正触发事件的回合（冷却计时起点；取自持久化的决策日志） */
export function lastTriggeredRound(beforeRound = Infinity) {
  for (let i = DIRECTOR_LOG.decisions.length - 1; i >= 0; i -= 1) {
    const d = DIRECTOR_LOG.decisions[i];
    if (d.trigger && d.round < beforeRound) return d.round;
  }
  return null;
}

export function recordDirectorDecision(entry) {
  const list = DIRECTOR_LOG.decisions;
  // 同一回合重复评估（prepareTurn + 混合模式复算）只保留最后一次
  if (list.length && list[list.length - 1].round === entry.round) list.pop();
  list.push(entry);
  if (list.length > DIRECTOR_LOG.max) list.splice(0, list.length - DIRECTOR_LOG.max);
}

/**
 * 从钩子中挑一个本回合可叙述的事件；没有钩子 → null（绝不凭空造事件）。
 * 最近 3 次已叙述过的钩子降权；挑选用种子 RNG。
 */
export function selectHookEvent(hooks = [], context = {}) {
  if (!hooks.length) return null;
  const recent = new Set(DIRECTOR_LOG.decisions.slice(-3).map(d => d.hookId).filter(Boolean));
  const fresh = hooks.filter(h => !recent.has(h.id));
  const pool = fresh.length ? fresh : hooks;
  const rng = rngFrom(context.rng, context.worldSeed ?? "world-tree", context.round || 0, "director.hook");
  const hook = pool[rng.int(pool.length)];
  const level = context.forceLevel || hook.level || "light";
  return {
    level,
    title: hook.title,
    proposal: hook.kind.endsWith("_motive") ? `让「${hook.actor}」按其既有动机行动：${hook.title}` : `推进已有线索：${hook.title}`,
    hookId: hook.id,
    hookKind: hook.kind,
    source: hook.ref,
    grounded: true,
    marker: level === "major" ? "★" : level === "moderate" ? "◆" : "·",
    canIncorporate: level === "major",
    canBackground: level !== "light"
  };
}
