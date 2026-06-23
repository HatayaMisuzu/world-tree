export function checkCharacterOoc(profile = {}, message = "", context = {}, options = {}) {
  const warnings = [], driftSignals = [], msgs = [];
  const lower = String(message || "").toLowerCase();
  // Meta language check
  if (/(as an ai|i am an ai|language model|ai assistant|artificial intelligence)/i.test(message)) {
    driftSignals.push("meta_language"); warnings.push("AI self-reference detected");
  }
  // Name check
  if (profile.name && !lower.includes(profile.name.toLowerCase().slice(0, 3))) {
    driftSignals.push("name_check"); warnings.push("character name not referenced");
  }
  // Forbidden drift
  const forbidden = Array.isArray(profile.expressionDNA?.forbiddenDrift) ? profile.expressionDNA.forbiddenDrift : [];
  for (const phrase of forbidden) {
    if (lower.includes(phrase.toLowerCase())) { driftSignals.push("forbidden_drift"); warnings.push(`forbidden phrase: ${phrase}`); }
  }
  // Appearance drift
  const doNotChange = Array.isArray(profile.appearance?.doNotChange) ? profile.appearance.doNotChange : [];
  for (const trait of doNotChange.slice(0, 3)) {
    const neg = lower.includes(trait.toLowerCase() + " changed") || lower.includes("no longer " + trait.toLowerCase());
    if (neg) { driftSignals.push("appearance_drift"); warnings.push(`appearance drift on: ${trait}`); }
  }
  return { ok: driftSignals.length === 0, warnings, driftSignals, repairHints: warnings.length ? ["Consider re-rolling"] : [] };
}

export function createOocSignature(profile = {}, options = {}) {
  return { name: profile.name || "", forbiddenDrift: profile.expressionDNA?.forbiddenDrift || [], doNotChange: profile.appearance?.doNotChange || [], checksum: Date.now().toString(36) };
}

export function validateOocNegatives(profile = {}, options = {}) {
  const negatives = Array.isArray(profile.quality?.oocNegatives) ? profile.quality.oocNegatives : [];
  return { ok: true, negatives, driftRisks: profile.quality?.driftRisks || [] };
}