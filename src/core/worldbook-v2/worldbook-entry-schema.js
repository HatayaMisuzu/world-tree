export const WORLDBOOK_ENTRY_TYPES = Object.freeze(["world","character","location","faction","organization","relationship","rule","event","timeline","scene","concept","item","style","note"]);
export const WORLDBOOK_VISIBILITY = Object.freeze(["public","player_known","character_known","faction_known","private","hiddenTruth","gm_only","system_only","forbidden"]);
export const WORLDBOOK_CONTEXT_SLOTS = Object.freeze(["world_rules","global_lore","active_scene","active_characters","relationship_context","active_factions","recent_timeline","runtime_hints","candidate_warnings","gm_only_context","debug_only"]);
export const WORLDBOOK_AUTHORITY = Object.freeze(["canon","confirmed","candidate","runtime","imported","manual"]);

const arr = (v) => Array.isArray(v) ? v.filter(Boolean).map(String) : typeof v === "string" ? v.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean) : [];
const num = (v, f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
const clamp = (v,min,max) => Math.max(min, Math.min(max, num(v,min)));

export function normalizeWorldbookVisibility(v="public") {
  const a = { hidden:"hiddenTruth", secret:"hiddenTruth", playerKnown:"player_known", characterKnown:"character_known", factionKnown:"faction_known", gmOnly:"gm_only", systemOnly:"system_only", answerLock:"system_only", truthLock:"system_only" };
  const x = a[String(v)] || String(v || "public");
  return WORLDBOOK_VISIBILITY.includes(x) ? x : "public";
}

export function normalizeWorldbookContextSlot(v="global_lore") {
  const a = { base:"global_lore", context:"global_lore", instant:"runtime_hints", rules:"world_rules", characters:"active_characters", factions:"active_factions", faction:"active_factions", timeline:"recent_timeline", gm:"gm_only_context", debug:"debug_only" };
  const x = a[String(v)] || String(v || "global_lore");
  return WORLDBOOK_CONTEXT_SLOTS.includes(x) ? x : "global_lore";
}

export function normalizeWorldbookFilters(input = {}) {
  return Object.freeze({
    requiredAny: arr(input.requiredAny || input.andAny || input.optionalAny),
    requiredAll: arr(input.requiredAll || input.andAll),
    excludeAny: arr(input.excludeAny || input.notAny),
    excludeAll: arr(input.excludeAll || input.notAll)
  });
}

export function normalizeWorldbookEntry(input = {}, options = {}) {
  const id = String(input.entryId || input.id || input.uid || `wb_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
  const keys = arr(input.keys || input.key || input.trigger || input.activationKeys);
  const title = String(input.title || input.name || input.comment || keys[0] || id);
  const content = String(input.content || input.text || input.description || "");
  const probability = num(input.triggerProbability ?? input.probability ?? input.triggerProb ?? 1, 1);
  return Object.freeze({
    entryId: id, id,
    worldId: String(input.worldId || options.worldId || ""),
    entryType: WORLDBOOK_ENTRY_TYPES.includes(input.entryType || input.type) ? (input.entryType || input.type) : "note",
    title, content,
    summary: String(input.summary || ""),
    keys,
    regexKeys: arr(input.regexKeys || input.regex || input.regex_keys).concat(keys.filter(k => /^\/.*\/[a-z]*$/i.test(k))),
    filters: normalizeWorldbookFilters(input.filters || input),
    sourceRefs: arr(input.sourceRefs || input.sourceRef || input.sources || input.source),
    moduleRefs: arr(input.moduleRefs || input.sourceModule),
    candidateRefs: arr(input.candidateRefs || input.candidateId),
    visibility: normalizeWorldbookVisibility(input.visibility || "public"),
    authority: WORLDBOOK_AUTHORITY.includes(input.authority) ? input.authority : (options.defaultAuthority || (input.status === "candidate" ? "candidate" : "canon")),
    status: String(input.status || "active"),
    enabled: input.enabled !== false && input.disable !== true,
    priority: num(input.priority ?? input.order, 100),
    insertionOrder: num(input.insertionOrder ?? input.order ?? input.priority, 100),
    insertionPosition: ["pre_context","context","post_history","final_guard","in_chat"].includes(input.insertionPosition || input.position) ? (input.insertionPosition || input.position) : "context",
    contextSlot: normalizeWorldbookContextSlot(input.contextSlot || input.slot || input.layer),
    tokenBudget: Math.max(0, num(input.tokenBudget ?? input.budget, 600)),
    trimDirection: ["start","end","middle","none"].includes(input.trimDirection) ? input.trimDirection : "end",
    inclusionGroups: arr(input.inclusionGroups || input.inclusionGroup || input.group),
    groupWeight: Math.max(0, num(input.groupWeight ?? input.weight, 100)),
    prioritizeInclusion: input.prioritizeInclusion === true,
    useGroupScoring: input.useGroupScoring !== false,
    matchMode: String(input.matchMode || input.match_mode || "exact"),
    matchLogic: String(input.matchLogic || input.logic || input.match || "any"),
    scanDepth: input.scanDepth ?? input.depth ?? "mid",
    caseSensitive: input.caseSensitive === true,
    matchWholeWords: input.matchWholeWords === true,
    alwaysOn: input.alwaysOn === true || input.mode === "persistent" || input.mode === "常驻",
    triggerProbability: probability > 1 ? clamp(probability/100,0,1) : clamp(probability,0,1),
    modeFilter: arr(input.modeFilter || input.modeIds),
    characterFilter: arr(input.characterFilter || input.characterNames),
    generationFilter: arr(input.generationFilter || input.generationTypes),
    stickyTurns: Math.max(0,num(input.stickyTurns,0)),
    cooldownTurns: Math.max(0,num(input.cooldownTurns,0)),
    delayTurns: Math.max(0,num(input.delayTurns,0)),
    recursive: input.recursive === true,
    preventRecursion: input.preventRecursion === true,
    metadata: Object.freeze({ ...(input.metadata || {}) }),
    createdAt: input.createdAt || options.now || new Date().toISOString(),
    updatedAt: input.updatedAt || options.now || new Date().toISOString()
  });
}

export function validateWorldbookEntry(entry = {}) {
  const n = normalizeWorldbookEntry(entry);
  const errors = [], warnings = [];
  if (!n.title) errors.push("title is required");
  if (!n.content.trim()) errors.push("content is required");
  if (!n.alwaysOn && !n.keys.length && !n.regexKeys.length && n.matchMode !== "vector") warnings.push("entry has no trigger keys and is not alwaysOn");
  if (n.authority === "canon" && !n.sourceRefs.length) warnings.push("canon entry should include sourceRefs");
  if (n.title && n.content && !n.content.includes(n.title)) warnings.push("content should be self-contained and include title/entity name");
  return Object.freeze({ ok: errors.length === 0, errors, warnings, normalized: n });
}

export function worldbookEntryToPromptText(entry = {}) {
  const e = normalizeWorldbookEntry(entry);
  return `【${e.title}】\n${e.summary ? `摘要：${e.summary}\n` : ""}${e.content}`.trim();
}

export function normalizeWorldbookCandidate(input = {}, options = {}) {
  const draft = normalizeWorldbookEntry(input.draftEntry || input.after || input.entry || input, { worldId: input.worldId || options.worldId || "", defaultAuthority: "candidate" });
  const risk = String(input.riskLevel || input.risk || "medium");
  return Object.freeze({
    candidateId: String(input.candidateId || input.id || `wbc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`),
    candidateType: String(input.candidateType || input.type || "entry_create"),
    worldId: String(input.worldId || options.worldId || draft.worldId || ""),
    sourceType: String(input.sourceType || input.source?.type || "module"),
    sourceModule: String(input.sourceModule || input.module || ""),
    sourceRefs: arr(input.sourceRefs || input.sourceRef || input.source?.hash || draft.sourceRefs),
    draftEntry: draft,
    visibility: normalizeWorldbookVisibility(input.visibility || draft.visibility),
    authority: "candidate",
    riskLevel: ["light","medium","major","critical","high"].includes(risk) ? (risk === "high" ? "major" : risk) : "medium",
    status: String(input.status || "pending"),
    requiresApproval: input.requiresApproval !== false,
    conflicts: Array.isArray(input.conflicts) ? input.conflicts.map(x=>({ ...x })) : [],
    evidence: Array.isArray(input.evidence) ? input.evidence.map(x=>({ ...x })) : [],
    createdAt: input.createdAt || options.now || new Date().toISOString(),
    updatedAt: input.updatedAt || options.now || new Date().toISOString()
  });
}

export function validateWorldbookCandidate(candidate = {}) {
  const n = normalizeWorldbookCandidate(candidate);
  const entryCheck = validateWorldbookEntry(n.draftEntry);
  const errors = [...entryCheck.errors], warnings = [...entryCheck.warnings];
  if (["major","critical"].includes(n.riskLevel) && !n.requiresApproval) errors.push("major/critical candidate must require approval");
  return Object.freeze({ ok: errors.length === 0, errors, warnings, normalized: n });
}
