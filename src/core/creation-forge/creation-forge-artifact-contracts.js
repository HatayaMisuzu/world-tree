export const FORGE_ARTIFACT_TYPES = ["character","worldbook","grand_world","tabletop","mystery_puzzle","strategy_sim","murder_mystery"];

const CONTRACTS = {
  character: { requiredFiles: ["shared/characters.json","shared/character_profile.json"], requiredFields: ["title","sourceText"], targetMode: "character", canInstantiateProject: true, visibilityRules: "no_hidden_truth_leak" },
  worldbook: { requiredFiles: ["shared/worldbook.json","shared/scenes.json"], requiredFields: ["title","sourceText"], targetMode: "world-rpg", canInstantiateProject: true, visibilityRules: "gm_only_section_allowed" },
  grand_world: { requiredFiles: ["shared/worldbook.json","shared/world_threads.json"], requiredFields: ["title","sourceText"], targetMode: "world-rpg", canInstantiateProject: true, visibilityRules: "world_state_proposals_only" },
  tabletop: { requiredFiles: ["shared/tabletop.json"], requiredFields: ["title","sourceText"], targetMode: "tabletop", canInstantiateProject: true, visibilityRules: "no_hidden_rules" },
  mystery_puzzle: { requiredFiles: ["shared/mystery_puzzle.json"], requiredFields: ["title","sourceText"], targetMode: "mystery-puzzle", canInstantiateProject: true, visibilityRules: "answer_lock_protected" },
  strategy_sim: { requiredFiles: ["shared/strategy_sim.json"], requiredFields: ["title","sourceText"], targetMode: "strategy-sim", canInstantiateProject: true, visibilityRules: "faction_balance" },
  murder_mystery: { requiredFiles: ["shared/murder_mystery.json"], requiredFields: ["title","sourceText"], targetMode: "murder-mystery", canInstantiateProject: true, visibilityRules: "truth_lock_system_only" },
};

export function getForgeArtifactContract(type) {
  return CONTRACTS[type] ? { ...CONTRACTS[type] } : null;
}

export function validateForgeArtifactAgainstContract(artifact = {}, contract = {}, options = {}) {
  const errors = [], warnings = [];
  if (!contract) return { ok: false, errors: ["unknown contract"], warnings: [] };
  for (const f of (contract.requiredFields || [])) { if (!(f in artifact)) errors.push(`missing required field: ${f}`); }
  return { ok: errors.length === 0, errors, warnings };
}

export function createForgeArtifactSkeleton(type, options = {}) {
  const contract = getForgeArtifactContract(type);
  return { title: "", sourceText: "", contractRef: contract?.targetMode || "", requiredFields: contract?.requiredFields || [] };
}
