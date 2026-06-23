// random-event-pool.js — M9 Random Event Pool + Scene Direction Candidate
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: candidate (events), runtime (history/cooldowns)
// Major events must go through proposal — never write canon directly

const EVENT_TYPES = ["flavor", "clue", "conflict", "opportunity", "pressure"];

export function createEventPool() {
  return { version: 1, events: [], history: [], cooldowns: {} };
}

export function addEvent(pool, { id, title, type = "flavor", modeIds = [], conditions = {}, weight = 1, cooldown = 0, impactLevel = "light", visibility = "public", proposalRequired = false } = {}) {
  if (!id) throw new Error("event requires id");
  if (!EVENT_TYPES.includes(type)) throw new Error(`invalid event type: ${type}`);
  pool.events.push({ id, title, type, modeIds, conditions, weight, cooldown, impactLevel, visibility, proposalRequired });
  return pool;
}

export function getCandidateEvents(pool, { modeId = "", turnCount = 0, telemetry = {} } = {}) {
  const now = Date.now();
  const candidates = [];
  for (const event of pool.events) {
    if (event.modeIds.length > 0 && !event.modeIds.includes(modeId)) continue;
    if (pool.cooldowns[event.id] && now - pool.cooldowns[event.id] < event.cooldown * 1000) continue;
    if (event.visibility === "hidden") continue;
    candidates.push({ ...event, score: event.weight * (1 + Math.random() * 0.5) });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}

export function recordEventUsage(pool, eventId) {
  pool.cooldowns[eventId] = Date.now();
  pool.history.push({ eventId, usedAt: new Date().toISOString() });
  return pool;
}

export function proposeMajorEvent(pool, event) {
  if (event.impactLevel === "major" || event.proposalRequired) {
    return {
      type: "major_event_proposal",
      event,
      status: "candidate",
      requiresApproval: true,
      note: "Major events must go through proposal approval. Do not auto-trigger."
    };
  }
  return event;
}

export function getSceneDirectionCandidate(pool, { modeId, turnCount, telemetry } = {}) {
  const candidates = getCandidateEvents(pool, { modeId, turnCount, telemetry });
  if (candidates.length === 0) return null;
  const candidate = candidates[0];
  if (candidate.impactLevel === "major" || candidate.proposalRequired) {
    return proposeMajorEvent(pool, candidate);
  }
  return candidate;
}
