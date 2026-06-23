import { getModuleGraph } from "./module-registry.js";
import { getMode } from "../modes/mode-manifest.js";
import { getModulesForMode } from "../modes/mode-module-map.js";
import { getModuleWrapper, listWrapperHooks } from "./wrappers/index.js";

export function loadModulesForMode(modeId) {
  const mode = getMode(modeId);
  const uses = getModulesForMode(modeId);
  const graph = getModuleGraph(uses);
  const warnings = [...graph.warnings];
  if (!mode) warnings.unshift(`unknown mode: ${modeId}`);
  return { modeId, uses, graph, warnings };
}

export function loadModules(moduleIds = []) {
  const uses = Array.isArray(moduleIds) ? [...moduleIds] : [];
  const graph = getModuleGraph(uses);
  return { uses, graph, warnings: [...graph.warnings] };
}

export function loadModuleWrapper(moduleId) {
  return getModuleWrapper(moduleId);
}

export function loadWrappersForMode(modeId) {
  const mode = getMode(modeId);
  const uses = getModulesForMode(modeId);
  const graph = getModuleGraph(uses);
  const wrappers = [];
  const missingWrappers = [];
  for (const module of graph.modules) {
    const wrapper = getModuleWrapper(module.id);
    if (wrapper) wrappers.push(wrapper);
    else missingWrappers.push(module.id);
  }
  const warnings = [...graph.warnings];
  if (!mode) warnings.unshift(`unknown mode: ${modeId}`);
  warnings.push(...missingWrappers.map((moduleId) => `wrapper unavailable: ${moduleId}`));
  return {
    modeId,
    uses,
    wrappers,
    missingWrappers,
    hooks: Object.fromEntries(wrappers.map((wrapper) => [wrapper.id, listWrapperHooks(wrapper.id)])),
    warnings
  };
}

export function describeLoadedModules(loadResult) {
  const graph = loadResult?.graph || getModuleGraph([]);
  const lines = [];
  if (loadResult?.modeId) lines.push(`Mode: ${loadResult.modeId}`);
  lines.push(`Requested modules: ${graph.requested.length}`);
  lines.push(`Resolved: ${graph.resolved.length}`);
  lines.push(`Missing: ${graph.missing.length}`, "");
  for (const entry of graph.modules) {
    const legacy = entry.legacyId ? ` ← ${entry.legacyId}` : "";
    lines.push(`[${entry.status}] ${entry.id}${legacy} ${entry.name}`);
  }
  if (graph.missing.length) {
    lines.push("", ...graph.missing.map((id) => `[missing] ${id}`));
  }
  return lines.join("\n").trimEnd();
}
