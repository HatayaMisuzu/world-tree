import { normalizeWorldbookEntry } from "./worldbook-entry-schema.js";
import { activateWorldbookEntries } from "./worldbook-trigger-engine.js";
import { buildSafeWorldbookPromptText } from "./worldbook-visibility-guard.js";

const DEFAULT_BUDGETS = Object.freeze({ world_rules:1600, global_lore:2200, active_scene:1600, active_characters:2200, relationship_context:1800, active_factions:1800, recent_timeline:1600, runtime_hints:1200, candidate_warnings:800, gm_only_context:1600, debug_only:400 });

export function compileWorldbookContextPack(input={}) {
  const { entries=[], modeId="world-rpg", taskId="writer", generationType="normal", worldId="", turnId="", userInput="", messages=[], engineState={}, audience="writer", budgets={}, rng=Math.random } = input;
  const normalized = entries.map(e => normalizeWorldbookEntry(e,{worldId}));
  const act = activateWorldbookEntries(normalized, { modeId, taskId, generationType, worldId, turnId, input:userInput, messages, engineState, characterName:engineState.characterName||"", characterTags:engineState.characterTags||[], turnCount:Number(engineState.turnCount||0) }, { rng });
  const slotBudgets = { ...DEFAULT_BUDGETS, ...budgets }, slots = {}, activationLog = [], omitted = [...act.omitted], visibilityWarnings = [], tokenUsage = {};
  for (const item of act.activations) {
    const safe = buildSafeWorldbookPromptText(item.entry, { audience, modeId, taskId });
    if (!safe.ok) { omitted.push({ entryId:item.entryId, title:item.title, reason:safe.reason, visibility:item.entry.visibility }); visibilityWarnings.push({ entryId:item.entryId, title:item.title, reason:safe.reason }); continue; }
    const slot = item.contextSlot || "global_lore";
    slots[slot] ||= [];
    tokenUsage[slot] ||= { chars:0, entries:0, budget: slotBudgets[slot] ?? 1200 };
    const cost = safe.text.length, budget = tokenUsage[slot].budget;
    if (budget > 0 && tokenUsage[slot].chars + cost > budget && slots[slot].length > 0) { omitted.push({ entryId:item.entryId, title:item.title, reason:"budget:slot", slot, cost }); continue; }
    const compiled = Object.freeze({ entryId:item.entryId, title:item.title, text:safe.text, slot, priority:item.priority, insertionOrder:item.insertionOrder, visibility:item.entry.visibility, sourceRefs:item.entry.sourceRefs, reason:item.reason });
    slots[slot].push(compiled);
    tokenUsage[slot].chars += cost; tokenUsage[slot].entries += 1;
    activationLog.push({ entryId:item.entryId, title:item.title, matchedBy:item.matchedBy, matchedKeys:item.matchedKeys, contextSlot:slot, reason:item.reason, included:true, cost });
  }
  for (const slot of Object.keys(slots)) slots[slot].sort((a,b)=>a.insertionOrder-b.insertionOrder || b.priority-a.priority);
  return Object.freeze({ schemaVersion:2, kind:"worldbook-context-pack", contextPackId:`wbctx_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, worldId, modeId, taskId, generationType, turnId, slots, activationLog, omitted, visibilityWarnings, tokenUsage, diagnostics:{ activeEntryCount:normalized.filter(e=>e.enabled).length, activatedCount:activationLog.length, omittedCount:omitted.length, scanTextLength:act.scanTextLength }, createdAt:new Date().toISOString() });
}

export const flattenWorldbookContextPack = (pack={}) => Object.values(pack.slots || {}).flat();
