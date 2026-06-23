import test from "node:test";
import assert from "node:assert/strict";

import {
  MODE_CAPSULE_REGISTRY_VERSION,
  listModeCapsules,
  getModeCapsule,
  isModeCapsuleSupported,
  isModeConsumerCapsule,
  isModeProducerCapsule,
  getModeCacheNamespace,
  getModeStateNamespace,
  getModePromptProfileId,
  getModeEngineAdapterId,
  getModeArtifactContractId,
  getModeCapsuleRequiredFiles,
  validateModeCapsule,
  validateAllModeCapsules,
  createModeCapsuleSummary
} from "../../src/core/modes/mode-capsule-registry.js";
import { getModeArtifactContract } from "../../src/core/modes/mode-artifact-contract.js";

const CONSUMER_MODES = ["quick-setting", "character", "world-rpg", "mystery-puzzle", "tabletop", "strategy-sim", "murder-mystery"];

// Tests 1-3: listModeCapsules
test("1. listModeCapsules() returns 8 capsules", () => {
  assert.equal(listModeCapsules().length, 8);
});

test("2. listModeCapsules({role:'consumer'}) returns 7", () => {
  assert.equal(listModeCapsules({ role: "consumer" }).length, 7);
});

test("3. listModeCapsules({role:'producer'}) returns creation-forge", () => {
  const producers = listModeCapsules({ role: "producer" });
  assert.equal(producers.length, 1);
  assert.equal(producers[0].modeId, "creation-forge");
});

// Tests 4-6: consumer/producer
test("4. isModeConsumerCapsule('character') = true", () => {
  assert.equal(isModeConsumerCapsule("character"), true);
});
test("5. isModeConsumerCapsule('creation-forge') = false", () => {
  assert.equal(isModeConsumerCapsule("creation-forge"), false);
});
test("6. isModeProducerCapsule('creation-forge') = true", () => {
  assert.equal(isModeProducerCapsule("creation-forge"), true);
});

// Test 7: cache namespace
test("7. getModeCacheNamespace('world-rpg') = runtime/cache/world-rpg", () => {
  assert.equal(getModeCacheNamespace("world-rpg"), "runtime/cache/world-rpg");
});

// Test 8: unique cache namespaces
test("8. all consumer cache namespaces are unique", () => {
  const ns = CONSUMER_MODES.map(m => getModeCacheNamespace(m));
  assert.equal(new Set(ns).size, ns.length);
});

// Test 9: unique prompt profiles
test("9. all consumer prompt profile ids are unique", () => {
  const ids = CONSUMER_MODES.map(m => getModePromptProfileId(m));
  assert.equal(new Set(ids).size, ids.length);
});

// Test 10: unique engine adapters
test("10. all consumer engine adapter ids are unique", () => {
  const ids = CONSUMER_MODES.map(m => getModeEngineAdapterId(m));
  assert.equal(new Set(ids).size, ids.length);
});

// Test 11: artifact contract linkage
test("11. all consumer artifactContractIds exist in mode-artifact-contract", () => {
  for (const modeId of CONSUMER_MODES) {
    const contractId = getModeArtifactContractId(modeId);
    assert.ok(contractId, `${modeId} has no artifactContractId`);
    const contract = getModeArtifactContract(contractId);
    assert.ok(contract, `${modeId} refs unknown contract ${contractId}`);
  }
});

// Test 12: dataMode alignment
test("12. consumer capsule dataMode matches artifact contract", () => {
  for (const modeId of CONSUMER_MODES) {
    const cap = getModeCapsule(modeId);
    const ctr = getModeArtifactContract(cap.artifactContractId);
    assert.equal(cap.dataMode, ctr.dataMode, `${modeId} dataMode mismatch`);
  }
});

// Test 13: worldSubType alignment
test("13. consumer capsule worldSubType matches artifact contract", () => {
  for (const modeId of CONSUMER_MODES) {
    const cap = getModeCapsule(modeId);
    const ctr = getModeArtifactContract(cap.artifactContractId);
    assert.equal(cap.worldSubType, ctr.worldSubType, `${modeId} worldSubType mismatch`);
  }
});

// Test 14: creation-forge specific
test("14. creation-forge artifactContractId = null", () => {
  assert.equal(getModeArtifactContractId("creation-forge"), null);
});

test("14b. creation-forge producerTargets contains 6 modes", () => {
  const cap = getModeCapsule("creation-forge");
  assert.ok(cap.producerTargets.includes("character"));
  assert.ok(cap.producerTargets.includes("world-rpg"));
  assert.ok(cap.producerTargets.includes("mystery-puzzle"));
  assert.ok(cap.producerTargets.includes("tabletop"));
  assert.ok(cap.producerTargets.includes("strategy-sim"));
  assert.ok(cap.producerTargets.includes("murder-mystery"));
});

// Test 15: requiredFiles
test("15. requiredFiles includes world.json for consumer modes", () => {
  for (const modeId of CONSUMER_MODES) {
    const files = getModeCapsuleRequiredFiles(modeId);
    assert.ok(files.includes("world.json"), `${modeId} missing world.json`);
    assert.ok(files.includes("runtime/state.json"), `${modeId} missing runtime/state.json`);
  }
});

// Test 16: validateAllModeCapsules
test("16. validateAllModeCapsules().ok = true", () => {
  const result = validateAllModeCapsules();
  assert.equal(result.ok, true);
});

// Test 17: unknown mode
test("17. getModeCapsule('unknown') = null", () => {
  assert.equal(getModeCapsule("nonexistent"), null);
});

// Test 18: registry immutability
test("18. returned capsule cannot pollute registry", () => {
  const cap = getModeCapsule("world-rpg");
  cap.cache.namespace = "hacked";
  const cap2 = getModeCapsule("world-rpg");
  assert.equal(cap2.cache.namespace, "runtime/cache/world-rpg");
});

// Test 19: state namespaces unique
test("19. all consumer state namespaces are unique", () => {
  const ns = CONSUMER_MODES.map(m => getModeStateNamespace(m));
  assert.equal(new Set(ns).size, ns.length);
});

// Test 20: quick-setting/character/multi-mode regression (summary check)
test("20. createModeCapsuleSummary returns correct fields", () => {
  const s = createModeCapsuleSummary("mystery-puzzle");
  assert.equal(s.role, "consumer");
  assert.equal(s.status, "active");
  assert.equal(s.isConsumer, true);
  assert.equal(s.isProducer, false);
  assert.ok(s.cacheNamespace);
  assert.ok(s.promptProfileId);
  assert.ok(s.engineAdapterId);
});
