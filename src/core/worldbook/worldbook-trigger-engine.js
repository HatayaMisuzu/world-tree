import { deepFilterHiddenFields } from "../system/mode-isolation-policy.js";

function safeEntry(entry = {}) { return deepFilterHiddenFields(entry); }

function matchesState(conditions = [], worldState = {}) {
  return conditions.every((condition) => {
    const actual = worldState.states?.[condition.stateId]?.value;
    return condition.equals === undefined || actual === condition.equals;
  });
}

export function activateWorldbookEntries(entries = [], context = {}, options = {}) {
  const input = String(context.userInput || "").toLowerCase();
  const sceneId = context.currentScene?.sceneId || context.currentScene?.id || "";
  const core = new Set(context.proximityScope?.rings?.core || []);
  const near = new Set(context.proximityScope?.rings?.near || []);
  const dormant = new Set(context.proximityScope?.rings?.dormant || []);
  const selected = [];
  const debug = { matchedByKeyword: [], matchedByScene: [], boostedByProximity: [], filteredByWorldState: [], filteredByIsolation: [] };
  for (const entry of entries) {
    if (["secret", "gm_only", "system_only"].includes(entry.visibility) || entry.gmOnly || entry.systemOnly) { debug.filteredByIsolation.push(entry.id); continue; }
    const conditions = entry.activation?.worldStateConditions || [];
    if (!matchesState(conditions, context.worldState || {})) { debug.filteredByWorldState.push(entry.id); continue; }
    const refs = new Set([...(entry.activation?.entityRefs || []), ...(entry.scope?.entityRefs || [])]);
    const keyword = [...(entry.keys || []), ...(entry.tags || [])].some((key) => input.includes(String(key).toLowerCase()));
    const scene = (entry.activation?.sceneRefs || []).includes(sceneId);
    const proximity = [...refs].some((ref) => core.has(ref) || near.has(ref));
    const dormantOnly = refs.size > 0 && [...refs].every((ref) => dormant.has(ref));
    const layer = entry.layer || "context";
    if (keyword) debug.matchedByKeyword.push(entry.id);
    if (scene) debug.matchedByScene.push(entry.id);
    if (proximity) debug.boostedByProximity.push(entry.id);
    if (layer === "base" || keyword || scene || (proximity && !dormantOnly)) selected.push({ ...safeEntry(entry), _score: Number(entry.priority || 0) + (keyword ? 30 : 0) + (scene ? 20 : 0) + (proximity ? 10 : 0) });
  }
  const limit = Math.max(1, Math.min(24, Number(options.maxEntries || 8)));
  const packet = { base: [], context: [], instant: [], debug };
  for (const entry of selected.sort((a, b) => b._score - a._score).slice(0, limit)) {
    const layer = ["base", "context", "instant"].includes(entry.layer) ? entry.layer : "context";
    const { _score, ...safe } = entry;
    packet[layer].push(safe);
  }
  return packet;
}
