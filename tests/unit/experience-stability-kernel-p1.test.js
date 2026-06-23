import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJson, appendJsonl } from "../../src/server/fs-utils.js";
import { classifyImpact } from "../../src/core/content/change-impact-classifier.js";
import { openStopLossWindow, isStopLossOpen } from "../../src/core/content/stop-loss-window.js";
import { createReverseProposal } from "../../src/core/content/reversible-change.js";
import { createProposal, approveProposal } from "../../src/core/system/proposal-bus.js";
import { createContextPacket } from "../../src/core/context/context-engine.js";
import { validateInertiaShift } from "../../src/core/character/emotional-inertia-policy.js";
import { updateCharacterInertia } from "../../src/core/character/emotional-inertia.js";
import { guardDirectorPlan } from "../../src/core/director/director-guardian.js";
import { detectWorldbookCandidates } from "../../src/core/worldbook/worldbook-candidate-detector.js";
import { recordWorldbookCandidate, transitionWorldbookCandidate } from "../../src/core/worldbook/worldbook-growth-tree.js";
import { createExperienceStabilityPacket } from "../../src/core/experience-stability/experience-stability-packet.js";

async function root() { return mkdtemp(join(tmpdir(), "wt-p1-")); }

test("impact classifier separates light, medium, major, and critical changes", () => {
  assert.equal(classifyImpact({ type: "metadata" }).impactLevel, "light");
  assert.equal(classifyImpact({ type: "clue_discovered" }).impactLevel, "medium");
  assert.equal(classifyImpact({ type: "relationship_break" }).impactLevel, "major");
  assert.equal(classifyImpact({ type: "character_death" }).impactLevel, "critical");
});

test("critical proposal requires second confirmation and opens stop-loss after approval", async () => {
  const projectRoot = await root();
  await writeJson(join(projectRoot, "shared", "world_state.json"), { state: "alive" });
  const proposal = createProposal({ id: "death", targetFile: "shared/world_state.json", patch: { replace: { state: "dead" } }, impactLevel: "critical", requiresSecondConfirm: true, oldValue: { state: "alive" } });
  await appendJsonl(join(projectRoot, "runtime", "world-proposals.jsonl"), proposal);
  assert.equal((await approveProposal({ projectRoot }, "death")).status, "second_confirmation_required");
  const approved = await approveProposal({ projectRoot }, "death", {}, { secondConfirm: true, currentTurn: 10 });
  assert.equal(approved.status, "approved");
  assert.equal(approved.stopLossWindow.expiresAtTurn, 15);
});

test("stop-loss creates a reverse proposal without deleting original tracking", async () => {
  const projectRoot = await root();
  const original = { id: "major", targetFile: "shared/world_state.json", impactLevel: "major", oldValue: { state: "old" }, summary: "change" };
  const window = await openStopLossWindow(projectRoot, original, 3);
  assert.equal(isStopLossOpen(window, 6), true);
  const reverse = createReverseProposal(original, window);
  assert.equal(reverse.reversesProposalId, "major");
  assert.equal(reverse.status, "pending");
});

test("context engine consumes P0, filters nested secrets, and enforces budgets", () => {
  const packet = createContextPacket({ modeId: "murder-mystery", livingWorldPacket: { scene: { id: "s" }, sceneSummaries: Array.from({ length: 8 }, (_, id) => ({ id })), trackingDigest: { recentChanges: Array.from({ length: 12 }, (_, id) => ({ id })) }, worldState: { states: { x: { id: "x", hiddenFacts: { culpritId: "c" }, value: "public" } } }, worldbookContext: { base: [], context: Array.from({ length: 12 }, (_, id) => ({ id, solution: "secret" })), instant: [] }, proximityScope: { rings: { core: [], near: [] } } } });
  assert.equal(packet.contextProfile, "mystery_safe");
  assert.equal(packet.blocks.recentSceneSummaries.length, 3);
  assert.equal(packet.blocks.trackingDigest.length, 8);
  assert.equal(packet.blocks.worldbookContext.length, 8);
  assert.equal("solution" in packet.blocks.worldbookContext[0], false);
  assert.equal("hiddenFacts" in packet.blocks.worldState[0], false);
});

test("emotional inertia blocks abrupt jumps and limits tracks per turn", async () => {
  const validation = validateInertiaShift({ distance: "hostile", secret: "guarded", trust: "neutral" }, { distance: "intimate", secret: "open", trust: "warming" });
  assert.deepEqual(validation.accepted, { trust: "warming" });
  assert.ok(validation.warnings.includes("distance_jump_blocked"));
  const projectRoot = await root();
  const update = await updateCharacterInertia(projectRoot, "npc", { distance: "intimate" }, { reason: "sudden" });
  assert.ok(update.warnings.length > 0);
  assert.equal(update.requiresProposalForLongTerm, true);
});

test("director guardian rejects reveals, player substitution, and excess events", () => {
  const result = guardDirectorPlan({ beatType: "reveal", shouldRevealSecret: true, makesPlayerChoice: true, maxNewEvents: 4 });
  assert.equal(result.valid, false);
  assert.equal(result.plan.beatType, "respond");
  assert.equal(result.plan.maxNewEvents, 0);
});

test("worldbook concepts remain seed/sprout candidates until approved proposal", async () => {
  const projectRoot = await root();
  const [seed] = detectWorldbookCandidates({ sceneId: "s1", concepts: [{ id: "artifact", title: "Rune Slate", mentions: 1 }] });
  await recordWorldbookCandidate(projectRoot, seed);
  const recorded = await recordWorldbookCandidate(projectRoot, { ...seed, lastSeen: { sceneId: "s2" } });
  assert.equal(recorded.mentions, 2);
  const sprout = await transitionWorldbookCandidate(projectRoot, "artifact", { userSupported: true });
  assert.equal(sprout.candidate.status, "sprout");
  const blocked = await transitionWorldbookCandidate(projectRoot, "artifact", {});
  assert.equal(blocked.decision.reason, "proposal_required");
  await assert.rejects(() => access(join(projectRoot, "shared", "worldbook.json")));
});

test("experience stability packet composes bounded context and safe director without canon writes", async () => {
  const projectRoot = await root();
  const packet = await createExperienceStabilityPacket({ modeId: "world-rpg", projectRoot, livingWorldPacket: { scene: { id: "s" }, sceneSummaries: [], trackingDigest: {}, worldState: { states: {} }, worldbookContext: {}, proximityScope: { rings: {} } } });
  assert.equal(packet.contextPacket.contextProfile, "full");
  assert.equal(packet.directorPlan.shouldRevealSecret, false);
  assert.equal(packet.debug.canonicalWrites, 0);
});
