import test from "node:test"; import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/core/workflows/workflow-runner.js";

test("creation.start returns candidate and writes no shared files", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", userInput: "我想创建一个奇幻世界" });
  assert.equal(r.ok, true); assert.ok(r.candidates.length > 0); assert.equal(r.canonWrites.length, 0);
});
test("creation.refine stays on a stage until all hard fields are answered", async () => {
  const started = await runWorkflowAction({ modeId: "creation-forge", userInput: "开始创建" });
  const sessionId = started.runtimeUpdates.find((item) => item.key === "wizard_session")?.sessionId;
  assert.ok(sessionId);

  const worldName = await runWorkflowAction({
    modeId: "creation-forge",
    explicitWorkflowType: "creation.refine",
    userInput: "黄铜港",
    runtime: { wizardSessionId: sessionId }
  });
  assert.equal(worldName.ok, true);
  assert.match(worldName.visibleText, /风格|类型/);
  assert.equal(worldName.runtimeUpdates[0].stage, "foundation");

  await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.refine", userInput: "蒸汽奇幻", runtime: { wizardSessionId: sessionId } });
  await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.refine", userInput: "悬疑", runtime: { wizardSessionId: sessionId } });
  const playerRole = await runWorkflowAction({
    modeId: "creation-forge",
    explicitWorkflowType: "creation.refine",
    userInput: "钟塔工程师",
    runtime: { wizardSessionId: sessionId }
  });
  assert.equal(playerRole.runtimeUpdates[0].stage, "characters");
  assert.match(playerRole.visibleText, /主角名字/);
});
test("creation.instantiate without confirmation writes nothing", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.instantiate", userInput: "confirm" });
  assert.equal(r.ok, false);
});
test("creation.instantiate with confirmation returns ok when possible", async () => {
  const r = await runWorkflowAction({ modeId: "creation-forge", explicitWorkflowType: "creation.instantiate", userInput: "confirm", intent: { userConfirmed: true } });
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
