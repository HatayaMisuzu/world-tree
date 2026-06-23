// tests/unit/workflow-authority-gate.test.js — W0 authority gate tests
import test from "node:test"; import assert from "node:assert/strict";
import { createWorkflowContextEnvelope } from "../../src/core/workflows/workflow-context-envelope.js";
import { decideWorkflowAuthority } from "../../src/core/workflows/workflow-authority-gate.js";

test("default play.turn is candidate-only, no canon write", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg" });
  const d = decideWorkflowAuthority(env);
  assert.equal(d.canWriteCanon, false); assert.equal(d.candidateOnly, true);
});

test("creation.instantiate without confirmation writes nothing", () => {
  const env = createWorkflowContextEnvelope({ modeId: "creation-forge" });
  env.workflowType = "creation.instantiate";
  const d = decideWorkflowAuthority(env, { userConfirmed: false });
  assert.equal(d.initializationWriteAllowed, false);
});

test("creation.instantiate with confirmation allows write", () => {
  const env = createWorkflowContextEnvelope({ modeId: "creation-forge" });
  env.workflowType = "creation.instantiate";
  const d = decideWorkflowAuthority(env, { userConfirmed: true });
  assert.equal(d.canWriteCanon, true);
});

test("debug.inspect is read-only", () => {
  const env = createWorkflowContextEnvelope({ modeId: "debug" });
  env.workflowType = "debug.inspect";
  const d = decideWorkflowAuthority(env);
  assert.equal(d.debugReadOnly, true); assert.equal(d.canWriteRuntime, false);
});

test("proposal.approve without approval stays candidate-only", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg" });
  env.workflowType = "proposal.approve";
  const d = decideWorkflowAuthority(env, { proposalApproved: false });
  assert.equal(d.candidateOnly, true);
});
