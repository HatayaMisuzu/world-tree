import { getMode } from "./mode-manifest.js";

export const MODE_ARTIFACT_CONTRACT_VERSION = 1;

// ─── Contract Registry ───

const CONTRACTS = Object.freeze({

  "quick-setting": Object.freeze({
    version: 1,
    targetMode: "quick-setting",
    title: "Quick Setting Artifact",
    status: "active",
    sourceType: "quick_setting_seed",
    dataMode: "preset",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: ["preset", "worldPremise"],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/worldbook.json", "shared/scenes.json", "shared/world_state.json"
    ],
    modeSpecificSharedFile: null,
    deferredCapabilities: [],
    summaryFields: ["title", "sourceText"]
  }),

  character: Object.freeze({
    version: 1,
    targetMode: "character",
    title: "Character Card Artifact",
    status: "active",
    sourceType: "character_card",
    dataMode: "character_card",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: [
      "name", "cardFormat", "description", "personality", "scenario", "firstMessage"
    ],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/characters.json"
    ],
    modeSpecificSharedFile: "shared/characters.json",
    deferredCapabilities: [
      "full card editor",
      "SillyTavern full compatibility",
      "long-term memory",
      "multi-character group chat"
    ],
    summaryFields: ["title", "name", "cardFormat"]
  }),

  "world-rpg": Object.freeze({
    version: 1,
    targetMode: "world-rpg",
    title: "World RPG Artifact",
    status: "active",
    sourceType: "world_rpg_seed",
    dataMode: "worldbook",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: [
      "worldPremise", "openingSceneSeed", "playerRoleSeed"
    ],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/worldbook.json", "shared/scenes.json", "shared/world_state.json",
      "shared/world_rpg.json"
    ],
    modeSpecificSharedFile: "shared/world_rpg.json",
    deferredCapabilities: [
      "quest system", "combat system", "growth system",
      "random event system", "timeline advancement"
    ],
    summaryFields: ["title", "sourceText", "worldPremise"]
  }),

  "mystery-puzzle": Object.freeze({
    version: 1,
    targetMode: "mystery-puzzle",
    title: "Mystery Puzzle Artifact",
    status: "active",
    sourceType: "mystery_puzzle_seed",
    dataMode: "worldbook",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: [
      "premise", "openingScene", "clueSeeds", "knownFacts"
    ],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/worldbook.json", "shared/scenes.json", "shared/mystery.json"
    ],
    modeSpecificSharedFile: "shared/mystery.json",
    deferredCapabilities: [
      "truth lock", "solution lock enforcement",
      "complex clue graph", "automatic deduction judging"
    ],
    summaryFields: ["title", "premise", "clueSeeds"]
  }),

  tabletop: Object.freeze({
    version: 1,
    targetMode: "tabletop",
    title: "Tabletop Artifact",
    status: "active",
    sourceType: "tabletop_seed",
    dataMode: "worldbook",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: [
      "setting", "openingScene", "rulesetPreference", "playerActionPrompt"
    ],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/worldbook.json", "shared/scenes.json", "shared/tabletop.json"
    ],
    modeSpecificSharedFile: "shared/tabletop.json",
    deferredCapabilities: [
      "dice system", "character sheet", "attributes",
      "DC checks", "combat turns", "ruleset engine"
    ],
    summaryFields: ["title", "setting", "rulesetPreference"]
  }),

  "strategy-sim": Object.freeze({
    version: 1,
    targetMode: "strategy-sim",
    title: "Strategy Sim Artifact",
    status: "active",
    sourceType: "strategy_sim_seed",
    dataMode: "worldbook",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: [
      "situation", "factionSeeds", "resourceSeeds", "firstTurnPrompt"
    ],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/worldbook.json", "shared/organizations.json",
      "shared/world_state.json", "shared/timeline.json", "shared/strategy.json"
    ],
    modeSpecificSharedFile: "shared/strategy.json",
    deferredCapabilities: [
      "numeric simulation", "resource economy",
      "automatic turn resolution", "faction AI model"
    ],
    summaryFields: ["title", "situation", "factionSeeds"]
  }),

  "murder-mystery": Object.freeze({
    version: 1,
    targetMode: "murder-mystery",
    title: "Murder Mystery Artifact",
    status: "active",
    sourceType: "murder_mystery_seed",
    dataMode: "worldbook",
    worldSubType: "classic",
    requiredArtifactFields: ["title", "sourceText"],
    optionalArtifactFields: [
      "casePremise", "openingScene", "suspectSeeds", "clueSeeds"
    ],
    requiredFiles: [
      "world.json", "runtime/state.json", "runtime/source.txt",
      "shared/worldbook.json", "shared/scenes.json",
      "shared/characters.json", "shared/murder_mystery.json"
    ],
    modeSpecificSharedFile: "shared/murder_mystery.json",
    deferredCapabilities: [
      "truth lock", "culprit lock", "testimony consistency",
      "clue release system", "phase progression", "deduction scoring"
    ],
    summaryFields: ["title", "casePremise", "suspectSeeds", "clueSeeds"]
  })

});

// ─── Public API ───

/** 深拷贝，防止调用方污染 registry */
function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * 列出所有支持的 consumer mode contracts。
 * 默认不含 creation-forge。
 */
export function listModeArtifactContracts(options = {}) {
  const result = [];
  for (const [modeId, contract] of Object.entries(CONTRACTS)) {
    result.push({ modeId, title: contract.title, status: contract.status });
  }
  return result;
}

