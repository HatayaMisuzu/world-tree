import { getMode } from "./mode-manifest.js";
import { loadModulesForMode, loadWrappersForMode } from "../modules/module-loader.js";

/**
 * 根据 mode-manifest 读取 mode 运行提示信息。
 * 优先级：options 明确传入 > manifest 字段 > 安全默认值。
 */
export function getModeRuntimeHints(modeId, options = {}) {
  const mode = getMode(modeId);
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);

  // sourceType: options > manifest.sourceType > manifest.sourceTypeHint > default
  const sourceType =
    options.sourceType ||
    mode.sourceType ||
    mode.sourceTypeHint ||
    "pasted_text";

  // dataMode: options > manifest.dataModeHint > default
  const dataMode =
    options.dataMode ||
    mode.dataModeHint ||
    "preset";

  // worldSubType: options > manifest.worldSubTypeHint > default
  const worldSubType =
    options.worldSubType ||
    mode.worldSubTypeHint ||
    "classic";

  return {
    mode: modeId,
    modeVersion: options.modeVersion ?? 1,
    displayName: options.displayName || mode.name || modeId,
    sourceType,
    dataMode,
    worldSubType,
    status: options.status || mode.status || "planned",
    defaultVisibility: options.defaultVisibility ?? (mode.defaultVisibility === true)
  };
}

/**
 * 将 loadModulesForMode 的结果转为 JSON-safe 摘要（不含函数/循环引用/路径/密钥）。
 */
export function summarizeModeModuleGraph(loadResult = {}) {
  const graph = loadResult.graph || {};
  return {
    modeId: loadResult.modeId || "",
    requested: Array.isArray(graph.requested) ? [...graph.requested] : [],
    resolved: Array.isArray(graph.resolved) ? [...graph.resolved] : [],
    missing: Array.isArray(graph.missing) ? [...graph.missing] : [],
    warnings: Array.isArray(graph.warnings) ? [...graph.warnings] : [],
    modules: (Array.isArray(graph.modules) ? graph.modules : []).map((mod) => ({
      id: mod.id || "",
      legacyId: mod.legacyId || "",
      category: mod.category || "",
      status: mod.status || "",
      callable: Boolean(mod.callable),
      hasWrapper: Boolean(mod.hasWrapper),
      hooks: Array.isArray(mod.hooks) ? [...mod.hooks] : []
    }))
  };
}

/**
 * 将 loadWrappersForMode 的结果转为 JSON-safe 摘要（不含函数/路径/密钥）。
 */
export function summarizeModeWrapperGraph(loadResult = {}) {
  const hooksMap = loadResult.hooks || {};
  return {
    modeId: loadResult.modeId || "",
    requested: Array.isArray(loadResult.uses) ? [...loadResult.uses] : [],
    wrappers: (Array.isArray(loadResult.wrappers) ? loadResult.wrappers : []).map((wrapper) => ({
      id: wrapper.id || "",
      legacyId: wrapper.legacyId || "",
      status: wrapper.status || "",
      hooks: Array.isArray(hooksMap[wrapper.id]) ? [...hooksMap[wrapper.id]] : []
    })),
    missingWrappers: Array.isArray(loadResult.missingWrappers) ? [...loadResult.missingWrappers] : [],
    warnings: Array.isArray(loadResult.warnings) ? [...loadResult.warnings] : []
  };
}

/**
 * 创建通用 mode metadata——调用 loader 生成 module graph + wrapper graph 摘要。
 * 返回的 metadata 完全 JSON-safe。
 */
export function createModeMetadata(modeId, options = {}) {
  const hints = getModeRuntimeHints(modeId, options);
  const moduleLoad = loadModulesForMode(modeId);
  const wrapperLoad = loadWrappersForMode(modeId);

  return {
    mode: modeId,
    modeVersion: hints.modeVersion,
    displayName: hints.displayName,
    createdAt: options.createdAt || new Date().toISOString(),
    sourceType: hints.sourceType,
    dataMode: hints.dataMode,
    worldSubType: hints.worldSubType,
    status: hints.status,
    defaultVisibility: hints.defaultVisibility,
    moduleGraph: summarizeModeModuleGraph(moduleLoad),
    wrapperGraph: summarizeModeWrapperGraph(wrapperLoad)
  };
}
