// src/core/v2-ready/relation-record.js — v2-ready lightweight relation record
// Stage 4: stores directed typed relations between entities. No graph algorithms.

const VALID_RELATION_TYPES = Object.freeze([
  "ally", "enemy", "neutral", "subordinate", "superior", "family",
  "friend", "rival", "lover", "debtor", "creditor", "unknown", "custom"
]);

const DEFAULTS = Object.freeze({
  relationType: "unknown",
  confidence: "medium",
  authority: "inferred",
  visibility: "gm_only",
});

function safeStr(v, fb = "") {
  return typeof v === "string" ? v.trim().slice(0, 200) : fb;
}

export function normalizeRelationRecord(input = {}) {
  const t = safeStr(input?.relationType || DEFAULTS.relationType);
  return Object.freeze({
    fromId: safeStr(input?.fromId || "", ""),
    toId: safeStr(input?.toId || "", ""),
    relationType: VALID_RELATION_TYPES.includes(t) ? t : "unknown",
    confidence: ["low", "medium", "high"].includes(input?.confidence) ? input.confidence : DEFAULTS.confidence,
    authority: ["user_setting", "confirmed_runtime", "canon", "inferred", "assistant_proposal"].includes(input?.authority) ? input.authority : DEFAULTS.authority,
    visibility: ["player_visible", "gm_only", "hidden_truth", "mode_private", "system_only"].includes(input?.visibility) ? input.visibility : DEFAULTS.visibility,
    modeScope: Array.isArray(input?.modeScope) ? [...input.modeScope].slice(0, 10) : [],
    sourceRef: safeStr(input?.sourceRef || ""),
  });
}

export function filterRelationsForMode(relations, modeId) {
  if (!Array.isArray(relations)) return [];
  return relations.filter(r => {
    if (!r) return false;
    const scope = r.modeScope || [];
    // If modeScope is empty, relation is global (available to all)
    if (scope.length === 0) return true;
    return scope.includes(modeId);
  });
}
