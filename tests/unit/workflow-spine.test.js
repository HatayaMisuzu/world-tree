// tests/unit/workflow-spine.test.js — W0 core tests
import test from "node:test"; import assert from "node:assert/strict";
import { WORKFLOW_TYPES, validateWorkflowTypes, CREATION_WORKFLOWS, PLAY_WORKFLOWS, DEBUG_WORKFLOWS } from "../../src/core/workflows/workflow-types.js";
import { createWorkflowResult, validateWorkflowResult } from "../../src/core/workflows/workflow-result-schema.js";
import { inferWorkflowType, createWorkflowContextEnvelope } from "../../src/core/workflows/workflow-context-envelope.js";
import { routeWorkflowIntent } from "../../src/core/workflows/workflow-intent-router.js";
import { decideWorkflowAuthority } from "../../src/core/workflows/workflow-authority-gate.js";
import { routeWorkflowOutput } from "../../src/core/workflows/workflow-output-router.js";
import { buildWorkflowTrace } from "../../src/core/workflows/workflow-observability.js";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("workflow types are all unique strings", () => {
  const v = validateWorkflowTypes();
  assert.equal(v.duplicateFree, true);
  assert.ok(v.count >= 20);
});

test("all route groups contain known workflow types", () => {
  const all = Object.values(WORKFLOW_TYPES);
  for (const g of [CREATION_WORKFLOWS, PLAY_WORKFLOWS, DEBUG_WORKFLOWS]) {
    for (const w of g) assert.ok(all.includes(w));
  }
});

test("routeWorkflowIntent maps explicit type", () => {
  assert.equal(routeWorkflowIntent({ explicitWorkflowType: "play.turn" }), "play.turn");
});

test("routeWorkflowIntent maps creation-forge creation action", () => {
  assert.equal(routeWorkflowIntent({ modeId: "creation-forge", action: "create" }), "creation.start");
});

test("routeWorkflowIntent maps continue keywords", () => {
  assert.equal(routeWorkflowIntent({ userInput: "继续探索" }), "play.continue");
  assert.equal(routeWorkflowIntent({ input: "下一幕" }), "play.continue");
});

test("routeWorkflowIntent maps mystery investigate", () => {
  assert.equal(routeWorkflowIntent({ modeId: "mystery-puzzle", userInput: "调查现场" }), "mystery.investigate");
});

test("routeWorkflowIntent falls back to play.turn", () => {
  assert.equal(routeWorkflowIntent({}), "play.turn");
});

test("authority denies canon write for play.turn", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg", userInput: "hello" });
  const d = decideWorkflowAuthority(env);
  assert.equal(d.canWriteCanon, false);
  assert.equal(d.candidateOnly, true);
});

test("authority allows initialization write only with userConfirmed", () => {
  const env = createWorkflowContextEnvelope({ modeId: "creation-forge", userInput: "confirm" });
  env.workflowType = "creation.instantiate";
  assert.equal(decideWorkflowAuthority(env, { userConfirmed: true }).canWriteCanon, true);
  assert.equal(decideWorkflowAuthority(env, { userConfirmed: false }).canWriteCanon, false);
});

test("authority allows proposal approved write", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg" });
  env.workflowType = "proposal.approve";
  const d = decideWorkflowAuthority(env, { proposalApproved: true });
  assert.equal(d.canWriteCanon, true);
});

test("output router rejects canonWrites without authority", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg" });
  const auth = decideWorkflowAuthority(env);
  const result = routeWorkflowOutput(env, { canonWrites: [{ test: true }], text: "ok" }, auth);
  assert.equal(result.canonWrites.length, 0);
  assert.ok(result.warnings.length > 0 || result.errors.length > 0);
});

test("output router moves canonWrites to candidates when candidate-only", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg" });
  const auth = { canWriteCanon: false, candidateOnly: true };
  const result = routeWorkflowOutput(env, { canonWrites: [{ x: 1 }], text: "ok" }, auth);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].movedFromCanon, true);
});

test("observability redacts paths and hidden fields", () => {
  const env = createWorkflowContextEnvelope({ modeId: "test" });
  const trace = buildWorkflowTrace(env, {}, { promptBlocks: ["D:\\Users\\test"] });
  const s = JSON.stringify(trace);
  assert.ok(!s.includes("D:\\\\"));
  assert.ok(s.includes("REDACTED"));
});

test("runWorkflowAction returns normalized result", async () => {
  const result = await runWorkflowAction({ modeId: "world-rpg", userInput: "hello" });
  assert.equal(result.ok, true);
  assert.ok(result.visibleText.length > 0);
  assert.ok(result.debugSummary);
  assert.equal(result.debugSummary.workflowType, "play.turn");
});

test("createWorkflowResult validates", () => {
  const r = createWorkflowResult({ visibleText: "test", authorityDecision: { canWriteCanon: false } });
  assert.equal(validateWorkflowResult(r).ok, true);
});
