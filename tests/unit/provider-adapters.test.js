import test from "node:test";
import assert from "node:assert/strict";

import { openAICompatibleProvider } from "../../src/adapters/providers/openai-compatible.js";
import { anthropicProvider, buildAnthropicPayload } from "../../src/adapters/providers/anthropic.js";
import { googleProvider, buildGooglePayload } from "../../src/adapters/providers/google.js";
import { mockProvider } from "../../src/adapters/providers/mock.js";
import { providerCapabilityTable, resolveProvider } from "../../src/adapters/providers/index.js";

test("provider capability table exposes required providers and methods", () => {
  const table = Object.fromEntries(providerCapabilityTable().map((item) => [item.id, item.supports]));
  for (const id of ["openai-compatible", "anthropic", "google", "mock"]) {
    assert.equal(table[id].chat, true);
    assert.equal(table[id].chatStream, true);
    assert.equal(typeof resolveProvider(id).normalizeError, "function");
    assert.equal(typeof resolveProvider(id).countHint, "function");
  }
});

test("anthropic adapter maps system prompt, messages, and usage", async () => {
  const payload = buildAnthropicPayload({
    model: "claude-test",
    messages: [
      { role: "system", content: "system one" },
      { role: "user", content: "hello" }
    ]
  });
  assert.equal(payload.system, "system one");
  assert.deepEqual(payload.messages, [{ role: "user", content: "hello" }]);

  let request = null;
  const result = await anthropicProvider.chat({
    baseUrl: "https://anthropic.local/v1",
    model: "claude-test",
    apiKey: "secret",
    messages: payload.messages,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        text: async () => JSON.stringify({ content: [{ type: "text", text: "pong" }], usage: { input_tokens: 3, output_tokens: 2 } })
      };
    }
  });
  assert.equal(request.url, "https://anthropic.local/v1/messages");
  assert.equal(request.init.headers["x-api-key"], "secret");
  assert.equal(result.text, "pong");
  assert.equal(result.usage.totalTokens, 5);
});

test("openai-compatible adapter retries without json_object when endpoint rejects response_format", async () => {
  const bodies = [];
  const result = await openAICompatibleProvider.chat({
    baseUrl: "https://openai.local/v1",
    model: "model",
    apiKey: "secret",
    responseFormat: "json",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      if (bodies.length === 1) {
        return { ok: false, status: 400, text: async () => "response_format json_object unsupported" };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })
      };
    }
  });
  assert.equal(bodies[0].response_format.type, "json_object");
  assert.equal("response_format" in bodies[1], false);
  assert.equal(result.text, "{\"ok\":true}");
  assert.equal(result.usage.totalTokens, 2);
});

test("google adapter maps systemInstruction, contents, and usage", async () => {
  const payload = buildGooglePayload({
    messages: [
      { role: "system", content: "system one" },
      { role: "assistant", content: "previous" },
      { role: "user", content: "hello" }
    ]
  });
  assert.equal(payload.systemInstruction.parts[0].text, "system one");
  assert.deepEqual(payload.contents.map((item) => item.role), ["model", "user"]);

  let request = null;
  const result = await googleProvider.chat({
    baseUrl: "https://google.local/v1beta",
    model: "gemini-test",
    apiKey: "secret",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "pong" }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 } })
      };
    }
  });
  assert.match(request.url, /\/models\/gemini-test:generateContent\?key=secret$/);
  assert.match(request.init.body, /generationConfig/);
  assert.equal(result.text, "pong");
  assert.equal(result.usage.totalTokens, 7);
});

test("mock provider streams deterministic chunks with usage", async () => {
  const chunks = [];
  const result = await mockProvider.chatStream({
    messages: [{ role: "user", content: "hello" }],
    mockResponse: "abcdefghijkl",
    onDelta: (chunk) => chunks.push(chunk)
  });
  assert.deepEqual(chunks, ["abcdefgh", "ijkl"]);
  assert.equal(result.text, "abcdefghijkl");
  assert.equal(result.provider, "mock");
  assert.ok(result.usage.totalTokens > 0);
});
