import test from "node:test";
import assert from "node:assert/strict";

// Character V1 unit tests — parser, profile, prompt, lore, persona, ooc, exporter

// ─── Parser ───
import {
  detectCharacterCardFormat, parseCharacterCard,
  normalizeImportedCharacterCard, validateImportedCharacterCard,
  preserveRawCharacterCard, createImportedCharacterSummary
} from "../../src/core/character/character-card-parser.js";

test("detect V2 JSON format", () => {
  const raw = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "Test", description: "A test" } });
  assert.equal(detectCharacterCardFormat(raw), "chara_card_v2_json");
});

test("detect V1 JSON format", () => {
  const raw = JSON.stringify({ name: "Test", first_mes: "Hello", personality: "Kind" });
  assert.equal(detectCharacterCardFormat(raw), "character_card_v1_json");
});

test("detect plain text", () => {
  assert.equal(detectCharacterCardFormat("Just a description of a character."), "plain_text");
});

test("detect CHARACTER.md", () => {
  assert.equal(detectCharacterCardFormat("# 角色名\n## 身份\n一位档案员。"), "character_md");
});

test("parse V2 JSON preserves extensions", () => {
  const raw = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "档案员", description: "冷静", first_mes: "欢迎" }, extensions: { custom: "value" }, unknown_key: "should be preserved" });
  const parsed = parseCharacterCard(raw);
  assert.equal(parsed.format, "chara_card_v2_json");
  assert.equal(parsed.data.name, "档案员");
  assert.equal(parsed.data.firstMessage, "欢迎");
  assert.ok(parsed.extensions.custom);
  assert.ok(parsed.unknownFields.unknown_key);
});

test("parse V1 JSON", () => {
  const raw = JSON.stringify({ name: "老兵", first_mes: "你找错人了。", mes_example: "<START>..." });
  const parsed = parseCharacterCard(raw);
  assert.equal(parsed.data.name, "老兵");
  assert.equal(parsed.data.messageExamples, "<START>...");
});

test("parse CHARACTER.md", () => {
  const parsed = parseCharacterCard("# 玻璃城档案员\n## 身份\n风暴记录者");
  assert.equal(parsed.format, "character_md");
  assert.equal(parsed.data.name, "玻璃城档案员");
});

test("normalize preserves alternateGreetings as array", () => {
  const n = normalizeImportedCharacterCard({ format: "chara_card_v2_json", data: { name: "T", alternateGreetings: ["Hi", "Hello"] } });
  assert.equal(n.data.alternateGreetings.length, 2);
});

test("validate warns on default name", () => {
  const r = validateImportedCharacterCard({ format: "plain_text", data: { name: "未命名角色" } });
  assert.ok(r.warnings.some(w => w.code === "unnamed"));
});

test("preserveRaw keeps raw text", () => {
  const r = preserveRawCharacterCard("raw text", { data: {} });
  assert.equal(r.raw, "raw text");
});

test("summary reports format and name", () => {
  const s = createImportedCharacterSummary({ format: "chara_card_v2_json", data: { name: "档案员", firstMessage: "Hi", alternateGreetings: ["A","B"] } });
  assert.equal(s.format, "chara_card_v2_json");
  assert.equal(s.name, "档案员");
  assert.equal(s.alternateGreetingCount, 2);
  assert.equal(s.hasFirstMessage, true);
});

// ─── Profile ───
import { createCharacterProfile, normalizeCharacterProfile, validateCharacterProfile, mergeCharacterProfilePatch, createCharacterProfileSummary, createCharacterProfileFiles } from "../../src/core/character/character-profile.js";

test("create profile with defaults", () => {
  const p = createCharacterProfile({ name: "测试", firstMessage: "你好" });
  assert.equal(p.profileType, "world_tree_character_profile");
  assert.equal(p.card.firstMessage, "你好");
  assert.ok(p.createdAt);
});

test("normalize profile arrays", () => {
  const p = normalizeCharacterProfile({ id: "p1", card: { alternateGreetings: "not_array" } });
  assert.ok(Array.isArray(p.card.alternateGreetings));
});

