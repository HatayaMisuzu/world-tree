import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAdventureModule,
  validateAdventureModule,
  extractPlayerBrief,
  extractHiddenGmBook,
  resolveStartState,
  resolveCurrentScene,
  validatePlayerIntentAgainstBook,
} from "../../src/core/tabletop/tabletop-v2-adventure-module.js";

// ── Normalizer ──

test("normalizeAdventureModule: minimal input produces valid module", () => {
  const m = normalizeAdventureModule({ title: "Test Adventure" });
  assert.equal(m.title, "Test Adventure");
  assert.ok(m.moduleId);
  assert.ok(m.schemaVersion.startsWith("world-tree.tabletop.v2.module"));
  assert.equal(m.sourceType, "quick_start");
  assert.ok(m.playerBrief);
  assert.ok(m.gmBook);
  assert.ok(Array.isArray(m.scenes));
  assert.ok(Array.isArray(m.characters));
});

test("normalizeAdventureModule: playerBrief and gmBook are separated", () => {
  const m = normalizeAdventureModule({
    title: "Split Test",
    playerBrief: { premise: "Public premise", objective: "Public goal" },
    gmBook: { hiddenTruth: "Secret truth", twistPoints: ["twist1"] },
  });
  assert.equal(m.playerBrief.premise, "Public premise");
  assert.equal(m.gmBook.hiddenTruth, "Secret truth");
  // playerBrief should not leak gmBook
  assert.equal(m.playerBrief.hiddenTruth, undefined);
});

test("normalizeAdventureModule: scenes with isHidden", () => {
  const m = normalizeAdventureModule({
    title: "Hidden Scene Test",
    scenes: [
      { title: "Public Scene", isStarting: true },
      { title: "Hidden Scene", isHidden: true, gmNotes: "secret" },
    ],
  });
  assert.equal(m.scenes.length, 2);
  assert.equal(m.scenes[0].isHidden, false);
  assert.equal(m.scenes[1].isHidden, true);
});

test("normalizeAdventureModule: preserves constraints", () => {
  const m = normalizeAdventureModule({
    title: "Constrained",
    constraints: {
      allowedActionTypes: ["explore", "social"],
      forbiddenActions: ["murder_hobo"],
    },
  });
  assert.deepEqual(m.constraints.allowedActionTypes, ["explore", "social"]);
  assert.ok(m.constraints.forbiddenActions.includes("murder_hobo"));
});

// ── Validator ──

test("validateAdventureModule: valid module passes", () => {
  const m = normalizeAdventureModule({ title: "Valid" });
  const result = validateAdventureModule(m);
  assert.equal(result.valid, true);
});

test("validateAdventureModule: external import source types pass", () => {
  const textImport = normalizeAdventureModule({ title: "Text Import", sourceType: "external_text" });
  const jsonImport = normalizeAdventureModule({ title: "JSON Import", sourceType: "structured_json" });
  assert.equal(validateAdventureModule(textImport).valid, true);
  assert.equal(validateAdventureModule(jsonImport).valid, true);
});

test("validateAdventureModule: missing title fails", () => {
  const result = validateAdventureModule({ moduleId: "test" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("title")));
});

test("validateAdventureModule: unknown sourceType fails", () => {
  const m = normalizeAdventureModule({ title: "Bad Source", sourceType: "magic_book" });
  const result = validateAdventureModule(m);
  assert.equal(result.valid, false);
});

// ── Extractors ──

test("extractPlayerBrief: excludes gmBook content", () => {
  const m = normalizeAdventureModule({
    title: "Secrets",
    playerBrief: { premise: "Public" },
    gmBook: { hiddenTruth: "SECRET" },
  });
  const brief = extractPlayerBrief(m);
  assert.equal(brief.premise, "Public");
  assert.equal(brief.hiddenTruth, undefined);
});

test("extractHiddenGmBook: includes hidden truth and hidden scenes", () => {
  const m = normalizeAdventureModule({
    title: "Hidden",
    gmBook: { hiddenTruth: "BIG SECRET" },
    scenes: [
      { title: "Public", isHidden: false },
      { title: "Secret Chamber", isHidden: true },
    ],
  });
  const gm = extractHiddenGmBook(m);
  assert.equal(gm.hiddenTruth, "BIG SECRET");
  assert.equal(gm.hiddenScenes.length, 1);
  assert.equal(gm.hiddenScenes[0].title, "Secret Chamber");
});

// ── Start state ──

test("resolveStartState: picks starting scene", () => {
  const m = normalizeAdventureModule({
    title: "Start Test",
    scenes: [
      { title: "Middle", isStarting: false },
      { title: "Beginning", isStarting: true, description: "It begins..." },
    ],
  });
  const state = resolveStartState(m, {});
  assert.equal(state.currentSceneTitle, "Beginning");
  assert.equal(state.initialNarrative, "It begins...");
});

test("resolveStartState: falls back to first scene if no starting scene", () => {
  const m = normalizeAdventureModule({
    title: "Fallback",
    scenes: [
      { title: "First", description: "First scene" },
      { title: "Second" },
    ],
  });
  const state = resolveStartState(m, {});
  assert.equal(state.currentSceneTitle, "First");
});

// ── Scene resolution ──

test("resolveCurrentScene: resolves NPCs from module characters", () => {
  const m = normalizeAdventureModule({
    title: "NPC Test",
    characters: [
      { name: "Barkeep", isNpc: true, role: "innkeeper" },
    ],
    scenes: [
      { title: "Tavern", npcs: ["Barkeep"] },
    ],
  });
  const scene = (m.scenes || [])[0]; // not null since normalize always creates array
  const resolved = resolveCurrentScene(m, { currentSceneId: scene.sceneId });
  assert.ok(resolved);
  assert.equal(resolved.resolvedNpcs.length, 1);
  assert.equal(resolved.resolvedNpcs[0].name, "Barkeep");
});

// ── Intent validation ──

test("validatePlayerIntentAgainstBook: empty intent rejected", () => {
  const m = normalizeAdventureModule({ title: "Test" });
  const result = validatePlayerIntentAgainstBook({ module: m, scene: null, runState: {}, intent: "" });
  assert.equal(result.allowed, false);
});

test("validatePlayerIntentAgainstBook: normal intent allowed", () => {
  const m = normalizeAdventureModule({ title: "Test" });
  const result = validatePlayerIntentAgainstBook({ module: m, scene: null, runState: {}, intent: "I search the room" });
  assert.equal(result.allowed, true);
});

test("validatePlayerIntentAgainstBook: forbidden action rejected", () => {
  const m = normalizeAdventureModule({
    title: "No Murder",
    constraints: { forbiddenActions: ["kill everyone"] },
  });
  const result = validatePlayerIntentAgainstBook({ module: m, scene: null, runState: {}, intent: "I kill everyone in the tavern" });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("kill everyone"));
});
