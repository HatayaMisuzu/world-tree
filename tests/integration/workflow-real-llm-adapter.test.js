import test from "node:test";
import assert from "node:assert/strict";
import { handleWorkflowApiRequest } from "../../src/core/workflows/adapters/server-workflow-adapter.js";

test("workflow injects real LLM when config and api key exist without exposing the key", async () => {
  const originalFetch = globalThis.fetch;
  let authorization = "";
  globalThis.fetch = async (_url, options = {}) => {
    authorization = options.headers.Authorization;
    return { ok: true, async json() { return { choices: [{ message: { content: "真实模型回应" } }] }; } };
  };
  try {
    const result = await handleWorkflowApiRequest({ workflowType: "play.turn", modeId: "world-rpg", userInput: "继续" }, { llmConfig: { llmBaseUrl: "https://example.invalid/v1", llmModel: "test-model" }, apiKey: "secret-workflow-key" });
    assert.equal(result.ok, true);
    assert.equal(result.visibleText, "真实模型回应");
    assert.equal(authorization, "Bearer secret-workflow-key");
    assert.doesNotMatch(JSON.stringify(result), /secret-workflow-key|Authorization/);
    assert.deepEqual(result.routed.proposals, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("workflow without api key uses safe offline fallback and remains candidate-only", async () => {
  const result = await handleWorkflowApiRequest({ workflowType: "play.turn", modeId: "world-rpg", userInput: "继续" }, { llmConfig: { llmBaseUrl: "https://example.invalid/v1", llmModel: "test-model" } });
  assert.equal(result.ok, true);
  assert.match(result.visibleText, /世界继续运转/);
  assert.deepEqual(result.routed.proposals, []);
  assert.deepEqual(result.routed.candidates, []);
});

test("workflow real LLM network failure surfaces visible warning, no key leak, candidate-only", async () => {
  const originalFetch = globalThis.fetch;
  let capturedAuthorization = "";
  globalThis.fetch = async (_url, options = {}) => {
    capturedAuthorization = options.headers?.Authorization || "";
    throw new Error("network timeout");
  };
  try {
    const result = await handleWorkflowApiRequest(
      { workflowType: "play.turn", modeId: "world-rpg", userInput: "继续" },
      { llmConfig: { llmBaseUrl: "https://example.invalid/v1", llmModel: "test-model" }, apiKey: "secre...key" }
    );
    // Still ok overall — offline fallback engaged
    assert.equal(result.ok, true);
    // Warnings must contain non-sensitive error summary
    assert.ok(Array.isArray(result.warnings) && result.warnings.length > 0, "should surface warnings");
    const joined = result.warnings.join(" ");
    assert.match(joined, /network timeout|LLM.*fail|LLM.*error/i, "warning contains error summary");
    // No API key anywhere in result
    assert.doesNotMatch(JSON.stringify(result), /secre...key/, "api key not in result");
    assert.doesNotMatch(JSON.stringify(result), /Authorization/, "auth header not in result");
    // Remains candidate-only — no canon or proposal writes
    assert.deepEqual(result.routed.candidates, []);
    assert.deepEqual(result.routed.proposals, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
