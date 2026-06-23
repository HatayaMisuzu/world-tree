import { loadModulesForMode, loadWrappersForMode } from "../modules/module-loader.js";
import { createModeMetadata, summarizeModeModuleGraph } from "./mode-metadata.js";
import { createModeInitialState } from "./mode-initial-state.js";
import { createModeRuntimePacket } from "./mode-runtime.js";

export const QUICK_SETTING_MODE_ID = "quick-setting";

/** quick-setting 专属输入标准化——不同 mode 的 sourceText/title 默认值可能不同。 */
export function normalizeQuickSettingInput(input = {}) {
  const rawTitle = String(input.title || input.name || "未命名设定").trim();
  const sourceType = String(input.sourceType || "pasted_text").trim() || "pasted_text";
  return {
    title: rawTitle || "未命名设定",
    sourceText: String(input.sourceText || input.text || input.content || "").trim(),
    sourceType
  };
}

/** 委托 loadModulesForMode 加载 quick-setting 模块图。 */
export function buildQuickSettingModuleGraph() {
  return loadModulesForMode(QUICK_SETTING_MODE_ID);
}

/** 委托 loadWrappersForMode 加载 quick-setting wrapper 图。 */
export function buildQuickSettingWrapperGraph() {
  return loadWrappersForMode(QUICK_SETTING_MODE_ID);
}

/** quick-setting module graph 摘要——保留旧 API 兼容。 */
export function summarizeQuickSettingGraph(loadResult = {}) {
  return summarizeModeModuleGraph(loadResult);
}

/** quick-setting wrapper graph 摘要。 */
export function summarizeQuickSettingWrappers(loadResult = {}) {
  const hooks = loadResult.hooks || {};
  return {
    modeId: loadResult.modeId || QUICK_SETTING_MODE_ID,
    requested: Array.isArray(loadResult.uses) ? [...loadResult.uses] : [],
    wrappers: (Array.isArray(loadResult.wrappers) ? loadResult.wrappers : []).map((wrapper) => ({
      id: wrapper.id || "",
      legacyId: wrapper.legacyId || "",
      status: wrapper.status || "",
      hooks: Array.isArray(hooks[wrapper.id]) ? [...hooks[wrapper.id]] : []
    })),
    missingWrappers: Array.isArray(loadResult.missingWrappers) ? [...loadResult.missingWrappers] : [],
    warnings: Array.isArray(loadResult.warnings) ? [...loadResult.warnings] : []
  };
}

/** 创建 quick-setting metadata——委托通用 createModeMetadata，保留向后兼容。 */
export function createQuickSettingMetadata(options = {}) {
  const normalized = normalizeQuickSettingInput(options);
  return createModeMetadata(QUICK_SETTING_MODE_ID, {
    ...options,
    sourceType: normalized.sourceType
  });
}

/** 创建 quick-setting initial state——委托通用 createModeInitialState，保留向后兼容。 */
export function createQuickSettingInitialState(options = {}) {
  return createModeInitialState(QUICK_SETTING_MODE_ID, options);
}
