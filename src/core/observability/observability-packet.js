// observability-packet.js — M11 Observability Terminal
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: debug (turn-debug) — never exposes hidden truth or local paths

import { createHash } from "node:crypto";

export function buildObservabilityPacket({
  modeId = "", taskId = "", branchId = "main",
  promptBlocks = [], promptBudget = 0, promptHash = "",
  worldbookActivations = 0, hiddenFiltered = 0,
  proposals = [], radarWarnings = [], ruleViolations = [],
  eventCandidates = [], materialCandidates = [],
  kernelStatus = {}, turnCount = 0
} = {}) {
  return {
    version: 1,
    turnId: `turn_${turnCount}`,
    modeId, taskId, branchId,
    kernel: {
      p0: Boolean(kernelStatus.p0), p1: Boolean(kernelStatus.p1), p2: Boolean(kernelStatus.p2)
    },
    prompt: {
      blocksActivated: promptBlocks.length,
      budget: promptBudget,
      hash: promptHash,
      worldbookActivations,
      hiddenFiltered
    },
    proposals: proposals.map(p => ({ id: p.id, impactLevel: p.impactLevel, status: p.status })),
    radar: { warnings: radarWarnings.length, violations: ruleViolations.length },
    events: { candidates: eventCandidates.length },
    materials: { candidates: materialCandidates.length },
    generatedAt: new Date().toISOString()
  };
}

export function redactDebugPacket(packet) {
  const safe = { ...packet };
  // Remove any field that could contain paths or secrets
  for (const key of Object.keys(safe)) {
    if (typeof safe[key] === "string" && (safe[key].includes(":\\") || safe[key].includes("D:") || safe[key].includes("C:"))) {
      safe[key] = "[REDACTED]";
    }
  }
  return safe;
}

export function isSafeForUser(packet) {
  const str = JSON.stringify(packet);
  return !str.includes("hiddenTruth") && !str.includes("answerLock") && !str.includes(":\\");
}
