// tests/unit/workflow-context-envelope.test.js — migrated to NEW workflow spine (Stage 5C)
import test from "node:test"; import assert from "node:assert/strict";
import { createWorkflowContextEnvelope, inferWorkflowType } from "../../src/core/workflows/workflow-context-envelope.js";
import { WORKFLOW_TYPES } from "../../src/core/workflows/workflow-types.js";

test("inferWorkflowType detects continue keywords", () => {
  assert.equal(inferWorkflowType({ userInput: "继续探索" }), WORKFLOW_TYPES.PLAY_CONTINUE);
  assert.equal(inferWorkflowType({ userInput: "下一幕" }), WORKFLOW_TYPES.PLAY_CONTINUE);
  assert.equal(inferWorkflowType({ userInput: "接着" }), WORKFLOW_TYPES.PLAY_CONTINUE);
});

test("inferWorkflowType detects creation start", () => {
  assert.equal(inferWorkflowType({ action: "create" }), WORKFLOW_TYPES.CREATION_START);
  assert.equal(inferWorkflowType({ endpoint: "/api/modules/create" }), WORKFLOW_TYPES.CREATION_START);
});

test("inferWorkflowType detects character chat", () => {
  assert.equal(inferWorkflowType({ modeId: "character" }), WORKFLOW_TYPES.CHARACTER_CHAT);
});

test("inferWorkflowType detects play turn as default fallback", () => {
  assert.equal(inferWorkflowType({ modeId: "world-rpg", userInput: "进入森林" }), WORKFLOW_TYPES.PLAY_TURN);
  assert.equal(inferWorkflowType({}), WORKFLOW_TYPES.PLAY_TURN);
});

test("workflow envelope has W0 defaults", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg", userInput: "进入森林" });
  assert.equal(env.version, 1);
  assert.equal(env.modeId, "world-rpg");
  assert.equal(env.workflowType, WORKFLOW_TYPES.PLAY_TURN);
  assert.equal(env.activeBranchId, "main");
  assert.ok(env.context);
  assert.ok(env.visibility);
});

test("workflow envelope falls back to unknown mode on empty input", () => {
  const env = createWorkflowContextEnvelope({});
  assert.equal(env.modeId, "unknown");
  assert.equal(env.workflowType, WORKFLOW_TYPES.PLAY_TURN);
});

test("workflow envelope preserves provided modeId and branchId", () => {
  const env = createWorkflowContextEnvelope({ modeId: "strategy-sim", activeBranchId: "alt-timeline" });
  assert.equal(env.modeId, "strategy-sim");
  assert.equal(env.activeBranchId, "alt-timeline");
});

test("workflow envelope accepts kernel and worldbook context", () => {
  const env = createWorkflowContextEnvelope({
    modeId: "world-rpg",
    kernelContext: { turnCount: 5 },
    worldbookContext: { entries: ["tavern"] }
  });
  assert.equal(env.context.p0p2Kernel.turnCount, 5);
  assert.deepEqual(env.context.worldbook.entries, ["tavern"]);
});
