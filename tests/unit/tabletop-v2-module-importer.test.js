// Tabletop V2 Module Importer Tests
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTabletopModuleInput,
  extractTabletopModuleSectionsFromText,
  createAdventureModuleDraftFromExternalText,
  buildTabletopImportPreview,
  normalizeImportedAdventureModule,
} from "../../src/core/tabletop/tabletop-v2-module-importer.js";
import { validateExternalTabletopModuleCompleteness } from "../../src/core/tabletop/tabletop-v2-module-completeness.js";

// ── Classification ──

test("classifyTabletopModuleInput: empty input returns unknown", () => {
  assert.deepEqual(classifyTabletopModuleInput(null), { type: "unknown", confidence: 0 });
  assert.deepEqual(classifyTabletopModuleInput(""), { type: "unknown", confidence: 0 });
});

test("classifyTabletopModuleInput: JSON string detected", () => {
  const r = classifyTabletopModuleInput('{"title":"Test","playerBrief":{"premise":"hi"}}');
  assert.equal(r.type, "json");
  assert.ok(r.confidence > 0.8);
});

test("classifyTabletopModuleInput: YAML frontmatter detected", () => {
  const r = classifyTabletopModuleInput("---\ntitle: Test\n---\n# Story");
  assert.equal(r.type, "yaml_frontmatter");
});

test("classifyTabletopModuleInput: markdown detected", () => {
  const r = classifyTabletopModuleInput("# 第一章\n\n故事开始...");
  assert.equal(r.type, "markdown");
});

test("classifyTabletopModuleInput: adventure module object detected", () => {
  const r = classifyTabletopModuleInput({ title: "A", playerBrief: { premise: "p" } });
  assert.equal(r.type, "adventure_module_json");
});

// ── Section extraction ──

test("extractTabletopModuleSectionsFromText: extracts title from heading", () => {
  const s = extractTabletopModuleSectionsFromText("# 龙之洞穴\n\n这是一个关于龙的故事");
  assert.equal(s.title, "龙之洞穴");
});

test("extractTabletopModuleSectionsFromText: extracts premise from Chinese heading", () => {
  const s = extractTabletopModuleSectionsFromText("## 背景：远古的龙苏醒");
  assert.equal(s.premise, "远古的龙苏醒");
});

test("extractTabletopModuleSectionsFromText: extracts ruleset", () => {
  const s = extractTabletopModuleSectionsFromText("## 规则：d20_fantasy");
  assert.equal(s.ruleset, "d20_fantasy");
});

test("extractTabletopModuleSectionsFromText: extracts NPCs", () => {
  const text = "## NPC\n- 老法师\n  住在大图书馆\n- 盗贼少女\n  敏捷 18";
  const s = extractTabletopModuleSectionsFromText(text);
  assert.ok(s.npcs_parsed);
  assert.ok(s.npcs_parsed.length >= 2);
});

test("extractTabletopModuleSectionsFromText: empty text returns empty", () => {
  assert.deepEqual(extractTabletopModuleSectionsFromText(""), {});
});

// ── Draft creation ──

test("createAdventureModuleDraftFromExternalText: creates draft from markdown", () => {
  const text = `# 哥布林巢穴

## 背景：哥布林袭击村庄

## 目标：救出被绑的村民

## 规则：d20_fantasy

## 场景
- 村庄入口
  你站在村口，远方传来哥布林的嚎叫。
- 洞穴深处
  黑暗的洞穴中传来呜咽声。

## NPC
- 村长
  焦急的老人

## GM 笔记
  真正的幕后黑手是一只年轻的龙`;
  const result = createAdventureModuleDraftFromExternalText(text);
  assert.equal(result.error, undefined);
  assert.ok(result.draft);
  assert.equal(result.draft.title, "哥布林巢穴");
  assert.ok(result.draft.scenes.length >= 2);
  assert.ok(result.draft.characters.length >= 1);
  assert.ok(result.draft.gmBook.hiddenTruth.length > 0);
});

