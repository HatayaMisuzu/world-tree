export const PROMPT_SECTION_ORDER = Object.freeze([
  "system_identity",
  "writing_rules",
  "canon_summary",
  "worldbook_hits",
  "recent_history",
  "direction_packet",
  "turn_input",
  "task_contract",
  "runtime_orchestration"
]);

const ORDER_INDEX = new Map(PROMPT_SECTION_ORDER.map((id, index) => [id, index]));

export function orderPromptSections(sections = []) {
  return [...(Array.isArray(sections) ? sections : [])]
    .filter((section) => section?.content)
    .sort((a, b) => (ORDER_INDEX.get(a.kind) ?? 999) - (ORDER_INDEX.get(b.kind) ?? 999));
}

export function renderOrderedPromptSections(sections = []) {
  return orderPromptSections(sections)
    .map((section) => [`<WT:${section.kind}>`, section.content, `</WT:${section.kind}>`].join("\n"))
    .join("\n\n---\n\n");
}
