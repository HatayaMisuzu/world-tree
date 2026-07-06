import test from "node:test";
import assert from "node:assert/strict";

import {
  extractJsonValue,
  validateDirectionPacketJson,
  validateLlmAnalysisJson
} from "../../src/core/llm/json-extract.js";

test("json extractor handles markdown fences", () => {
  const result = extractJsonValue("```json\n{\"ok\":true}\n```");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { ok: true });
});

test("json extractor handles leading explanation", () => {
  const result = extractJsonValue("好的，以下是 JSON：\n{\"intent\":\"action\"}", { validate: validateLlmAnalysisJson });
  assert.equal(result.ok, true);
  assert.equal(result.value.intent, "action");
});

test("json extractor repairs trailing commas", () => {
  const result = extractJsonValue("{\"directorDecision\":{},\"contentPlan\":{\"mustInclude\":[],},}");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.contentPlan.mustInclude, []);
});

test("json extractor chooses the first balanced object from double JSON", () => {
  const result = extractJsonValue("{\"a\":1}\n{\"a\":2}");
  assert.equal(result.ok, true);
  assert.equal(result.value.a, 1);
});

test("json extractor rejects truncated JSON", () => {
  const result = extractJsonValue("prefix {\"a\":1");
  assert.equal(result.ok, false);
});

test("json extractor rejects schema-invalid direction packets", () => {
  const result = extractJsonValue("{\"foo\":1}", { validate: validateDirectionPacketJson });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "schema_invalid");
});
