// prompt-hidden-sanitizer.js
// Central hidden/private field sanitizer for LLM inputs.

const HIDDEN_KEY_RE = /(^|[_-])?(hidden|secret|private|system|gm|dm)([_-])?(truth|lock|notes|only|state|book)?$/i;
const EXACT_HIDDEN_KEYS = new Set([
  "hiddenTruth",
  "hidden_truth",
  "answerLock",
  "answer_lock",
  "truthLock",
  "truth_lock",
  "solutionLock",
  "solution_lock",
  "truthLedger",
  "truth_ledger",
  "hiddenMeaning",
  "hidden_meaning",
  "deceptionReason",
  "deception_reason",
  "isCulprit",
  "private",
  "_private",
  "privateNotes",
  "private_notes",
  "systemOnly",
  "_systemOnly",
  "system_only",
  "gmNotes",
  "gm_notes",
  "gmOnly",
  "gm_only",
  "dmOnly",
  "dm_only",
  "dmBook",
  "gmBook",
  "hiddenGmState",
  "hidden_gm_state",
  "roleSecrets",
  "role_secrets"
]);

const LOCAL_PATH_RE = /([A-Z]:\\[^\n\r]+|\/(?:Users|home)\/[^\n\r]+)/g;

export function isHiddenKey(key = "") {
  const k = String(key || "");
  if (!k) return false;
  if (EXACT_HIDDEN_KEYS.has(k)) return true;
  if (/^_/.test(k) && /(secret|private|system|hidden)/i.test(k)) return true;
  return HIDDEN_KEY_RE.test(k);
}

export function sanitizeForLlm(value, options = {}) {
  const {
    replacement = "[FILTERED]",
    maxDepth = 20,
    maxStringLength = 6000
  } = options;
  return sanitizeValue(value, { replacement, maxDepth, maxStringLength }, 0, "");
}

function sanitizeValue(value, options, depth, path) {
  if (depth > options.maxDepth) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeText(value, options.maxStringLength);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, options, depth + 1, `${path}[${index}]`));
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (isHiddenKey(key)) {
      out[key] = options.replacement;
    } else {
      out[key] = sanitizeValue(child, options, depth + 1, path ? `${path}.${key}` : key);
    }
  }
  return out;
}

export function sanitizeText(text = "", maxStringLength = 6000) {
  const raw = String(text ?? "").replace(LOCAL_PATH_RE, "<local-path>");
  return raw.length > maxStringLength ? `${raw.slice(0, maxStringLength)}…` : raw;
}

export function assertNoHiddenKeys(value = {}) {
  const hits = [];
  walk(value, "", hits);
  return { ok: hits.length === 0, hiddenKeys: hits };
}

function walk(value, path, hits) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, hits));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (isHiddenKey(key)) hits.push(next);
    walk(child, next, hits);
  }
}

export function buildSanitizedJsonBlock(title, value, options = {}) {
  return `【${title}】\n${JSON.stringify(sanitizeForLlm(value, options), null, 2)}`;
}
