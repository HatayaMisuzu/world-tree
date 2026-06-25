// Detective V2 Truth Ledger
// Hidden solution data. Never exposed to player view.
// Must never be written into public Worldbook or shared runtime.

export function normalizeTruthLedger(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    culpritIds: input.culpritIds || [],
    motive: input.motive || "",
    method: input.method || "",
    realTimeline: input.realTimeline || [],
    falseTimeline: input.falseTimeline || [],
    keyContradictions: input.keyContradictions || [],
    criticalEvidenceIds: input.criticalEvidenceIds || [],
    misleadingEvidenceIds: input.misleadingEvidenceIds || [],
    witnessDeceptions: input.witnessDeceptions || [],
    solutionChain: input.solutionChain || [],
    gradingRubric: input.gradingRubric || {},
  };
}

export function validateTruthLedger(ledger = {}) {
  const errors = [];
  if (!Array.isArray(ledger.culpritIds)) errors.push("culpritIds must be an array");
  if (!ledger.motive && ledger.culpritIds.length > 0) errors.push("motive is required when culpritIds exist");
  if (!ledger.method) errors.push("method is required");
  if (!Array.isArray(ledger.solutionChain)) errors.push("solutionChain must be an array");
  return { valid: errors.length === 0, errors };
}

export function extractTruthLedgerForReview(ledger = {}) {
  return {
    culpritIds: [...(ledger.culpritIds || [])],
    motive: ledger.motive,
    method: ledger.method,
    solutionChain: [...(ledger.solutionChain || [])],
    criticalEvidenceIds: [...(ledger.criticalEvidenceIds || [])],
  };
}

const FORBIDDEN_IN_PLAYER_VIEW = ["truthLedger", "hiddenTruth", "solutionChain", "hiddenMeaning", "isLie", "lieReason"];

export function assertTruthLedgerNotInPlayerView(playerView = {}) {
  const text = JSON.stringify(playerView || {});
  const leaked = FORBIDDEN_IN_PLAYER_VIEW.filter((key) => text.includes(key));
  return { ok: leaked.length === 0, leaked };
}