test("createAdventureModuleDraftFromExternalText: empty text returns error", () => {
  const result = createAdventureModuleDraftFromExternalText("");
  assert.equal(result.error, "EMPTY_INPUT");
});

test("createAdventureModuleDraftFromExternalText: JSON module passed through", () => {
  const json = JSON.stringify({ title: "Test JSON", playerBrief: { premise: "Hi" } });
  const result = createAdventureModuleDraftFromExternalText(json);
  assert.equal(result.error, undefined);
  assert.equal(result.draft.title, "Test JSON");
});

// ── Import preview ──

test("buildTabletopImportPreview: generates preview from markdown", () => {
  const text = "# My Adventure\n\n## 背景：Epic quest\n\n## 规则：d20_fantasy";
  const preview = buildTabletopImportPreview(text);
  assert.equal(preview.status, "ok");
  assert.equal(preview.title, "My Adventure");
  assert.ok(preview.playerBriefPreview.premise.includes("Epic quest"));
});

test("buildTabletopImportPreview: handles JSON module", () => {
  const json = JSON.stringify({ title: "JSON Mod", playerBrief: { premise: "Save the world" } });
  const preview = buildTabletopImportPreview(json);
  assert.equal(preview.status, "ok");
  assert.equal(preview.type, "structured_json");
});

// ── Completeness validation ──

test("validateExternalTabletopModuleCompleteness: complete draft passes", () => {
  const text = "# 龙之洞穴\n\n## 背景：龙袭击村庄\n\n## 规则：d20_fantasy\n\n## 场景\n- 开场\n  你在村口";
  const result = createAdventureModuleDraftFromExternalText(text);
  // Add allowed actions
  result.draft.playerBrief.allowedActions = ["attack", "talk", "move"];
  const v = validateExternalTabletopModuleCompleteness(result.draft);
  // title, premise, scenes, starting scene, allowed actions, ruleset — all present
  assert.ok(v.ready);
  assert.ok(v.canStart);
});

test("validateExternalTabletopModuleCompleteness: empty module fails", () => {
  const v = validateExternalTabletopModuleCompleteness({});
  assert.equal(v.ready, false);
  assert.equal(v.canStart, false);
});

test("validateExternalTabletopModuleCompleteness: thin GM book produces warning", () => {
  const draft = {
    title: "Test",
    playerBrief: { premise: "A story", allowedActions: ["move"] },
    scenes: [{ sceneId: "s1", title: "Start", isStarting: true }],
    rulesetProfileId: "d20_fantasy",
    characters: [],
    clocks: [],
  };
  const v = validateExternalTabletopModuleCompleteness(draft);
  assert.ok(v.ready);
  assert.equal(v.gmBookQuality, "none");
  const thinWarnings = v.warnings.filter((w) => w.code === "THIN_GM_BOOK");
  assert.ok(thinWarnings.length > 0);
});

// ── normalizeImportedAdventureModule ──

test("normalizeImportedAdventureModule: returns normalized draft", () => {
  const mod = normalizeImportedAdventureModule("# Test\n\n## 背景：A story");
  assert.ok(mod);
  assert.equal(mod.title, "Test");
});

test("normalizeImportedAdventureModule: empty input returns null", () => {
  assert.equal(normalizeImportedAdventureModule(""), null);
});

// ── GM Book isolation assertions ──

test("imported module: GM hidden notes never appear in playerBrief", () => {
  const text = "## GM 笔记\n  幕后主使是村长\n\n## 背景：普通冒险";
  const result = createAdventureModuleDraftFromExternalText(text);
  assert.ok(result.draft.gmBook.hiddenTruth.includes("幕后主使是村长"));
  // playerBrief should not contain the hidden truth
  const playerText = JSON.stringify(result.draft.playerBrief);
  assert.ok(!playerText.includes("幕后主使是村长"));
});
