import { loadModulesForMode } from "../modules/module-loader.js";

export const QUICK_SETTING_MODE_ID = "quick-setting";

export function normalizeQuickSettingInput(input = {}) {
  const rawTitle = String(input.title || input.name || "未命名设定").trim();
  const sourceType = String(input.sourceType || "pasted_text").trim() || "pasted_text";
  return {
    title: rawTitle || "未命名设定",
    sourceText: String(input.sourceText || input.text || input.content || "").trim(),
    sourceType
  };
}

export function buildQuickSettingModuleGraph() {
  return loadModulesForMode(QUICK_SETTING_MODE_ID);
}

export function summarizeQuickSettingGraph(loadResult = {}) {
  const graph = loadResult.graph || {};
  return {
    modeId: QUICK_SETTING_MODE_ID,
    requested: Array.isArray(graph.requested) ? [...graph.requested] : [],
    resolved: Array.isArray(graph.resolved) ? [...graph.resolved] : [],
    missing: Array.isArray(graph.missing) ? [...graph.missing] : [],
    warnings: Array.isArray(graph.warnings) ? [...graph.warnings] : [],
    modules: (Array.isArray(graph.modules) ? graph.modules : []).map((module) => ({
      id: module.id || "",
      legacyId: module.legacyId || "",
      category: module.category || "",
      status: module.status || "",
      callable: Boolean(module.callable)
    }))
  };
}

export function createQuickSettingMetadata(options = {}) {
  const normalized = normalizeQuickSettingInput(options);
  return {
    mode: QUICK_SETTING_MODE_ID,
    modeVersion: 1,
    displayName: "预设/设定",
    createdAt: options.createdAt || new Date().toISOString(),
    sourceType: normalized.sourceType,
    dataMode: "preset",
    worldSubType: "classic",
    moduleGraph: summarizeQuickSettingGraph(buildQuickSettingModuleGraph())
  };
}

export function createQuickSettingInitialState(options = {}) {
  const metadata = createQuickSettingMetadata(options);
  return {
    mode: QUICK_SETTING_MODE_ID,
    modeMetadata: {
      modeVersion: metadata.modeVersion,
      displayName: metadata.displayName,
      createdAt: metadata.createdAt,
      sourceType: metadata.sourceType,
      dataMode: metadata.dataMode,
      worldSubType: metadata.worldSubType
    },
    moduleGraph: metadata.moduleGraph,
    engineStatePatch: {
      dataMode: "preset",
      worldSubType: "classic",
      preset: "preset"
    }
  };
}
