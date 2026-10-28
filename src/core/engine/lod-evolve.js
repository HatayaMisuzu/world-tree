/**
 * s3-3: LOD offscreen evolution (near / far / dormant wake补算).
 *
 * Absorbs ring labels from `src/core/proximity/proximity-scope.js`
 * (core / near / far / dormant) and the s3-2 NPC runtime shape.
 * Causal write-back lives in lifecycle via timeline-causality-wire (S4-4);
 * this module stays LOD-only (no parallel event bus).
 *
 * ## LOD rules
 * - **near** (and **core**): finer per-tick update — one fine step per
 *   calendar day since `lod.lastEvolvedDay`.
 * - **far**: coarser daily/period summary — same net on comparable fields,
 *   applied as one batch (tagged `far`).
 * - **dormant**: no ongoing evolution; `lod.lastEvolvedDay` freezes.
 *   On the tick that *enters* dormant from an active ring, the missed span
 *   is still applied under the previous active mode, then freeze.
 * - **wake** (dormant → near/core, or dormant → far): catch-up补算 with the
 *   same per-day rates so comparable fields match a continuous near run.
 *
 * ## Comparable fields (wake补算 ↔ continuous never-dormant)
 * - `lod.fatigue`      (0..100, +FATIGUE_PER_DAY / calendar day)
 * - `lod.taskProgress` (integer, +PROGRESS_PER_DAY / calendar day)
 *
 * Diagnostic (not asserted for parity): `lastEvolvedDay`, `lastMode`,
 * `fineSteps`, `summaryBatches`, `catchUpDays`.
 */

export const LOD_RINGS = Object.freeze({
  CORE: "core",
  NEAR: "near",
  FAR: "far",
  DORMANT: "dormant"
});

/** Per calendar day rates — identical for near / far net / wake补算. */
export const LOD_RATES = Object.freeze({
  FATIGUE_PER_DAY: 1,
  PROGRESS_PER_DAY: 1,
  FATIGUE_MAX: 100
});

const FINE_RINGS = new Set([LOD_RINGS.CORE, LOD_RINGS.NEAR]);
const ACTIVE_RINGS = new Set([LOD_RINGS.CORE, LOD_RINGS.NEAR, LOD_RINGS.FAR]);

/**
 * @typedef {{
 *   fatigue: number,
 *   taskProgress: number,
 *   lastEvolvedDay: number,
 *   lastMode: string|null,
 *   fineSteps: number,
 *   summaryBatches: number,
 *   catchUpDays: number
 * }} LodState
 */

/** @returns {LodState} */
export function createLodState(seed = {}) {
  return {
    fatigue: clampFatigue(Number(seed.fatigue) || 0),
    taskProgress: Math.max(0, Number(seed.taskProgress) || 0),
    lastEvolvedDay: Math.max(0, Number(seed.lastEvolvedDay) || 0),
    lastMode: seed.lastMode || null,
    fineSteps: Math.max(0, Number(seed.fineSteps) || 0),
    summaryBatches: Math.max(0, Number(seed.summaryBatches) || 0),
    catchUpDays: Math.max(0, Number(seed.catchUpDays) || 0)
  };
}

function clampFatigue(n) {
  return Math.max(0, Math.min(LOD_RATES.FATIGUE_MAX, n));
}

/** Closed-form apply of `days` onto comparable fields. */
export function applyLodDays(lod, days, mode = "near") {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  const base = createLodState(lod);
  if (n === 0) return { ...base, lastMode: mode };
  return {
    ...base,
    fatigue: clampFatigue(base.fatigue + n * LOD_RATES.FATIGUE_PER_DAY),
    taskProgress: base.taskProgress + n * LOD_RATES.PROGRESS_PER_DAY,
    lastMode: mode,
    catchUpDays: mode === "catchup" ? base.catchUpDays + n : base.catchUpDays,
    fineSteps: mode === "near" ? base.fineSteps + n : base.fineSteps,
    summaryBatches: mode === "far" ? base.summaryBatches + 1 : base.summaryBatches
  };
}

export function ringOf(scope, npcId) {
  return scope?.reasons?.[npcId]?.ring || LOD_RINGS.DORMANT;
}

export function isFineRing(ring) {
  return FINE_RINGS.has(ring);
}

export function isActiveRing(ring) {
  return ACTIVE_RINGS.has(ring);
}

export function isDormantRing(ring) {
  return ring === LOD_RINGS.DORMANT || ring == null;
}

/**
 * Attach lod bag. New bags start at lastEvolvedDay=0 so the first worldTick
 * span (0→N) is applied. Mid-game spawns should pass lod.lastEvolvedDay
 * explicitly (e.g. current calendar day) to avoid false backlog.
 */
