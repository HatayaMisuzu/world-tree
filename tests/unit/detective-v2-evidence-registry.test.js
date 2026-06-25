import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvidence, normalizeEvidenceRegistry, validateEvidenceRegistry, getPlayerEvidenceView, linkEvidenceToTestimony } from "../../src/core/detective/detective-evidence-registry.js";

test("normalizeEvidence: fills defaults", () => {
  const e = normalizeEvidence({ label: "Bloody knife", isCoreClue: true });
  assert.equal(e.label, "Bloody knife");
  assert.equal(e.isCoreClue, true);
  assert.ok(e.evidenceId);
});

test("getPlayerEvidenceView: strips hiddenMeaning", () => {
  const e = normalizeEvidence({ label: "Letter", visibleDescription: "A letter", hiddenMeaning: "SECRET" });
  const v = getPlayerEvidenceView(e);
  assert.equal(v.hiddenMeaning, undefined);
  assert.equal(v.visibleDescription, "A letter");
});

test("linkEvidenceToTestimony: finds contradictions", () => {
  const evidence = [normalizeEvidence({ label: "E1", contradictsTestimonyIds: ["t1"] })];
  const testimonies = [{ testimonyId: "t1", summary: "I was home" }];
  const links = linkEvidenceToTestimony(evidence, testimonies);
  assert.equal(links.length, 1);
  assert.equal(links[0].type, "contradicts");
});

test("validateEvidenceRegistry: valid passes", () => {
  assert.equal(validateEvidenceRegistry([normalizeEvidence({ label: "ok" })]).valid, true);
});

test("normalizeEvidenceRegistry: empty returns []", () => {
  assert.deepEqual(normalizeEvidenceRegistry(null), []);
});
