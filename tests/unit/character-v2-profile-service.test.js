import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createOrPreviewCharacterCapsule, loadCharacterCapsuleRuntimeMvp } from "../../src/server/character-capsule-service.js";
import { loadCharacterV2EditableProfile, saveCharacterV2EditableProfile } from "../../src/server/character-v2-profile-service.js";

test("advanced profile save reloads and changes the runtime packet source", () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-"));
  try {
    const created = createOrPreviewCharacterCapsule({ input: { name: "林澄", text: "温和的向导" }, confirmed: true }, { charactersRoot: root });
    const before = loadCharacterV2EditableProfile(root, created.characterId);
    const saved = saveCharacterV2EditableProfile(root, created.characterId, {
      ...before.editable,
      displayName: "林澄·远行者",
      oneLineSummary: "谨慎、温和，熟悉远行路线。",
      relationshipLabel: "互相信任的旅伴",
      relationshipAllows: "讨论行程, 适度关心",
      relationshipForbids: "擅自替用户做决定",
      runtimeSummary: "始终以旅伴身份自然回应。",
      outputGuidance: "先回应情绪, 再给出简洁建议",
      cognitionSummary: "熟悉旅行常识，不假装懂专业医疗知识。",
      commonKnowledgeExamples: "地图, 火车",
      depthLimitedExamples: "专业医学",
      catchphrases: "慢一点也没关系",
      speechHabits: "短句",
      gestures: "轻轻点头",
      expressions: "放松地笑",
      appearanceAnchors: "旧帆布背包"
    });
    assert.equal(saved.status, "ok");
    const reloaded = loadCharacterV2EditableProfile(root, created.characterId);
    assert.equal(reloaded.editable.displayName, "林澄·远行者");
    assert.deepEqual(reloaded.editable.catchphrases, ["慢一点也没关系"]);
    const runtime = loadCharacterCapsuleRuntimeMvp(root, created.characterId);
    assert.equal(runtime.available, true);
    assert.equal(runtime.displayName, "林澄·远行者");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("advanced profile validation rejects blank required fields without overwriting", () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-invalid-"));
  try {
    const created = createOrPreviewCharacterCapsule({ input: { name: "阿遥", text: "学生" }, confirmed: true }, { charactersRoot: root });
    const result = saveCharacterV2EditableProfile(root, created.characterId, { displayName: "", oneLineSummary: "学生" });
    assert.equal(result.status, "error");
    assert.equal(loadCharacterV2EditableProfile(root, created.characterId).editable.displayName, "阿遥");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
