// character-kernel-v2.js — M4 Character Kernel v2
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: canon (profile), runtime (expression/inertia) — boundaries enforced

export function createCharacterProfile({ characterId, name = "" } = {}) {
  return {
    version: 2,
    characterId: characterId || `char_${Date.now()}`,
    canonProfile: {
      name,
      identity: "",
      appearance: "",
      personalityCore: "",
      desire: "",
      fear: "",
      shame: "",
      protectiveInstinct: ""
    },
    expressionDNA: {
      sentenceLength: "medium",
      tone: "neutral",
      verbalHabits: [],
      tabooWords: [],
      addressRules: { default: "你", intimate: null, hostile: null }
    },
    responseLadder: {
      calm: { tone: "neutral", openness: "moderate" },
      surprised: { tone: "alert", openness: "guarded" },
      threatened: { tone: "defensive", openness: "closed" },
      intimate: { tone: "soft", openness: "open" },
      hostile: { tone: "cold", openness: "closed" }
    },
    growthPhase: { current: "initial", possibleDirections: [] },
    boundaries: {
      cannotReveal: [],
      cannotAssume: [],
      requiresProposal: []
    }
  };
}

export function validateCharacterBoundary(profile, field) {
  if (profile.boundaries.cannotReveal.includes(field)) return { allowed: false, reason: "cannot_reveal" };
  if (profile.boundaries.cannotAssume.includes(field)) return { allowed: false, reason: "cannot_assume" };
  return { allowed: true };
}

export function getExpressionHints(profile) {
  const dna = profile.expressionDNA || {};
  return [
    `句子长度偏好: ${dna.sentenceLength || "medium"}`,
    `语气: ${dna.tone || "neutral"}`,
    ...(dna.verbalHabits || []).map(h => `口癖: ${h}`),
    ...(dna.tabooWords || []).map(w => `禁语: ${w}`)
  ].filter(Boolean);
}

export function getResponsePattern(profile, situation) {
  const ladder = profile.responseLadder || {};
  return ladder[situation] || { tone: "neutral", openness: "moderate" };
}
