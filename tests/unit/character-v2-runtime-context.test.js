import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCharacterV2RuntimeContext,
  validateCharacterV2RuntimeContext,
  summarizeCharacterV2RuntimeContext
} from "../../src/core/character/character-v2-runtime-context.js";

test("builds read-only runtime context from V2 sidecars", () => {
  const context = buildCharacterV2RuntimeContext({
    manifest: { characterId: "char_misuzu", displayName: "美铃", textFirst: true, multimodal: false },
    profile: { schemaVersion: "world-tree-character-profile.v2.seed.1", characterId: "char_misuzu", identity: { oneLineSummary: "普通日本学生" } },
    runtimeContract: { mode: "in_character_text_first", summary: "不自称 AI", blocks: ["ai_identity_leak"], outputGuidance: ["保持角色语气"] },
    cognitionBoundary: { mode: "companion_common_sense", summary: "熟悉日常，限制专业知识", commonKnowledgeExamples: ["微信"], depthLimitedExamples: ["汽车技术"], blockedMetaExamples: ["prompt"] },
    performanceFingerprint: { status: "seed", source: "manual", overuseGuard: ["不要重复动作"] },
    relationship: { baseline: "familiar_companion", label: "熟悉但不过界", requiresConfirmationFor: ["恋爱关系"] },
    memorySeed: { memories: [], note: "no writes" },
    uiSummary: { title: "美铃", subtitle: "角色摘要", lines: ["默认关系：熟悉但不过界"] }
  });

  assert.equal(context.available, true);
  assert.equal(context.readOnly, true);
  assert.equal(context.llmInjectionEnabled, false);
  assert.equal(context.mayWriteCanon, false);
  assert.equal(context.normalSummary.safeForNormalUi, true);
  assert.equal(context.advancedSummary.hiddenFromNormalUi, true);
  assert.ok(context.normalSummary.lines.some(line => line.includes("认知边界")));
});

test("runtime context validation rejects write permissions", () => {
  const context = buildCharacterV2RuntimeContext({ manifest: { characterId: "char_a", displayName: "A" } });
  context.mayWriteCanon = true;
  const validation = validateCharacterV2RuntimeContext(context);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(error => error.includes("must not write")));
});

test("summary strips runtime context to safe UI object", () => {
  const context = buildCharacterV2RuntimeContext({ manifest: { characterId: "char_a", displayName: "A" } });
  const summary = summarizeCharacterV2RuntimeContext(context);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.llmInjectionEnabled, false);
  assert.equal(summary.normalSummary.safeForNormalUi, true);
});
