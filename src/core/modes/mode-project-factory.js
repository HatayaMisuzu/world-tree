import { getMode, MODE_STATUS } from "./mode-manifest.js";
import { getModeRuntimeHints } from "./mode-metadata.js";
import { createModeRuntimePacket } from "./mode-runtime.js";
import { createModuleRuntimePacket } from "../modules/module-runtime-orchestrator.js";
import { createModeStateEnvelope } from "./mode-state-schema.js";

// ─── Mode 创建权限 ───

/**
 * 判断 mode 是否可以真实创建项目。
 * quick-setting → allowed；planned/hidden → not allowed（除非显式 options）。
 */
export function assertModeProjectCanBeCreated(modeId, options = {}) {
  const mode = getMode(modeId);
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);

  // 测试用 unsafe flag——默认拒绝
  if (options.allowUnsafePersist === true) return { allowed: true, reason: null };

  const status = mode.status;

  if (status === MODE_STATUS.ACTIVE && mode.defaultVisibility === true) {
    return { allowed: true, reason: null };
  }

  if (status === MODE_STATUS.PLANNED) {
    if (options.allowPlannedModeDraft === true) {
      return { allowed: true, reason: "planned mode draft (not for production)" };
    }
    return {
      allowed: false,
      reason: `Mode ${modeId} is planned and not enabled for project creation yet. Use createModeProjectDraft() for structural preview.`
    };
  }

  return {
    allowed: false,
    reason: `Mode ${modeId} (${status}) is not enabled for project creation.`
  };
}

// ─── 输入标准化 ───

const MODE_DEFAULTS = {
  "quick-setting": { title: "未命名设定", sourceType: "pasted_text" },
  character: { title: "未命名人物卡", sourceType: "character_card" },
  "world-rpg": { title: "未命名世界冒险", sourceType: "world_rpg_seed" },
  "mystery-puzzle": { title: "未命名谜题", sourceType: "mystery_puzzle_seed" },
  tabletop: { title: "未命名跑团", sourceType: "tabletop_seed" },
  "strategy-sim": { title: "未命名策略模拟", sourceType: "strategy_sim_seed" },
  "murder-mystery": { title: "未命名剧本杀", sourceType: "murder_mystery_seed" },
  "creation-forge": { title: "未命名创作项目", sourceType: "creation" }
};

/**
 * 统一标准化不同 mode 的项目输入。
 * 不写文件，不调 LLM，不改变 DATA_MODES。
 */
export function normalizeModeProjectInput(modeId, input = {}) {
  const hints = getModeRuntimeHints(modeId, {});
  const defaults = MODE_DEFAULTS[modeId] || { title: "未命名项目", sourceType: "pasted_text" };

  return {
    mode: modeId,
    title: String(input.title || input.name || defaults.title).trim() || defaults.title,
    sourceText: String(input.sourceText || input.cardText || input.content || input.text || "").trim(),
    sourceType: String(input.sourceType || defaults.sourceType).trim() || defaults.sourceType
  };
}

// ─── Project Draft ───

/**
 * 生成 JSON-safe 项目草案——聚合 Mode Runtime Core + Module Runtime Orchestrator + Mode State Schema。
 * 不写文件。
 */
export function createModeProjectDraft(modeId, input = {}, options = {}) {
  const normalized = normalizeModeProjectInput(modeId, input);
  const hints = getModeRuntimeHints(modeId, options);

  const now = options.createdAt || new Date().toISOString();

  // 聚合三层
  const modeRuntimePacket = createModeRuntimePacket(modeId, {
    ...options,
    sourceType: normalized.sourceType
  });

  const moduleRuntimePacket = createModuleRuntimePacket(modeId, {
    input: normalized.sourceText,
    options
  });

  const modeStateEnvelope = createModeStateEnvelope(modeId, {
    ...options,
    createdAt: now
  });

  // 聚合 warnings
  const warnings = [
    ...(modeRuntimePacket.warnings || []),
    ...(moduleRuntimePacket.warnings || []),
    ...(modeRuntimePacket.metadata?.moduleGraph?.warnings || []),
    ...(modeRuntimePacket.metadata?.wrapperGraph?.warnings || [])
  ];

  return {
    mode: modeId,
    title: normalized.title,
    sourceType: normalized.sourceType,
    sourceText: normalized.sourceText,
    dataMode: hints.dataMode,
    worldSubType: hints.worldSubType,
    createdAt: now,

    modeRuntimePacket,
    moduleRuntimePacket,
    modeStateEnvelope,

    worldJsonDraft: {
      title: normalized.title,
      mode: modeId,
      modeMetadata: {
        modeVersion: modeRuntimePacket.metadata.modeVersion,
        displayName: modeRuntimePacket.metadata.displayName,
        createdAt: now,
        sourceType: normalized.sourceType,
        dataMode: hints.dataMode,
        worldSubType: hints.worldSubType,
        status: hints.status,
        defaultVisibility: hints.defaultVisibility
      },
      moduleGraph: modeRuntimePacket.metadata.moduleGraph,
      createdAt: now,
      updatedAt: now
    },

    runtimeStateDraft: {
      engineState: {
        dataMode: hints.dataMode,
        worldSubType: hints.worldSubType
      },
      mode: modeId,
      modeMetadata: modeRuntimePacket.metadata,
      moduleGraph: modeRuntimePacket.metadata.moduleGraph,
      wrapperGraph: modeRuntimePacket.metadata.wrapperGraph,
      modeStateEnvelope
    },

    warnings
  };
}

