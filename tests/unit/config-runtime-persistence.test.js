import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createConfigRuntime } from "../../src/server/config-runtime.js";
import { readJson, updateJson, writeJson } from "../../src/shared/fs-utils.js";

test("config runtime coordinates config and secret persistence without storing masked keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "world-tree-config-runtime-"));
  let coordinatorCalls = 0;
  const runtime = createConfigRuntime({
    ROOT: root,
    DATA_ROOT_OVERRIDE: root,
    join,
    userDataPath: (...parts) => join(root, "userData", ...parts),
    readJson,
    writeJson,
    updateJson,
    stateCoordinator: { async runExclusive(operation) { coordinatorCalls += 1; return operation(); } },
    chmod,
    buildOpenAICompatibleChatBody: () => ({}),
    llmHttpError: () => ({}),
    errorPayload: (code) => ({ code })
  });
  try {
    await runtime.saveConfig({ theme: "light", llmApiKey: "must-not-persist" });
    assert.equal((await runtime.loadConfig()).theme, "light");
    assert.equal((await runtime.loadConfig()).llmApiKey, undefined);

    await runtime.saveSecrets({ llm: { active: "one", items: [{ id: "one", label: "One", value: "abcdefgh" }] } });
    assert.equal(await runtime.getActiveLlmValue(), "abcdefgh");
    assert.equal((await runtime.getSecretState()).llm.items[0].masked, "*******h");
    await runtime.saveLlmSecret({ id: "two", label: "Two", value: "secret-two" });
    assert.equal(await runtime.getActiveLlmValue(), "secret-two");
    assert.equal((await runtime.saveLlmSecret({ id: "two", value: "****" })).llm.active, "two");
    assert.equal(runtime.maskSecret(""), "");
    assert.equal(runtime.maskSecret("abcd"), "****");
    assert.equal(runtime.maskSecret("abcdef"), "*****f");
    assert.ok(coordinatorCalls >= 3);

    assert.equal(runtime.strictProbeFailure(runtime.parseChatCompletionProbe("not json")).status, "fail");
    assert.equal(runtime.strictProbeFailure(runtime.parseChatCompletionProbe(JSON.stringify({ choices: [{ message: { content: runtime.LLM_CONNECTION_SENTINEL } }] }))), null);

    const directRuntime = createConfigRuntime({
      ROOT: root,
      DATA_ROOT_OVERRIDE: root,
      join,
      userDataPath: (...parts) => join(root, "direct-userData", ...parts),
      readJson,
      writeJson,
      updateJson,
      chmod,
      buildOpenAICompatibleChatBody: () => ({}),
      llmHttpError: () => ({}),
      errorPayload: (code) => ({ code })
    });
    await directRuntime.saveConfig({ language: "en-US" });
    await directRuntime.saveSecrets({ llm: { active: "direct", items: [] } });
    await directRuntime.saveLlmSecret({ id: "direct", value: "direct-key" });
    assert.equal((await directRuntime.loadConfig()).language, "en-US");

    assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "", llmModel: "model" } })).code, "LLM_BASE_URL_MISSING");
    assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "ftp://invalid", llmModel: "model" } })).code, "LLM_BASE_URL_INVALID");
    assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "" } })).code, "LLM_MODEL_MISSING");

    const emptyRuntime = createConfigRuntime({
      ROOT: root,
      DATA_ROOT_OVERRIDE: root,
      join,
      userDataPath: (...parts) => join(root, "empty-userData", ...parts),
      readJson,
      writeJson,
      updateJson,
      chmod,
      buildOpenAICompatibleChatBody: () => ({}),
      llmHttpError: () => ({}),
      errorPayload: (code) => ({ code })
    });
    assert.equal((await emptyRuntime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).code, "LLM_API_KEY_MISSING");

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: runtime.LLM_CONNECTION_SENTINEL } }] })
      });
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).status, "ok");

      globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "unauthorized" });
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).safeToSave, false);

      globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => "not found" });
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).safeToSave, false);

      globalThis.fetch = async () => ({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { reasoning_content: "thinking" }, finish_reason: "length" }] })
      });
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).status, "partial");

      globalThis.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: "wrong token" } }] }) });
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).status, "partial");

      globalThis.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: runtime.LLM_CONNECTION_SENTINEL } }] }) });
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/api", llmModel: "model" } })).status, "partial");

      globalThis.fetch = async () => { const error = new Error("timeout"); error.name = "TimeoutError"; throw error; };
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).code, "LLM_TIMEOUT");

      globalThis.fetch = async () => { throw new Error("offline"); };
      assert.equal((await runtime.testLlmConnection({ config: { llmBaseUrl: "https://example.test/v1", llmModel: "model" } })).code, "LLM_NETWORK_ERROR");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
