import { MODULE_MANIFEST, LEGACY_MODULE_MAP } from "./module-manifest.js";
import { MODULE_STATUS, isCallableModule, normalizeModuleDefinition } from "./module-contract.js";
import { getModulesForMode } from "../modes/mode-module-map.js";

export function listModules(options = {}) {
  const status = typeof options.status === "string" ? options.status : null;
  const category = typeof options.category === "string" ? options.category : null;
  const modeId = typeof options.modeId === "string" ? options.modeId : null;
  return Object.values(MODULE_MANIFEST).filter((entry) => {
    if (status && entry.status !== status) return false;
    if (category && entry.category !== category) return false;
    return !modeId || entry.usedByModes.includes(modeId);
  }).map(normalizeModuleDefinition);
}

export function getModule(moduleId) {
  const definition = MODULE_MANIFEST[moduleId];
  return definition ? normalizeModuleDefinition(definition) : null;
}

export function getModuleByLegacyId(legacyId) {
  const moduleId = LEGACY_MODULE_MAP[legacyId];
  return moduleId ? getModule(moduleId) : null;
}

export function hasModule(moduleId) {
  return Object.hasOwn(MODULE_MANIFEST, moduleId);
}

export function expandModuleDependencies(moduleIds = []) {
  const modules = [];
  const included = new Set();
  const missing = new Set();
  const visiting = new Set();
  const cycles = [];

  function visit(id, path = []) {
    if (included.has(id) || missing.has(id)) return;
    if (visiting.has(id)) {
      cycles.push([...path, id]);
      return;
    }
    const definition = getModule(id);
    if (!definition) {
      missing.add(id);
      return;
    }
    visiting.add(id);
    for (const dependency of definition.dependsOn) visit(dependency, [...path, id]);
    visiting.delete(id);
    if (!included.has(id)) {
      included.add(id);
      modules.push(id);
    }
  }

  for (const id of Array.isArray(moduleIds) ? moduleIds : []) visit(id);
  return { modules, missing: [...missing], cycles };
}

export function getModuleStatus(moduleId) {
  return getModule(moduleId)?.status || MODULE_STATUS.MISSING;
}

export function getModuleGraph(moduleIds = []) {
  const requested = [...new Set(Array.isArray(moduleIds) ? moduleIds : [])];
  const expanded = expandModuleDependencies(requested);
  const modules = expanded.modules.map((id) => {
    const entry = getModule(id);
    return {
      id: entry.id,
      legacyId: entry.legacyId,
      name: entry.name,
      category: entry.category,
      status: entry.status,
      dependsOn: [...entry.dependsOn],
      sourceFiles: [...entry.sourceFiles],
      callable: isCallableModule(entry)
    };
  });
  const warnings = expanded.missing.map((id) => `missing module: ${id}`);
  warnings.push(...expanded.cycles.map((cycle) => `circular dependency: ${cycle.join(" -> ")}`));
  return { requested, resolved: [...expanded.modules], missing: [...expanded.missing], modules, warnings };
}

export function getModulesByMode(modeId) {
  return getModulesForMode(modeId).map(getModule).filter(Boolean);
}

export function getModuleStats() {
  const modules = Object.values(MODULE_MANIFEST);
  const byStatus = {};
  const byCategory = {};
  for (const entry of modules) {
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }
  return {
    total: modules.length,
    byStatus,
    byCategory,
    legacyMappedCount: Object.keys(LEGACY_MODULE_MAP).length,
    callableCount: modules.filter(isCallableModule).length
  };
}