// ─── Project Files ───

/**
 * 把 projectDraft 转为落盘文件内容 map。
 * 不直接写文件，只返回内容 map。
 */
export function createModeProjectFiles(projectDraft = {}, options = {}) {
  const mode = projectDraft.mode || "unknown";
  const now = projectDraft.createdAt || new Date().toISOString();

  const sourceText = projectDraft.sourceText || "";

  const worldJson = {
    title: projectDraft.title || "未命名项目",
    mode: projectDraft.mode || mode,
    modeMetadata: projectDraft.worldJsonDraft?.modeMetadata || {},
    moduleGraph: projectDraft.worldJsonDraft?.moduleGraph || { modules: [] },
    createdAt: projectDraft.worldJsonDraft?.createdAt || now,
    updatedAt: now
  };

  const runtimeState = {
    engineState: projectDraft.runtimeStateDraft?.engineState || {},
    mode: mode,
    modeMetadata: projectDraft.runtimeStateDraft?.modeMetadata || {},
    moduleGraph: projectDraft.runtimeStateDraft?.moduleGraph || { modules: [] },
    wrapperGraph: projectDraft.runtimeStateDraft?.wrapperGraph || { wrappers: [] },
    modeStateEnvelope: projectDraft.runtimeStateDraft?.modeStateEnvelope || {}
  };

  const files = {
    "world.json": worldJson,
    "runtime/state.json": runtimeState,
    "runtime/source.txt": sourceText,
    "shared/worldbook.json": { entries: [] },
    "shared/characters.json": [],
    "shared/scenes.json": [],
    "shared/organizations.json": [],
    "shared/relations.json": [],
    "shared/timeline.json": [],
    "shared/world_state.json": { version: 1, updatedAt: null, states: {} },
    "runtime/current-scene.json": { version: 1, sceneId: "opening", modeId: mode, title: "Opening", startedAt: now, participants: [], metadata: {} },
    "runtime/scene-summaries.jsonl": "",
    "runtime/proximity-scope.json": { version: 1, rings: { core: [], near: [], far: [], dormant: [] } },
    "runtime/worldbook-activation.json": { base: [], context: [], instant: [] },
    "runtime/tracking/change-log.jsonl": "",
    "runtime/tracking/foreshadowing.json": { version: 1, updatedAt: now, items: [] },
    "runtime/tracking/conflicts.json": { version: 1, updatedAt: now, items: [] }
  };

  // character mode: primary character record
  if (mode === "character") {
    const charName = projectDraft.title || "未命名角色";
    files["shared/characters.json"] = [{
      id: "primary",
      name: charName,
      sourceType: "character_card",
      rawTextRef: "runtime/source.txt",
      createdAt: now,
      updatedAt: now
    }];
  }

  // Multi-mode closures: mode-specific shared state files
  if (mode === "world-rpg") {
    files["shared/world_rpg.json"] = { schemaVersion: 1, mode: "world-rpg", status: "minimal", gmMode: true, currentSceneId: "opening", questSeed: null, playerState: { name: "玩家", role: "adventurer" }, notes: [], createdAt: now, updatedAt: now };
    // Grand World Mode V1 foundation files
    files["shared/world_threads.json"] = { schemaVersion: 1, items: [], activeThreadIds: [], updatedAt: now, note: "叙事牵引/当前目标，不是传统RPG quest" };
    files["runtime/world-proposals.jsonl"] = "";
    files["runtime/cache/worldbook/.gitkeep"] = "";
  }
  if (mode === "mystery-puzzle") {
    files["shared/mystery.json"] = { schemaVersion: 1, mode: "mystery-puzzle", status: "minimal", hostRole: "puzzle_host", currentPuzzleId: "opening", clues: [], knownFacts: [], solutionLock: { enabled: false, reason: "Truth lock deferred beyond P1." }, createdAt: now, updatedAt: now };
  }
  if (mode === "tabletop") {
    files["shared/tabletop.json"] = { schemaVersion: 1, mode: "tabletop", status: "minimal", gmMode: true, ruleset: "freeform", currentSceneId: "opening", diceSystem: { enabled: false, reason: "Dice system deferred beyond P1." }, party: [], createdAt: now, updatedAt: now };
    files["runtime/tabletop-proposals.jsonl"] = "";
    files["runtime/cache/tabletop/.gitkeep"] = "";
  }
  if (mode === "strategy-sim") {
    files["shared/strategy.json"] = { schemaVersion: 1, mode: "strategy-sim", status: "minimal", simulationStyle: "narrative", turn: 0, factions: [], resources: {}, numericModel: { enabled: false, reason: "Numeric simulation deferred beyond P1." }, createdAt: now, updatedAt: now };
    files["runtime/strategy-sim-proposals.jsonl"] = "";
    files["runtime/cache/strategy-sim/.gitkeep"] = "";
  }
  if (mode === "murder-mystery") {
    files["shared/murder_mystery.json"] = { schemaVersion: 1, mode: "murder-mystery", status: "minimal", hostRole: "murder_mystery_host", caseId: "opening", suspects: [], clues: [], truthLock: { enabled: false, reason: "Truth lock deferred beyond P1." }, createdAt: now, updatedAt: now };
    files["runtime/murder-mystery-proposals.jsonl"] = "";
    files["runtime/cache/murder-mystery/.gitkeep"] = "";
  }
  if (mode === "mystery-puzzle") {
    files["shared/mystery.json"] = { schemaVersion: 1, mode: "mystery-puzzle", status: "minimal", hostRole: "puzzle_host", currentPuzzleId: "opening", clues: [], knownFacts: [], solutionLock: { enabled: false, reason: "Truth lock deferred beyond P1." }, createdAt: now, updatedAt: now };
    files["runtime/mystery-puzzle-proposals.jsonl"] = "";
    files["runtime/cache/mystery-puzzle/.gitkeep"] = "";
  }
  if (mode === "creation-forge") {
    files["shared/creation_forge.json"] = { schemaVersion: 1, modeMeaning: "artifact_factory", status: "draft", targetArtifactTypes: [], activeBlueprintId: null, activeArtifactId: null, createdProjects: [], updatedAt: now };
    files["shared/forge_inputs.json"] = { schemaVersion: 1, inputs: [] };
    files["shared/forge_blueprints.json"] = { schemaVersion: 1, blueprints: [] };
    files["shared/forge_artifacts.json"] = { schemaVersion: 1, artifacts: [] };
    files["runtime/creation-forge-proposals.jsonl"] = "";
    files["runtime/cache/creation-forge/.gitkeep"] = "";
  }

  return files;
}

