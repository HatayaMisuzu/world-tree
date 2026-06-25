// Detective V2 Testimony Registry
// Multiple deception types — not only "culprit lies".

export const TESTIMONY_RELIABILITY = ["first_hand", "second_hand", "assumption", "unknown"];
export const TESTIMONY_DECEPTION_TYPES = [
  "truthful",
  "lie",
  "partial_truth",
  "mistaken",
  "self_protective",
  "protecting_other",
  "assumption",
  "unknown",
];

export function normalizeTestimony(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    testimonyId: input.testimonyId || input.id || `tst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    witnessId: input.witnessId || "",
    witnessName: input.witnessName || "未知证人",
    summary: input.summary || "",
    fullStatement: input.fullStatement || input.summary || "",
    reliability: TESTIMONY_RELIABILITY.includes(input.reliability) ? input.reliability : "unknown",
    deceptionType: TESTIMONY_DECEPTION_TYPES.includes(input.deceptionType) ? input.deceptionType : "unknown",
    deceptionReason: input.deceptionReason || "",
    contradictionEvidenceIds: input.contradictionEvidenceIds || [],
    isCoreTestimony: input.isCoreTestimony !== undefined ? input.isCoreTestimony : false,
    relatedPersons: input.relatedPersons || [],
    sceneTrigger: input.sceneTrigger || "",
    tags: input.tags || [],
  };
}

export function normalizeTestimonyRegistry(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeTestimony).filter(Boolean);
}

export function validateTestimonyRegistry(items = []) {
  const errors = [];
  if (!Array.isArray(items)) return { valid: false, errors: ["items must be an array"] };
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    if (!t.testimonyId) errors.push(`testimony[${i}]: testimonyId required`);
    if (!t.witnessId && !t.witnessName) errors.push(`testimony[${i}]: witnessId or witnessName required`);
    if (!TESTIMONY_DECEPTION_TYPES.includes(t.deceptionType)) errors.push(`testimony[${i}]: unknown deceptionType "${t.deceptionType}"`);
  }
  return { valid: errors.length === 0, errors };
}

export function getPlayerTestimonyView(testimony = {}) {
  const { deceptionReason, fullStatement, ...safe } = testimony;
  return { ...safe, fullStatement: undefined };
}

export function findContradictions({ evidence = [], testimonies = [] } = {}) {
  const contradictions = [];
  for (const t of testimonies) {
    for (const eid of (t.contradictionEvidenceIds || [])) {
      const ev = evidence.find((e) => e.evidenceId === eid);
      contradictions.push({
        testimonyId: t.testimonyId,
        witnessName: t.witnessName,
        evidenceId: eid,
        evidenceLabel: ev?.label || eid,
        testimonySummary: t.summary,
        deceptionType: t.deceptionType,
      });
    }
  }
  return contradictions;
}
