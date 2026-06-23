import { getMode, isModeVisible } from "./mode-manifest.js";
import { getModulesForMode } from "./mode-module-map.js";
import { getModeRuntimeHints } from "./mode-metadata.js";

export const MODE_STATE_SCHEMA_VERSION = 1;

/**
 * 创建 mode 默认运行状态。
 * 不同 mode 附加安全空结构，不填复杂业务逻辑。
 */
export function createDefaultModeState(modeId, options = {}) {
  const hints = getModeRuntimeHints(modeId, options);
  const base = {
    status: "initialized",
    turnCount: 0,
    lastActiveAt: null,
    sourceType: hints.sourceType,
    dataMode: hints.dataMode,
    worldSubType: hints.worldSubType
  };

  // 各 mode 专属默认字段（纯占位，不做功能）
  const extras = {
    "quick-setting": {
      sourceTextDigest: "",
      seedReady: false
    },
    character: {
      primaryCharacterId: null,
      relationshipStage: "unknown",
      memoryReady: false
    },
    "world-rpg": {
      currentChapterId: null,
      questStateReady: false
    },
    "creation-forge": {
      draftId: null,
      proposalReady: false
    }
  };

  return Object.assign(base, extras[modeId] || {});
}

/**
 * 创建各 module 的默认运行状态。
 * 根据 getModulesForMode 生成 keys，每个 module 有默认状态对象。
 */
export function createDefaultModuleState(modeId, options = {}) {
  const moduleIds = getModulesForMode(modeId);
  const state = {};
  for (const id of moduleIds) {
    state[id] = {
      status: "initialized",
      updatedAt: null,
      data: {},
      warnings: []
    };
  }
  return state;
}

/**
 * 创建默认运行时开关。
 * visibleToUser 必须来自 mode manifest，禁止通过 runtimeFlags 打开 hidden mode。
 */
export function createDefaultRuntimeFlags(modeId, options = {}) {
  const hints = getModeRuntimeHints(modeId, options);
  return {
    modeRuntimeReady: true,
    moduleRuntimeReady: true,
    stateSchemaReady: true,
    projectFactoryReady: false,
    reviewContractReady: false,
    importExportReady: false,
    visibleToUser: hints.defaultVisibility === true && isModeVisible(modeId)
  };
}

/**
 * 创建默认审核策略占位。
 * 本轮不改现有审核行为：默认 manual_review / allowAutoApply=false。
 */
export function createDefaultReviewPolicy(modeId, options = {}) {
  return {
    policyVersion: 1,
    defaultDisposition: "manual_review",
    allowAutoApply: false,
    requireUserConfirmation: true,
    proposalTypes: [],
    protectedScopes: [
      "world.json",
      "shared/",
      "runtime/state.json"
    ],
    notes: []
  };
}

/**
 * 创建完整 Mode State Envelope。
 * 聚合 modeState / moduleState / runtimeFlags / reviewPolicy。
 * 全部 JSON-safe。
 */
export function createModeStateEnvelope(modeId, options = {}) {
  // 提前校验 mode 存在性
  getModeRuntimeHints(modeId, options);

  const now = options.createdAt || new Date().toISOString();
  const modeState = options.modeState || createDefaultModeState(modeId, options);
  const moduleState = options.moduleState || createDefaultModuleState(modeId, options);
  const runtimeFlags = options.runtimeFlags || createDefaultRuntimeFlags(modeId, options);
  const reviewPolicy = options.reviewPolicy || createDefaultReviewPolicy(modeId, options);

  return {
    schemaVersion: MODE_STATE_SCHEMA_VERSION,
    mode: modeId,
    modeVersion: options.modeVersion ?? 1,
    modeState,
    moduleState,
    runtimeFlags,
    reviewPolicy,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now
  };
}

/**
 * 补齐部分缺失/不完整的 envelope。
 * 不删除未知字段，不迁移真实文件，不 throw（除非 mode 完全缺失且无 options.modeId）。
 */
