import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBrowserSource } from "../../scripts/lib/browser-source.mjs";

import {
  commitMechanismDrafts,
  draftFromTemplate,
  extractMechanismDrafts,
  listMechanismLibrary,
  normalizeMechanismDraft
} from "../../src/server/mechanism-service.js";
import {
  buildConfirmedAfterState,
  createTurnStateFrame,
  diffConfirmedState,
  emptyConfirmedState,
  sanitizeVisualPacket
} from "../../src/server/turn-state-frame-service.js";

const SAMPLE = "红衣少女会根据玩家行动改变信任度。旧城堡有探索度。玩家可以获得银钥匙和梦境花。梦境稳定度会随着污染值变化。";

test("alchemy mechanism extraction defaults input mechanisms to selected", () => {
  const drafts = extractMechanismDrafts(SAMPLE);
  assert.ok(drafts.some(item => item.type === "affinity" && item.name.includes("红衣少女")));
  assert.ok(drafts.some(item => item.type === "exploration" && item.name.includes("旧城堡")));
  assert.ok(drafts.some(item => item.type === "inventory"));
  assert.ok(drafts.some(item => item.type === "meter" && item.name === "梦境稳定度"));
  assert.ok(drafts.every(item => item.source === "input"));
  assert.ok(drafts.every(item => item.selected === true));
  assert.ok(drafts.every(item => item.scope === "save"));
  assert.equal(drafts.find(item => item.type === "affinity").visualHint.preferredType, "stat_bar");
});

test("mechanism library ranks matching templates and creates library drafts", () => {
  const drafts = extractMechanismDrafts(SAMPLE);
  const library = listMechanismLibrary({ text: SAMPLE, drafts });
  assert.deepEqual(library.recommendations.slice(0, 4).map(item => item.templateId), [
    "affinity.basic.v1",
    "exploration.location.v1",
    "inventory.simple.v1",
    "meter.pollution_stability.v1"
  ]);
  const added = draftFromTemplate("quest.progress.v1");
  assert.equal(added.source, "library");
  assert.equal(added.selected, true);
  assert.equal(added.sourceRef.templateId, "quest.progress.v1");
});

test("mechanism scope defaults are save-scoped except custom and preserve edits", () => {
  for (const type of ["affinity", "inventory", "exploration", "quest"]) {
    assert.equal(normalizeMechanismDraft({ name: type, type }).scope, "save");
  }
  assert.equal(normalizeMechanismDraft({ name: "custom", type: "custom" }).scope, "world");
  assert.equal(normalizeMechanismDraft({ name: "quest", type: "quest", scope: "world" }).scope, "world");
});

test("commit mechanism drafts writes selected items only and strips secrets", () => {
  const drafts = extractMechanismDrafts("信任度会变化。背包可以获得物品。apiKey=super-secret-value");
  drafts[1].selected = false;
  drafts[0].stateSchema.apiKey = "sk-1234567890abcdefghijkl";
  const result = commitMechanismDrafts({}, drafts, { moduleKey: "world", worldbookHash: "wb-1", now: "2026-06-21T00:00:00.000Z" });
  assert.equal(result.committed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.cache.mechanisms.length, 1);
  assert.equal(JSON.stringify(result.cache).includes("super-secret-value"), false);
  assert.equal(JSON.stringify(result.cache).includes("sk-1234567890"), false);
  assert.equal(Object.hasOwn(result.cache.mechanisms[0], "typeId"), false);
  assert.equal(result.cache.moduleKey, "world");
  assert.equal(result.cache.worldbookHash, "wb-1");
  assert.equal(result.committedNew, 1);
});

test("mechanism definition hashes and unchanged statistics are stable", () => {
  const drafts = extractMechanismDrafts("信任度会变化。");
  const first = commitMechanismDrafts({}, drafts, { moduleKey: "world", worldbookHash: "wb-1", now: "2026-06-21T00:00:00.000Z" });
  const second = commitMechanismDrafts(first.cache, drafts, { moduleKey: "world", worldbookHash: "wb-1", now: "2026-06-21T01:00:00.000Z" });
  assert.equal(second.cache.definitionHash, first.cache.definitionHash);
  assert.equal(second.cache.compiledAt, first.cache.compiledAt);
  assert.equal(second.committed, 0);
  assert.equal(second.unchanged, 1);
  assert.equal(second.updatedExisting, 0);
});

test("TurnStateFrame merges previous, engine, confirmed sections, overlays and applied mechanisms", () => {
  const previousState = { ...emptyConfirmedState(), characters: { meiling: { trust: 72 } }, inventory: { key: 1 } };
  const after = buildConfirmedAfterState({
    previousState,
    engineState: { worldState: { weather: "rain" } },
    parsedSections: { "状态": { world: { scene: "tower" }, _raw: "private raw" }, "状态建议": { world: { ignored: true } } },
    overlayPatch: { characters: { meiling: { trust: 77 } }, inventory: { flower: 2 }, proposals: { leaked: true } },
    mechanismCache: { confirmedState: { stability: 80 } },
    appliedMechanismChanges: [{ applied: true, target: "quests.main.progress", after: 25 }, { applied: false, target: "world.leak", after: true }]
  });
  assert.equal(after.characters.meiling.trust, 77);
  assert.equal(after.world.weather, "rain");
  assert.equal(after.world.scene, "tower");
  assert.equal(after.inventory.key, 1);
  assert.equal(after.inventory.flower, 2);
  assert.equal(after.mechanisms.stability, 80);
  assert.equal(after.quests.main.progress, 25);
  assert.equal(JSON.stringify(after).includes("private raw"), false);
  assert.equal(JSON.stringify(after).includes("ignored"), false);
  assert.equal(JSON.stringify(after).includes("leaked"), false);
});

