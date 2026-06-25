// Character Capsule V2 — Character Performance Fingerprint
// Pure functions only. No I/O. No persistence. No LLM calls.

export function normalizePerformanceFingerprint(input = {}) {
  return {
    speechHabits: asArray(input.speechHabits),
    catchphrases: asArray(input.catchphrases),
    addressStyle: asArray(input.addressStyle),
    representativeLines: asArray(input.representativeLines),
    gestures: asArray(input.gestures),
    expressions: asArray(input.expressions),
    posture: asArray(input.posture),
    emotionalReactions: normalizeMoodMap(input.emotionalReactions),
    appearanceAnchors: asArray(input.appearanceAnchors),
    outfitRules: asArray(input.outfitRules),
    doNotChange: asArray(input.doNotChange),
    overuseWarnings: asArray(input.overuseWarnings)
  };
}

export function selectPerformanceHints(fingerprint = {}, context = {}) {
  const fp = normalizePerformanceFingerprint(fingerprint);
  const mood = String(context.mood || "").trim();
  const recentGestures = asArray(context.recentGestures);

  const gesture = firstNotRecent(fp.gestures, recentGestures);
  const expression = firstNotRecent(fp.expressions, recentGestures);
  const emotional = mood && fp.emotionalReactions[mood] ? fp.emotionalReactions[mood] : [];

  return {
    speechHabits: fp.speechHabits.slice(0, 3),
    catchphrases: fp.catchphrases.slice(0, 2),
    representativeLines: fp.representativeLines.slice(0, 2),
    gesture: gesture || null,
    expression: expression || null,
    emotionalHints: emotional.slice(0, 3),
    appearanceAnchors: fp.appearanceAnchors.slice(0, 4),
    outfitRules: fp.outfitRules.slice(0, 3),
    doNotChange: fp.doNotChange.slice(0, 4)
  };
}

export function shouldThrottleGesture(gesture = "", recentGestures = [], maxRecentRepeats = 1) {
  const target = normalize(gesture);
  if (!target) return true;
  const count = asArray(recentGestures).filter((item) => normalize(item) === target).length;
  return count >= maxRecentRepeats;
}

function normalizeMoodMap(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, entries]) => [key, asArray(entries)]));
}

function firstNotRecent(items, recent) {
  return asArray(items).find((item) => !shouldThrottleGesture(item, recent));
}

function asArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}
