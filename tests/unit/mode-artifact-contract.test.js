import test from "node:test";
import assert from "node:assert/strict";

import {
  MODE_ARTIFACT_CONTRACT_VERSION,
  listModeArtifactContracts,
  getModeArtifactContract,
  isModeArtifactSupported,
  createDefaultModeArtifact,
  normalizeModeArtifact,
  validateModeArtifact,
  createModeArtifactSummary,
  createModeArtifactProjectInput
} from "../../src/core/modes/mode-artifact-contract.js";

const CONSUMER_MODES = ["quick-setting", "character", "world-rpg", "mystery-puzzle", "tabletop", "strategy-sim", "murder-mystery"];

// ─── Test 1: contracts cover 7 consumer modes ───

test("1. listModeArtifactContracts includes all 7 consumer modes", () => {
  const list = listModeArtifactContracts();
  const ids = list.map(c => c.modeId);
  for (const modeId of CONSUMER_MODES) {
    assert.ok(ids.includes(modeId), `missing ${modeId}`);
  }
});

// ─── Test 2: creation-forge not included ───

test("2. listModeArtifactContracts does not include creation-forge", () => {
  const list = listModeArtifactContracts();
  const ids = list.map(c => c.modeId);
  assert.equal(ids.includes("creation-forge"), false);
});

// ─── Test 3: isModeArtifactSupported ───

test("3. isModeArtifactSupported('world-rpg') = true", () => {
  assert.equal(isModeArtifactSupported("world-rpg"), true);
});

// ─── Test 4: creation-forge not supported ───

test("4. isModeArtifactSupported('creation-forge') = false", () => {
  assert.equal(isModeArtifactSupported("creation-forge"), false);
});

// ─── Test 5: getContract world-rpg sourceType ───

test("5. getModeArtifactContract('world-rpg').sourceType = world_rpg_seed", () => {
  const c = getModeArtifactContract("world-rpg");
  assert.equal(c.sourceType, "world_rpg_seed");
  assert.equal(c.dataMode, "worldbook");
});

// ─── Test 6: getContract character dataMode ───

test("6. getModeArtifactContract('character').dataMode = character_card", () => {
  const c = getModeArtifactContract("character");
  assert.equal(c.dataMode, "character_card");
});

// ─── Test 7: murder-mystery modeSpecificSharedFile ───

test("7. getModeArtifactContract('murder-mystery').modeSpecificSharedFile = shared/murder_mystery.json", () => {
  const c = getModeArtifactContract("murder-mystery");
  assert.equal(c.modeSpecificSharedFile, "shared/murder_mystery.json");
});

// ─── Test 8: createDefaultModeArtifact tabletop ───

test("8. createDefaultModeArtifact('tabletop') generates targetMode/tabletop_seed/worldbook", () => {
  const artifact = createDefaultModeArtifact("tabletop", { title: "龙牙酒馆" });
  assert.equal(artifact.targetMode, "tabletop");
  assert.equal(artifact.sourceType, "tabletop_seed");
  assert.equal(artifact.dataMode, "worldbook");
  assert.equal(artifact.worldSubType, "classic");
  assert.equal(artifact.title, "龙牙酒馆");
});

// ─── Test 9: normalize fallback ───

test("9. normalizeModeArtifact supports content/seedText fallback", () => {
  const artifact = normalizeModeArtifact("strategy-sim", {
    title: "三国边境",
    content: "三方对峙"
  });
  assert.equal(artifact.sourceText, "三方对峙");
  // seedText fallback
  const artifact2 = normalizeModeArtifact("strategy-sim", {
    title: "test",
    seedText: "种子文本"
  });
  assert.equal(artifact2.sourceText, "种子文本");
});

// ─── Test 10: validate fail missing title ───

test("10. validateModeArtifact fails when missing title", () => {
  const result = validateModeArtifact("world-rpg", { sourceText: "test" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === "title"));
});

// ─── Test 11: validate fail missing sourceText ───

test("11. validateModeArtifact fails when missing sourceText", () => {
  const result = validateModeArtifact("world-rpg", { title: "test" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === "sourceText"));
});

// ─── Test 12: validate minimal valid artifact ───

test("12. validateModeArtifact passes for valid minimal artifact", () => {
  const result = validateModeArtifact("world-rpg", { title: "风暴大陆", sourceText: "一片风暴包围的大陆" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

// ─── Test 13: dataMode mismatch gives warning ───

test("13. validateModeArtifact warns on dataMode mismatch", () => {
  const result = validateModeArtifact("world-rpg", {
    title: "test",
    sourceText: "test",
    dataMode: "character_card"
  });
  assert.equal(result.ok, true); // not a hard error
  assert.ok(result.warnings.some(w => w.code === "dataMode_mismatch"));
});

// ─── Test 14: summary reports missingRequiredFields ───

test("14. createModeArtifactSummary reports missingRequiredFields", () => {
  const summary = createModeArtifactSummary("world-rpg", { title: "test" });
  assert.equal(summary.requiredFieldsPresent, false);
  assert.ok(summary.missingRequiredFields.includes("sourceText"));
});

// ─── Test 15: projectInput for strategy-sim ───

test("15. createModeArtifactProjectInput('strategy-sim') returns mode/title/sourceText/sourceType/dataMode/worldSubType", () => {
  const input = createModeArtifactProjectInput("strategy-sim", { title: "三国", sourceText: "三方" });
  assert.equal(input.mode, "strategy-sim");
  assert.equal(input.title, "三国");
  assert.equal(input.sourceType, "strategy_sim_seed");
  assert.equal(input.dataMode, "worldbook");
  assert.equal(input.worldSubType, "classic");
  assert.ok(input.artifact);
});

// ─── Test 16: unknown mode returns null ───

test("16. getModeArtifactContract for unknown mode returns null", () => {
  assert.equal(getModeArtifactContract("nonexistent"), null);
});

test("16b. validateModeArtifact for unknown mode returns error", () => {
  const result = validateModeArtifact("nonexistent", {});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.code === "unknown_mode"));
});

// ─── Test 17: contract cannot be mutated by caller ───

test("17. returned contract is immutable (deep clone)", () => {
  const c1 = getModeArtifactContract("world-rpg");
  c1.sourceType = "hacked";
  const c2 = getModeArtifactContract("world-rpg");
  assert.equal(c2.sourceType, "world_rpg_seed");
});

// ─── Test 18: requiredFiles includes runtime/state.json ───

test("18. each contract's requiredFiles includes runtime/state.json", () => {
  for (const modeId of CONSUMER_MODES) {
    const c = getModeArtifactContract(modeId);
    assert.ok(c.requiredFiles.includes("runtime/state.json"), `${modeId} missing runtime/state.json`);
  }
});

// ─── Test 19: modeSpecificSharedFile ───

test("19. each consumer contract has modeSpecificSharedFile or null", () => {
  for (const modeId of CONSUMER_MODES) {
    const c = getModeArtifactContract(modeId);
    const val = c.modeSpecificSharedFile;
    assert.ok(val === null || (typeof val === "string" && val.length > 0),
      `${modeId} has invalid modeSpecificSharedFile`);
  }
});

// ─── Test 20: deferredCapabilities is array ───

test("20. deferredCapabilities is array for every contract", () => {
  for (const modeId of CONSUMER_MODES) {
    const c = getModeArtifactContract(modeId);
    assert.ok(Array.isArray(c.deferredCapabilities), `${modeId} deferredCapabilities not array`);
  }
});
