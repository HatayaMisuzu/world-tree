export function exportWorldbookJson(worldbook = {}, options = {}) {
  return { ...worldbook, exportedAt: new Date().toISOString(), exportVersion: 1 };
}
export function exportWorldContextSummaryMarkdown(packet = {}, options = {}) {
  const id = packet.worldIdentity || {};
  return `# ${id.title || "世界"}\n\n${id.premise || ""}\n\n## 活跃条目\n${(packet.activeLoreEntries || []).map(e => `- **${e.title || e.id}**: ${(e.content || "").slice(0, 200)}`).join("\n")}`;
}
