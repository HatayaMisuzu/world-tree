export function createCharacterLoreFromBook(characterBook, options = {}) {
  const entries = (characterBook?.entries || characterBook || []).map(e => ({
    id: e.id || `lore_${Date.now()}`,
    keys: Array.isArray(e.keys) ? e.keys : [],
    content: e.content || "",
    enabled: e.enabled !== false,
    insertionOrder: e.insertion_order || e.insertionOrder || 100,
    priority: e.priority || 0
  }));
  return { schemaVersion: 1, characterId: options.characterId || "primary", entries, source: "character_book", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export function normalizeCharacterLore(lore = {}, options = {}) {
  return { schemaVersion: lore.schemaVersion || 1, characterId: lore.characterId || "primary", entries: Array.isArray(lore.entries) ? lore.entries : [], source: lore.source || "character_book", createdAt: lore.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export function selectActiveCharacterLoreEntries(lore = {}, input = "", options = {}) {
  const entries = Array.isArray(lore.entries) ? lore.entries : [];
  const max = options.maxEntries || 5;
  if (!input) return entries.filter(e => e.enabled !== false).slice(0, max);
  const scored = entries.map(e => ({ ...e, score: (e.keys || []).filter(k => input.toLowerCase().includes(k.toLowerCase())).length }));
  return scored.filter(e => e.enabled !== false).sort((a, b) => b.score - a.score || b.priority - a.priority).slice(0, max);
}
export function validateCharacterLore(lore = {}, options = {}) {
  const errors = [], warnings = [];
  if (!Array.isArray(lore.entries)) errors.push({ code: "invalid_entries", message: "entries must be array" });
  return { ok: errors.length === 0, errors, warnings };
}