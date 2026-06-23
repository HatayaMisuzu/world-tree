export function createDefaultPersona(input = {}, options = {}) {
  return { id: input.id || "default", name: input.name || "用户", roleInChat: input.roleInChat || "", relationshipToCharacter: input.relationshipToCharacter || "", knownFacts: Array.isArray(input.knownFacts) ? input.knownFacts : [], loreRefs: Array.isArray(input.loreRefs) ? input.loreRefs : [] };
}
export function normalizePersonaStore(store = {}, options = {}) {
  return { schemaVersion: store.schemaVersion || 1, activePersonaId: store.activePersonaId || "default", items: Array.isArray(store.items) ? store.items.map(createDefaultPersona) : [createDefaultPersona()], createdAt: store.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export function getActivePersona(store = {}, options = {}) {
  const n = normalizePersonaStore(store);
  return n.items.find(p => p.id === n.activePersonaId) || n.items[0] || createDefaultPersona();
}
export function validatePersonaStore(store = {}, options = {}) {
  const errors = [], warnings = [];
  if (!Array.isArray(store.items) || store.items.length === 0) warnings.push("no personas");
  return { ok: errors.length === 0, errors, warnings };
}