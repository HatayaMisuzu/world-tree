export function createCharacterPromptPacket(profile = {}, context = {}, options = {}) {
  const card = profile.card || {};
  const g = selectGreeting(profile, options);
  return { schemaVersion: 1, mode: "character", characterId: profile.id || "primary", permanent: { name: profile.name || "", description: card.description || "", personality: card.personality || "", scenario: card.scenario || "" }, style: { expressionDNA: profile.expressionDNA || {}, messageExamples: card.messageExamples || "", budgetPolicy: options.budgetPolicy || "fit_to_context" }, opening: { firstMessage: card.firstMessage || "", alternateGreetings: card.alternateGreetings || [], selectedGreetingIndex: g.index || 0 }, instructions: { systemPrompt: card.systemPrompt || "", postHistoryInstructions: card.postHistoryInstructions || "", mergePolicy: "prefer_card_but_keep_world_tree_safety" }, lore: { characterBook: profile.lore?.characterBook || null, activeLoreEntries: context.activeLoreEntries || [], activationPolicy: "keyword_budgeted" }, persona: { activePersona: context.activePersona || null, personaLore: [] }, modules: { sourceMap: context.moduleSourceMap || {}, selectedPromptBlocks: context.selectedPromptBlocks || [], contextBlocks: [], debugSummary: context.moduleDebugSummary || {} }, runtime: { cacheKey: `character.packet.${profile.id || "primary"}.${Date.now()}`, tokenEstimate: estimateCharacterPromptBudget(profile, options), warnings: [] } };
}

export function estimateCharacterPromptBudget(profile = {}, options = {}) {
  const card = profile.card || {};
  return Math.ceil(((card.description||"").length + (card.personality||"").length + (card.scenario||"").length + (card.firstMessage||"").length + (card.messageExamples||"").length) / 2);
}

export function selectGreeting(profile = {}, options = {}) {
  const gs = Array.isArray(profile.card?.alternateGreetings) ? profile.card.alternateGreetings : [];
  const idx = options.greetingIndex ?? 0;
  return { index: idx, text: gs[idx] || profile.card?.firstMessage || "" };
}

export function selectExampleMessages(profile = {}, options = {}) {
  return profile.card?.messageExamples || "";
}

export function mergeCharacterInstructions(profile = {}, globalPrompt = "", options = {}) {
  return { systemPrompt: profile.card?.systemPrompt || globalPrompt, postHistoryInstructions: profile.card?.postHistoryInstructions || "", mergePolicy: "prefer_card" };
}

export function validateCharacterPromptPacket(packet = {}, options = {}) {
  const errors = [], warnings = [];
  if (!packet.characterId) errors.push("missing characterId");
  if (!packet.permanent?.name) warnings.push("no name");
  return { ok: errors.length === 0, errors, warnings };
}