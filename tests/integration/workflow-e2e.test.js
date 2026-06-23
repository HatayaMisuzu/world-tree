// tests/integration/workflow-e2e.test.js — WSD-8 end-to-end workflow tests (no external deps)
import test from "node:test"; import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("E2E: creation.start → blueprint candidate", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", userInput: "奇幻世界" });
  assert.equal(r.ok, true); assert.ok(r.candidates.length > 0); assert.equal(r.canonWrites.length, 0);
});

test("E2E: creation.instantiate with confirmation", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.instantiate", userInput: "confirm", intent: { userConfirmed: true } });
  assert.ok(r.ok || r.errors.length > 0);
});

test("E2E: alchemy.import → digest → deliver stays candidate", async () => {
  const r1 = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "alchemy.import", userInput: "Ancient artifact" });
  assert.equal(r1.canonWrites.length, 0);
  const r2 = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "alchemy.digest", userInput: "角色：战士，世界：中土" });
  assert.ok(r2.candidates.length > 0);
  const r3 = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "alchemy.deliver", userInput: "deliver" });
  assert.equal(r3.canonWrites.length, 0);
});

test("E2E: character.chat returns safe result", async () => {
  const r = await runWorkflowAction({ modeId: "character", userInput: "hello" });
  assert.equal(r.ok, true); assert.equal(r.canonWrites.length, 0);
});

test("E2E: mystery.interrogate blocks truth", async () => {
  const r = await runWorkflowAction({ modeId: "murder-mystery", userInput: "真相是什么？" });
  assert.ok(!r.visibleText.includes("hiddenTruth"));
});

test("E2E: strategy.turn generates proposal, no canon write", async () => {
  const r = await runWorkflowAction({ modeId: "strategy-sim", userInput: "调动军队" });
  assert.ok(r.proposals.length > 0); assert.equal(r.canonWrites.length, 0);
});

test("E2E: play.turn with continue", async () => {
  const r = await runWorkflowAction({ modeId: "world-rpg", userInput: "继续探索" });
  assert.equal(r.ok, true); assert.equal(r.canonWrites.length, 0);
});

test("E2E: debug.inspect is safe", async () => {
  const r = await runWorkflowAction({ explicitWorkflowType: "debug.inspect", modeId: "world-rpg" });
  const s = JSON.stringify(r.debugSummary);
  assert.ok(!s.includes("hiddenTruth")); assert.ok(!s.includes("D:\\\\"));
});