// ─── 统一入口 ───

/**
 * P1 统一入口。
 * quick-setting 允许 persist；其他 mode 默认只返回 draft。
 */
export function createProjectFromMode(modeId, input = {}, options = {}) {
  const permission = assertModeProjectCanBeCreated(modeId, options);
  const draft = createModeProjectDraft(modeId, input, options);
  const files = createModeProjectFiles(draft, options);

  if (!permission.allowed && options.persist === true) {
    return {
      ok: false,
      mode: modeId,
      error: permission.reason,
      draft,
      files: null
    };
  }

  return {
    ok: true,
    mode: modeId,
    draft,
    files: options.persist === true ? files : null
  };
}

// ─── 摘要 ───

/**
 * 轻量摘要——测试和 debug 用。
 */
export function createModeProjectSummary(projectDraft = {}) {
  return {
    mode: projectDraft.mode || "",
    title: projectDraft.title || "",
    sourceType: projectDraft.sourceType || "",
    dataMode: projectDraft.dataMode || "",
    hasModeRuntimePacket: Boolean(projectDraft.modeRuntimePacket),
    hasModuleRuntimePacket: Boolean(projectDraft.moduleRuntimePacket),
    hasModeStateEnvelope: Boolean(projectDraft.modeStateEnvelope),
    fileCount: projectDraft.files ? Object.keys(projectDraft.files).length : 0,
    warningCount: Array.isArray(projectDraft.warnings) ? projectDraft.warnings.length : 0
  };
}
