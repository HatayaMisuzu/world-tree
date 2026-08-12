export function containsLocalFallback(value) {
  if (!value || typeof value !== "object") return false;
  if (value.localFallback === true) return true;
  return Object.values(value).some(containsLocalFallback);
}

export function validatePrehumanEvidence(evidence, { testedSha } = {}) {
  const errors = [];
  if (evidence?.schemaVersion !== 2) errors.push("schemaVersion must be 2");
  if (!testedSha || evidence?.testedSha !== testedSha) errors.push(`testedSha mismatch: ${evidence?.testedSha || "missing"} !== ${testedSha || "missing"}`);
  if (evidence?.worktreeCleanAtStart !== true) errors.push("worktreeCleanAtStart must be true");
  if (evidence?.status !== "PASS") errors.push(`status must be PASS, received ${evidence?.status || "missing"}`);
  if (!evidence?.generatedAt) errors.push("generatedAt is required");
  if (!evidence?.provider?.id || !evidence?.provider?.model) errors.push("provider id and model are required");
  if (containsLocalFallback(evidence)) errors.push("local fallback is not accepted");
  if (evidence?.cases?.strategySimV2?.classification !== "NOT_APPLICABLE_DETERMINISTIC_ARCHITECTURE") errors.push("Strategy Sim V2 must use deterministic not-applicable classification");
  if (evidence?.cases?.strategySimV2?.hiddenStateSafe !== true) errors.push("Strategy Sim V2 hidden-state isolation must pass");
  return { ok: errors.length === 0, errors };
}
