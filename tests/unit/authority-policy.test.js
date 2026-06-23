// tests/unit/authority-policy.test.js
import test from "node:test"; import assert from "node:assert/strict";
import { createAuthorityContext, validateAuthorityForWrite, classifyTargetLayer, AUTHORITY_ACTION, TARGET_LAYERS } from "../../src/core/authority/asset-authority-policy.js";
import { normalizeCandidate, validateCandidate, candidateToProposal, CANDIDATE_KIND } from "../../src/core/candidates/candidate-schema.js";
import { normalizeAlchemyReviewItem, normalizeProcessingCandidate, normalizeWizardBlueprint } from "../../src/core/candidates/candidate-normalizer.js";

test("candidate_only cannot write shared", () => {
  const ctx = createAuthorityContext({ action: AUTHORITY_ACTION.CANDIDATE_ONLY, targetFile: "shared/worldbook.json" });
  const r = validateAuthorityForWrite(ctx);
  assert.equal(r.ok, false);
});

test("runtime_only cannot write shared", () => {
  const ctx = createAuthorityContext({ action: AUTHORITY_ACTION.RUNTIME_ONLY, targetFile: "shared/characters.json" });
  assert.equal(validateAuthorityForWrite(ctx).ok, false);
});

test("initialization_write can write shared when userConfirmed", () => {
  const ctx = createAuthorityContext({ action: AUTHORITY_ACTION.INITIALIZATION_WRITE, targetFile: "shared/worldbook.json", userConfirmed: true });
  assert.equal(validateAuthorityForWrite(ctx).ok, true);
});

test("manual_canon_edit requires userConfirmed", () => {
  const ctx = createAuthorityContext({ action: AUTHORITY_ACTION.MANUAL_CANON_EDIT, targetFile: "shared/worldbook.json" });
  assert.equal(validateAuthorityForWrite(ctx).ok, false);
});

test("proposal_approved_write requires proposalId", () => {
  const ctx = createAuthorityContext({ action: AUTHORITY_ACTION.PROPOSAL_APPROVED_WRITE, targetFile: "shared/worldbook.json", proposalId: "p1" });
  assert.equal(validateAuthorityForWrite(ctx).ok, true);
});

test("classifyTargetLayer handles shared/runtime/debug/candidate", () => {
  assert.equal(classifyTargetLayer("shared/worldbook.json"), TARGET_LAYERS.SHARED);
  assert.equal(classifyTargetLayer("runtime/state.json"), TARGET_LAYERS.RUNTIME);
  assert.equal(classifyTargetLayer("candidates/test.jsonl"), TARGET_LAYERS.CANDIDATE);
});

test("candidate schema validates", () => {
  const c = normalizeCandidate({ id: "t1", kind: "worldbook", summary: "test" });
  assert.equal(validateCandidate(c).ok, true);
  assert.equal(validateCandidate({}).ok, false);
});

test("candidateToProposal preserves source and risk", () => {
  const c = normalizeCandidate({ id: "t1", kind: "worldbook", riskLevel: "high", summary: "risky" });
  const p = candidateToProposal(c);
  assert.equal(p.impactLevel, "major");
  assert.equal(p.status, "pending");
});

test("normalizeAlchemyReviewItem produces valid candidate", () => {
  const c = normalizeAlchemyReviewItem({ id: "r1", typeId: "character", summary: "test" });
  assert.equal(c.kind, CANDIDATE_KIND.CHARACTER);
  assert.equal(c.requiresProposal, true);
});

test("normalizeWizardBlueprint produces blueprint candidate", () => {
  const c = normalizeWizardBlueprint({ sessionId: "w1", worldName: "Test" });
  assert.equal(c.kind, CANDIDATE_KIND.BLUEPRINT);
});
