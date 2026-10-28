// Detective V2 Hypothesis Board
// Player hypotheses with supporting/contradicting evidence links.

export function createHypothesis({ runState, type = "general", claim = "", supportIds = [], contradictIds = [] } = {}) {
  const entries = runState.publicState?.hypothesisEntries || [];
  return [...entries, {
    hypothesisId: `hyp_${Date.now()}`,
    type,           // culprit | motive | method | timeline | general
    claim: claim.slice(0, 500),
    supportIds,
    contradictIds,
    confidence: 0,
    status: "draft",
    createdAt: new Date().toISOString(),
  }];
}

export function updateHypothesisConfidence({ runState, hypothesisId, confidence = 0 } = {}) {
  const entries = runState.publicState?.hypothesisEntries || [];
  return entries.map((h) => h.hypothesisId === hypothesisId ? { ...h, confidence: Math.min(1, Math.max(0, confidence)) } : h);
}

export function submitHypothesisForReview({ runState, hypothesisId } = {}) {
  const entries = runState.publicState?.hypothesisEntries || [];
  return entries.map((h) => h.hypothesisId === hypothesisId ? { ...h, status: "submitted", submittedAt: new Date().toISOString() } : h);
}
