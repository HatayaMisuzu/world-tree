// adapters/llm-workflow-adapter.js — WSD-4 safe LLM generation adapter
export async function generateWorkflowDraft({ envelope, promptPacket, deps = {} } = {}) {
  if (deps.fakeLlm) {
    const result = await deps.fakeLlm({ envelope, promptPacket });
    return normalizeDraft(result);
  }
  if (!deps.realLlm || envelope.options?.disableNetwork === true) {
    return { ok: true, text: buildOfflineFallback(envelope), llmUsed: false, warnings: ["LLM unavailable; fallback used."], debug: { adapter: "llm-workflow-adapter", fallback: true } };
  }
  try {
    const result = await deps.realLlm({ envelope, promptPacket });
    return normalizeDraft(result);
  } catch (error) {
    return { ok: true, text: buildOfflineFallback(envelope), llmUsed: false, warnings: [`LLM error: ${error?.message || "unknown"}`], debug: { adapter: "llm-workflow-adapter", fallback: true } };
  }
}

function normalizeDraft(raw) {
  return { ok: raw?.ok !== false, text: raw?.text ?? raw?.visibleText ?? raw?.content ?? "", raw: raw, llmUsed: raw?.llmUsed !== false, model: raw?.model ?? "unknown", warnings: raw?.warnings ?? [], debug: raw?.debug ?? {} };
}

function buildOfflineFallback(envelope) {
  const input = envelope.userInput || "";
  if (input.includes("继续")) return "世界继续运转…";
  if (input.includes("创建") || input.includes("新建")) return "创建向导已就绪，请提供更多信息。";
  return `[离线模式] 收到：「${input.slice(0, 80)}」`;
}
