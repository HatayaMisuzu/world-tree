// tests/unit/prompt-activation-log.test.js
// Verify activation logging, budget tracking, and inspector
import test from "node:test";
import assert from "node:assert/strict";
import { createActivationLog, logBlockActivation, logBlockOmission, logHiddenFieldFilter, finalizeActivationLog, summarizeActivationLog } from "../../src/core/prompts/prompt-activation-log.js";
import { buildPromptInspector, validateInspectorSafety } from "../../src/core/prompts/prompt-inspector.js";
import { buildPromptOrchestrationPacket } from "../../src/core/prompts/prompt-builder.js";

test("activation log records blocks with reasons", () => {
  const log = createActivationLog("world-rpg", "writer", "normal");
  assert.equal(log.modeId, "world-rpg");
  assert.equal(log.taskId, "writer");
  assert.equal(log.blocks.length, 0);

  logBlockActivation(log, { id: "test.block", layer: "mode", position: "context", priority: 500, required: true, content: "test content" }, "trigger:mode");
  assert.equal(log.blocks.length, 1);
  assert.equal(log.blocks[0].reason, "trigger:mode");

  logBlockOmission(log, { id: "removed.block", layer: "mode", priority: 100 }, "budget");
  assert.equal(log.omittedBlocks.length, 1);

  logHiddenFieldFilter(log, "kernelContext.hiddenTruth");
  assert.equal(log.hiddenFieldsFiltered.length, 1);
});

test("finalize computes hash and token total", () => {
  const log = createActivationLog("test", "test", "normal");
  logBlockActivation(log, { id: "a", layer: "mode", position: "context", priority: 500, required: true, content: "hello world" });
  const finalized = finalizeActivationLog(log, "hello world");
  assert.ok(finalized.promptHash);
  assert.ok(finalized.promptHash.length > 0);
  assert.ok(finalized.totalTokens > 0);
});

test("summarize returns safe debug view without content", () => {
  const log = createActivationLog("test", "test", "normal");
  finalizeActivationLog(log, "test");
  const summary = summarizeActivationLog(log);
  assert.ok(summary);
  assert.equal(summary.blockCount, 0);
  assert.equal(summary.omittedCount, 0);
});

test("inspector extracts safe debug summary from packet", () => {
  const packet = buildPromptOrchestrationPacket({ modeId: "world-rpg", taskId: "writer", userInput: "test", generationType: "normal" });
  const inspector = buildPromptInspector(packet);
  assert.ok(inspector.modeId);
  assert.ok(inspector.blockCount > 0);
  assert.equal(inspector.finalGuardIncluded, true);
});

test("inspector hides prompt text by default", () => {
  const packet = buildPromptOrchestrationPacket({ modeId: "world-rpg", taskId: "writer", generationType: "normal" });
  const inspector = buildPromptInspector(packet);
  assert.equal("promptPreview" in inspector, false);

  const withText = buildPromptInspector(packet, { includePromptText: true, maxPromptChars: 100 });
  assert.ok(withText.promptPreview);
  assert.ok(withText.promptPreview.length <= 103);
});

test("inspector safety validator catches missing guard", () => {
  const bad = { finalGuardIncluded: false, blocks: [], totalTokens: 0, budget: 1000 };
  const result = validateInspectorSafety(bad);
  assert.equal(result.pass, false);
});

test("inspector safety passes for valid config", () => {
  const good = { finalGuardIncluded: true, blocks: [], omittedBlocks: [], totalTokens: 100, budget: 1000, hiddenFilteredCount: 0 };
  const result = validateInspectorSafety(good);
  assert.equal(result.pass, true);
});
