// tests/unit/prompt-mode-profiles.test.js
// Verify each mode profile has the correct blocks and constraints
import test from "node:test";
import assert from "node:assert/strict";
import { resolveBlocks, ALL_BLOCKS } from "../../src/core/prompts/prompt-blocks.js";
import { buildPromptOrchestrationPacket } from "../../src/core/prompts/prompt-builder.js";

const MODES = {
  "quick-setting": { mustContain: ["不编造事实", "candidate"], mustNotContain: [] },
  "world-rpg": { mustContain: ["Proximity", "proposal", "大世界"], mustNotContain: [] },
  "character": { mustContain: ["角色", "Emotional Inertia", "OOC"], mustNotContain: [] },
  "tabletop": { mustContain: ["主持人", "检定", "DND"], mustNotContain: [] },
  "mystery-puzzle": { mustContain: ["答案", "分级", "线索"], mustNotContain: [] },
  "murder-mystery": { mustContain: ["真相锁", "嫌疑人", "凶手"], mustNotContain: [] },
  "strategy-sim": { mustContain: ["阵营", "proposal", "因果链"], mustNotContain: [] },
  "creation-forge": { mustContain: ["候选", "candidate"], mustNotContain: [] }
};

test("each mode profile resolves valid blocks", () => {
  for (const [modeId, checks] of Object.entries(MODES)) {
    const blocks = resolveBlocks({ modeId, taskId: "writer" });
    assert.ok(blocks.length >= 2, `${modeId}: should have >= 2 blocks, got ${blocks.length}`);
    const text = blocks.map(b => b.content).join(" ");
    for (const term of checks.mustContain) {
      assert.ok(text.includes(term), `${modeId}: must contain "${term}"`);
    }
    for (const term of checks.mustNotContain) {
      assert.ok(!text.includes(term), `${modeId}: must NOT contain "${term}"`);
    }
  }
});

test("each mode builds a valid packet", () => {
  for (const modeId of Object.keys(MODES)) {
    const p = buildPromptOrchestrationPacket({ modeId, taskId: "writer", userInput: "hello", generationType: "normal" });
    assert.equal(p.ok, true, `${modeId}: ok`);
    assert.ok(p.debug.blockCount >= 2, `${modeId}: blockCount ${p.debug.blockCount}`);
  }
});

test("block IDs are unique", () => {
  const ids = ALL_BLOCKS.map(b => b.id);
  assert.equal(new Set(ids).size, ids.length, "all block IDs must be unique");
});