test("validate missing id", () => {
  const r = validateCharacterProfile({ schemaVersion: 1 });
  assert.ok(r.errors.some(e => e.code === "missing_id"));
});

test("merge patch updates name", () => {
  const base = createCharacterProfile({ name: "Old" });
  const merged = mergeCharacterProfilePatch(base, { name: "New" });
  assert.equal(merged.name, "New");
});

test("profile summary", () => {
  const s = createCharacterProfileSummary({ id: "x", name: "T", card: { firstMessage: "Hi", alternateGreetings: ["A","B"] } });
  assert.equal(s.hasFirstMessage, true);
  assert.equal(s.alternateGreetingCount, 2);
});

test("profile files generates characters.json and profile", () => {
  const files = createCharacterProfileFiles(createCharacterProfile({ name: "档案员" }));
  assert.ok(files["shared/character_profile.json"]);
  assert.ok(files["shared/characters.json"].items[0].name, "档案员");
});

// ─── Lore ───
import { createCharacterLoreFromBook, selectActiveCharacterLoreEntries, validateCharacterLore } from "../../src/core/character/character-lore.js";

test("create lore from character book", () => {
  const book = { entries: [{ id: "e1", keys: ["玻璃城"], content: "风暴城市", enabled: true }] };
  const lore = createCharacterLoreFromBook(book);
  assert.equal(lore.entries.length, 1);
  assert.equal(lore.entries[0].keys[0], "玻璃城");
});

test("select active lore entries by keyword", () => {
  const lore = { entries: [{ id: "e1", keys: ["玻璃城"], content: "...", enabled: true }, { id: "e2", keys: ["风暴"], content: "...", enabled: true }, { id: "e3", keys: ["other"], content: "...", enabled: false }] };
  const active = selectActiveCharacterLoreEntries(lore, "玻璃城的风暴");
  assert.ok(active.length >= 1);
  assert.equal(active[0].id, "e1");
});

// ─── Persona ───
import { createDefaultPersona, normalizePersonaStore, getActivePersona } from "../../src/core/character/character-persona.js";

test("default persona has expected fields", () => {
  const p = createDefaultPersona({ id: "user1", name: "玩家" });
  assert.equal(p.id, "user1");
  assert.ok(Array.isArray(p.knownFacts));
});

test("getActivePersona returns default when empty", () => {
  const store = normalizePersonaStore({});
  const p = getActivePersona(store);
  assert.equal(p.id, "default");
});

// ─── OOC ───
import { checkCharacterOoc, createOocSignature } from "../../src/core/character/character-ooc-checker.js";

test("OOC detects AI self-reference", () => {
  const result = checkCharacterOoc({ name: "档案员" }, "As an AI assistant, I cannot...");
  assert.equal(result.ok, false);
  assert.ok(result.driftSignals.includes("meta_language"));
});

test("OOC passes safe message", () => {
  const result = checkCharacterOoc({ name: "档案员" }, "档案员翻开记录本，微微一笑。");
  assert.equal(result.ok, true);
});

test("OOC detects forbidden drift phrase", () => {
  const result = checkCharacterOoc({ name: "档案员", expressionDNA: { forbiddenDrift: ["actually"] } }, "档案员说：actually，我不是这么想的。");
  assert.ok(result.driftSignals.includes("forbidden_drift"));
});

// ─── Exporter ───
import { exportCharacterAsV2Json, exportCharacterAsWorldTreeProfile } from "../../src/core/character/character-exporter.js";

test("export V2 JSON has correct spec", () => {
  const profile = createCharacterProfile({ name: "档案员", firstMessage: "欢迎", alternateGreetings: ["你好"] });
  const exported = exportCharacterAsV2Json(profile);
  assert.equal(exported.spec, "chara_card_v2");
  assert.equal(exported.data.name, "档案员");
  assert.ok(exported.data.alternate_greetings);
});

test("export WT profile preserves data", () => {
  const profile = createCharacterProfile({ name: "X" });
  const exported = exportCharacterAsWorldTreeProfile(profile);
  assert.equal(exported.name, "X");
  assert.ok(exported.exportedAt);
});
