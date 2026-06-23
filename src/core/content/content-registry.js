export const CONTENT_TYPES = Object.freeze({
  worldbook_entry: { path: "shared/worldbook.json", category: "lore" },
  world_state: { path: "shared/world_state.json", category: "world_state" },
  character_state: { path: "shared/characters.json", category: "character" },
  relationship: { path: "shared/relations.json", category: "relationship" },
  scene_summary: { path: "runtime/scene-summaries.jsonl", category: "scene" },
  clue: { path: "shared/world_state.json", category: "truth" },
  rule: { path: "shared/worldbook.json", category: "rule" },
  truth: { path: "shared/worldbook.json", category: "truth" },
  organization_state: { path: "shared/organizations.json", category: "world_state" },
  location_state: { path: "shared/world_state.json", category: "world_state" }
});

export function resolveContentTarget(type) { return CONTENT_TYPES[type] || null; }
export function validateContentTarget(type, targetFile = "") {
  const entry = resolveContentTarget(type);
  if (!entry) return { ok: false, reason: "unknown_content_type" };
  if (entry.path.startsWith("runtime/")) return { ok: targetFile === entry.path, reason: targetFile === entry.path ? "runtime_only" : "target_mismatch" };
  return { ok: targetFile === entry.path && targetFile.startsWith("shared/"), reason: targetFile === entry.path ? "proposal_required" : "target_mismatch" };
}
