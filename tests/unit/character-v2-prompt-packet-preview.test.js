import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCharacterV2PromptPacketPreview,
  validateCharacterV2PromptPacketPreview
} from "../../src/core/character/character-v2-prompt-packet-preview.js";

function ctx() {
  return {
    available: true,
    characterId: "char_misuzu",
    displayName: "美铃",
    normalSummary: { subtitle: "普通日本学生", safeForNormalUi: true },
    runtimeContract: { summary: "保持角色身份", blocks: ["ai_identity_leak"], outputGuidance: ["保持语气"] },
    cognitionBoundary: { summary: "熟悉日常，不装懂专业", commonKnowledgeExamples: ["微信"], depthLimitedExamples: ["汽车技术"], blockedMetaExamples: ["prompt"] },
    relationship: { baseline: "familiar_companion", label: "熟悉但不过界", requiresConfirmationFor: ["恋爱关系"] },
    performanceFingerprint: { status: "seed", overuseGuard: ["不要重复动作"] }
  };
}

test("builds preview-only prompt packet", () => {
  const packet = buildCharacterV2PromptPacketPreview(ctx());
  assert.equal(packet.previewOnly, true);
  assert.equal(packet.llmInjectionEnabled, false);
  assert.equal(packet.mayWriteCanon, false);
  assert.ok(packet.blocks.some(b => b.type === "runtime_contract"));
  assert.ok(packet.blocks.some(b => b.type === "cognition_boundary"));
});

test("validates write-disabled prompt preview", () => {
  const packet = buildCharacterV2PromptPacketPreview(ctx());
  const validation = validateCharacterV2PromptPacketPreview(packet);
  assert.equal(validation.ok, true);
});
