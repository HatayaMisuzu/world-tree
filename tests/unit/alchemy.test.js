import assert from "node:assert/strict";
import test from "node:test";

import { classify, parseClassifierResponse } from "../../src/core/data/alchemy/classifier.js";
import { extract, parseExtractorResponse } from "../../src/core/data/alchemy/extractor.js";

test("classifier parses plain JSON array strings", () => {
  const response = `[{"blockIndex":0,"typeIds":["character"],"confidence":0.8,"entities":["Alice"],"reason":"character profile"}]`;
  const parsed = parseClassifierResponse(response);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].typeIds[0], "character");
  assert.equal(parsed[0].entities[0], "Alice");
});

test("classifier parses fenced JSON arrays", () => {
  const response = "```json\n[{\"blockIndex\":0,\"typeIds\":[\"location\"],\"confidence\":0.9,\"entities\":[\"Capital\"],\"reason\":\"place\"}]\n```";
  const parsed = parseClassifierResponse(response);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].typeIds[0], "location");
  assert.equal(parsed[0].entities[0], "Capital");
});

test("classifier parses JSON array embedded in explanatory text", () => {
  const response = `Result:\n[{"blockIndex":1,"typeIds":["organization"],"confidence":0.7,"entities":["Guild"]}]`;
  const parsed = parseClassifierResponse(response);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].typeIds[0], "organization");
});

test("classifier returns an empty array for empty or null responses without chunks", () => {
  assert.deepEqual(parseClassifierResponse(""), []);
  assert.deepEqual(parseClassifierResponse(null), []);
});

test("extractor parses plain JSON object strings", () => {
  const response = `{"name":"Alice","role":"Mage","traits":["calm","scholarly"],"background":"academy graduate"}`;
  const parsed = parseExtractorResponse(response);

  assert.equal(parsed.name, "Alice");
  assert.equal(parsed.role, "Mage");
  assert.ok(parsed.traits.includes("calm"));
});

test("extractor parses fenced JSON objects", () => {
  const response = "```json\n{\"name\":\"Capital Tavern\",\"type\":\"location\",\"description\":\"adventurers gather here\"}\n```";
  const parsed = parseExtractorResponse(response);

  assert.equal(parsed.name, "Capital Tavern");
  assert.equal(parsed.type, "location");
});

test("extractor parses JSON object embedded in explanatory text", () => {
  const response = `Extraction:\n{"name":"Guild","type":"organization","goals":["keep order"]}`;
  const parsed = parseExtractorResponse(response);

  assert.equal(parsed.name, "Guild");
  assert.equal(parsed.type, "organization");
});

test("extractor tolerates JSON arrays and empty responses", () => {
  const arrayParsed = parseExtractorResponse(`[{"name":"Captain","role":"Warrior"}]`);
  assert.ok(Array.isArray(arrayParsed));
  assert.equal(arrayParsed[0].name, "Captain");

  const emptyParsed = parseExtractorResponse("");
  assert.equal(emptyParsed._empty, true);
});

test("classify awaits string-returning llmCall and parses the result", async () => {
  const chunks = [{ index: 0, text: "Alice is a traveling mage." }];
  const llmCall = async () => `[{"blockIndex":0,"typeIds":["character"],"confidence":0.8,"entities":["Alice"],"reason":"character"}]`;

  const result = await classify({ chunks, llmCall });

  assert.equal(result.length, 1);
  assert.equal(result[0].typeIds[0], "character");
  assert.equal(result[0].entities[0], "Alice");
  assert.equal(result[0]._source, "llm");
});

test("extract awaits string-returning llmCall and parses the result", async () => {
  const groups = {
    character: [{ index: 0, text: "Alice is a mage.", heading: "Alice", typeName: "Character" }]
  };
  const llmCall = async () => `{"name":"Alice","role":"Mage","traits":["calm"]}`;

  const result = await extract({ groups, llmCall, options: { maxConcurrent: 1 } });

  assert.equal(result.length, 1);
  assert.equal(result[0].typeId, "character");
  assert.equal(result[0].entity, "Alice");
  assert.equal(result[0].data.name, "Alice");
});

test("object-returning llmCall does not silently parse as valid classifier output", async () => {
  const badMock = async () => ({ parsed: null, raw: "some text" });
  const asString = String(await badMock());

  assert.equal(asString, "[object Object]");
  assert.deepEqual(parseClassifierResponse(asString), []);
});
