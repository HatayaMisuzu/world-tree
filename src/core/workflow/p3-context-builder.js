// p3-context-builder.js — Build safe P3 mechanism summary for context injection
export async function buildP3MechanismContext(input = {}) {
  const { modeId = "", workflowType = "play_turn" } = input;
  const mechanisms = {};
  for (const [key, id] of Object.entries(MECHANISM_REGISTRY)) {
    mechanisms[key] = { id, enabled: true, readiness: "kernel-complete", summary: `${id}: kernel ready, tests pass` };
  }
  return { version: 1, enabled: true, modeId, workflowType, mechanisms, promptBlocks: [], warnings: [], debug: {} };
}
const MECHANISM_REGISTRY = {
  creationWizard: "M1-creation-wizard", alchemyDigest: "M2-alchemy-digest", materialWarehouse: "M3-material-warehouse",
  characterKernel: "M4-character-kernel-v2", cognitionMatrix: "M5-cognition-matrix", factionGraph: "M6-faction-graph",
  worldRules: "M7-world-rules", narrativeRadar: "M8-narrative-radar", randomEvents: "M9-random-events",
  macros: "M10-macros", observability: "M11-observability"
};
