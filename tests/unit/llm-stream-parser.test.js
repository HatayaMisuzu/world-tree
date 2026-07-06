import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import {
  callLLMByRoleStream,
  isStreamUnsupportedError,
  parseOpenAIChatCompletionStream
} from "../../src/adapters/llm.js";

test("OpenAI-compatible stream parser emits text deltas and stops on DONE", async () => {
  const frames = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: "雾" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: "铃塔" } }] })}\n\n`,
    "data: [DONE]\n\n"
  ];
  const events = [];
  for await (const event of parseOpenAIChatCompletionStream(Readable.from(frames))) {
    events.push(event);
  }
  assert.deepEqual(events.map(event => event.content), ["雾", "铃塔"]);
});

test("stream role call reports unsupported endpoints without pretending success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    body: null,
    text: async () => ""
  });
  try {
    await assert.rejects(
      () => callLLMByRoleStream("writer", "packet", {
        llmBaseUrl: "http://127.0.0.1:12345/v1",
        llmModel: "test-model",
        llmTimeoutMs: 20
      }, "test-key"),
      (err) => isStreamUnsupportedError(err)
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
