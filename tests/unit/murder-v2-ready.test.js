// tests/unit/murder-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMurderV2Ready } from "../../src/core/murder-mystery/murder-v2-ready.js";

test("normalizeMurderV2Ready defaults truthVisibility to hidden_truth", () => {
  const m = normalizeMurderV2Ready({});
  assert.equal(m.truthVisibility, "hidden_truth");
});

test("normalizeMurderV2Ready preserves case and suspect ref", () => {
  const m = normalizeMurderV2Ready({
    caseRecord: { title: "The Case" },
    suspectRef: "butler"
  });
  assert.equal(m.caseRecord.title, "The Case");
  assert.equal(m.suspectRef, "butler");
});
