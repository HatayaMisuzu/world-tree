import { countHint, normalizeBaseUrl, normalizeProviderError, normalizeUsage, parseJsonResponse, splitSystemMessages } from "./common.js";

export const anthropicProvider = {
  id: "anthropic",
  supports() {
    return { chat: true, chatStream: true, jsonMode: false, systemRole: "separate", usage: true };
  },
  countHint,
  normalizeError(error) {
    return normalizeProviderError(error, "anthropic");
  },
  async chat({ baseUrl = "https://api.anthropic.com/v1", model, messages, apiKey, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, timeoutMs = 60000 }) {
    const endpoint = `${normalizeBaseUrl(baseUrl)}/messages`;
    const payload = buildAnthropicPayload({ model, messages, temperature, maxTokens });
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await parseJsonResponse(response);
    return {
      text: (data.content || []).map((item) => item?.text || "").join(""),
      raw: data,
      usage: normalizeUsage(data.usage || {}),
      modelUsed: data.model || model,
      endpointUsed: endpoint,
      provider: "anthropic"
    };
  },
  async chatStream({ baseUrl = "https://api.anthropic.com/v1", model, messages, apiKey, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, timeoutMs = 60000, onDelta }) {
    const endpoint = `${normalizeBaseUrl(baseUrl)}/messages`;
    const payload = { ...buildAnthropicPayload({ model, messages, temperature, maxTokens }), stream: true };
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey || "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw Object.assign(new Error(await response.text().catch(() => `HTTP ${response.status}`)), { status: response.status });
    let text = "";
    for await (const delta of parseAnthropicStream(response.body)) {
      text += delta;
      if (onDelta) onDelta(delta);
    }
    return { text, raw: null, usage: normalizeUsage({}), modelUsed: model, endpointUsed: endpoint, provider: "anthropic", stream: true };
  }
};

export function buildAnthropicPayload({ model, messages, temperature = 0.7, maxTokens = 1024 }) {
  const split = splitSystemMessages(messages);
  return {
    model,
    max_tokens: maxTokens,
    temperature,
    ...(split.system ? { system: split.system } : {}),
    messages: split.messages.map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }))
  };
}

export async function* parseAnthropicStream(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body || []) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = raw.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim();
      const dataLine = raw.split(/\r?\n/).find((line) => line.startsWith("data:"));
      if (event === "content_block_delta" && dataLine) {
        const parsed = JSON.parse(dataLine.slice(5).trim());
        const text = parsed?.delta?.text || "";
        if (text) yield text;
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}
