// candidate-normalizer.js — Bridge old output formats to unified candidate schema
// Stage 1: Authority/Candidate — World Tree Maturation v1

import { normalizeCandidate, CANDIDATE_KIND } from "./candidate-schema.js";

export function normalizeAlchemyReviewItem(item) {
  return normalizeCandidate({
    id: item.id || item.reviewId,
    kind: item.typeId === "character" ? CANDIDATE_KIND.CHARACTER : CANDIDATE_KIND.WORLDBOOK,
    source: "alchemy-review", sourceRef: item.reviewId || item.id,
    confidence: "high", riskLevel: "medium",
    targetFile: item.typeId === "character" ? "shared/characters.json" : "shared/worldbook.json",
    summary: item.summary || item.title || "",
    proposedPatch: item.content ? { merge: { entries: [item.content] } } : null,
    visibility: "public", requiresProposal: true
  });
}

export function normalizeProcessingCandidate(item) {
  return normalizeCandidate({
    id: item.id, kind: CANDIDATE_KIND.MATERIAL,
    source: item.source?.label || "processing", sourceRef: item.materialId || item.id,
    confidence: item.confidence || "high", riskLevel: item.riskLevel || "medium",
    targetFile: item.suggestedTarget || "shared/worldbook.json",
    summary: item.title || item.summary || "",
    proposedPatch: item.content ? { merge: { entries: [item.content] } } : null,
    requiresProposal: true
  });
}

export function normalizeWizardBlueprint(blueprint) {
  return normalizeCandidate({
    id: blueprint.sessionId || `wiz_${Date.now()}`,
    kind: CANDIDATE_KIND.BLUEPRINT,
    source: "creation-wizard", sourceRef: blueprint.sessionId,
    confidence: "high", riskLevel: "medium",
    targetFile: "shared/worldbook.json",
    summary: `Blueprint: ${blueprint.worldName || "unnamed"}`,
    proposedPatch: { merge: { worldName: blueprint.worldName, genre: blueprint.genre, tone: blueprint.tone } },
    requiresProposal: false
  });
}

export function normalizeRandomEventCandidate(event) {
  return normalizeCandidate({
    id: event.id, kind: CANDIDATE_KIND.EVENT,
    source: "random-event-pool", sourceRef: event.id,
    confidence: "medium", riskLevel: event.impactLevel || "light",
    targetFile: "runtime/events/event-candidates.jsonl",
    summary: event.title || event.id,
    requiresProposal: event.proposalRequired === true
  });
}

export function normalizeWorldbookCandidate(candidate) {
  return normalizeCandidate({
    id: candidate.id, kind: CANDIDATE_KIND.WORLDBOOK,
    source: candidate.source?.label || "worldbook-growth",
    confidence: candidate.confidence || "medium", riskLevel: candidate.riskLevel || "medium",
    targetFile: "shared/worldbook.json",
    summary: candidate.title || candidate.summary || "",
    proposedPatch: candidate.content ? { merge: { entries: [{ title: candidate.title, content: candidate.content }] } } : null,
    requiresProposal: true
  });
}
