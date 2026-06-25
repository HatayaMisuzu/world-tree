/**
 * Character Capsule V2 candidate workbench service.
 * Stores candidate review queue and confirmed sidecars under character v2 directory only.
 */

import fs from "fs";
import path from "path";

const CANDIDATE_REVIEW_FILE = "candidate-review.json";
const MEMORY_CONFIRMED_FILE = "memory.confirmed.json";
const RELATIONSHIP_CONFIRMED_FILE = "relationship.confirmed.json";
const QUALITY_REVIEW_FILE = "quality-review.json";

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function safeCharacterId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").slice(0, 80) || `char_${Date.now()}`;
}

function resolveV2Dir(charactersRoot, characterId) {
  const root = path.resolve(charactersRoot);
  const dir = path.resolve(root, safeCharacterId(characterId), "v2");
  if (!dir.startsWith(root + path.sep) && dir !== root) throw new Error("路径越界");
  return dir;
}

function normalizeCandidate(kind, c) {
  return {
    id: c.id || `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    reason: c.reason || "",
    payload: c.payload || {},
    confidence: c.confidence || "low",
    status: "pending",
    requiresUserConfirmation: true,
    autoWrite: false,
    createdAt: new Date().toISOString(),
    decidedAt: null
  };
}

export function saveCharacterV2CandidatesForReview(charactersRoot, characterId, candidatesEnvelope = {}) {
  const v2Dir = resolveV2Dir(charactersRoot, characterId);
  const reviewFile = path.join(v2Dir, CANDIDATE_REVIEW_FILE);
  const existing = readJson(reviewFile, []);

  const kinds = [
    { key: "memoryCandidates", kind: "memory" },
    { key: "relationshipCandidates", kind: "relationship" },
    { key: "qualityCandidates", kind: "quality" }
  ];

  const added = [];
  for (const { key, kind } of kinds) {
    const items = candidatesEnvelope[key] || [];
    for (const c of items) {
      const entry = normalizeCandidate(kind, c);
      existing.push(entry);
      added.push(entry);
    }
  }

  writeJson(reviewFile, existing);
  return { saved: added.length, total: existing.length, candidates: added };
}

export function listCharacterV2CandidateReview(charactersRoot, characterId) {
  const v2Dir = resolveV2Dir(charactersRoot, characterId);
  const reviewFile = path.join(v2Dir, CANDIDATE_REVIEW_FILE);
  const items = readJson(reviewFile, []);
  return {
    characterId,
    total: items.length,
    pending: items.filter(c => c.status === "pending").length,
    approved: items.filter(c => c.status === "approved").length,
    rejected: items.filter(c => c.status === "rejected").length,
    candidates: items.map(({ id, kind, reason, confidence, status, createdAt }) => ({ id, kind, reason, confidence, status, createdAt }))
  };
}

export function decideCharacterV2Candidate(charactersRoot, characterId, candidateId, decision) {
  const v2Dir = resolveV2Dir(charactersRoot, characterId);
  const reviewFile = path.join(v2Dir, CANDIDATE_REVIEW_FILE);
  const items = readJson(reviewFile, []);
  const idx = items.findIndex(c => c.id === candidateId);
  if (idx < 0) return { ok: false, error: "候选不存在" };

  const candidate = items[idx];
  candidate.status = decision;
  candidate.decidedAt = new Date().toISOString();
  items[idx] = candidate;
  writeJson(reviewFile, items);

  if (decision === "approve") {
    const targetMap = {
      memory: path.join(v2Dir, MEMORY_CONFIRMED_FILE),
      relationship: path.join(v2Dir, RELATIONSHIP_CONFIRMED_FILE),
      quality: path.join(v2Dir, QUALITY_REVIEW_FILE)
    };
    const targetFile = targetMap[candidate.kind];
    if (targetFile) {
      const confirmed = readJson(targetFile, []);
      confirmed.push({
        id: candidate.id,
        kind: candidate.kind,
        reason: candidate.reason,
        payload: candidate.payload,
        confidence: candidate.confidence,
        approvedAt: candidate.decidedAt
      });
      writeJson(targetFile, confirmed);
    }
  }

  return { ok: true, candidateId, decision };
}
