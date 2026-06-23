// candidate-schema.js — Unified candidate format for all subsystems
// Stage 1: Authority/Candidate — World Tree Maturation v1

export const CANDIDATE_KIND = Object.freeze({
  WORLDBOOK: "worldbook", CHARACTER: "character", LOCATION: "location",
  FACTION: "faction", RULE: "rule", EVENT: "event", CLUE: "clue",
  RELATION: "relation", BLUEPRINT: "blueprint", MATERIAL: "material"
});

export function normalizeCandidate(input = {}) {
  const id = input.id || `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id, kind: input.kind || CANDIDATE_KIND.WORLDBOOK,
    source: input.source || "unknown", sourceRef: input.sourceRef || input.id || id,
    confidence: input.confidence || "medium", riskLevel: input.riskLevel || "medium",
    targetLayer: "candidate", targetFile: input.targetFile || "shared/worldbook.json",
    summary: input.summary || input.title || "", proposedPatch: input.proposedPatch || null,
    visibility: input.visibility || "public", requiresProposal: input.requiresProposal !== false,
    canAutoApply: false, createdAt: input.createdAt || new Date().toISOString(),
    warnings: input.warnings || []
  };
}

export function validateCandidate(candidate = {}) {
  const errors = [];
  if (!candidate.id) errors.push("missing id");
  if (!candidate.kind) errors.push("missing kind");
  if (!Object.values(CANDIDATE_KIND).includes(candidate.kind)) errors.push(`unknown kind: ${candidate.kind}`);
  return { ok: errors.length === 0, errors };
}

export function candidateToProposal(candidate = {}, options = {}) {
  return {
    type: "candidate_to_proposal", candidateId: candidate.id,
    kind: candidate.kind, targetFile: candidate.targetFile,
    patch: candidate.proposedPatch || { merge: {} },
    impactLevel: candidate.riskLevel === "high" ? "major" : "medium",
    reversible: true, summary: candidate.summary,
    source: candidate.source, requiresProposal: true,
    status: "pending", createdAt: new Date().toISOString()
  };
}
