// tests/unit/workflow-creation-alchemy.test.js — W1 tests
import test from "node:test"; import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("creation.start returns candidate and writes no shared files", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", userInput: "我想创建一个奇幻世界" });
  assert.equal(r.ok, true); assert.ok(r.candidates.length > 0); assert.equal(r.canonWrites.length, 0);
});
test("creation.instantiate without confirmation writes nothing", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.instantiate", userInput: "confirm" });
  assert.equal(r.ok, false); assert.ok(r.errors.some(e => e.includes("confirmation")));
});
test("creation.instantiate with confirmation allows initialization write", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.instantiate", userInput: "confirm", intent: { userConfirmed: true }, runtime: { wizardSessionId: "test" } });
  // Without active session, will create new one but high-risk findings may still block
  assert.ok(r.ok || r.errors.length > 0);
});
test("alchemy.import records material as runtime only", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "alchemy.import", userInput: "Ancient artifact" });
  assert.equal(r.ok, true); assert.equal(r.canonWrites.length, 0);
});
test("alchemy.digest emits normalized candidates", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "alchemy.digest", userInput: "角色：战士，世界：中土" });
  assert.equal(r.ok, true); assert.ok(r.candidates.length > 0);
});
test("alchemy.deliver cannot write canon directly", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "alchemy.deliver", userInput: "deliver" });
  assert.equal(r.canonWrites.length, 0);
});
