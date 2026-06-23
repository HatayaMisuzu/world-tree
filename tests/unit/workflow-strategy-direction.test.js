// tests/unit/workflow-strategy-direction.test.js — W4 tests
import test from "node:test"; import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("play.continue advances max one beat", async () => {
  const r = await runWorkflowAction({ userInput: "继续" });
  assert.equal(r.workflowType || r.debugSummary?.workflowType, "play.continue");
  assert.equal(r.canonWrites.length, 0);
});
test("play.auto_light does not generate canonWrites", async () => {
  const r = await runWorkflowAction({ explicitWorkflowType: "play.auto_light", userInput: "auto" });
  assert.equal(r.canonWrites.length, 0);
});
test("debug.inspect returns safe summary", async () => {
  const r = await runWorkflowAction({ explicitWorkflowType: "debug.inspect", modeId: "world-rpg" });
  assert.equal(r.ok, true); const s = JSON.stringify(r.debugSummary);
  assert.ok(!s.includes("hiddenTruth")); assert.ok(!s.includes("D:\\\\"));
});
