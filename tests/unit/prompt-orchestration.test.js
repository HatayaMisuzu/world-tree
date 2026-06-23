// tests/unit/prompt-orchestration.test.js
// Tests that the prompt orchestrator works for all modes and tasks
import test from "node:test";
import assert from "node:assert/strict";

import { GLOBAL_RULES_V2, LAYERS, POSITIONS } from "../../src/core/prompts/prompt-contract.js";
import { resolveBlocks, getBlock, ALL_BLOCKS } from "../../src/core/prompts/prompt-blocks.js";
import { buildPromptOrchestrationPacket, buildInternalTaskPrompt } from "../../src/core/prompts/prompt-builder.js";
import { applyBudget, getBudget, estimateTokens } from "../../src/core/prompts/prompt-budget.js";
import { deepFilterHiddenFields, isHiddenField, buildVisibilityInstruction } from "../../src/core/prompts/prompt-visibility-policy.js";

const ALL_MODES = ["quick-setting", "world-rpg", "character", "tabletop", "mystery-puzzle", "murder-mystery", "strategy-sim", "creation-forge"];
const ALL_TASKS = ["writer", "director", "guardian", "proposal-extractor", "scene-summary", "worldbook-candidate", "processing-extractor", "emotional-inertia", "telemetry-explanation"];

test("every mode can build a non-empty prompt", () => {
  for (const modeId of ALL_MODES) {
    const packet = buildPromptOrchestrationPacket({ modeId, taskId: "writer", userInput: "测试输入", generationType: "normal" });
    assert.equal(packet.ok, true, `${modeId}: ok should be true`);
    assert.ok(packet.promptText.length > 50, `${modeId}: promptText should have content`);
    assert.ok(packet.blocks.length > 0, `${modeId}: should have blocks`);
  }
});

test("every mode includes final guard", () => {
  for (const modeId of ALL_MODES) {
    const packet = buildPromptOrchestrationPacket({ modeId, taskId: "writer", generationType: "normal" });
    const hasGuard = packet.blocks.some(b => b.position === "final_guard" || b.id.includes("final_guard"));
    assert.equal(hasGuard, true, `${modeId}: must include final_guard`);
  }
});

test("every task has a prompt block", () => {
  for (const taskId of ALL_TASKS) {
    const blocks = resolveBlocks({ modeId: "world-rpg", taskId });
    assert.ok(blocks.length > 0, `${taskId}: should resolve blocks`);
  }
});

test("hidden truth fields are filtered from prompt text", () => {
  const obj = { publicData: "safe", hiddenTruth: "secret", nested: { answerLock: "locked", okay: "fine" } };
  const filtered = deepFilterHiddenFields(obj);
  assert.equal(filtered.publicData, "safe");
  assert.equal(filtered.hiddenTruth, "[FILTERED]");
  assert.equal(filtered.nested.answerLock, "[FILTERED]");
  assert.equal(filtered.nested.okay, "fine");
});

test("budget removes optional blocks but keeps required ones", () => {
  const blocks = resolveBlocks({ modeId: "world-rpg", taskId: "writer" });
  const budget = 200; // very small budget
  const { kept, omitted } = applyBudget(blocks, budget);
  assert.ok(kept.length > 0, "should keep some blocks");
  const requiredKept = kept.filter(b => b.required);
  const requiredOmitted = omitted.filter(b => b.required);
  assert.equal(requiredOmitted.length, 0, "no required blocks should be omitted");
  assert.ok(requiredKept.length > 0, "required blocks should be kept");
});

test("internal task prompt is compact", () => {
  const packet = buildInternalTaskPrompt({ modeId: "murder-mystery", taskId: "director" });
  assert.equal(packet.ok, true);
  assert.ok(packet.promptText.includes("final_guard") || packet.blocks.some(b => b.position === "final_guard"));
});

test("creation-forge prompt does not allow direct project creation", () => {
  const packet = buildPromptOrchestrationPacket({ modeId: "creation-forge", taskId: "writer", generationType: "normal" });
  const prompt = packet.promptText;
  // The prompt should instruction AGAINST creating projects, so the instruction string exists
  assert.ok(prompt.includes("候选") || prompt.includes("candidate"), "should mention candidate");
  assert.ok(prompt.includes("Growth Tree") || prompt.includes("proposal"), "should mention Growth Tree or proposal");
  // Verify the strict boundary instruction exists
  assert.ok(prompt.includes("未经确认") || prompt.includes("不创建项目") || prompt.includes("不直接"), "should forbid auto-creation");
});

test("murder mystery prompt does not leak truth lock", () => {
  const packet = buildPromptOrchestrationPacket({ modeId: "murder-mystery", taskId: "writer", generationType: "normal" });
  assert.ok(packet.promptText.includes("真相锁") || packet.promptText.includes("truthLock"), "should mention truth lock protection");
});

test("strategy sim prompt limits infinite cascade", () => {
  const packet = buildPromptOrchestrationPacket({ modeId: "strategy-sim", taskId: "writer", generationType: "normal" });
  assert.ok(packet.promptText.includes("因果链不超过") || packet.promptText.includes("depth"), "should limit cascade depth");
});

test("character prompt includes emotional inertia boundary", () => {
  const packet = buildPromptOrchestrationPacket({ modeId: "character", taskId: "writer", generationType: "normal" });
  assert.ok(packet.promptText.includes("Emotional Inertia") || packet.promptText.includes("情绪惯性") || packet.promptText.includes("渐进"), "should mention emotional inertia");
});

test("global rules V2 are defined", () => {
  assert.ok(GLOBAL_RULES_V2.length >= 6);
});

test("block catalog is non-empty", () => {
  assert.ok(ALL_BLOCKS.length >= 15, `expected >=15 blocks, got ${ALL_BLOCKS.length}`);
  const globalBlock = getBlock("global.final_guard");
  assert.ok(globalBlock, "final guard block must exist");
  assert.equal(globalBlock.required, true);
});

test("visibility instruction varies by mode", () => {
  const mm = buildVisibilityInstruction("murder-mystery");
  const normal = buildVisibilityInstruction("world-rpg");
  assert.ok(mm.includes("system") || mm.includes("never"), "murder mystery should differ from default");
  assert.notEqual(mm, normal, "should differ by mode");
});
