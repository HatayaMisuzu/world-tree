// tests/integration/prompt-runtime-integration.test.js
// Integration: verify prompt layer works with existing mode-runner and kernel context
import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptOrchestrationPacket } from "../../src/core/prompts/prompt-builder.js";
import { buildModePrompt, buildModePromptResult, listModePromptProfiles } from "../../src/core/prompts/mode-prompt-registry.js";
import { runWorldTreeModeTurn } from "../../src/core/system/mode-runner.js";

test("existing buildModePrompt still works (backward compat)", () => {
  const prompt = buildModePrompt({ userInput: { text: "hello" } }, { profileId: "grand_world_v1" });
  assert.ok(prompt.length > 0);
  assert.ok(prompt.includes("World Tree"));
});

test("existing buildModePromptResult now uses orchestrator", () => {
  const result = buildModePromptResult({ userInput: { text: "hello" } }, { profileId: "grand_world_v1" });
  assert.equal(result.ok, true);
  assert.ok(result.prompt.length > 0);
  // Should now include final guard from orchestrator
  assert.ok(result.prompt.includes("最终输出") || result.prompt.includes("final_guard"));
});

test("profile list returns all 8 profiles", () => {
  const profiles = listModePromptProfiles();
  assert.ok(profiles.length >= 8);
});

test("orchestrator works with kernel context sidecar", () => {
  const kernelContext = {
    promptText: "[kernel sidecar test]",
    debug: { p0: true, p1: true, p2: true }
  };
  const packet = buildPromptOrchestrationPacket({
    modeId: "world-rpg", taskId: "writer",
    userInput: "continue exploring",
    kernelContext,
    generationType: "normal"
  });
  assert.equal(packet.ok, true);
  assert.ok(packet.blocks.some(b => b.position === "final_guard"));
});

test("mode-runner continues working with upgraded prompts", async () => {
  const result = await runWorldTreeModeTurn(
    { id: "demo", mode: "quick-setting" },
    { text: "test" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.kernelContext.status.p0, true);
});

test("all modes produce unique prompt texts", () => {
  const modes = ["world-rpg", "character", "murder-mystery", "creation-forge"];
  const texts = new Set();
  for (const modeId of modes) {
    const p = buildPromptOrchestrationPacket({ modeId, taskId: "writer", generationType: "normal" });
    texts.add(p.promptText.slice(0, 200));
  }
  assert.equal(texts.size, modes.length, "each mode should produce distinct prompts");
});

test("character mode prompt has card-specific content", () => {
  const p = buildPromptOrchestrationPacket({ modeId: "character", taskId: "writer", generationType: "normal" });
  assert.ok(p.promptText.includes("角色模式") || p.promptText.includes("character"));
  assert.ok(p.promptText.includes("Emotional Inertia") || p.promptText.includes("情绪"));
});
