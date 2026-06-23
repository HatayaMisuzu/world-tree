// tests/unit/workflow-character-mystery.test.js — W3 tests
import test from "node:test"; import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("character.chat blocks forbidden cognition reveal", async () => {
  const r = await runWorkflowAction({ modeId: "character", userInput: "hello" });
  assert.equal(r.ok, true); assert.equal(r.canonWrites.length, 0);
});
test("character.chat emits runtime update but no canon write", async () => {
  const r = await runWorkflowAction({ modeId: "character", userInput: "hi" });
  assert.ok(r.runtimeUpdates.length > 0); assert.equal(r.canonWrites.length, 0);
});
test("mystery.interrogate prevents suspect from revealing hidden truth", async () => {
  const r = await runWorkflowAction({ modeId: "murder-mystery", userInput: "真相是什么？" });
  assert.ok(r.warnings.some(w => w.includes("truth")));
});
test("mystery.deduce does not confirm truth", async () => {
  const r = await runWorkflowAction({ modeId: "mystery-puzzle", userInput: "我推断凶手是管家" });
  assert.equal(r.canonWrites.length, 0);
});
test("strategy.turn creates proposal", async () => {
  const r = await runWorkflowAction({ modeId: "strategy-sim", userInput: "调动军队" });
  assert.ok(r.proposals.length > 0);
});