export function normalizeModeStateEnvelope(raw = {}, options = {}) {
  const modeId = raw.mode || options.modeId;
  if (!modeId) {
    throw new Error("Cannot normalize envelope: mode is missing");
  }

  let hints;
  try {
    hints = getModeRuntimeHints(modeId, options);
  } catch {
    // unknown mode → safe fallback
    hints = { mode: modeId, modeVersion: 1, dataMode: "preset", worldSubType: "classic", sourceType: "pasted_text", status: "unknown", defaultVisibility: false };
  }

  const defaultModeState = {
    status: "initialized",
    turnCount: 0,
    lastActiveAt: null,
    sourceType: hints.sourceType,
    dataMode: hints.dataMode,
    worldSubType: hints.worldSubType
  };

  const defaultRuntime = {
    modeRuntimeReady: true,
    moduleRuntimeReady: true,
    stateSchemaReady: true,
    projectFactoryReady: false,
    reviewContractReady: false,
    importExportReady: false,
    visibleToUser: hints.defaultVisibility === true
  };

  return {
    schemaVersion: raw.schemaVersion ?? MODE_STATE_SCHEMA_VERSION,
    mode: modeId,
    modeVersion: raw.modeVersion ?? hints.modeVersion ?? 1,

    modeState: raw.modeState && typeof raw.modeState === "object" && !Array.isArray(raw.modeState)
      ? { ...defaultModeState, ...raw.modeState }
      : defaultModeState,

    moduleState: raw.moduleState && typeof raw.moduleState === "object" && !Array.isArray(raw.moduleState)
      ? raw.moduleState
      : {},

    runtimeFlags: raw.runtimeFlags && typeof raw.runtimeFlags === "object" && !Array.isArray(raw.runtimeFlags)
      ? { ...defaultRuntime, ...raw.runtimeFlags }
      : defaultRuntime,

    reviewPolicy: raw.reviewPolicy && typeof raw.reviewPolicy === "object" && !Array.isArray(raw.reviewPolicy)
      ? { ...createDefaultReviewPolicy(modeId, options), ...raw.reviewPolicy }
      : createDefaultReviewPolicy(modeId, options),

    createdAt: raw.createdAt || options.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || options.updatedAt || new Date().toISOString()
  };
}

/**
 * 校验 envelope 最低结构。
 * 返回 { ok, errors, warnings }。
 */
export function validateModeStateEnvelope(envelope = {}) {
  const errors = [];
  const warnings = [];

  if (!envelope.schemaVersion) errors.push("schemaVersion is required");
  if (!envelope.mode) errors.push("mode is required");

  if (envelope.modeState != null && (typeof envelope.modeState !== "object" || Array.isArray(envelope.modeState))) {
    errors.push("modeState must be an object");
  }
  if (envelope.moduleState != null && (typeof envelope.moduleState !== "object" || Array.isArray(envelope.moduleState))) {
    errors.push("moduleState must be an object");
  }
  if (envelope.runtimeFlags != null && (typeof envelope.runtimeFlags !== "object" || Array.isArray(envelope.runtimeFlags))) {
    errors.push("runtimeFlags must be an object");
  }
  if (envelope.reviewPolicy != null && (typeof envelope.reviewPolicy !== "object" || Array.isArray(envelope.reviewPolicy))) {
    errors.push("reviewPolicy must be an object");
  }

  // reviewPolicy.allowAutoApply 在当前版本必须为 false
  if (envelope.reviewPolicy?.allowAutoApply === true) {
    errors.push("reviewPolicy.allowAutoApply must be false in schema v1");
  }

  // hidden mode 的 visibleToUser 不能为 true
  if (envelope.mode && envelope.runtimeFlags?.visibleToUser === true) {
    const mode = getMode(envelope.mode);
    if (mode && mode.status !== "active") {
      errors.push(`runtimeFlags.visibleToUser must be false for hidden/planned mode: ${envelope.mode}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 轻量摘要——测试和 debug 用。
 */
export function createModeStateSummary(envelope = {}) {
  return {
    mode: envelope.mode || "",
    schemaVersion: envelope.schemaVersion ?? 0,
    modeStatus: envelope.modeState?.status || "unknown",
    moduleCount: envelope.moduleState ? Object.keys(envelope.moduleState).length : 0,
    visibleToUser: envelope.runtimeFlags?.visibleToUser ?? false,
    reviewDefaultDisposition: envelope.reviewPolicy?.defaultDisposition || "manual_review",
    allowAutoApply: envelope.reviewPolicy?.allowAutoApply ?? false,
    warningCount: 0
  };
}
