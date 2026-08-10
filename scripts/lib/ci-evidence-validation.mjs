const REQUIRED_JOBS = Object.freeze(["check", "browserQuality", "coverage", "reliability", "windowsLauncher"]);

export function validateExactCiEvidence(evidence, { testedSha, headSha = testedSha, testSubject = "COMMIT" } = {}) {
  const errors = [];
  if (!evidence || typeof evidence !== "object") return { ok: false, errors: ["evidence JSON is missing"] };
  if (evidence.schemaVersion !== 2) errors.push("schemaVersion must be 2");
  if (evidence.testedSha !== testedSha) errors.push(`testedSha mismatch: ${evidence.testedSha || "missing"} !== ${testedSha}`);
  if (evidence.headSha !== headSha) errors.push(`headSha mismatch: ${evidence.headSha || "missing"} !== ${headSha}`);
  if (evidence.testSubject !== testSubject) errors.push(`testSubject mismatch: ${evidence.testSubject || "missing"} !== ${testSubject}`);
  if (evidence.result !== "PASS_REMOTE_EXACT_TESTED_SHA") errors.push("result is not PASS_REMOTE_EXACT_TESTED_SHA");
  for (const job of REQUIRED_JOBS) if (evidence.jobs?.[job] !== "success") errors.push(`job ${job} is not success`);
  if (Object.hasOwn(evidence, "sha")) errors.push("ambiguous legacy sha field is forbidden");
  return { ok: errors.length === 0, errors };
}
