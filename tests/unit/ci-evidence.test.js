import test from "node:test";
import assert from "node:assert/strict";
import { buildCiEvidence, ciEvidenceArtifactName, resolveCiIdentity } from "../../scripts/lib/ci-evidence.mjs";
import { validateExactCiEvidence } from "../../scripts/lib/ci-evidence-validation.mjs";

test("push evidence identifies the exact tested commit without an ambiguous sha field", () => {
  const identity = resolveCiIdentity({ GITHUB_EVENT_NAME: "push", GITHUB_SHA: "commit-sha" });
  assert.deepEqual(identity, {
    eventName: "push", testedSha: "commit-sha", headSha: "commit-sha", baseSha: "", testSubject: "COMMIT"
  });
  const evidence = buildCiEvidence({ env: { GITHUB_EVENT_NAME: "push", GITHUB_SHA: "commit-sha" } });
  assert.equal("sha" in evidence, false);
  assert.equal(evidence.result, "PASS_REMOTE_EXACT_TESTED_SHA");
  assert.equal(ciEvidenceArtifactName(evidence), "world-tree-ci-evidence-tested-commit-sha");
});

test("pull request evidence keeps merge tested SHA distinct from head and base", () => {
  const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_SHA: "merge-sha", GITHUB_RUN_ID: "42", GITHUB_RUN_ATTEMPT: "2" };
  const event = { pull_request: { head: { sha: "head-sha" }, base: { sha: "base-sha" } } };
  const evidence = buildCiEvidence({ env, event });
  assert.equal(evidence.testedSha, "merge-sha");
  assert.equal(evidence.headSha, "head-sha");
  assert.equal(evidence.baseSha, "base-sha");
  assert.equal(evidence.testSubject, "PR_MERGE_COMMIT");
  assert.equal(evidence.workflowRunId, "42");
  assert.equal(ciEvidenceArtifactName(evidence), "world-tree-ci-evidence-tested-merge-sha-head-head-sha");
});

test("pull request evidence fails closed when event identity is unavailable", () => {
  assert.throws(
    () => resolveCiIdentity({ GITHUB_EVENT_NAME: "pull_request", GITHUB_SHA: "merge-sha" }, {}),
    /requires head and base SHA/
  );
});

test("remote verifier rejects legacy or wrong-SHA evidence", () => {
  const good = buildCiEvidence({
    env: { GITHUB_EVENT_NAME: "push", GITHUB_SHA: "candidate" },
    jobs: { check: "success", browserQuality: "success", coverage: "success", reliability: "success", windowsLauncher: "success" }
  });
  assert.equal(validateExactCiEvidence(good, { testedSha: "candidate" }).ok, true);
  assert.equal(validateExactCiEvidence({ ...good, testedSha: "old" }, { testedSha: "candidate" }).ok, false);
  assert.equal(validateExactCiEvidence({ ...good, sha: "candidate" }, { testedSha: "candidate" }).ok, false);
});
