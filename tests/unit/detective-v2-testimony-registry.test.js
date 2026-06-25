import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTestimony, normalizeTestimonyRegistry, validateTestimonyRegistry, getPlayerTestimonyView, findContradictions, TESTIMONY_DECEPTION_TYPES } from "../../src/core/detective/detective-testimony-registry.js";

test("TESTIMONY_DECEPTION_TYPES includes multiple types", () => {
  assert.ok(TESTIMONY_DECEPTION_TYPES.includes("truthful"));
  assert.ok(TESTIMONY_DECEPTION_TYPES.includes("lie"));
  assert.ok(TESTIMONY_DECEPTION_TYPES.includes("partial_truth"));
  assert.ok(TESTIMONY_DECEPTION_TYPES.includes("mistaken"));
  assert.ok(TESTIMONY_DECEPTION_TYPES.includes("self_protective"));
});

test("normalizeTestimony: fills defaults", () => {
  const t = normalizeTestimony({ witnessName: "Bob", summary: "I saw nothing", deceptionType: "lie" });
  assert.equal(t.witnessName, "Bob");
  assert.equal(t.deceptionType, "lie");
});

test("getPlayerTestimonyView: strips deceptionReason", () => {
  const t = normalizeTestimony({ witnessName: "Eve", summary: "...", deceptionType: "partial_truth", deceptionReason: "HIDDEN" });
  const v = getPlayerTestimonyView(t);
  assert.equal(v.deceptionReason, undefined);
});

test("findContradictions: links testimony to evidence", () => {
  const testimonies = [normalizeTestimony({ witnessName: "X", summary: "...", contradictionEvidenceIds: ["e1"] })];
  const evidence = [{ evidenceId: "e1", label: "Fingerprint" }];
  const c = findContradictions({ evidence, testimonies });
  assert.equal(c.length, 1);
  assert.equal(c[0].evidenceLabel, "Fingerprint");
});

test("validateTestimonyRegistry: unknown deceptionType fails", () => {
  const t = { testimonyId: "t1", witnessName: "Bad", summary: "x", deceptionType: "magic" };
  assert.equal(validateTestimonyRegistry([t]).valid, false);
});