/**
 * 获取指定 mode 的 artifact contract（深拷贝）。
 * 未知 mode 返回 null。
 */
export function getModeArtifactContract(modeId, options = {}) {
  const contract = CONTRACTS[modeId];
  return contract ? clone(contract) : null;
}

/**
 * 判断 mode 是否有 artifact contract 且为 active。
 */
export function isModeArtifactSupported(modeId, options = {}) {
  const contract = CONTRACTS[modeId];
  return Boolean(contract && contract.status === "active");
}

// ─── Default / Normalize / Validate / Summary ───

/**
 * 生成最小 artifact。
 */
export function createDefaultModeArtifact(modeId, input = {}, options = {}) {
  const contract = CONTRACTS[modeId];
  if (!contract) throw new Error(`No artifact contract for mode: ${modeId}`);

  const now = new Date().toISOString();
  const title = String(input.title || input.name || "未命名").trim() || "未命名";

  return {
    contractVersion: MODE_ARTIFACT_CONTRACT_VERSION,
    targetMode: modeId,
    sourceType: contract.sourceType,
    dataMode: contract.dataMode,
    worldSubType: contract.worldSubType,
    title,
    sourceText: String(input.sourceText || input.content || input.seedText || ""),
    optional: {},
    metadata: {
      createdAt: input.createdAt || now,
      updatedAt: now
    }
  };
}

/**
 * 规范化 artifact——补齐 sourceType/dataMode/worldSubType，处理 fallback。
 */
export function normalizeModeArtifact(modeId, artifact = {}, options = {}) {
  const contract = CONTRACTS[modeId];
  if (!contract) throw new Error(`No artifact contract for mode: ${modeId}`);

  const now = new Date().toISOString();

  return {
    contractVersion: artifact.contractVersion ?? MODE_ARTIFACT_CONTRACT_VERSION,
    targetMode: modeId,
    sourceType: contract.sourceType,
    dataMode: contract.dataMode,
    worldSubType: contract.worldSubType,
    title: String(artifact.title || artifact.name || "未命名").trim() || "未命名",
    sourceText: String(artifact.sourceText || artifact.content || artifact.seedText || ""),
    optional: artifact.optional && typeof artifact.optional === "object" ? { ...artifact.optional } : {},
    metadata: {
      createdAt: artifact.metadata?.createdAt || artifact.createdAt || now,
      updatedAt: now
    }
  };
}

/**
 * 校验 artifact。
 * 返回 { ok, errors, warnings }。
 */
export function validateModeArtifact(modeId, artifact = {}, options = {}) {
  const contract = CONTRACTS[modeId];
  if (!contract) {
    return {
      ok: false,
      errors: [{ code: "unknown_mode", field: "targetMode", message: `No artifact contract for mode: ${modeId}` }],
      warnings: []
    };
  }

  const errors = [];
  const warnings = [];

  // Required fields
  for (const field of contract.requiredArtifactFields) {
    const value = artifact[field];
    if (value == null || String(value).trim() === "") {
      errors.push({
        code: "missing_required_field",
        field,
        message: `${field} is required for ${modeId} artifact.`
      });
    }
  }

  // Type consistency
  if (artifact.dataMode && artifact.dataMode !== contract.dataMode) {
    warnings.push({
      code: "dataMode_mismatch",
      field: "dataMode",
      message: `dataMode "${artifact.dataMode}" differs from contract "${contract.dataMode}".`
    });
  }
  if (artifact.worldSubType && artifact.worldSubType !== contract.worldSubType) {
    warnings.push({
      code: "worldSubType_mismatch",
      field: "worldSubType",
      message: `worldSubType "${artifact.worldSubType}" differs from contract "${contract.worldSubType}".`
    });
  }
  if (artifact.sourceType && artifact.sourceType !== contract.sourceType) {
    warnings.push({
      code: "sourceType_mismatch",
      field: "sourceType",
      message: `sourceType "${artifact.sourceType}" differs from contract "${contract.sourceType}".`
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 轻量摘要。
 */
export function createModeArtifactSummary(modeId, artifact = {}, options = {}) {
  const contract = CONTRACTS[modeId];
  if (!contract) throw new Error(`No artifact contract for mode: ${modeId}`);

  const missingRequired = contract.requiredArtifactFields.filter(
    (field) => artifact[field] == null || String(artifact[field]).trim() === ""
  );

  return {
    targetMode: modeId,
    title: artifact.title || "",
    sourceType: contract.sourceType,
    dataMode: contract.dataMode,
    requiredFieldsPresent: missingRequired.length === 0,
    missingRequiredFields: missingRequired,
    modeSpecificSharedFile: contract.modeSpecificSharedFile,
    deferredCapabilities: [...contract.deferredCapabilities]
  };
}

/**
 * 把 artifact 转成 createModeProjectDraft / createProjectFromMode 可消费 input。
 * 这是未来 creation-forge → project factory 的桥。
 */
export function createModeArtifactProjectInput(modeId, artifact = {}, options = {}) {
  const contract = CONTRACTS[modeId];
  if (!contract) throw new Error(`No artifact contract for mode: ${modeId}`);

  const normalized = normalizeModeArtifact(modeId, artifact, options);

  return {
    mode: modeId,
    title: normalized.title,
    sourceText: normalized.sourceText,
    sourceType: contract.sourceType,
    dataMode: contract.dataMode,
    worldSubType: contract.worldSubType,
    artifact: normalized
  };
}
