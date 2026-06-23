import { normalizeWorldbook } from "./worldbook-normalizer.js";

export function activateWorldbookContext(worldbook = {}, context = {}, options = {}) {
  const wb = normalizeWorldbook(worldbook);
  const entries = matchWorldbookEntries(wb.entries, { input: context.input || context.query || "" }, options);
  const visible = filterWorldbookEntriesByVisibility(entries, context.visibility || "player_known", options);
  const ranked = rankWorldbookEntries(visible, context, options);
  const active = ranked.slice(0, options.maxEntries || 8);
  return { activeEntries: active, totalEntries: wb.entries.length, matched: entries.length, visible: visible.length, selected: active.length };
}

export function matchWorldbookEntries(entries = [], input = {}, options = {}) {
  const query = String(input.input || "").toLowerCase();
  if (!query) return entries.filter(e => e.enabled !== false);
  return entries.filter(e => {
    if (e.enabled === false) return false;
    const keys = [...(e.keys || []), ...(e.secondaryKeys || [])];
    return keys.some(k => query.includes(k.toLowerCase())) || (e.tags || []).some(t => query.includes(t.toLowerCase()));
  });
}

export function filterWorldbookEntriesByVisibility(entries = [], visibility = "player_known", options = {}) {
  return entries.filter(e => e.visibility === visibility || e.visibility === "player_known");
}

export function rankWorldbookEntries(entries = [], context = {}, options = {}) {
  const query = String(context.input || "").toLowerCase();
  return [...entries].sort((a, b) => {
    const aHits = (a.keys || []).filter(k => query.includes(k.toLowerCase())).length;
    const bHits = (b.keys || []).filter(k => query.includes(k.toLowerCase())).length;
    return bHits - aHits || (b.priority || 100) - (a.priority || 100);
  });
}

export function createWorldContextActivationSummary(result = {}, options = {}) {
  return { totalEntries: result.totalEntries || 0, matched: result.matched || 0, visible: result.visible || 0, selected: result.selected || 0 };
}
