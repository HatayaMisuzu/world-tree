import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  commitMechanismDrafts,
  draftFromTemplate,
  extractMechanismDrafts,
  listMechanismLibrary
} from "../../src/server/mechanism-service.js";
import {
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

test("commit mechanism drafts writes selected items only and strips secrets", () => {
  const drafts = extractMechanismDrafts("信任度会变化。背包可以获得物品。apiKey=super-secret-value");
  drafts[1].selected = false;
  drafts[0].stateSchema.apiKey = "sk-1234567890abcdefghijkl";
  const result = commitMechanismDrafts({}, drafts);
  assert.equal(result.committed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.cache.mechanisms.length, 1);
  assert.equal(JSON.stringify(result.cache).includes("super-secret-value"), false);
  assert.equal(JSON.stringify(result.cache).includes("sk-1234567890"), false);
  assert.equal(Object.hasOwn(result.cache.mechanisms[0], "typeId"), false);
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
  const code = readFileSync(new URL("../../world-tree-console.js", import.meta.url), "utf8");
  const statusBlock = code.slice(code.indexOf("function renderStatBar"), code.indexOf("function renderNarrativeContextDebug"));
  const candidateBlock = code.slice(code.indexOf("async function messageAction"), code.indexOf("async function importCharacterFile"));
  assert.ok(statusBlock.includes("U.esc(card.title"));
  assert.ok(statusBlock.includes("U.esc(item.label"));
  assert.equal(statusBlock.includes("innerHTML"), false);
  assert.equal(candidateBlock.includes("statusTurn("), false);
  assert.equal(candidateBlock.includes("latestTurnFrame"), false);
});
