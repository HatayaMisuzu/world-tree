import test from "node:test";
import assert from "node:assert/strict";

import { mapLlmError } from "../../src/server/llm-error-mapper.js";

test("mapLlmError classifies unreachable and timeout failures as retryable", () => {
  const unreachable = mapLlmError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }));
  assert.equal(unreachable.code, "LLM_UNREACHABLE");
  assert.equal(unreachable.retryable, true);

  const timeout = mapLlmError(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
  assert.equal(timeout.code, "LLM_TIMEOUT");
  assert.equal(timeout.retryable, true);
});

test("mapLlmError classifies auth, rate limit, model, and upstream failures", () => {
  assert.equal(mapLlmError(new Error("HTTP 401 invalid api key")).code, "LLM_AUTH_FAILED");
  assert.equal(mapLlmError(new Error("HTTP 429 rate limit")).code, "LLM_RATE_LIMITED");
  assert.equal(mapLlmError(new Error("模型不可用: bad-model (404)")).code, "LLM_MODEL_NOT_FOUND");
  assert.equal(mapLlmError(new Error("HTTP 503 service unavailable")).code, "LLM_UPSTREAM_ERROR");
  assert.equal(mapLlmError(new Error("HTTP 401 invalid api key")).retryable, false);
  assert.equal(mapLlmError(new Error("模型不可用: bad-model (404)")).retryable, false);
});
