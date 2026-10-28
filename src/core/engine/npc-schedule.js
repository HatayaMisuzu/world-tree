/**
 * s3-2: NPC position + minimal schedule.
 * Absorbs tabletop-v2 NPC state shape (id/name/location) without wall-clock.
 * Schedule entries are keyed by structured calendar totalDays (worldTick clock).
 */

import { calculateProximityScope } from "../proximity/proximity-scope.js";

/**
 * @typedef {{ atDay: number, locationId: string }} ScheduleEntry
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   locationId: string,
 *   schedule?: ScheduleEntry[],
 *   relationDistance?: number,
 *   [k: string]: unknown
 * }} NpcRuntime
 */

/**
 * Create an NPC runtime entry (tabletop-v2 pattern, structured-time only).
 * @param {object} def
 * @returns {NpcRuntime}
 */
export function createNpcRuntime(def = {}) {
  const id = String(def.id || def.npcId || def.name || "").trim();
  const schedule = Array.isArray(def.schedule)
    ? def.schedule
        .filter((e) => e && e.locationId != null && Number.isFinite(Number(e.atDay)))
        .map((e) => ({ atDay: Math.max(0, Number(e.atDay) || 0), locationId: String(e.locationId) }))
        .sort((a, b) => a.atDay - b.atDay)
    : [];
  const locationId = String(
    def.locationId || def.location || schedule[0]?.locationId || "unknown"
  );
  return {
    id: id || "npc_unknown",
    name: def.name || id || "未命名 NPC",
    locationId,
    schedule,
    relationDistance: Number.isFinite(Number(def.relationDistance))
      ? Number(def.relationDistance)
      : undefined,
    alive: def.alive !== false
  };
}

/**
 * Resolve location at a given calendar totalDays from schedule (last entry with atDay <= totalDays).
 * Falls back to current locationId when schedule is empty.
 */
export function resolveNpcLocationAt(npc = {}, totalDays = 0) {
  const day = Math.max(0, Number(totalDays) || 0);
  const schedule = Array.isArray(npc.schedule) ? npc.schedule : [];
  if (schedule.length === 0) return String(npc.locationId || "unknown");
  let loc = schedule[0].locationId;
  for (const entry of schedule) {
    if (entry.atDay <= day) loc = entry.locationId;
    else break;
  }
  return String(loc || npc.locationId || "unknown");
}

/**
 * Advance all NPC positions to match calendar totalDays.
 * @param {NpcRuntime[]} npcs
 * @param {number} totalDays
 * @returns {NpcRuntime[]}
 */
export function advanceNpcSchedules(npcs = [], totalDays = 0) {
  const day = Math.max(0, Number(totalDays) || 0);
  return (Array.isArray(npcs) ? npcs : []).map((npc) => {
    if (!npc || npc.alive === false) return npc;
    const locationId = resolveNpcLocationAt(npc, day);
    if (locationId === npc.locationId) return npc;
    return { ...npc, locationId };
  });
}

/** Build proximity-scope candidates from NPC runtimes. */
export function proximityCandidatesFromNpcs(npcs = []) {
  return (Array.isArray(npcs) ? npcs : [])
    .filter((n) => n && n.id && n.alive !== false)
    .map((n) => ({
      id: n.id,
      name: n.name,
      locationId: n.locationId,
      relationDistance: n.relationDistance,
      updatedAt: `day:${n.locationId}`
    }));
}

/**
 * Diff two proximity scopes into enter/exit ring change events.
 * @returns {{ id: string, from: string|null, to: string }[]}
 */
export function diffProximityRings(previous = null, next = null) {
  const prevReasons = previous?.reasons || {};
  const nextReasons = next?.reasons || {};
  const ids = new Set([...Object.keys(prevReasons), ...Object.keys(nextReasons)]);
  const changes = [];
  for (const id of ids) {
    const from = prevReasons[id]?.ring || null;
    const to = nextReasons[id]?.ring || null;
    if (from !== to && to) {
      changes.push({ id, from, to });
    }
  }
  return changes;
}

/**
 * Recompute proximity scope for NPCs relative to the player location,
 * then return { scope, npcs, changes }.
 */
export function recomputeNpcProximity({
  npcs = [],
  totalDays = 0,
  currentLocationId = "",
  protagonistId = "player",
  previousScope = null,
  relations = []
} = {}) {
  const advanced = advanceNpcSchedules(npcs, totalDays);
  const candidates = proximityCandidatesFromNpcs(advanced);
  const scope = calculateProximityScope({
    protagonistId,
    currentLocationId,
    candidates,
    relations
  });
  const changes = diffProximityRings(previousScope, scope);
  return { npcs: advanced, scope, changes };
}

export default {
  createNpcRuntime,
  resolveNpcLocationAt,
  advanceNpcSchedules,
  proximityCandidatesFromNpcs,
  diffProximityRings,
  recomputeNpcProximity
};
