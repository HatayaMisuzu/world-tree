function parseJson(text) {
  return JSON.parse(text);
}

function normalizeQuotes(text) {
  return String(text || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function stripFence(text) {
  const match = String(text || "").trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : null;
}

function firstBalancedObject(text) {
  const source = String(text || "");
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (start < 0) {
      if (ch === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

function lightRepair(text) {
  return normalizeQuotes(text)
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function tryParseCandidate(candidate, validate) {
  try {
    const value = parseJson(candidate);
    const validation = typeof validate === "function" ? validate(value) : { ok: true };
    if (!validation?.ok) {
      return {
        ok: false,
        value: null,
        error: validation?.error || "SCHEMA_INVALID",
        reason: "schema_invalid"
      };
    }
    return { ok: true, value, error: null, reason: "" };
  } catch (err) {
    return { ok: false, value: null, error: err?.message || "JSON_PARSE_FAILED", reason: "parse_failed" };
  }
}

export function extractJsonValue(raw, { validate } = {}) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, value: null, raw, error: "EMPTY_JSON_TEXT", reason: "empty" };

  const candidates = [
    text,
    stripFence(text),
    firstBalancedObject(text)
  ].filter(Boolean);

  for (const candidate of candidates) {
    const direct = tryParseCandidate(candidate, validate);
    if (direct.ok) return { ...direct, raw, candidate };

    const repaired = lightRepair(candidate);
    if (repaired !== candidate) {
      const fixed = tryParseCandidate(repaired, validate);
      if (fixed.ok) return { ...fixed, raw, candidate: repaired, repaired: true };
      if (fixed.reason === "schema_invalid") return { ...fixed, raw, candidate: repaired, repaired: true };
    }
    if (direct.reason === "schema_invalid") return { ...direct, raw, candidate };
  }

  return { ok: false, value: null, raw, error: "JSON_EXTRACT_FAILED", reason: "parse_failed" };
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateChatCompletionJson(value) {
  if (!isObject(value)) return { ok: false, error: "CHAT_COMPLETION_NOT_OBJECT" };
  if (!Array.isArray(value.choices)) return { ok: false, error: "CHAT_COMPLETION_CHOICES_MISSING" };
  return { ok: true };
}

export function validateLlmAnalysisJson(value) {
  if (!isObject(value)) return { ok: false, error: "LLM_ANALYSIS_NOT_OBJECT" };
  const known = [
    "intent",
    "emotionalSubtext",
    "pacingSuggestion",
    "pressureSuggestion",
    "eventIntensitySuggestion",
    "sceneGoal",
    "suggestedMustInclude",
    "suggestedMustNotInclude",
    "emotionalTarget"
  ];
  if (!known.some((field) => Object.hasOwn(value, field))) return { ok: false, error: "LLM_ANALYSIS_FIELDS_MISSING" };
  if (value.suggestedMustInclude !== undefined && !Array.isArray(value.suggestedMustInclude)) return { ok: false, error: "LLM_ANALYSIS_MUST_INCLUDE_INVALID" };
  if (value.suggestedMustNotInclude !== undefined && !Array.isArray(value.suggestedMustNotInclude)) return { ok: false, error: "LLM_ANALYSIS_MUST_NOT_INCLUDE_INVALID" };
  return { ok: true };
}

export function validateDirectionPacketJson(value) {
  if (!isObject(value)) return { ok: false, error: "DIRECTION_PACKET_NOT_OBJECT" };
  const hasPacketShape = ["directorDecision", "contentPlan", "writingConstraints", "storyState"].some((field) => Object.hasOwn(value, field));
  if (!hasPacketShape) return { ok: false, error: "DIRECTION_PACKET_FIELDS_MISSING" };
  if (value.contentPlan !== undefined && !isObject(value.contentPlan)) return { ok: false, error: "DIRECTION_PACKET_CONTENT_PLAN_INVALID" };
  if (value.contentPlan?.mustInclude !== undefined && !Array.isArray(value.contentPlan.mustInclude)) return { ok: false, error: "DIRECTION_PACKET_MUST_INCLUDE_INVALID" };
  if (value.contentPlan?.mustNotInclude !== undefined && !Array.isArray(value.contentPlan.mustNotInclude)) return { ok: false, error: "DIRECTION_PACKET_MUST_NOT_INCLUDE_INVALID" };
  return { ok: true };
}

export function validateAlchemyJson(value, purpose = "") {
  if (!isObject(value)) return { ok: false, error: "ALCHEMY_JSON_NOT_OBJECT" };
  const text = String(purpose || "");
  if (text.includes("plan")) {
    if (!isObject(value.summary) && !Array.isArray(value.entrypointMap) && !isObject(value.userDecisionNeeded)) {
      return { ok: false, error: "ALCHEMY_PLAN_FIELDS_MISSING" };
    }
    return { ok: true };
  }
  if (text.includes("preview") || text.includes("quick") || text.includes("localization")) {
    if (!value.title && !isObject(value.playableWorld) && !Array.isArray(value.worldbookEntries) && !Array.isArray(value.deliveryPlan)) {
      return { ok: false, error: "ALCHEMY_PREVIEW_FIELDS_MISSING" };
    }
    return { ok: true };
  }
  return { ok: true };
}