export function ensureNpcLod(npc = {}, totalDays = 0) {
  void totalDays;
  if (npc?.lod && typeof npc.lod === "object") {
    if (npc.lod.lastEvolvedDay == null) {
      return { ...npc, lod: createLodState({ ...npc.lod, lastEvolvedDay: 0 }) };
    }
    return npc;
  }
  return { ...npc, lod: createLodState({ lastEvolvedDay: 0 }) };
}

function modeForRing(ring) {
  if (isFineRing(ring)) return "near";
  if (ring === LOD_RINGS.FAR) return "far";
  return LOD_RINGS.DORMANT;
}

/**
 * Evolve one NPC for (lastEvolvedDay → totalDays) given current/previous rings.
 *
 * @returns {{ npc: object, applied: object|null }}
 */
export function evolveNpcLod(
  npc = {},
  { totalDays = 0, ring = LOD_RINGS.DORMANT, previousRing = null } = {}
) {
  const day = Math.max(0, Number(totalDays) || 0);
  const current = ensureNpcLod(npc, day);
  const lod0 = createLodState(current.lod);
  const missed = Math.max(0, day - lod0.lastEvolvedDay);
  const fromDormant = isDormantRing(previousRing);
  const toDormant = isDormantRing(ring);
  const waking = fromDormant && isActiveRing(ring) && missed > 0;

  // Stay dormant with backlog: freeze (wake补算 later).
  if (toDormant && !waking && fromDormant) {
    return {
      npc: { ...current, lod: { ...lod0, lastMode: LOD_RINGS.DORMANT } },
      applied:
        missed > 0
          ? { mode: LOD_RINGS.DORMANT, days: 0, wake: false, deferredDays: missed }
          : null
    };
  }

  if (missed === 0) {
    return {
      npc: {
        ...current,
        lod: { ...lod0, lastMode: toDormant ? LOD_RINGS.DORMANT : modeForRing(ring) }
      },
      applied: null
    };
  }

  // Decide apply mode for the missed span:
  // - wake → catchup
  // - now fine → near
  // - now far → far
  // - entering dormant from active → apply under previous active mode, then freeze
  let mode;
  if (waking) {
    mode = "catchup";
  } else if (isFineRing(ring)) {
    mode = "near";
  } else if (ring === LOD_RINGS.FAR) {
    mode = "far";
  } else if (toDormant && isActiveRing(previousRing)) {
    mode = modeForRing(previousRing);
  } else {
    return {
      npc: { ...current, lod: { ...lod0, lastMode: LOD_RINGS.DORMANT } },
      applied: { mode: LOD_RINGS.DORMANT, days: 0, wake: false, deferredDays: missed }
    };
  }

  const evolved = applyLodDays(lod0, missed, mode);
  evolved.lastEvolvedDay = day;
  if (toDormant && mode !== "catchup") {
    // Entering dormant after flushing the span: surface dormant as lastMode.
    evolved.lastMode = LOD_RINGS.DORMANT;
  }
  return {
    npc: { ...current, lod: evolved },
    applied: { mode: toDormant && mode !== "catchup" ? LOD_RINGS.DORMANT : mode, days: missed, wake: mode === "catchup", flushedMode: mode }
  };
}

/**
 * Batch evolve NPCs from proximity scope (+ previous / ringChanges for wake).
 * @returns {{ npcs: object[], reports: object[] }}
 */
export function evolveNpcsByLod({
  npcs = [],
  totalDays = 0,
  scope = null,
  previousScope = null,
  ringChanges = null
} = {}) {
  const day = Math.max(0, Number(totalDays) || 0);
  const changeById = new Map();
  for (const c of Array.isArray(ringChanges) ? ringChanges : []) {
    if (c?.id) changeById.set(c.id, c);
  }
  const reports = [];
  const out = (Array.isArray(npcs) ? npcs : []).map((npc) => {
    if (!npc || npc.alive === false || !npc.id) return npc;
    const ring = ringOf(scope, npc.id);
    const prev = changeById.has(npc.id)
      ? changeById.get(npc.id).from
      : ringOf(previousScope, npc.id);
    const { npc: next, applied } = evolveNpcLod(npc, {
      totalDays: day,
      ring,
      previousRing: prev
    });
    if (applied) reports.push({ id: npc.id, ring, previousRing: prev, ...applied });
    return next;
  });
  return { npcs: out, reports };
}

/** Test helper: continuous near evolution over `days` from a seed lod. */
export function continuousNearLod(seedLod = {}, days = 0) {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  const base = createLodState(seedLod);
  const evolved = applyLodDays(base, n, "near");
  evolved.lastEvolvedDay = base.lastEvolvedDay + n;
  return evolved;
}

export default {
  LOD_RINGS,
  LOD_RATES,
  createLodState,
  applyLodDays,
  ringOf,
  isFineRing,
  isActiveRing,
  isDormantRing,
  ensureNpcLod,
  evolveNpcLod,
  evolveNpcsByLod,
  continuousNearLod
};
