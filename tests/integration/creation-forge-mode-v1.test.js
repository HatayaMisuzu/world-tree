import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { runCreationForgeTurn, createCreationForgeTurnPacket } from "../../src/core/creation-forge/creation-forge-mode-adapter.js";
import { analyzeForgeInput, detectForgeTargets } from "../../src/core/creation-forge/creation-forge-intake.js";
import { createForgeQuestions } from "../../src/core/creation-forge/creation-forge-questioning.js";
import { createForgeBlueprintFromIntake, validateForgeBlueprint } from "../../src/core/creation-forge/creation-forge-blueprint.js";
import { getForgeArtifactContract, FORGE_ARTIFACT_TYPES } from "../../src/core/creation-forge/creation-forge-artifact-contracts.js";
import { validateForgeArtifact } from "../../src/core/creation-forge/creation-forge-validator.js";
import { createForgeInstantiationPlan, instantiateForgeProject } from "../../src/core/creation-forge/creation-forge-project-instantiator.js";
import { exportForgeBlueprint, exportForgeArtifact } from "../../src/core/creation-forge/creation-forge-exporter.js";

test("forge intake detects targets from text", () => {
  const intake = analyzeForgeInput({ text: "一个推理案件，凶手是管家" });
  assert.ok(intake.detectedTargets.includes("murder-mystery"));
  assert.ok(intake.detectedTargets.includes("mystery-puzzle"));
});

test("forge intake defaults to worldbook for ambiguous input", () => {
  const intake = analyzeForgeInput({ text: "一些灵感" });
  assert.ok(intake.detectedTargets.includes("worldbook"));
  assert.equal(intake.confidence, "low");
});

test("forge questions generated for character target", () => {
  const qs = createForgeQuestions({ detectedTargets: ["character"] });
  assert.ok(qs.questions.length >= 2);
  assert.ok(qs.questions[0].question.includes("角色"));
});

test("forge blueprint generated with correct type", () => {
  const bp = createForgeBlueprintFromIntake({ detectedTargets: ["character"], inputId: "inp_1" }, { name: "测试" });
  assert.equal(bp.targetArtifactType, "character");
  assert.ok(bp.sections.answers.name);
});

test("forge blueprint validation catches missing type", () => {
  const v = validateForgeBlueprint({ title: "test" });
  assert.equal(v.status, "invalid");
});

test("forge artifact contract for all 7 types", () => {
  for (const t of FORGE_ARTIFACT_TYPES) {
    const ct = getForgeArtifactContract(t);
    assert.ok(ct, `contract missing for ${t}`);
    assert.ok(ct.requiredFields.includes("title"));
  }
});

test("forge validator catches missing sourceText", () => {
  const r = validateForgeArtifact({ title: "test", targetType: "character" });
  assert.equal(r.ok, false);
});

test("forge instantiation requires confirmation", () => {
  const plan = createForgeInstantiationPlan({ title: "T", targetType: "character" });
  const r = instantiateForgeProject(plan);
  assert.equal(r.ok, false);
  assert.ok(r.error.includes("confirmation"));
});

test("forge instantiation works with confirmation", () => {
  const plan = createForgeInstantiationPlan({ title: "T", targetType: "character" });
  const r = instantiateForgeProject(plan, {}, { confirmed: true });
  assert.equal(r.ok, true);
});

test("forge run turn generates full packet", () => {
  const r = runCreationForgeTurn({}, { text: "一个暴风城的神秘案件" });
  assert.equal(r.status, "ready");
  assert.ok(r.packet.intake.detectedTargets.length > 0);
  assert.ok(r.packet.questions.questions.length > 0);
  assert.ok(r.packet.blueprint.blueprintId);
});

test("deferred forge cannot create a normal persisted module", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST", body: JSON.stringify({ name: "forge_test", displayName: "炼金台", mode: "creation-forge", dataMode: "preset", subType: "classic", draft: true, sourceType: "pasted_text", sourceText: "灵感" })
    });
    assert.equal(create.body.status, "error");
    assert.equal(create.body.code, "MODE_PROJECT_CREATION_DISABLED");
    const wd = join(dataDir, "engine", "worlds", "forge_test");
    assert.equal(existsSync(wd), false);
  } finally { await server.stop(); await removeTempDir(dataDir); }
});
