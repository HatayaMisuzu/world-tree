import { normalizeWorldbookCandidate, validateWorldbookCandidate } from "./worldbook-entry-schema.js";

export function createWorldbookCandidateLedger(input = {}) {
  return { version: 2, worldId: String(input.worldId || ""), candidates: Array.isArray(input.candidates) ? input.candidates.map(normalizeWorldbookCandidate) : [], reviewLog: Array.isArray(input.reviewLog) ? [...input.reviewLog] : [], createdAt: input.createdAt || new Date().toISOString(), updatedAt: input.updatedAt || new Date().toISOString() };
}

export function appendWorldbookCandidate(ledger, candidate, options = {}) {
  const target = ledger || createWorldbookCandidateLedger(options);
  const check = validateWorldbookCandidate(candidate);
  if (!check.ok) return { ok: false, errors: check.errors, warnings: check.warnings, ledger: target };
  const n = check.normalized;
  const exists = target.candidates.find(x => x.candidateId === n.candidateId || (x.draftEntry.title === n.draftEntry.title && x.draftEntry.content === n.draftEntry.content));
  if (exists) return { ok: true, deduped: true, candidate: exists, ledger: target };
  target.candidates.push(n);
  target.reviewLog.push(log("append", n));
  target.updatedAt = options.now || new Date().toISOString();
  return { ok: true, candidate: n, ledger: target };
}

export function transitionWorldbookCandidate(ledger, candidateId, action, options = {}) {
  const target = ledger || createWorldbookCandidateLedger(options);
  const item = target.candidates.find(x => x.candidateId === candidateId || x.id === candidateId);
  if (!item) return { ok: false, error: "candidate_not_found", ledger: target };
  const map = { confirm: "confirmed", reject: "rejected", merge: "merged", supersede: "superseded", expire: "expired" };
  if (!map[action]) return { ok: false, error: `unsupported_action:${action}`, ledger: target };
  const idx = target.candidates.indexOf(item);
  const updated = Object.freeze({ ...item, status: map[action], review: { action, reviewer: options.reviewer || "system", reason: options.reason || "", reviewedAt: options.now || new Date().toISOString() }, updatedAt: options.now || new Date().toISOString() });
  target.candidates[idx] = updated;
  target.reviewLog.push(log(action, updated, { reason: options.reason || "" }));
  target.updatedAt = updated.updatedAt;
  return { ok: true, candidate: updated, ledger: target };
}

export const getPendingWorldbookCandidates = (ledger) => (ledger?.candidates || []).filter(x => x.status === "pending");
export const getConfirmedWorldbookCandidates = (ledger) => (ledger?.candidates || []).filter(x => x.status === "confirmed");
export const candidateRequiresProposal = (candidate = {}) => candidate.requiresApproval !== false || ["major","critical"].includes(candidate.riskLevel);

function log(action, candidate, extra = {}) {
  return Object.freeze({ id: `wblog_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, action, candidateId: candidate.candidateId, title: candidate.draftEntry?.title || "", riskLevel: candidate.riskLevel || "medium", visibility: candidate.visibility || candidate.draftEntry?.visibility || "public", createdAt: new Date().toISOString(), ...extra });
}
