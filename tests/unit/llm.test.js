import test from "node:test";
import assert from "node:assert/strict";
import { sendGameTurn } from "../../src/adapters/llm.js";

test("sendGameTurn passes an AbortSignal to legacy fetch calls", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options = {}) => {
    assert.ok(options.signal, "expected fetch to receive an AbortSignal");
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  };

  try {
    await assert.rejects(
      () => sendGameTurn({
        model: {
          selected: { id: "test", name: "Test", path: "/tmp/test", branch: "main" },
          moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, tracking: [], canon: {}, runtime: {} }
        },
        config: { llmBaseUrl: "http://127.0.0.1:9/v1", llmModel: "test-model", llmTimeoutMs: 20 },
        apiKey: "test-key",
        personaText: "",
        enginePacket: "",
        messages: [],
        input: "hello",
        injectedWorldbook: [],
        cards: []
      }),
      /aborted|AbortError/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
