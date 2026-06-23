import { getMode } from "./mode-manifest.js";
import { getModeArtifactContract } from "./mode-artifact-contract.js";

export const MODE_CAPSULE_REGISTRY_VERSION = 1;

const CAPSULES = Object.freeze({
  "quick-setting": Object.freeze({
      "modeId": "quick-setting",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "quick-setting",
      "dataMode": "preset",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "quick-setting",
            "modeSpecificFile": null,
            "sharedFiles": [
                  "shared/worldbook.json",
                  "shared/scenes.json",
                  "shared/world_state.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.quick-setting"
      },
      "cache": {
            "namespace": "runtime/cache/quick-setting",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.quick-setting.v1"
      },
      "engine": {
            "adapterId": "engine.quick-setting.v1",
            "strategy": "existing-pipeline"
      },
      "deferredCapabilities": []
}),
  "character": Object.freeze({
      "modeId": "character",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "character",
      "dataMode": "character_card",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "character",
            "modeSpecificFile": "shared/characters.json",
            "sharedFiles": [
                  "shared/characters.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.character"
      },
      "cache": {
            "namespace": "runtime/cache/character",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.character.roleplay.v1"
      },
      "engine": {
            "adapterId": "engine.character.v1",
            "strategy": "existing-character-card-pipeline"
      },
      "deferredCapabilities": [
            "full character card editor",
            "long-term memory",
            "multi-character group chat"
      ]
}),
  "world-rpg": Object.freeze({
      "modeId": "world-rpg",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "world-rpg",
      "dataMode": "worldbook",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "world-rpg",
            "modeSpecificFile": "shared/world_rpg.json",
            "sharedFiles": [
                  "shared/worldbook.json",
                  "shared/scenes.json",
                  "shared/world_state.json",
                  "shared/timeline.json",
                  "shared/relations.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.world-rpg"
      },
      "cache": {
            "namespace": "runtime/cache/world-rpg",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.world-rpg.gm.v1"
      },
      "engine": {
            "adapterId": "engine.world-rpg.v1",
            "strategy": "mode-adapter-placeholder"
      },
      "deferredCapabilities": [
            "quest system",
            "combat system",
            "growth system",
            "random event system",
            "timeline advancement"
      ]
}),
  "mystery-puzzle": Object.freeze({
      "modeId": "mystery-puzzle",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "mystery-puzzle",
      "dataMode": "worldbook",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "mystery-puzzle",
            "modeSpecificFile": "shared/mystery.json",
            "sharedFiles": [
                  "shared/worldbook.json",
                  "shared/scenes.json",
                  "shared/mystery.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.mystery-puzzle"
      },
      "cache": {
            "namespace": "runtime/cache/mystery-puzzle",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.mystery-puzzle.host.v1"
      },
      "engine": {
            "adapterId": "engine.mystery-puzzle.v1",
            "strategy": "mode-adapter-placeholder"
      },
      "deferredCapabilities": [
            "complex clue graph",
            "automatic deduction judging"
      ]
}),
  "tabletop": Object.freeze({
      "modeId": "tabletop",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "tabletop",
      "dataMode": "worldbook",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "tabletop",
            "modeSpecificFile": "shared/tabletop.json",
            "sharedFiles": [
                  "shared/worldbook.json",
                  "shared/scenes.json",
                  "shared/tabletop.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.tabletop"
      },
      "cache": {
            "namespace": "runtime/cache/tabletop",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.tabletop.gm.v1"
      },
      "engine": {
            "adapterId": "engine.tabletop.v1",
            "strategy": "mode-adapter-placeholder"
      },
      "deferredCapabilities": [
            "dice system",
            "character sheet",
            "attributes",
            "DC checks",
            "combat turns",
            "ruleset engine"
      ]
}),
  "strategy-sim": Object.freeze({
      "modeId": "strategy-sim",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "strategy-sim",
      "dataMode": "worldbook",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "strategy-sim",
            "modeSpecificFile": "shared/strategy.json",
            "sharedFiles": [
                  "shared/worldbook.json",
                  "shared/organizations.json",
                  "shared/world_state.json",
                  "shared/timeline.json",
                  "shared/strategy.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.strategy-sim"
      },
      "cache": {
            "namespace": "runtime/cache/strategy-sim",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.strategy-sim.turn.v1"
      },
      "engine": {
            "adapterId": "engine.strategy-sim.v1",
            "strategy": "mode-adapter-placeholder"
      },
      "deferredCapabilities": [
            "numeric simulation",
            "resource economy",
            "automatic turn resolution",
            "faction AI model"
      ]
}),
  "murder-mystery": Object.freeze({
      "modeId": "murder-mystery",
      "role": "consumer",
      "status": "active",
      "artifactContractId": "murder-mystery",
      "dataMode": "worldbook",
      "worldSubType": "classic",
      "saveSchema": {
            "namespace": "murder-mystery",
            "modeSpecificFile": "shared/murder_mystery.json",
            "sharedFiles": [
                  "shared/worldbook.json",
                  "shared/scenes.json",
                  "shared/characters.json",
                  "shared/murder_mystery.json"
            ]
      },
      "runtimeState": {
            "namespace": "runtime.modes.murder-mystery"
      },
      "cache": {
            "namespace": "runtime/cache/murder-mystery",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.murder-mystery.case-host.v1"
      },
      "engine": {
            "adapterId": "engine.murder-mystery.v1",
            "strategy": "mode-adapter-placeholder"
      },
      "deferredCapabilities": [
            "truth lock enforcement",
            "testimony consistency engine",
            "clue release system",
            "phase progression"
      ]
}),
  "creation-forge": Object.freeze({
      "modeId": "creation-forge",
      "role": "producer",
      "status": "deferred",
      "artifactContractId": null,
      "dataMode": null,
      "worldSubType": null,
      "saveSchema": {
            "namespace": "creation-forge",
            "modeSpecificFile": "shared/creation_forge.json",
            "sharedFiles": []
      },
      "runtimeState": {
            "namespace": "runtime.modes.creation-forge"
      },
      "cache": {
            "namespace": "runtime/cache/creation-forge",
            "policy": "mode-isolated"
      },
      "prompt": {
            "profileId": "prompt.creation-forge.artifact-forge.v1"
      },
      "engine": {
            "adapterId": "engine.creation-forge.v1",
            "strategy": "deferred-producer"
      },
      "producerTargets": [
            "character",
            "world-rpg",
            "mystery-puzzle",
            "tabletop",
            "strategy-sim",
            "murder-mystery"
      ],
      "deferredCapabilities": []
}),
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function listModeCapsules(options = {}) {
  const role = options.role || null;
  const result = [];
  for (const [modeId, cap] of Object.entries(CAPSULES)) {
    if (role && cap.role !== role) continue;
    result.push(clone({ modeId, role: cap.role, status: cap.status, artifactContractId: cap.artifactContractId }));
  }
  return result;
}

export function getModeCapsule(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return cap ? clone(cap) : null;
}

export function isModeCapsuleSupported(modeId, options = {}) {
  return Boolean(CAPSULES[modeId]);
}

export function isModeConsumerCapsule(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return Boolean(cap && cap.role === "consumer" && cap.status === "active");
}

export function isModeProducerCapsule(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return Boolean(cap && cap.role === "producer");
}

export function getModeCacheNamespace(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return cap?.cache?.namespace || null;
}

export function getModeStateNamespace(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return cap?.runtimeState?.namespace || null;
}

export function getModePromptProfileId(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return cap?.prompt?.profileId || null;
}

export function getModeEngineAdapterId(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return cap?.engine?.adapterId || null;
}

export function getModeArtifactContractId(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  return cap?.artifactContractId || null;
}

export function getModeCapsuleRequiredFiles(modeId, options = {}) {
  const contract = getModeArtifactContract(modeId);
  return contract?.requiredFiles || [];
}

export function getModeCapsuleIsolationPolicy(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  if (!cap) return null;
  return {
    separateCache: true,
    separatePromptProfile: true,
    separateEngineAdapter: true,
    separateSaveSchema: true,
    mayShareKernel: true,
    mayShareModules: true,
    mayShareWorldbook: cap.role === "consumer"
  };
}

export function validateModeCapsule(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  if (!cap) return { ok: false, errors: [`No capsule for mode: ${modeId}`], warnings: [] };
  const errors = [];
  const warnings = [];
  if (cap.role === "consumer" && cap.artifactContractId) {
    const contract = getModeArtifactContract(cap.artifactContractId);
    if (!contract) {
      warnings.push(`Capsule ${modeId} refs unknown contract: ${cap.artifactContractId}`);
    } else {
      if (cap.dataMode !== contract.dataMode) warnings.push(`${modeId} dataMode mismatch`);
      if (cap.worldSubType !== contract.worldSubType) warnings.push(`${modeId} worldSubType mismatch`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateAllModeCapsules(options = {}) {
  const results = [];
  for (const modeId of Object.keys(CAPSULES)) results.push({ modeId, ...validateModeCapsule(modeId) });
  return { ok: results.every(r => r.ok), results, errors: results.flatMap(r => r.errors), warnings: results.flatMap(r => r.warnings) };
}

export function createModeCapsuleSummary(modeId, options = {}) {
  const cap = CAPSULES[modeId];
  if (!cap) return null;
  return {
    modeId, role: cap.role, status: cap.status,
    artifactContractId: cap.artifactContractId, dataMode: cap.dataMode, worldSubType: cap.worldSubType,
    cacheNamespace: cap.cache?.namespace, promptProfileId: cap.prompt?.profileId,
    engineAdapterId: cap.engine?.adapterId, stateNamespace: cap.runtimeState?.namespace,
    isConsumer: cap.role === "consumer", isProducer: cap.role === "producer"
  };
}