test("visual generation prefers stat bars and inventory grids", () => {
  const frame = createTurnStateFrame({
    turnId: "turn-visual", moduleKey: "world",
    afterState: { ...emptyConfirmedState(), characters: { meiling: { trust: 77 } }, inventory: { key: 2 }, quests: { main: "active" } }
  });
  assert.ok(frame.visual.cards.some(card => card.type === "stat_bar" && card.title === "trust"));
  assert.ok(frame.visual.cards.some(card => card.type === "inventory_grid" && card.items[0].name === "key"));
  assert.ok(frame.visual.cards.some(card => card.type === "status_list" && card.title === "任务"));
});

test("TurnStateFrame persists an empty fallback shape", () => {
  const frame = createTurnStateFrame({ turnId: "turn-1", round: 1, moduleKey: "world", saveId: "main" });
  assert.deepEqual(frame.afterState, emptyConfirmedState());
  assert.deepEqual(frame.changes, []);
  assert.deepEqual(frame.visual.cards, []);
  assert.ok(frame.beforeStateHash && frame.afterStateHash);
});

test("TurnStateFrame records confirmed numeric delta", () => {
  const beforeState = { ...emptyConfirmedState(), characters: { meiling: { trust: 72 } } };
  const afterState = { ...emptyConfirmedState(), characters: { meiling: { trust: 77 } } };
  const changes = diffConfirmedState(beforeState, afterState, { sourceMessageId: "turn-2-assistant" });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].type, "increase");
  assert.equal(changes[0].delta, 5);
  assert.equal(changes[0].applied, true);
});

test("persistTurn chains beforeState from the previous frame afterState", () => {
  const serverCode = readFileSync(new URL("../../server.js", import.meta.url), "utf8");
  const persistBlock = serverCode.slice(serverCode.indexOf("async function persistTurn"), serverCode.indexOf("async function handleLlmChat"));
  assert.ok(persistBlock.includes("const beforeState = previousFrame?.afterState || emptyConfirmedState()"));
  assert.ok(persistBlock.includes("previousState: beforeState"));
  assert.ok(persistBlock.includes("parsedSections: result.parsedSections"));
  assert.ok(persistBlock.includes("overlayPatch: result.overlayPatch"));
});

test("VisualPacket rejects unknown or executable card fields", () => {
  const packet = sanitizeVisualPacket({
    cards: [
      { type: "raw_html", html: "<script>alert(1)</script>" },
      { type: "status_list", title: "状态<script>alert(1)</script>", items: [{ label: "安全", value: "正常" }] },
      { type: "status_list", title: "危险", rawHtml: "<img onerror=alert(1)>", items: [] }
    ]
  });
  assert.equal(packet.cards.length, 1);
  assert.equal(JSON.stringify(packet).includes("<script>"), false);
  assert.equal(JSON.stringify(packet).includes("rawHtml"), false);
});

test("TurnStateFrame strips secrets, proposals, sessions and local paths", () => {
  const frame = createTurnStateFrame({
    turnId: "turn-3",
    moduleKey: "world",
    engineState: {
      worldState: { place: "C:\\Users\\Lenovo\\secret", apiKey: "sk-1234567890abcdefghijkl" },
      proposals: [{ value: 99 }],
      session: { raw: true }
    }
  });
  const raw = JSON.stringify(frame);
  assert.equal(raw.includes("sk-1234567890"), false);
  assert.equal(raw.includes("C:\\\\Users"), false);
  assert.equal(raw.includes("proposals"), false);
  assert.equal(raw.includes("session"), false);
});

test("status renderers escape dynamic fields and candidate selection does not mutate frames", () => {
  const code = readBrowserSource();
  const statusBlock = code.slice(code.indexOf("function renderStatBar"), code.indexOf("function renderNarrativeContextDebug"));
  const candidateBlock = code.slice(code.indexOf("async function messageAction"), code.indexOf("async function importCharacterFile"));
  assert.ok(statusBlock.includes("U.esc(card.title"));
  assert.ok(statusBlock.includes("U.esc(item.label"));
  assert.equal(statusBlock.includes("innerHTML"), false);
  assert.equal(candidateBlock.includes("statusTurn("), false);
  assert.equal(candidateBlock.includes("latestTurnFrame"), false);
});

test("mechanism draft editor is inline and validates numeric bounds", () => {
  const code = readBrowserSource();
  const editorBlock = code.slice(code.indexOf("function editMechanismDraft"), code.indexOf("function removeMechanismDraft"));
  assert.equal(editorBlock.includes("prompt("), false);
  assert.ok(code.includes('data-mechanism-field="stateSchema"') === false);
  for (const field of ["name", "description", "type", "scope", "kind", "min", "max", "defaultValue", "preferredType", "showToPlayer"]) {
    assert.ok(code.includes(`data-mechanism-field="${field}"`), `missing inline field ${field}`);
  }
  assert.ok(editorBlock.includes("min > max"));
  assert.ok(editorBlock.includes("defaultValue < min"));
  assert.ok(editorBlock.includes("defaultValue > max"));
});
