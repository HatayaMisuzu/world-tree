// prompt-visibility-policy.js — hidden truth / answer lock / private field filtering
// Part of World Tree Prompt Orchestration Layer v1

const HIDDEN_FIELD_PATTERNS = [
  "hiddenTruth",
  "answerLock",
  "truthLock",
  "_private",
  "_systemOnly",
  "_secret",
  "privateNotes",
  "gmNotes",
  "dmOnly"
];

const HIDDEN_PATH_PATTERNS = [
  /\.hiddenTruth/i,
  /\.answerLock/i,
  /\.truthLock/i,
  /\._private/i,
  /\._systemOnly/i,
  /\._secret/i,
  /\.privateNotes/i,
  /\.gmNotes/i,
  /\.dmOnly/i,
  /\["hiddenTruth"\]/i,
  /\["answerLock"\]/i,
  /\["truthLock"\]/i
];

/**
 * Deep filter hidden fields from any object.
 * Returns a new object with hidden fields replaced by "[FILTERED]".
 */
export function deepFilterHiddenFields(obj, depth = 0) {
  if (depth > 20) return obj; // Max recursion depth
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => deepFilterHiddenFields(item, depth + 1));
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (HIDDEN_FIELD_PATTERNS.some(p => key.includes(p) || key === p)) {
      result[key] = "[FILTERED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = deepFilterHiddenFields(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if a field key contains hidden/private patterns.
 */
export function isHiddenField(key) {
  if (!key || typeof key !== "string") return false;
  return HIDDEN_FIELD_PATTERNS.some(p => key.includes(p) || key === p);
}

/**
 * Check if a path (dot-notation or bracket) targets a hidden field.
 */
export function isHiddenPath(pathStr) {
  if (!pathStr) return false;
  return HIDDEN_PATH_PATTERNS.some(p => p.test(pathStr));
}

/**
 * Get visibility rules for a mode.
 */
export function getVisibilityRules(modeId) {
  const base = {
    public: "user visible",
    playerKnown: "player known fact",
    characterKnown: "current character knows",
    private: "system or specific character only",
    hiddenTruth: "never expose to player text",
    answerLock: "never expose to player text"
  };
  // Mode-specific overrides
  const overrides = {
    "murder-mystery": {
      truthLock: "system only, never in suspect testimony or scene description",
      answerLock: "only exposed at final reveal phase, never before"
    },
    "mystery-puzzle": {
      answerLock: "never exposed; only graded hints",
      truthLock: "only as investigation conclusion, never as direct statement"
    },
    "character": {
      private: "character inner thoughts may be shared with emotional context, but core secrets are never directly stated"
    }
  };
  return { ...base, ...(overrides[modeId] || {}) };
}

/**
 * Build a visibility instruction string for prompt injection.
 */
export function buildVisibilityInstruction(modeId) {
  const rules = getVisibilityRules(modeId);
  return [
    "【可见性规则】",
    "public: " + rules.public,
    "playerKnown: " + rules.playerKnown,
    "characterKnown: " + rules.characterKnown,
    "private: " + rules.private,
    "hiddenTruth: " + rules.hiddenTruth,
    "answerLock: " + rules.answerLock
  ].join("\n");
}
