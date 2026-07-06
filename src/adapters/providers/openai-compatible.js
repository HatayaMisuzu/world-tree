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
  async chat({ baseUrl, model, messages, apiKey, temperature = 0.7, maxTokens = 1024, responseFormat = null, fetchImpl = fetch, timeoutMs = 60000 }) {
    const endpoint = chatEndpoint(baseUrl);
    const body = { model, messages, temperature, max_tokens: maxTokens };
    if (responseFormat === "json") body.response_format = { type: "json_object" };
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
      raw: data,
      usage: normalizeUsage(data?.usage || {}),
      modelUsed: data?.model || model,
      endpointUsed: endpoint,
      provider: "openai-compatible"
    };
  },
  async chatStream({ baseUrl, model, messages, apiKey, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, timeoutMs = 60000, onDelta }) {
    const endpoint = chatEndpoint(baseUrl);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
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
