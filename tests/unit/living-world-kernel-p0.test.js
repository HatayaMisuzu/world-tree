import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calculateProximityScope } from "../../src/core/proximity/proximity-scope.js";
import { appendChange, readRecentChanges, upsertForeshadowing, resolveForeshadowing, upsertConflict } from "../../src/core/tracking/tracking-store.js";
import { transitionScene, readRecentSceneSummaries } from "../../src/core/scene/scene-summary-chain.js";
import { createWorldStateProposal } from "../../src/core/world-state/world-state-proposals.js";
import { applyWorldStateChange, readWorldState } from "../../src/core/world-state/world-state-manager.js";
import { deriveBoundedRipple } from "../../src/core/world-state/world-state-ripple.js";
import { activateWorldbookEntries } from "../../src/core/worldbook/worldbook-trigger-engine.js";
import { createLivingWorldPacket } from "../../src/core/living-world/living-world-packet.js";

async function projectRoot() { return mkdtemp(join(tmpdir(), "wt-p0-")); }

test("proximity scope is deterministic, bounded, and reuses an unchanged scene", () => {
  const input = { modeId: "world-rpg", protagonistId: "hero", currentScene: { id: "s1", locationId: "tavern" }, currentLocationId: "tavern", candidates: [
    { id: "ally", locationId: "tavern", timeDistance: 0, relationDistance: 0.1 },
    { id: "contact", locationDistance: 0.4, timeDistance: 0.5, relationDistance: 0.5 },
    { id: "stranger" }
  ] };
  const first = calculateProximityScope(input);
  assert.deepEqual(first.rings.core, ["ally"]);
  assert.deepEqual(first.rings.near, ["contact"]);
  assert.deepEqual(first.rings.dormant, ["stranger"]);
  assert.equal(calculateProximityScope(input, first).reused, true);
});

test("tracking appends JSONL and manages foreshadowing/conflicts without changing canon", async () => {
  const root = await projectRoot();
  const one = await appendChange(root, { reason: "first" });
  const two = await appendChange(root, { reason: "second" });
  assert.deepEqual((await readRecentChanges(root, 1)).map((item) => item.id), [two.id]);
  await upsertForeshadowing(root, { id: "f1", content: "door" });
  const resolved = await resolveForeshadowing(root, "f1", { note: "opened" });
  assert.equal(resolved.items[0].status, "resolved");
  const conflicts = await upsertConflict(root, { id: "c1", summary: "mismatch" });
  assert.equal(conflicts.items[0].status, "open");
  assert.ok(one.id);
});

test("scene transition appends a runtime-only deterministic summary", async () => {
  const root = await projectRoot();
  await transitionScene(root, { sceneId: "s1", title: "Tavern" });
  const result = await transitionScene(root, { sceneId: "s2", title: "Mine" }, { events: [{ text: "The party accepted the job." }] });
  assert.equal(result.summary.sceneId, "s1");
  assert.equal((await readRecentSceneSummaries(root, 3)).length, 1);
});

test("world state refuses unapproved changes and tracks approved changes", async () => {
  const root = await projectRoot();
  const proposal = createWorldStateProposal(root, { stateId: "capital", value: "under_siege", impactLevel: "major" }, { modeId: "world-rpg" });
  await assert.rejects(() => applyWorldStateChange(root, proposal), /approved/);
  const applied = await applyWorldStateChange(root, { ...proposal, status: "approved" });
  assert.equal((await readWorldState(root)).states.capital.value, "under_siege");
  assert.equal(applied.tracking.rippleDepth, 0);
});

test("bounded ripple enforces depth, fanout, approval actions, and duplicate roots", () => {
  const effects = [];
  for (let depth = 1; depth <= 3; depth += 1) for (let i = 0; i < 5; i += 1) effects.push({ depth, confidence: 0.9, summary: `${depth}-${i}` });
  const result = deriveBoundedRipple("", { id: "root", stateId: "capital", impactLevel: "critical", effects });
  assert.equal(result.items.length, 9);
  assert.equal(result.items.filter((item) => item.depth === 2).every((item) => item.action === "pending_proposal" && item.requiresUserApproval), true);
  assert.equal(result.items.filter((item) => item.depth === 3).every((item) => item.action === "narrative_hook"), true);
  assert.equal(deriveBoundedRipple("", { id: "root", effects }, {}, { seenRootChangeIds: ["root"] }).skipped, "duplicate_root");
});

test("worldbook trigger uses layers and never exposes hidden truth fields", () => {
  const packet = activateWorldbookEntries([
    { id: "base", title: "Rules", layer: "base", visibility: "player_known", content: "safe" },
    { id: "mine", title: "Mine", layer: "context", visibility: "player_known", keys: ["mine"], solution: "secret" },
    { id: "truth", title: "Truth", layer: "instant", visibility: "secret", keys: ["mine"], content: "killer" }
  ], { userInput: "enter mine", worldState: { states: {} }, proximityScope: { rings: {} } });
  assert.deepEqual(packet.base.map((item) => item.id), ["base"]);
  assert.deepEqual(packet.context.map((item) => item.id), ["mine"]);
  assert.equal("solution" in packet.context[0], false);
  assert.deepEqual(packet.debug.filteredByIsolation, ["truth"]);
});

test("living world packet is complete for consumer modes and disabled for quick-setting", async () => {
  const root = await projectRoot();
  const packet = await createLivingWorldPacket({ modeId: "world-rpg", projectRoot: root, userInput: "mine", currentScene: { sceneId: "s1", locationId: "mine" }, candidates: [], relations: [], runtimeData: { sceneSummaries: [], trackingDigest: {}, proximityScope: null }, sharedData: { worldState: { states: {} }, worldbook: { entries: [] } } });
  assert.equal(packet.enabled, true);
  for (const key of ["scene", "trackingDigest", "worldState", "proximityScope", "worldbookContext"]) assert.ok(key in packet);
  assert.equal((await createLivingWorldPacket({ modeId: "quick-setting", projectRoot: root })).enabled, false);
});
