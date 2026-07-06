function safeText(value, max = 360) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeList(value, maxItems = 12, maxChars = 360) {
  return (Array.isArray(value) ? value : [])
    .map((item) => safeText(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function createSessionRecapProposal({ recap = {}, moduleKey = "", turnCount = 0, source = "session-recap" } = {}) {
  const newFacts = normalizeList(recap.newFacts || recap.facts || [], 20, 500);
  return {
    id: `session-recap-${Date.now()}`,
    kind: "session_recap",
    status: "pending_review",
    moduleKey: safeText(moduleKey, 120),
    turnCount: Number(turnCount || recap.turnCount || 0),
    summary: safeText(recap.summary || recap.recap || "", 1200),
    keyEvents: normalizeList(recap.keyEvents || recap.events || [], 16, 500),
    decisions: normalizeList(recap.decisions || [], 12, 500),
    openThreads: normalizeList(recap.openThreads || recap.unresolvedThreads || [], 12, 500),
    reviewProposals: newFacts.map((fact, index) => ({
      id: `session-fact-${index + 1}`,
      kind: "canon_candidate",
      type: "new_fact",
      status: "pending",
      source,
      fact,
      requiresHumanReview: true
    })),
    writes: { canon: false, proposal: true, review: true }
  };
}
