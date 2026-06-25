import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCharacterV2RuntimeMvp,
  validateCharacterV2RuntimeMvp,
  buildCharacterV2FirstTurnDraftTemplate
} from "../../src/core/character/character-v2-runtime-mvp.js";

function ctx() {
  return {
    available: true,
    readOnly: true,
    characterId: "char_misuzu",
    displayName: "美铃",
    normalSummary: { subtitle: "普通日本学生", safeForNormalUi: true },
    runtimeContract: { summary: "保持角色身份", blocks: ["ai_identity_leak"], outputGuidance: ["保持语气"] },
    cognitionBoundary: { summary: "熟悉日常，不装懂专业", commonKnowledgeExamples: ["微信"], depthLimitedExamples: ["汽车技术"], blockedMetaExamples: ["prompt"] },
    relationship: { baseline: "familiar_companion", label: "熟悉但不过界", requiresConfirmationFor: ["恋爱关系"] },
    performanceFingerprint: { status: "seed", overuseGuard: ["不要重复动作"] }
  };
}

test("builds runtime MVP with prompt preview and candidates", () => {
  const mvp = buildCharacterV2RuntimeMvp(ctx(), { userInput: "记住，我喜欢散步。" });
  assert.equal(mvp.previewOnly, true);
  assert.equal(mvp.llmInjectionEnabled, false);
  assert.equal(mvp.mayWriteCanon, false);
  assert.equal(mvp.promptPacketPreview.previewOnly, true);
  assert.ok(mvp.candidates.memoryCandidates.length >= 1);
  assert.equal(mvp.advancedSummary.hiddenFromNormalUi, true);
  assert.equal(validateCharacterV2RuntimeMvp(mvp).ok, true);
});

test("first turn template is not generated dialogue", () => {
  const template = buildCharacterV2FirstTurnDraftTemplate(ctx(), { userInput: "你好" });
  assert.equal(template.llmInjectionEnabled, false);
  assert.ok(template.template.some(line => line.includes("角色身份")));
  assert.ok(template.note.includes("not generated character dialogue"));
});
