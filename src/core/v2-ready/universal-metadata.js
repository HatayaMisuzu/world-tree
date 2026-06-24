// src/core/v2-ready/universal-metadata.js — v2-ready universal metadata normalizer
// Stage 4: all-mode V2-ready foundation. Does NOT implement full V2.

const VALID_SOURCE_TYPES = Object.freeze([
  "user_input", "raw_user_setting", "ai_inferred", "runtime_event",
  "imported_file", "system_rule"
]);

const VALID_AUTHORITY = Object.freeze([
  "user_setting", "confirmed_runtime", "canon", "inferred", "assistant_proposal"
]);

const VALID_CONFIDENCE = Object.freeze(["low", "medium", "high"]);

const VALID_VISIBILITY = Object.freeze([
  "player_visible", "gm_only", "hidden_truth", "mode_private", "system_only"
]);

const VALID_STATUS = Object.freeze([
  "draft", "candidate", "pending_review", "active", "archived", "rejected"
]);

const VALID_CANON_STATE = Object.freeze([
  "runtime_only", "candidate_only", "shared_canon"
]);

const DEFAULTS = Object.freeze({
  sourceType: "ai_inferred",
  authority: "inferred",
  confidence: "medium",
  visibility: "gm_only",
  status: "candidate",
  canonState: "candidate_only",
});

function safeStr(v, fb = "") {
  return typeof v === "string" ? v.trim().slice(0, 500) : fb;
}

function safeEnum(v, valid, fb) {
  return valid.includes(v) ? v : fb;
}

function safeISODate(v) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v;
  return new Date().toISOString();
}

export function normalizeUniversalMetadata(input = {}, defaults = {}) {
  const m = { ...DEFAULTS, ...defaults };
  const now = new Date().toISOString();
  const id = safeStr(input?.id || m.id, `v2r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const record = {
    id,
    type: safeStr(input?.type || m.type || "unknown"),
    modeScope: Array.isArray(input?.modeScope)
      ? [...input.modeScope].slice(0, 20)
      : (Array.isArray(m.modeScope) ? [...m.modeScope] : []),
    sourceType: safeEnum(input?.sourceType, VALID_SOURCE_TYPES, m.sourceType),
    authority: safeEnum(input?.authority, VALID_AUTHORITY, m.authority),
    confidence: safeEnum(input?.confidence, VALID_CONFIDENCE, m.confidence),
    visibility: safeEnum(input?.visibility, VALID_VISIBILITY, m.visibility),
    status: safeEnum(input?.status, VALID_STATUS, m.status),
    canonState: safeEnum(input?.canonState, VALID_CANON_STATE, m.canonState),
    sourceRef: safeStr(input?.sourceRef || m.sourceRef || ""),
    createdAt: safeISODate(input?.createdAt || m.createdAt || now),
    updatedAt: safeISODate(input?.updatedAt || now),
  };

  return Object.freeze(record);
}

export function isPlayerVisible(record) {
  return record?.visibility === "player_visible";
}

export function isHiddenTruth(record) {
  return record?.visibility === "hidden_truth";
}

export { VALID_SOURCE_TYPES, VALID_AUTHORITY, VALID_CONFIDENCE, VALID_VISIBILITY, VALID_STATUS, VALID_CANON_STATE };
