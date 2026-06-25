// Detective V2 Evidence Registry
// Manages evidence items with core/misdirection classification and testimony linking.

export const EVIDENCE_STRENGTHS = ["decisive", "strong", "moderate", "circumstantial", "weak"];
export const EVIDENCE_RELIABILITY = ["forensic", "documented", "eyewitness", "hearsay", "analysis", "unknown"];

export function normalizeEvidence(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    evidenceId: input.evidenceId || input.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: input.label || "未命名证据",
    source: input.source || "",
    discoveredFrom: input.discoveredFrom || input.location || "",
    visibleDescription: input.visibleDescription || input.description || "",
    hiddenMeaning: input.hiddenMeaning || "",
    relatedPersons: input.relatedPersons || [],
    relatedLocations: input.relatedLocations || [],
    relatedTimePoints: input.relatedTimePoints || [],
    contradictsTestimonyIds: input.contradictsTestimonyIds || [],
    supportsHypothesisIds: input.supportsHypothesisIds || [],
    isCoreClue: input.isCoreClue !== undefined ? input.isCoreClue : false,
    isMisleading: input.isMisleading !== undefined ? input.isMisleading : false,
    reliability: EVIDENCE_RELIABILITY.includes(input.reliability) ? input.reliability : "unknown",
    evidenceStrength: EVIDENCE_STRENGTHS.includes(input.evidenceStrength) ? input.evidenceStrength : "moderate",
    unlockConditions: input.unlockConditions || [],
    tags: input.tags || [],
  };
}

export function normalizeEvidenceRegistry(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeEvidence).filter(Boolean);
}

export function validateEvidenceRegistry(items = []) {
  const errors = [];
  if (!Array.isArray(items)) return { valid: false, errors: ["items must be an array"] };
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.evidenceId) errors.push(`evidence[${i}]: evidenceId required`);
    if (!e.visibleDescription && !e.label) errors.push(`evidence[${i}]: visibleDescription or label required`);
  }
  return { valid: errors.length === 0, errors };
}

export function getPlayerEvidenceView(evidence = {}) {
  const { hiddenMeaning, ...safe } = evidence;
  return safe;
}

export function linkEvidenceToTestimony(evidenceItems = [], testimonyItems = []) {
  const links = [];
  for (const ev of evidenceItems) {
    for (const tid of (ev.contradictsTestimonyIds || [])) {
      const testimony = testimonyItems.find((t) => t.testimonyId === tid);
      links.push({
        evidenceId: ev.evidenceId,
        testimonyId: tid,
        type: "contradicts",
        testimonySummary: testimony?.summary || tid,
      });
    }
  }
  return links;
}
