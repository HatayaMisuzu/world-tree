import test from "node:test";
import assert from "node:assert/strict";
import {
  createTabletopRun,
  createSaveSlot,
  restoreSaveSlot,
  forkBranchFromSave,
  recordTurn,
  validateRunState,
  stripHiddenState,
} from "../../src/core/tabletop/tabletop-v2-save-branch.js";
import { normalizeAdventureModule } from "../../src/core/tabletop/tabletop-v2-adventure-module.js";

// ── Run creation ──

test("createTabletopRun: basic run", () => {
  const module = normalizeAdventureModule({ title: "Test Adventure" });
  const run = createTabletopRun({ module, playerCharacter: { name: "Hero", stats: { strength: 3 } } });
  assert.ok(run.runId);
  assert.equal(run.moduleId, module.moduleId);
  assert.equal(run.turnIndex, 0);
  assert.ok(run.publicState);
  assert.ok(run.hiddenGmState);
  assert.equal(run.publicState.playerCharacter.name, "Hero");
});

test("createTabletopRun: picks starting scene", () => {
  const module = normalizeAdventureModule({
    title: "Scene Test",
    scenes: [
      { title: "Middle" },
      { title: "Start", isStarting: true },
    ],
  });
  const run = createTabletopRun({ module });
  assert.equal(run.currentSceneId, module.scenes[1].sceneId);
});

// ── Save slot ──

test("createSaveSlot: snapshots state", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const slot = createSaveSlot(run, "my save");
  assert.ok(slot.saveId);
  assert.equal(slot.label, "my save");
  assert.equal(slot.turnIndex, 0);
  assert.deepEqual(slot.publicSnapshot, run.publicState);
});

test("restoreSaveSlot: recovers state", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const slot = createSaveSlot(run, "checkpoint");
  const restored = restoreSaveSlot(slot);
  assert.equal(restored.turnIndex, 0);
  assert.deepEqual(restored.publicState, slot.publicSnapshot);
});

// ── Branch fork ──

test("forkBranchFromSave: preserves roll history divergence point", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const slot = createSaveSlot(run, "branch point");
  const branch = forkBranchFromSave(slot, "alternate path");
  assert.ok(branch.branchId);
  assert.notEqual(branch.branchId, slot.branchId);
  assert.equal(branch.status, "active");
  assert.equal(branch.divergenceTurnIndex, 0);
});

// ── Record turn ──

test("recordTurn: increments turn index and logs roll", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  let run = createTabletopRun({ module });
  run = recordTurn(run, {
    roll: { source: "system_dice_engine", expression: "1d20", total: 15, outcome: "success" },
  });
  assert.equal(run.turnIndex, 1);
  assert.equal(run.rollHistory.length, 1);
  assert.equal(run.rollHistory[0].roll.total, 15);
});

test("recordTurn: updates public state", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  let run = createTabletopRun({ module });
  run = recordTurn(run, {
    publicStateUpdate: { lastNarrative: "战斗开始了" },
  });
  assert.equal(run.publicState.lastNarrative, "战斗开始了");
});

// ── Validate ──

test("validateRunState: valid run passes", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const result = validateRunState(run);
  assert.equal(result.valid, true);
});

test("validateRunState: missing runId fails", () => {
  const result = validateRunState({ moduleId: "test", branchId: "b1", turnIndex: 0, publicState: {}, hiddenGmState: {}, rollHistory: [], saveSlots: [] });
  assert.equal(result.valid, false);
});

// ── Strip hidden ──

test("stripHiddenState: removes hidden gm state", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const safe = stripHiddenState(run);
  assert.ok(safe.publicState);
  assert.equal(safe.hiddenGmState, undefined);
});

// ── dc-3: ids/seeds independent of wall clock ──

function withMockedDate(clockStart, fn) {
  const RealDate = Date;
  let t = clockStart;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [t += 7])); }
    static now() { return (t += 7); }
  };
  try { return fn(); }
  finally { globalThis.Date = RealDate; }
}

test("dc-3: run/save/branch ids stable under mocked Date (same seed+module)", () => {
  const module = normalizeAdventureModule({ title: "Clock Independence", moduleId: "mod-dc3" });
  const capture = (clockStart) => withMockedDate(clockStart, () => {
    const run = createTabletopRun({ module, seed: "seed-dc3", playerCharacter: { name: "Hero" } });
    const slot = createSaveSlot(run, "checkpoint");
    const branch = forkBranchFromSave(slot, "alt");
    return {
      runId: run.runId,
      branchId: run.branchId,
      seed: run.seed,
      saveId: slot.saveId,
      forkBranchId: branch.branchId,
    };
  });
  const a = capture(1_000_000_000_000);
  const b = capture(1_900_000_123_457);
  assert.deepEqual(a, b);
  assert.match(a.runId, /^run-[0-9a-f]{16}$/);
  assert.match(a.saveId, /^save-[0-9a-f]{16}$/);
  assert.match(a.forkBranchId, /^branch-[0-9a-f]{16}$/);
  assert.notEqual(a.runId, a.branchId);
});

test("dc-3: different seeds produce different run ids; same seed reproduces", () => {
  const module = normalizeAdventureModule({ title: "Seed Diff", moduleId: "mod-seed" });
  const r1 = createTabletopRun({ module, seed: "a" });
  const r2 = createTabletopRun({ module, seed: "a" });
  const r3 = createTabletopRun({ module, seed: "b" });
  assert.equal(r1.runId, r2.runId);
  assert.equal(r1.seed, "a");
  assert.notEqual(r1.runId, r3.runId);
});

test("dc-3: successive saves at same turn get distinct stable saveIds", () => {
  const module = normalizeAdventureModule({ title: "Save Seq", moduleId: "mod-save-seq" });
  const run = createTabletopRun({ module, seed: 7 });
  const s1 = createSaveSlot(run, "slot");
  run.saveSlots = [s1.saveId];
  const s2 = createSaveSlot(run, "slot");
  assert.notEqual(s1.saveId, s2.saveId);
  // replay
  const run2 = createTabletopRun({ module, seed: 7 });
  const s1b = createSaveSlot(run2, "slot");
  run2.saveSlots = [s1b.saveId];
  const s2b = createSaveSlot(run2, "slot");
  assert.equal(s1.saveId, s1b.saveId);
  assert.equal(s2.saveId, s2b.saveId);
});
