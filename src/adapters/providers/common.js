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
  const promptDetails = usage.prompt_tokens_details || usage.promptTokensDetails || {};
  const completionDetails = usage.completion_tokens_details || usage.completionTokensDetails || {};
  const cacheHitTokens = Number(
    usage.prompt_cache_hit_tokens ??
    usage.promptCacheHitTokens ??
    usage.cached_tokens ??
    usage.cachedTokens ??
    promptDetails.cached_tokens ??
    promptDetails.cachedTokens ??
    0
  );
  const cacheMissTokens = Number(
    usage.prompt_cache_miss_tokens ??
    usage.promptCacheMissTokens ??
    0
  );
  const reasoningTokens = Number(
    usage.reasoning_tokens ??
    usage.reasoningTokens ??
    completionDetails.reasoning_tokens ??
    completionDetails.reasoningTokens ??
    0
  );
  const promptTokens = Number(
    usage.prompt_tokens ??
    usage.promptTokens ??
    usage.input_tokens ??
    usage.inputTokens ??
    usage.promptTokenCount ??
    0
  );
  const completionTokens = Number(
    usage.completion_tokens ??
    usage.completionTokens ??
    usage.output_tokens ??
    usage.outputTokens ??
    usage.candidatesTokenCount ??
    0
  );
  const totalTokens = Number(
    usage.total_tokens ??
    usage.totalTokens ??
    usage.totalTokenCount ??
    (promptTokens + completionTokens)
  );
  return { promptTokens, completionTokens, totalTokens, cacheHitTokens, cacheMissTokens, reasoningTokens };
}
