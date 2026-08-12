import test from "node:test";
import assert from "node:assert/strict";

import { validatePrehumanEvidence } from "../../scripts/lib/prehuman-evidence-validation.mjs";

function validEvidence() {
  return {
    schemaVersion: 2,
    testedSha: "abc123",
    worktreeCleanAtStart: true,
    status: "PASS",
    generatedAt: "2026-08-12T00:00:00.000Z",
    provider: { id: "deepseek", model: "deepseek-chat" },
    cases: { strategySimV2: { classification: "NOT_APPLICABLE_DETERMINISTIC_ARCHITECTURE", hiddenStateSafe: true } }
  };
}

test("prehuman verifier accepts exact clean PASS evidence", () => {
  assert.equal(validatePrehumanEvidence(validEvidence(), { testedSha: "abc123" }).ok, true);
});

test("prehuman verifier rejects blocked, stale, dirty, and fallback evidence", () => {
  for (const evidence of [
    { ...validEvidence(), status: "BLOCKED_BY_CREDENTIALS" },
    { ...validEvidence(), testedSha: "old" },
    { ...validEvidence(), worktreeCleanAtStart: false },
    { ...validEvidence(), cases: { ...validEvidence().cases, live: { localFallback: true } } }
  ]) assert.equal(validatePrehumanEvidence(evidence, { testedSha: "abc123" }).ok, false);
});
