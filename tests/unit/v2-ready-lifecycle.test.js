// tests/unit/v2-ready-lifecycle.test.js — Stage 4 P0
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLifecycleState, canWriteSharedCanon, isActive } from "../../src/core/v2-ready/lifecycle-state.js";

test("normalizeLifecycleState defaults to candidate / candidate_only", () => {
  const s = normalizeLifecycleState({});
  assert.equal(s.status, "candidate");
  assert.equal(s.canonState, "candidate_only");
});

test("normalizeLifecycleState clamps invalid values", () => {
  const s = normalizeLifecycleState({ status: "impossible", canonState: "nonsense" });
  assert.equal(s.status, "candidate");
  assert.equal(s.canonState, "candidate_only");
});

test("canWriteSharedCanon denies runtime_only", () => {
  assert.equal(canWriteSharedCanon({ canonState: "runtime_only" }), false);
});

test("canWriteSharedCanon denies candidate_only", () => {
  assert.equal(canWriteSharedCanon({ canonState: "candidate_only" }), false);
});

test("canWriteSharedCanon requires userConfirmed or approvedProposal for shared_canon", () => {
  assert.equal(canWriteSharedCanon({ canonState: "shared_canon", status: "active" }), false);
  assert.equal(canWriteSharedCanon({ canonState: "shared_canon", status: "active" }, { userConfirmed: true }), true);
  assert.equal(canWriteSharedCanon({ canonState: "shared_canon", status: "active" }, { approvedProposal: true }), true);
});

test("canWriteSharedCanon blocks pending_review", () => {
  assert.equal(canWriteSharedCanon({ canonState: "shared_canon", status: "pending_review" }, { userConfirmed: true }), false);
});

test("canWriteSharedCanon blocks rejected", () => {
  assert.equal(canWriteSharedCanon({ canonState: "shared_canon", status: "rejected" }, { userConfirmed: true }), false);
});

test("isActive returns true only for active status", () => {
  assert.equal(isActive({ status: "active" }), true);
  assert.equal(isActive({ status: "candidate" }), false);
  assert.equal(isActive({ status: "rejected" }), false);
});
