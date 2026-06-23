// tests/unit/prompt-task-contracts.test.js
// Verify each task has a contract, output schema, and prompt blocks
import test from "node:test";
import assert from "node:assert/strict";
import { resolveBlocks } from "../../src/core/prompts/prompt-blocks.js";
import { getTaskSchema, TASK_SCHEMAS } from "../../src/core/prompts/prompt-output-schemas.js";
import { buildInternalTaskPrompt } from "../../src/core/prompts/prompt-builder.js";

const TASKS = ["writer", "director", "guardian", "proposal-extractor", "scene-summary", "worldbook-candidate", "processing-extractor", "emotional-inertia", "telemetry-explanation"];

test("each task has a schema definition", () => {
  for (const taskId of TASKS) {
    const schema = getTaskSchema(taskId);
    assert.ok(schema, `${taskId}: must have schema`);
  }
});

test("internal JSON tasks have block coverage", () => {
  const jsonTasks = ["director", "guardian", "proposal-extractor", "scene-summary", "worldbook-candidate", "processing-extractor", "emotional-inertia"];
  for (const taskId of jsonTasks) {
    const blocks = resolveBlocks({ modeId: "world-rpg", taskId });
    const taskBlocks = blocks.filter(b => b.taskIds.includes(taskId));
    assert.ok(taskBlocks.length > 0, `${taskId}: should have task-specific blocks`);
  }
});

test("internal task prompt for each task is valid", () => {
  for (const taskId of TASKS) {
    const packet = buildInternalTaskPrompt({ modeId: "world-rpg", taskId });
    assert.equal(packet.ok, true, `${taskId}: ok`);
    assert.ok(packet.promptText.length > 0, `${taskId}: non-empty prompt`);
  }
});

test("director schema enforces required JSON fields", () => {
  const schema = getTaskSchema("director");
  assert.equal(schema.type, "json");
  assert.ok("beatType" in schema.schema);
  assert.ok("pace" in schema.schema);
  assert.ok("forbiddenMoves" in schema.schema);
});

test("guardian schema covers anti-OOC checks", () => {
  const schema = getTaskSchema("guardian");
  assert.equal(schema.type, "json");
  assert.ok("oocDetected" in schema.schema);
  assert.ok("hiddenTruthLeaked" in schema.schema);
});

test("proposal-extractor outputs candidates not canon", () => {
  const blocks = resolveBlocks({ modeId: "world-rpg", taskId: "proposal-extractor" });
  const text = blocks.map(b => b.content).join(" ");
  assert.ok(text.includes("candidates") || text.includes("候选"));
  assert.ok(text.includes("JSON") || text.includes("json"));
});
