import { countHint, normalizeBaseUrl, normalizeProviderError, normalizeUsage, parseJsonResponse, splitSystemMessages } from "./common.js";

export const googleProvider = {
  id: "google",
  aliases: ["gemini"],
  supports() {
    return { chat: true, chatStream: true, jsonMode: true, systemRole: "systemInstruction", usage: true };
  },
  countHint,
  normalizeError(error) {
    return normalizeProviderError(error, "google");
  },
  async chat({ baseUrl = "https://generativelanguage.googleapis.com/v1beta", model, messages, apiKey, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, timeoutMs = 60000 }) {
    const endpoint = googleEndpoint(baseUrl, model, "generateContent", apiKey);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGooglePayload({ messages, temperature, maxTokens })),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await parseJsonResponse(response);
    return {
      text: (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join(""),
      raw: data,
      usage: normalizeUsage(data?.usageMetadata || {}),
      modelUsed: model,
      endpointUsed: endpoint,
      provider: "google"
    };
  },
  async chatStream({ baseUrl = "https://generativelanguage.googleapis.com/v1beta", model, messages, apiKey, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch, timeoutMs = 60000, onDelta }) {
    const endpoint = googleEndpoint(baseUrl, model, "streamGenerateContent", apiKey);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGooglePayload({ messages, temperature, maxTokens })),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw Object.assign(new Error(await response.text().catch(() => `HTTP ${response.status}`)), { status: response.status });
    let text = "";
    for await (const delta of parseGoogleStream(response.body)) {
      text += delta;
      if (onDelta) onDelta(delta);
    }
    return { text, raw: null, usage: normalizeUsage({}), modelUsed: model, endpointUsed: endpoint, provider: "google", stream: true };
  }
};

export function buildGooglePayload({ messages, temperature = 0.7, maxTokens = 1024 }) {
  const split = splitSystemMessages(messages);
  return {
    ...(split.system ? { systemInstruction: { parts: [{ text: split.system }] } } : {}),
    contents: split.messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  };
}

export function googleEndpoint(baseUrl, model, method, apiKey = "") {
  const base = normalizeBaseUrl(baseUrl);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}/models/${encodeURIComponent(model)}:${method}${apiKey ? `${separator}key=${encodeURIComponent(apiKey)}` : ""}`;
}

export async function* parseGoogleStream(body) {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of body || []) text += decoder.decode(chunk, { stream: true });
  const jsonText = text.trim();
  if (!jsonText) return;
  const values = JSON.parse(jsonText);
  for (const item of Array.isArray(values) ? values : [values]) {
    const delta = (item?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
    if (delta) yield delta;
  }
}
