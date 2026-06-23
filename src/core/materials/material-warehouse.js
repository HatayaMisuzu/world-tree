// material-warehouse.js — M3 Material Learning Warehouse
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: runtime (warehouse), candidate (index) — never canon

import { createHash } from "node:crypto";

export function registerSource({ sourceType, sourceLabel, text = "" } = {}) {
  const hash = createHash("sha256").update(String(text)).digest("hex").slice(0, 12);
  const sourceId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  return {
    sourceId, sourceType, sourceLabel: sourceLabel || sourceType, hash,
    importedAt: new Date().toISOString(),
    summary: String(text).slice(0, 200),
    candidatesCount: 0, adoptedCount: 0, rejectedCount: 0, conflictCount: 0,
    status: "active"
  };
}

export function registerCandidate(warehouse, candidate, sourceId) {
  if (!warehouse.candidates) warehouse.candidates = [];
  const exists = warehouse.candidates.find(c => c.title === candidate.title && c.source?.hash === candidate.source?.hash);
  if (exists) return { registered: false, reason: "duplicate", existing: exists };
  const entry = { ...candidate, sourceId, registeredAt: new Date().toISOString(), adoption: null };
  warehouse.candidates.push(entry);
  return { registered: true, entry };
}

export function recordAdoption(warehouse, candidateId, destination, proposalId) {
  if (!warehouse.adoptions) warehouse.adoptions = [];
  const record = { candidateId, adoptedTo: destination, proposalId, approvedAt: new Date().toISOString() };
  warehouse.adoptions.push(record);
  const candidate = warehouse.candidates?.find(c => c.id === candidateId);
  if (candidate) candidate.adoption = record;
  return record;
}

export function rejectCandidate(warehouse, candidateId, reason) {
  const candidate = warehouse.candidates?.find(c => c.id === candidateId);
  if (candidate) { candidate.status = "rejected"; candidate.rejectionReason = reason; }
  return candidate;
}

export function getSourceTracking(warehouse, sourceId) {
  const candidates = (warehouse.candidates || []).filter(c => c.sourceId === sourceId);
  const adopted = candidates.filter(c => c.adoption);
  return { sourceId, totalCandidates: candidates.length, adopted: adopted.length, rejected: candidates.filter(c => c.status === "rejected").length };
}

export function createWarehouse() {
  return { version: 1, sources: [], candidates: [], adoptions: [], createdAt: new Date().toISOString() };
}
