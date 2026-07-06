import { countHint, normalizeProviderError, normalizeUsage } from "./common.js";

export const mockProvider = {
  id: "mock",
  supports() {
    return { chat: true, chatStream: true, jsonMode: true, systemRole: true, usage: true, replay: true };
  },
  countHint,
  normalizeError(error) {
    return normalizeProviderError(error, "mock");
  },
  async chat({ messages = [], mockResponse = "", model = "mock-model" }) {
    const text = mockResponse || messages.at(-1)?.content || "mock response";
    const promptTokens = countHint(messages.map((message) => message.content || "").join("\n"));
    const completionTokens = countHint(text);
    return { text, raw: { mock: true }, usage: normalizeUsage({ prompt_tokens: promptTokens, completion_tokens: completionTokens }), modelUsed: model, endpointUsed: "mock://chat", provider: "mock" };
  },
  async chatStream({ messages = [], mockResponse = "", model = "mock-model", onDelta }) {
    const text = mockResponse || messages.at(-1)?.content || "mock response";
    for (const chunk of text.match(/.{1,8}/gs) || []) {
      if (onDelta) onDelta(chunk);
    }
    const promptTokens = countHint(messages.map((message) => message.content || "").join("\n"));
    const completionTokens = countHint(text);
    return { text, raw: { mock: true }, usage: normalizeUsage({ prompt_tokens: promptTokens, completion_tokens: completionTokens }), modelUsed: model, endpointUsed: "mock://stream", provider: "mock", stream: true };
  }
};
