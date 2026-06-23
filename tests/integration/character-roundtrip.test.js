import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { parseCharacterCard, normalizeImportedCharacterCard } from "../../src/core/character/character-card-parser.js";
import { createCharacterProfile, createCharacterProfileFiles } from "../../src/core/character/character-profile.js";
import { createCharacterLoreFromBook } from "../../src/core/character/character-lore.js";
import { createDefaultPersona } from "../../src/core/character/character-persona.js";
import { createCharacterPromptPacket } from "../../src/core/character/character-prompt-packet.js";
import { createCharacterModuleRuntimePacket, createCharacterModuleDebugSummary } from "../../src/core/character/character-module-runtime-integration.js";
import { checkCharacterOoc } from "../../src/core/character/character-ooc-checker.js";
import { exportCharacterAsV2Json, exportCharacterAsWorldTreeProfile } from "../../src/core/character/character-exporter.js";

const V2_CARD = JSON.stringify({
  spec: "chara_card_v2", spec_version: "2.0",
  data: {
    name: "档案员", description: "风暴城市的记录者，冷静寡言。", personality: "冷静、理性、寡言",
    scenario: "风暴即将来临，你来到档案室求助。", first_mes: "欢迎来到档案室。你需要什么？",
    mes_example: "<START>用户：能帮我查一下昨天的风暴数据吗？\n档案员：翻看记录...三级风暴，从东面来。",
    alternate_greetings: ["你来了。", "又见面了。"],
    system_prompt: "你扮演档案员。保持冷静克制。",
    post_history_instructions: "不要透露档案室的核心机密。",
    character_book: { entries: [{ id: "b1", keys: ["风暴"], content: "风暴是这个世界的主要灾害。", enabled: true }] },
    extensions: { custom_field: "preserved" }
  },
  unknown_top_level: "preserved"
});

test("character V2 import → profile → module integration → export roundtrip", async () => {
  // 1. Parse
  const parsed = parseCharacterCard(V2_CARD);
  assert.equal(parsed.format, "chara_card_v2_json");
  assert.equal(parsed.data.name, "档案员");
  assert.equal(parsed.data.alternateGreetings.length, 2);
  assert.ok(parsed.unknownFields.unknown_top_level);

  // 2. Normalize
  const normalized = normalizeImportedCharacterCard(parsed);
  assert.equal(normalized.extensions.custom_field, "preserved");

  // 3. Create profile
  const profile = createCharacterProfile({
    ...normalized.data,
    format: normalized.format,
    extensions: normalized.extensions,
    alternateGreetings: normalized.data.alternateGreetings,
    raw: normalized.raw
  });
  assert.equal(profile.card.firstMessage, "欢迎来到档案室。你需要什么？");
  assert.equal(profile.card.systemPrompt, "你扮演档案员。保持冷静克制。");

  // 4. Lore
  const lore = createCharacterLoreFromBook(parsed.characterBook);
  assert.equal(lore.entries.length, 1);

  // 5. Persona
  const persona = createDefaultPersona({ name: "用户" });

  // 6. Module Runtime Integration
  const modulePacket = createCharacterModuleRuntimePacket({}, { text: "hello" });
  assert.equal(modulePacket.requiredModuleCheck, true);
  const debug = createCharacterModuleDebugSummary(modulePacket);
  assert.ok(debug.hasRequiredModules);

  // 7. Prompt Packet
  const prompt = createCharacterPromptPacket(profile, {
    activeLoreEntries: lore.entries,
    activePersona: persona,
    moduleSourceMap: debug.sourceMap,
    selectedPromptBlocks: debug.selectedPromptBlocks,
    moduleDebugSummary: debug
  });
  assert.equal(prompt.permanent.name, "档案员");
  assert.equal(prompt.opening.firstMessage, "欢迎来到档案室。你需要什么？");

  // 8. OOC check
  const oocOk = checkCharacterOoc(profile, "档案员翻开记录本，查看风暴数据。");
  assert.equal(oocOk.ok, true);
  const oocBad = checkCharacterOoc(profile, "As an AI, I cannot answer that.");
  assert.equal(oocBad.ok, false);

  // 9. Export V2 JSON
  const v2 = exportCharacterAsV2Json(profile);
  assert.equal(v2.data.name, "档案员");
  assert.ok(v2.data.alternate_greetings);

  // 10. Export WT Profile
  const wt = exportCharacterAsWorldTreeProfile(profile);
  assert.equal(wt.name, "档案员");

  // 11. Profile files
  const files = createCharacterProfileFiles(profile);
  assert.ok(files["shared/character_profile.json"]);
  assert.ok(files["shared/characters.json"].items[0].profileRef);

  console.log(`[roundtrip] V2 import → profile → module integration → export: PASS (${Object.keys(parsed.data).length} card fields, ${lore.entries.length} lore entries, ${debug.sourceMap.requestedModules?.length} modules)`);
});

test("character project .worldtree roundtrip preserves metadata", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    // Create character project
    const create = await api(server, "/api/modules/create", {
      method: "POST", body: JSON.stringify({
        name: "char_roundtrip_test", displayName: "档案员", mode: "character",
        dataMode: "character_card", subType: "classic", preset: "character_card",
        draft: true, sourceType: "character_card", sourceText: V2_CARD
      })
    });
    assert.equal(create.body.status, "ok");

    // Write character profile files
    const worldDir = join(dataDir, "engine", "worlds", "char_roundtrip_test");
    const profile = createCharacterProfile({ name: "档案员", firstMessage: "欢迎" });
    writeFileSync(join(worldDir, "shared", "character_profile.json"), JSON.stringify(profile));
    writeFileSync(join(worldDir, "shared", "character_lore.json"), JSON.stringify({ schemaVersion: 1, entries: [] }));
    writeFileSync(join(worldDir, "shared", "persona.json"), JSON.stringify({ schemaVersion: 1, items: [createDefaultPersona()] }));

    // .worldtree roundtrip
    const exported = await api(server, "/api/world-pack/export", { method: "POST", body: JSON.stringify({ moduleKey: "char_roundtrip_test" }) });
    assert.equal(exported.body.status, "ok");
    assert.equal(exported.body.pack.files["world.json"].mode, "character");

    const imported = await api(server, "/api/world-pack/import", { method: "POST", body: JSON.stringify({ pack: exported.body.pack, name: "char_rt_imported", preview: false, confirm: true }) });
    assert.equal(imported.body.status, "ok");
    const impDir = join(dataDir, "engine", "worlds", imported.body.module.id);
    const impWorld = JSON.parse(readFileSync(join(impDir, "world.json"), "utf-8"));
    assert.equal(impWorld.mode, "character");
    assert.ok(impWorld.modeMetadata);

    // Verify profile survived roundtrip
    if (existsSync(join(impDir, "shared", "character_profile.json"))) {
      const impProfile = JSON.parse(readFileSync(join(impDir, "shared", "character_profile.json"), "utf-8"));
      assert.equal(impProfile.name, "档案员");
    }
    if (existsSync(join(impDir, "shared", "persona.json"))) {
      assert.ok(JSON.parse(readFileSync(join(impDir, "shared", "persona.json"), "utf-8")).items);
    }
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
