import test from "node:test";
import assert from "node:assert/strict";
import { buildSinglePlayerScriptKillImportPreview, commitSinglePlayerScriptKillImport } from "../../src/core/single-player-scriptkill/single-player-scriptkill-importer.js";
import fixture from "../fixtures/single-player-scriptkill-v2/ready-package.json" with { type: "json" };

test("JSON package import can be ready", () => {
  const preview = buildSinglePlayerScriptKillImportPreview({ package: fixture });
  assert.equal(preview.status, "ready", JSON.stringify(preview.validation));
});

test("text import does not fake ready", () => {
  const preview = buildSinglePlayerScriptKillImportPreview({ text: "# 故事简介\n只有一段故事，没有DM本和角色本。", ownershipDeclaration: { userConfirmedLegalAccess: true } });
  assert.equal(preview.status, "needs_mapping");
  assert.ok(preview.mappingHints.some(h => h.includes("不能假装完整可玩")));
});

test("commit rejects incomplete text unless forced and still does not mark ready", () => {
  const result = commitSinglePlayerScriptKillImport({ text: "# 故事简介\n只有一段故事。", ownershipDeclaration: { userConfirmedLegalAccess: true } });
  assert.notEqual(result.status, "ok");
  assert.equal(result.code, "NOT_READY_FOR_PLAY");
});
