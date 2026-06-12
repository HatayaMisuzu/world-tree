export function normalizeCharacterState(items = []) {
  const raw = Array.isArray(items) ? items : Object.values(items || {});
  return raw.map((item, index) => ({
    id: item.id || item.name || `character-${index + 1}`,
    name: item.name || item.id || `角色${index + 1}`,
    role: item.role || "",
    status: item.status || "",
    mood: item.mood || "",
    location: item.location || "",
    knowledge: item.knowledge || {},
    source: item.source || "world-tree"
  }));
}

export function characterSnapshot(characters = []) {
  return normalizeCharacterState(characters).map((item) => `${item.name}: ${item.status || "正常"}${item.location ? ` @ ${item.location}` : ""}`).join("\n");
}
