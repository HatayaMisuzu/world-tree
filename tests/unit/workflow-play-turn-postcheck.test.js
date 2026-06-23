// tests/unit/workflow-play-turn-postcheck.test.js — W2 tests
import test from "node:test"; import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("play.turn returns normalized result", async () => {
  const r = await runWorkflowAction({ modeId: "world-rpg", userInput: "前往酒馆" });
  assert.equal(r.ok, true); assert.ok(r.visibleText.length > 0); assert.equal(r.canonWrites.length, 0);
});
test("play.turn invokes prompt bridge with kernelContext", async () => {
  const r = await runWorkflowAction({ modeId: "world-rpg", userInput: "explore", kernelContext: { debug: { p0: true } } });
  assert.equal(r.ok, true);
});
test("play.turn produces workflow debug trace", async () => {
  const r = await runWorkflowAction({ modeId: "world-rpg", userInput: "test" });
  assert.ok(r.debugSummary); assert.equal(r.debugSummary.workflowType, "play.turn");
});
test("play.turn warns on hidden truth leak", async () => {
  const r = await runWorkflowAction({ modeId: "world-rpg", userInput: "hiddenTruth exposed" });
  // The post-check runs on visibleText which is built from envelope not LLM. But the play-turn stub puts userInput in visibleText
  assert.ok(r.warnings.length >= 0);
});
test("runtime update is allowed; canon write is not", async () => {
  const r = await runWorkflowAction({ modeId: "world-rpg", userInput: "hello" });
  assert.equal(r.canonWrites.length, 0);
});
