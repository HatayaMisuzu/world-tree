// Character V2 Long-Term State
// Manages the full long-term state directory for a character.
// All writes are auditable and reversible.

import { createHash } from "node:crypto";

export function createCharacterV2LongTermState({ characterId, displayName } = {}) {
  if (!characterId) throw new Error("characterId required");

  return {
    schemaVersion: "world-tree.character.v2.long-term.1",
    characterId,
    displayName: displayName || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memory: {
      pending: [],
      confirmed: [],
      rejected: [],
    },
    relationship: {
      pending: [],
      confirmed: { baseline: "neutral", stage: "initial", trustScore: 0, familiarityScore: 0, boundaryFlags: [], lastChangedAt: null, changeLog: [] },
      rejected: [],
    },
    canon: {
      proposals: [],
      confirmed: [],
    },
    quality: {
      issues: [],
    },
    auditLog: [],
  };
}

export function validateCharacterV2LongTermState(state = {}) {
  const errors = [];
  if (!state.characterId) errors.push("missing characterId");
  if (!state.schemaVersion) errors.push("missing schemaVersion");
  if (!state.memory) errors.push("missing memory store");
  if (!state.relationship) errors.push("missing relationship store");
  if (!state.canon) errors.push("missing canon store");
  if (!Array.isArray(state.auditLog)) errors.push("auditLog must be array");
  return { valid: errors.length === 0, errors };
}

export function appendCharacterAuditEvent({ state, event } = {}) {
  if (!state || !event) return state;
  const entry = {
    eventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
    checksum: createHash("sha256").update(JSON.stringify(event)).digest("hex").slice(0, 8),
  };
  return {
    ...state,
    auditLog: [...(state.auditLog || []), entry],
    updatedAt: entry.timestamp,
  };
}
