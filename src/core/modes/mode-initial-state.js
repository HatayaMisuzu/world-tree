import { getModeRuntimeHints, createModeMetadata } from "./mode-metadata.js";

/**
 * 生成 engineState 补丁——mode 专属的 dataMode / worldSubType 等字段。
 * 不修改全局 DATA_MODES 枚举，只生成运行时 patch。
 */
export function createModeEngineStatePatch(modeId, options = {}) {
  const hints = getModeRuntimeHints(modeId, options);
  const patch = {
    dataMode: hints.dataMode,
    worldSubType: hints.worldSubType
  };

  // quick-setting 沿用旧 preset 管线，需要额外 preset 字段
  if (modeId === "quick-setting") {
    patch.preset = "preset";
  }

  return patch;
}

/**
 * 创建通用 mode initial state——供创建项目和持久化使用。
 * 返回结构与 quick-setting 现有 createQuickSettingInitialState 兼容。
 */
export function createModeInitialState(modeId, options = {}) {
  const metadata = createModeMetadata(modeId, options);
  const engineStatePatch = createModeEngineStatePatch(modeId, options);

  return {
    mode: modeId,
    modeMetadata: {
      modeVersion: metadata.modeVersion,
      displayName: metadata.displayName,
      createdAt: metadata.createdAt,
      sourceType: metadata.sourceType,
      dataMode: metadata.dataMode,
      worldSubType: metadata.worldSubType,
      status: metadata.status,
      defaultVisibility: metadata.defaultVisibility
    },
    moduleGraph: metadata.moduleGraph,
    wrapperGraph: metadata.wrapperGraph,
    engineStatePatch
  };
}
