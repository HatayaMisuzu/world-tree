import { normalizeWorldbookEntry, normalizeWorldbookCandidate, validateWorldbookEntry } from "./worldbook-entry-schema.js";

export function createWorldbookStore(input = {}) {
  return { version: 2, worldId: String(input.worldId || ""), entries: Array.isArray(input.entries) ? input.entries.map(e => normalizeWorldbookEntry(e,{worldId:input.worldId})) : [], changeLog: Array.isArray(input.changeLog) ? [...input.changeLog] : [], createdAt: input.createdAt || new Date().toISOString(), updatedAt: input.updatedAt || new Date().toISOString() };
}

export function upsertWorldbookEntry(store, entry, options = {}) {
  const target = store || createWorldbookStore(options);
  const n = normalizeWorldbookEntry({ ...entry, authority: entry.authority || "canon" }, { worldId: target.worldId });
  const check = validateWorldbookEntry(n);
  if (!check.ok) return { ok: false, errors: check.errors, warnings: check.warnings, store: target };
  if (n.authority === "candidate" && !options.allowCandidate) return { ok: false, errors: ["candidate cannot be upserted directly into canon store"], warnings: check.warnings, store: target };
  const idx = target.entries.findIndex(x => x.entryId === n.entryId || x.title === n.title);
  const now = options.now || new Date().toISOString();
  if (idx >= 0) {
    const prior = target.entries[idx];
    const next = Object.freeze({ ...prior, ...n, authority: n.authority === "candidate" ? "canon" : n.authority, version: Number(prior.version || 1) + 1, updatedAt: now });
    target.entries[idx] = next;
    target.changeLog.push(change("update", next, { previousVersion: prior.version || 1, source: options.source || "upsert" }));
    target.updatedAt = now;
    return { ok: true, entry: next, store: target, warnings: check.warnings };
  }
  const stored = Object.freeze({ ...n, authority: n.authority === "candidate" ? "canon" : n.authority, version: Number(n.version || 1), createdAt: n.createdAt || now, updatedAt: now });
  target.entries.push(stored);
  target.changeLog.push(change("create", stored, { source: options.source || "upsert" }));
  target.updatedAt = now;
  return { ok: true, entry: stored, store: target, warnings: check.warnings };
}

export function applyConfirmedWorldbookCandidate(store, candidate, options = {}) {
  const n = normalizeWorldbookCandidate(candidate, { worldId: store?.worldId || options.worldId });
  if (n.status !== "confirmed" && !options.force) return { ok: false, error: "candidate_not_confirmed", store };
  if (["major","critical"].includes(n.riskLevel) && !options.approvedProposalId) return { ok: false, error: "proposal_required", requiresProposal: true, store };
  return upsertWorldbookEntry(store, { ...n.draftEntry, authority: "canon", sourceRefs: [...new Set([...(n.draftEntry.sourceRefs || []), n.candidateId, ...n.sourceRefs])], candidateRefs: [...new Set([...(n.draftEntry.candidateRefs || []), n.candidateId])] }, { ...options, source: "confirmed-candidate" });
}

export const getActiveWorldbookEntries = (store) => (store?.entries || []).filter(e => e.enabled !== false && e.status !== "disabled" && e.status !== "archived");

function change(action, entry, extra = {}) {
  return Object.freeze({ id: `wbchg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, action, entryId: entry.entryId, title: entry.title, version: entry.version || 1, visibility: entry.visibility, createdAt: new Date().toISOString(), ...extra });
}
