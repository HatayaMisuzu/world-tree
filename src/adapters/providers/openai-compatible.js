import { countHint, normalizeBaseUrl, normalizeProviderError, normalizeUsage, parseJsonResponse } from "./common.js";

export const openAICompatibleProvider = {
  id: "openai-compatible",
  aliases: ["deepseek", "openrouter", "ollama", "vllm", "lmstudio"],
  supports() {
    return { chat: true, chatStream: true, jsonMode: true, systemRole: true, usage: true };
  },
  countHint,
  normalizeError(error) {
    return normalizeProviderError(error, "openai-compatible");
  },
  async chat({ baseUrl, providerId = "", model, messages, apiKey, temperature = 0.7, maxTokens = 1024, responseFormat = null, thinking = "auto", fetchImpl = fetch, timeoutMs = 60000 }) {
    const endpoint = chatEndpoint(baseUrl);
    const body = buildOpenAICompatibleChatBody({ baseUrl, providerId, model, messages, temperature, maxTokens, responseFormat, thinking });
    let response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok && response.status === 400 && body.response_format) {
      const text = await response.text();
      if (/response[_ -]?format|json_object/i.test(text)) {
        const retryBody = { ...body };
        delete retryBody.response_format;
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify(retryBody),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } else {
        throw Object.assign(new Error(text || "LLM HTTP 400"), { status: 400, body: text });
      }
    }
    const data = await parseJsonResponse(response);
    return {
      text: data?.choices?.[0]?.message?.content || "",
      reasoningContent: data?.choices?.[0]?.message?.reasoning_content || data?.choices?.[0]?.message?.reasoningContent || "",
      raw: data,
      usage: normalizeUsage(data?.usage || {}),
      modelUsed: data?.model || model,
      endpointUsed: endpoint,
      provider: "openai-compatible"
    };
  },
  async chatStream({ baseUrl, providerId = "", model, messages, apiKey, temperature = 0.7, maxTokens = 1024, thinking = "auto", fetchImpl = fetch, timeoutMs = 60000, onDelta }) {
    const endpoint = chatEndpoint(baseUrl);
    const body = buildOpenAICompatibleChatBody({ baseUrl, providerId, model, messages, temperature, maxTokens, stream: true, thinking });
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw Object.assign(new Error(await response.text().catch(() => `HTTP ${response.status}`)), { status: response.status });
    if (!response.body) {
      throw Object.assign(new Error("stream body missing"), { code: "LLM_STREAM_UNSUPPORTED", streamUnsupported: true });
    }
    let text = "";
    for await (const event of parseOpenAIStream(response.body)) {
      text += event;
      if (onDelta) onDelta(event);
    }
    return { text, raw: null, usage: normalizeUsage({}), modelUsed: model, endpointUsed: endpoint, provider: "openai-compatible", stream: true };
  }
};

export function chatEndpoint(baseUrl = "") {
  const base = normalizeBaseUrl(baseUrl);
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

export function buildOpenAICompatibleChatBody({ baseUrl = "", providerId = "", model = "", messages = [], temperature = 0.7, maxTokens = 1024, responseFormat = null, stream = false, thinking = "auto" } = {}) {
  const thinkingPayload = resolveOpenAICompatibleThinking({ baseUrl, providerId, model, thinking });
  const body = {
    model,
    messages,
    temperature,
    max_tokens: effectiveMaxTokens(maxTokens, thinkingPayload)
  };
  if (stream) body.stream = true;
  if (responseFormat === "json") body.response_format = { type: "json_object" };
  if (thinkingPayload) body.thinking = thinkingPayload;
  return body;
}

export function resolveOpenAICompatibleThinking({ baseUrl = "", providerId = "", model = "", thinking = "auto" } = {}) {
  if (thinking && typeof thinking === "object") return thinking;
  const value = String(thinking ?? "auto").trim().toLowerCase();
  if (["disabled", "disable", "off", "false", "0"].includes(value)) return { type: "disabled" };
  if (["enabled", "enable", "on", "true", "1"].includes(value)) return { type: "enabled" };
  if (value && value !== "auto") return null;
  const provider = String(providerId || "").toLowerCase();
  const url = String(baseUrl || "").toLowerCase();
  const modelName = String(model || "").toLowerCase();
  if (provider === "deepseek" || url.includes("api.deepseek.com") || modelName.includes("deepseek-v4-flash")) {
    return { type: "disabled" };
  }
  return null;
}

function effectiveMaxTokens(maxTokens, thinkingPayload) {
  const parsed = Number(maxTokens || 0);
  const fallback = parsed > 0 ? parsed : 1024;
  if (thinkingPayload?.type === "enabled") return Math.max(fallback, 4096);
  return fallback;
}

export async function* parseOpenAIStream(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of raw.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content || "";
        if (delta) yield delta;
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}
