export function parseWorldbookText(raw = "", options = {}) {
  const trimmed = String(raw || "").trim();
  return { format: "plain_text", title: trimmed.split("\n")[0]?.slice(0, 40) || "未命名世界", content: trimmed, entries: [] };
}
export function parseWorldbookJson(raw = {}, options = {}) {
  return { format: "world_tree_worldbook_json", title: raw.title || "", entries: Array.isArray(raw.entries) ? raw.entries : [] };
}
export function createImportedWorldbookSummary(parsed = {}, options = {}) {
  return { format: parsed.format || "unknown", title: parsed.title || "", entryCount: (parsed.entries || []).length };
}
