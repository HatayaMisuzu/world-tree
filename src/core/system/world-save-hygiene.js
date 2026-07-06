const ENGINE_GRAPH_FIELDS = new Set(["moduleGraph", "wrapperGraph"]);

export function stripRegenerableWorldFields(world = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(world || {})) {
    if (ENGINE_GRAPH_FIELDS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

export function buildEngineGraphSidecar(world = {}, runtimeState = {}) {
  const moduleGraph = runtimeState.moduleGraph || world.moduleGraph || null;
  const wrapperGraph = runtimeState.wrapperGraph || world.wrapperGraph || null;
  if (!moduleGraph && !wrapperGraph) return null;
  return {
    schemaVersion: 1,
    source: "regenerable-runtime-graph",
    moduleGraph,
    wrapperGraph
  };
}

export function splitWorldForSave(world = {}, runtimeState = {}) {
  return {
    world: stripRegenerableWorldFields(world),
    engineGraph: buildEngineGraphSidecar(world, runtimeState)
  };
}

export function mergeLegacyWorldGraph(world = {}, runtimeState = {}) {
  return {
    ...runtimeState,
    moduleGraph: runtimeState.moduleGraph || world.moduleGraph,
    wrapperGraph: runtimeState.wrapperGraph || world.wrapperGraph
  };
}
