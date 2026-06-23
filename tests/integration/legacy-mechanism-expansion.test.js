// tests/integration/legacy-mechanism-expansion.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createWizardSession } from "../../src/core/creation-wizard/wizard-session.js";
import { prepareWizardDelivery } from "../../src/core/creation-wizard/wizard-delivery.js";
import { parseSourceMaterial, extractCandidates } from "../../src/core/alchemy/alchemy-digest.js";
import { createWarehouse, registerCandidate } from "../../src/core/materials/material-warehouse.js";
import { createCharacterProfile, validateCharacterBoundary } from "../../src/core/character/character-kernel-v2.js";
import { createCognitionMatrix, addKnowledgeEntry, canCharacterReveal } from "../../src/core/cognition/cognition-matrix.js";
import { createFactionGraph, addFaction, addRelation, getSecretRelations } from "../../src/core/factions/faction-graph.js";
import { createRulesEngine, addRule, evaluateAction } from "../../src/core/world-rules/world-rules-engine.js";
import { checkConsistency, shouldBlockOutput } from "../../src/core/narrative-radar/narrative-consistency-radar.js";
import { createEventPool, addEvent, getSceneDirectionCandidate } from "../../src/core/events/random-event-pool.js";
import { resolveMacro, validateMacroScope } from "../../src/core/macros/macro-registry.js";
import { buildObservabilityPacket, redactDebugPacket, isSafeForUser } from "../../src/core/observability/observability-packet.js";

test("M1: wizard delivery does not create project or write canon", () => {
  const s = createWizardSession({ modeHint: "world-rpg" });
  s.fields.hard = { worldName: "X", genre: "Y", tone: "Z", playerRole: "t", protagonistName: "A", protagonistRole: "B", openingScene: "C" };
  const r = prepareWizardDelivery(s);
  assert.equal(r.ok, true); assert.equal(r.deliveryMethod, "candidate");
});

test("M2: alchemy preserves source and does not overwrite canon", () => {
  const m = parseSourceMaterial({ text: "Ancient artifact from Northern Kingdom", sourceType: "manual", sourceLabel: "test" });
  const c = extractCandidates(m);
  assert.ok(c.length >= 1); assert.equal(c[0].source.label, "test");
});

test("M3: warehouse prevents duplicate imports", () => {
  const wh = createWarehouse();
  const c = { id: "c1", title: "Test", source: { hash: "abc" } };
  assert.equal(registerCandidate(wh, c, "s1").registered, true);
  assert.equal(registerCandidate(wh, c, "s1").registered, false);
});

test("M4: character profile blocks secret reveal", () => {
  const p = createCharacterProfile({ characterId: "t", name: "T" });
  p.boundaries.cannotReveal = ["dark_secret"];
  assert.equal(validateCharacterBoundary(p, "dark_secret").allowed, false);
});

test("M5: cognition blocks forbidden knowledge reveal", () => {
  const m = createCognitionMatrix("c1");
  addKnowledgeEntry(m, { fact: "truth", state: "forbidden" });
  const r = canCharacterReveal(m, "truth");
  assert.equal(r.canReveal, false); assert.equal(r.reason, "forbidden");
});

test("M6: faction graph hides secret relations", () => {
  const g = createFactionGraph();
  addFaction(g, { id: "a", name: "A" }); addFaction(g, { id: "b", name: "B" });
  addRelation(g, { from: "a", to: "b", type: "secret", publicKnown: false });
  assert.equal(getSecretRelations(g).length, 1);
});

test("M7: rules engine blocks hard violations", () => {
  const e = createRulesEngine();
  addRule(e, { id: "no_kill", rule: "killing", strictness: "hard", violationPolicy: "block" });
  assert.equal(evaluateAction(e, { action: "killing the king" }).blocked, true);
});

test("M8: radar blocks hidden truth leaks", () => {
  const r = checkConsistency("凶手是张三 hiddenTruth");
  assert.ok(r.blocked.length > 0);
  assert.equal(shouldBlockOutput(r), true);
});

test("M9: major events cannot auto-trigger", () => {
  const p = createEventPool();
  addEvent(p, { id: "war", title: "War", type: "conflict", impactLevel: "major", proposalRequired: true });
  const c = getSceneDirectionCandidate(p, { modeId: "world-rpg", turnCount: 10 });
  assert.equal(c.status, "candidate"); assert.equal(c.requiresApproval, true);
});

test("M10: macro blocks hidden field", () => {
  const r = resolveMacro("{{hiddenTruth}}", {});
  assert.ok(r.warnings.some(w => w.includes("blocked")));
});

test("M10: safe macro resolves", () => {
  assert.equal(resolveMacro("{{mode.id}}", { modeId: "test" }).resolved, "test");
});

test("M11: observability redacts paths", () => {
  const p = buildObservabilityPacket({ modeId: "t", turnCount: 1 });
  p.somePath = "D:\\secret";
  assert.equal(redactDebugPacket(p).somePath, "[REDACTED]");
});

test("M11: is safe for user", () => {
  const p = buildObservabilityPacket({ modeId: "t", kernelStatus: { p0: true, p1: true, p2: true }, turnCount: 1 });
  assert.equal(isSafeForUser(p), true);
});

test("cross: wizard → alchemy → warehouse chain stays candidate", () => {
  const s = createWizardSession({ modeHint: "world-rpg" });
  s.fields.hard = { worldName: "TW", genre: "F", tone: "S", playerRole: "H", protagonistName: "A", protagonistRole: "B", openingScene: "S" };
  const d = prepareWizardDelivery(s);
  assert.equal(d.deliveryMethod, "candidate");
  const m = parseSourceMaterial({ text: d.blueprint.worldName, sourceType: "wizard" });
  const cs = extractCandidates(m);
  assert.ok(cs.length >= 1);
  const wh = createWarehouse();
  for (const c of cs) registerCandidate(wh, c, m.id);
  assert.equal(wh.candidates.length, cs.length);
});
