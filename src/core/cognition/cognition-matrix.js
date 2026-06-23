// cognition-matrix.js — M5 Character Cognition Matrix
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: runtime/candidate — knowledge boundaries enforced

export const KNOWLEDGE_STATES = ["known", "suspected", "misunderstood", "unknown", "forbidden"];

export function createCognitionMatrix(characterId) {
  return {
    characterId,
    version: 1,
    entries: [],
    updatedAt: new Date().toISOString()
  };
}

export function addKnowledgeEntry(matrix, { fact, state = "unknown", sourceRefs = [], confidence = 0 } = {}) {
  if (!fact) return matrix;
  matrix.entries.push({
    fact,
    state,
    sourceRefs: sourceRefs || [],
    confidence: Math.max(0, Math.min(1, confidence)),
    updatedAt: new Date().toISOString()
  });
  matrix.updatedAt = new Date().toISOString();
  return matrix;
}

export function canCharacterReveal(matrix, fact) {
  const entry = matrix.entries.find(e => e.fact === fact);
  if (!entry) return { canReveal: false, reason: "unknown_to_character" };
  if (entry.state === "forbidden") return { canReveal: false, reason: "forbidden" };
  if (entry.state === "unknown") return { canReveal: false, reason: "unknown" };
  if (entry.state === "suspected") return { canReveal: true, confidence: "low", note: "express as suspicion, not fact" };
  if (entry.state === "known") return { canReveal: true, confidence: entry.confidence > 0.7 ? "high" : "moderate" };
  return { canReveal: false, reason: entry.state };
}

export function checkKnowledgeBoundary(matrix, fact) {
  const entry = matrix.entries.find(e => e.fact === fact);
  if (!entry) return { known: false, state: "unknown" };
  return { known: entry.state !== "unknown" && entry.state !== "forbidden", state: entry.state };
}

export function filterPlayerVisible(matrix, playerKnown = []) {
  return matrix.entries.filter(e => e.state !== "forbidden" && (e.state === "known" || playerKnown.includes(e.fact)));
}

export function getSuspicionSummary(matrix) {
  return matrix.entries.filter(e => e.state === "suspected").map(e => ({ fact: e.fact, confidence: e.confidence }));
}
