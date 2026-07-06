import { estimateContextTokens } from "../../core/engine/context-budget.js";

export function normalizeBaseUrl(baseUrl = "") {
  return String(baseUrl || "").replace(/\/$/, "");
}

export function countHint(value = "") {
  return estimateContextTokens(value);
}

export async function parseJsonResponse(response) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }
  if (!response.ok) {
    const error = new Error(text || `LLM HTTP ${response.status}`);
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

export function normalizeProviderError(error, providerId = "unknown") {
  return {
    provider: providerId,
    code: error?.code || (error?.status ? `HTTP_${error.status}` : "PROVIDER_ERROR"),
    message: error?.message || "Provider request failed",
    status: error?.status || 0
  };
}

export function splitSystemMessages(messages = []) {
  const system = [];
  const rest = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role === "system") system.push(String(message.content || ""));
    else if (message?.role === "assistant" || message?.role === "user") rest.push({ role: message.role, content: String(message.content || "") });
  }
  return { system: system.join("\n\n"), messages: rest };
}

export function normalizeUsage(usage = {}) {
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? 0);
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokenCount ?? (promptTokens + completionTokens));
  return { promptTokens, completionTokens, totalTokens };
}
