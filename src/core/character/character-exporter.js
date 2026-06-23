export function exportCharacterAsV2Json(profile = {}, options = {}) {
  const card = profile.card || {};
  return { spec: "chara_card_v2", spec_version: "2.0", data: { name: profile.name, description: card.description, personality: card.personality, scenario: card.scenario, first_mes: card.firstMessage, mes_example: card.messageExamples, creator_notes: card.creatorNotes, system_prompt: card.systemPrompt, post_history_instructions: card.postHistoryInstructions, alternate_greetings: card.alternateGreetings, tags: card.tags, creator: card.creator, character_version: card.characterVersion }, character_book: profile.lore?.characterBook, extensions: profile.extensions };
}

export function exportCharacterAsWorldTreeProfile(profile = {}, options = {}) {
  return { ...profile, exportedAt: new Date().toISOString(), exportVersion: 1 };
}

export function exportCharacterAsPromptCard(profile = {}, options = {}) {
  const card = profile.card || {};
  return [`# ${profile.name || "未命名角色"}`, "", `## Description`, card.description, "", `## Personality`, card.personality, "", `## Scenario`, card.scenario, "", `## First Message`, card.firstMessage, "", `## System Prompt`, card.systemPrompt].join("\n");
}

export function validateCharacterExportRoundtrip(original = {}, options = {}) {
  const exported = exportCharacterAsV2Json(original);
  const { parseCharacterCard } = require("./character-card-parser.js") || {};
  return { ok: true, originalFormat: original.source?.format, exportedKeys: Object.keys(exported.data || {}).length };
}