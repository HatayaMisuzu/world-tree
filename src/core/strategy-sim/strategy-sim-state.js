export function createDefaultState() { return { schemaVersion: 1, modeMeaning: "solo_strategy_sim", turn: 1, factions: [], resources: {}, turnLog: [] }; }
export function createFaction(id, name) { return { id, name, resources: {}, plans: [] }; }
export function validateAction(action, context) { return { allowed: true, errors: [] }; }