// Character Capsule V2 — Profile Draft Validation
// Pure functions only. No I/O. No persistence. No LLM calls.

export function validateCharacterV2Draft(profile = {}) {
  const issues = [];

  requireString(profile.name || profile.displayName, "name", issues);
  requireString(profile.summary || profile.oneLineSummary, "summary", issues);

  if (!profile.relationshipBaseline) {
    issues.push(warn("relationshipBaseline", "Missing relationship baseline; default should be familiar_companion."));
  }

  if (!profile.runtimeContract) {
    issues.push(warn("runtimeContract", "Missing runtime contract settings."));
  }

  if (!profile.cognitionBoundary) {
    issues.push(warn("cognitionBoundary", "Missing companion common-sense cognition boundary."));
  }

  if (!profile.performanceFingerprint) {
    issues.push(warn("performanceFingerprint", "Missing performance fingerprint."));
  }

  if (profile.avatar && profile.avatar.participatesInPrompt === true) {
    issues.push(error("avatar", "Manual avatar must be UI-only and must not participate in prompt or appearance inference."));
  }

  return {
    ok: issues.every((item) => item.level !== "error"),
    issues
  };
}

function requireString(value, field, issues) {
  if (!String(value || "").trim()) {
    issues.push(error(field, `Missing required field: ${field}`));
  }
}

function warn(field, message) {
  return { level: "warn", field, message };
}

function error(field, message) {
  return { level: "error", field, message };
}
