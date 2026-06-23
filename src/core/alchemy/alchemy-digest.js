// alchemy-digest.js — M2 Alchemy Digest Candidate Flow
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: candidate only — never writes canon directly

import { createHash } from "node:crypto";

const CANDIDATE_TYPES = [
  "worldbookCandidate", "characterCandidate", "locationCandidate",
  "factionCandidate", "ruleCandidate", "caseClueCandidate",
  "sceneTemplateCandidate", "openingCandidate", "relationshipCandidate", "eventCandidate"
];

export function parseSourceMaterial({ text = "", sourceType = "unknown", sourceLabel = "" } = {}) {
  const hash = createHash("sha256").update(String(text)).digest("hex").slice(0, 16);
  const id = `mat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id, sourceType, sourceLabel: sourceLabel || sourceType, hash,
    rawPreview: String(text).slice(0, 200), createdAt: new Date().toISOString(),
    status: "ingested"
  };
}

export function extractCandidates(material) {
  const candidates = [];
  const text = String(material.rawPreview || "");
  // Simple heuristic extraction — in production this would be LLM-driven
  if (text.includes("角色") || text.includes("人物") || text.match(/name|名字|姓名/i)) {
    candidates.push(createCandidate(material, "characterCandidate", text.slice(0, 80)));
  }
  if (text.includes("世界") || text.includes("设定") || text.includes("背景")) {
    candidates.push(createCandidate(material, "worldbookCandidate", text.slice(0, 80)));
  }
  if (text.includes("地点") || text.includes("城市") || text.includes("王国")) {
    candidates.push(createCandidate(material, "locationCandidate", text.slice(0, 80)));
  }
  if (text.includes("组织") || text.includes("阵营") || text.includes("公会")) {
    candidates.push(createCandidate(material, "factionCandidate", text.slice(0, 80)));
  }
  // Default: at least one worldbook candidate
  if (candidates.length === 0) {
    candidates.push(createCandidate(material, "worldbookCandidate", text.slice(0, 80)));
  }
  return candidates;
}

function createCandidate(material, type, title) {
  return {
    id: `cand_${material.id}_${Math.random().toString(36).slice(2, 5)}`,
    materialId: material.id,
    type,
    title: title || "未命名候选",
    summary: String(material.rawPreview).slice(0, 100),
    suggestedTarget: type === "characterCandidate" ? "shared/characters.json" : "shared/worldbook.json",
    confidence: "high",
    riskLevel: "medium",
    conflicts: [],
    requiresApproval: true,
    suggestedProposalType: "worldbook_entry_create",
    source: { label: material.sourceLabel, hash: material.hash },
    score: { relevance: "high", consistency: "high", novelty: "medium", risk: "medium", readiness: "high" }
  };
}

export function dedupeCandidates(candidates, existingCanon = {}) {
  const seen = new Set(Object.keys(existingCanon));
  return candidates.filter(c => !seen.has(c.title));
}

export function detectConflicts(candidates, existingCanon = {}) {
  for (const c of candidates) {
    if (existingCanon[c.title]) c.conflicts.push({ type: "duplicate", existing: existingCanon[c.title] });
  }
  return candidates;
}

export function classifyRisk(candidate) {
  if (candidate.type === "ruleCandidate" || candidate.type === "factionCandidate") candidate.riskLevel = "high";
  else if (candidate.conflicts.length > 0) candidate.riskLevel = "high";
  else candidate.riskLevel = "medium";
  return candidate;
}

export function prepareDigestDelivery(candidates) {
  return {
    candidates: candidates.map(c => ({ ...c, status: "candidate", suggestedDestination: "warehouse" })),
    note: "All outputs are CANDIDATES. Do not write directly to shared/ or create projects."
  };
}
