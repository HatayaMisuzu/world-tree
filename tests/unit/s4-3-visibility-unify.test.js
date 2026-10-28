// S4-3: visibility-policy sole grading + knownBy + canary + unified call sites
import test from "node:test";
import assert from "node:assert/strict";
import {
  canExposeToPlayer,
  filterPromptVisible,
  normalizeVisibilityGrade,
  normalizeWriterVisibility,
  normalizeKnownBy,
  makeCanaryToken,
  countCanaryHits,
  scanOutputForCanaries,
  redactHiddenLeaks,
  collectNonPlayerSensitiveTerms,
  buildVisibilityRevealProposalInput,
  hiddenFactsFromGmState
} from "../../src/core/v2-ready/visibility-policy.js";
import { scanForHiddenLeaks } from "../../src/core/tabletop/tabletop-v2-gm-loop.js";
import { scrubStrategyPublicView, assertNoHiddenStrategyLeak } from "../../src/core/strategy-sim/strategy-sim-public-view-scrubber.js";
import { sealStrategySimSpec } from "../../src/core/strategy-sim/strategy-sim-spec.js";
import { createStrategyRunState } from "../../src/core/strategy-sim/strategy-sim-run-state.js";
import { prepareWorldbookInjection } from "../../src/core/runtime/worldbook-runtime.js";

test("S4-3 normalizeVisibilityGrade maps strategy/legacy labels onto policy grades", () => {
  assert.equal(normalizeVisibilityGrade("secret"), "hidden_truth");
  assert.equal(normalizeVisibilityGrade("public"), "player_visible");
  assert.equal(normalizeVisibilityGrade("hidden"), "gm_only");
  assert.equal(normalizeVisibilityGrade("gm_only"), "gm_only");
  assert.equal(normalizeVisibilityGrade({ visibility: "forbidden" }), "system_only");
  assert.equal(normalizeWriterVisibility({ content: "x" }), "player_visible");
  assert.equal(normalizeWriterVisibility({ visibility: "secret" }), "hidden_truth");
});

test("S4-3 knownBy restricts player_visible facts to listed observers", () => {
  const fact = { id: "f1", visibility: "player_visible", knownBy: ["npc_a"] };
  assert.equal(canExposeToPlayer(fact, { audience: "player" }), false);
  assert.equal(canExposeToPlayer(fact, { audience: "player", observerId: "npc_b" }), false);
  assert.equal(canExposeToPlayer(fact, { audience: "player", observerId: "npc_a" }), true);
  assert.deepEqual(normalizeKnownBy(["a", "a", ""]), ["a"]);
});

test("S4-3 gm_only never reaches Writer filterPromptVisible", () => {
  const canary = makeCanaryToken("unit", "gm1");
  const records = [
    { id: "pub", visibility: "player_visible", content: "safe" },
    { id: "sec", visibility: "gm_only", content: canary }
  ];
  const kept = filterPromptVisible(records, { modeId: "world-rpg", audience: "writer" });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, "pub");
  const body = JSON.stringify(kept);
  assert.equal(countCanaryHits(body, [canary]), 0);
});

test("S4-3 prepareWorldbookInjection drops canary-bearing gm_only from Writer injection", () => {
  const canary = makeCanaryToken("wb", "inj");
  const runtime = prepareWorldbookInjection({
    worldbook: {
      entries: [
        { id: "public", title: "Public", keys: ["灯塔"], content: "SAFE_TOKEN", visibility: "player_visible", priority: 100 },
        { id: "secret", title: "Secret", keys: ["灯塔"], content: canary, visibility: "gm_only", priority: 200 }
      ]
    },
    input: "靠近灯塔",
    engineState: { contextBudget: "balanced", modeId: "world-rpg" }
  });
  const body = JSON.stringify(runtime.injectedWorldbook);
  assert.equal(countCanaryHits(body, [canary]), 0);
  assert.equal(body.includes("SAFE_TOKEN"), true);
});

test("S4-3 tabletop scanForHiddenLeaks uses visibility-policy + blocks output canary", () => {
  const canary = makeCanaryToken("tt", "out");
  const hiddenGmState = {
    npcSecrets: { mage: { trueAllegiance: "老其实是叛徒" } },
    canaryTokens: [canary]
  };
  const dirty = `老其实是叛徒。并且泄漏 ${canary}`;
  const result = scanForHiddenLeaks(dirty, hiddenGmState, {});
  assert.ok(result.leaks.length >= 2);
  assert.equal(result.sanitizedNarration.includes(canary), false);
  assert.equal(result.sanitizedNarration.includes("老其实是叛徒"), false);
  assert.ok(result.canaryHits.includes(canary));
});

test("S4-3 collectNonPlayerSensitiveTerms grades via policy", () => {
  const terms = collectNonPlayerSensitiveTerms(
    { hiddenClocks: [{ id: "doom", label: "末日钟" }] },
    { hiddenTruth: "村长其实是一只龙" }
  );
  assert.ok(terms.some((t) => t.source === "gmBook.hiddenTruth"));
  assert.ok(terms.some((t) => String(t.source).startsWith("hiddenClock:")));
  assert.ok(hiddenFactsFromGmState({}, { hiddenTruth: "村长其实是一只龙" }).length >= 1);
});

test("S4-3 strategy scrubber omits secret via policy grade; canary assert works", () => {
  const canary = makeCanaryToken("st", "sec");
  const spec = sealStrategySimSpec({
    specId: "s4-3-scrub",
    title: "S4-3",
    turnUnit: "turn",
    resources: [{ id: "cash", label: "Cash", initial: 10, min: 0, max: 100, visibility: "public", recoveryActions: ["recover"] }],
    variables: [
      { id: "secret_pressure", label: "Secret", initial: 80, min: 0, max: 100, visibility: "secret", recoveryActions: ["recover"] }
    ],
    probabilityRules: []
  }, { sealedAt: "2026-01-01T00:00:00.000Z" });
  const state = createStrategyRunState(spec);
  const view = scrubStrategyPublicView(spec, state);
  assert.equal(view.variables.find((v) => v.id === "secret_pressure"), undefined);
  assert.ok(view.omitted.some((o) => o.id === "secret_pressure"));
  assert.doesNotThrow(() => assertNoHiddenStrategyLeak(view));
  assert.throws(() => assertNoHiddenStrategyLeak({ hint: canary }, "$", { canaryTokens: [canary] }));
});

test("S4-3 visibility reveal proposal is shaped for proposal-bus (no canon write)", () => {
  const proposal = buildVisibilityRevealProposalInput(
    { id: "clue_1", visibility: "gm_only", knownBy: ["npc_a"] },
    { observerId: "player", toVisibility: "player_visible" }
  );
  assert.equal(proposal.type, "visibility_reveal");
  assert.equal(proposal.requiresUserApproval, true);
  assert.equal(proposal.patch.fromVisibility, "gm_only");
  assert.equal(proposal.patch.toVisibility, "player_visible");
  assert.ok(proposal.patch.knownBy.includes("player"));
  assert.ok(proposal.patch.knownBy.includes("npc_a"));
});

test("S4-3 redactHiddenLeaks + scanOutputForCanaries helpers", () => {
  const token = makeCanaryToken("h", "1");
  const r = redactHiddenLeaks(`leak ${token}`, [{ source: "x", text: "nope" }], [token]);
  assert.equal(countCanaryHits(r.sanitizedNarration, [token]), 0);
  assert.equal(scanOutputForCanaries("clean", [token]).ok, true);
});
