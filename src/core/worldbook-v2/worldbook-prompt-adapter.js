import { createPromptBlock } from "../prompts/prompt-contract.js";
import { flattenWorldbookContextPack } from "./worldbook-context-compiler.js";

const SLOT_TO_POSITION = Object.freeze({ world_rules:"context", global_lore:"context", active_scene:"context", active_characters:"context", relationship_context:"context", active_factions:"context", recent_timeline:"context", runtime_hints:"post_history", candidate_warnings:"post_history", gm_only_context:"context", debug_only:"context" });
const SLOT_ORDER = Object.freeze({ world_rules:20, global_lore:40, active_scene:60, active_characters:80, relationship_context:100, active_factions:120, recent_timeline:140, runtime_hints:160, candidate_warnings:180, gm_only_context:200, debug_only:900 });

export function worldbookContextToPromptBlocks(worldbookContext, options={}) {
  if (!worldbookContext) return [];
  if (Array.isArray(worldbookContext)) return legacyEntriesToPromptBlocks(worldbookContext, options);
  if (worldbookContext.kind === "worldbook-context-pack" || worldbookContext.schemaVersion === 2) {
    const blocks = [];
    for (const [slot, entries] of Object.entries(worldbookContext.slots || {})) {
      if (!Array.isArray(entries) || !entries.length) continue;
      const content = entries.map(e=>e.text||"").filter(Boolean).join("\n\n");
      if (!content.trim()) continue;
      blocks.push(createPromptBlock({ id:`worldbook.v2.${slot}`, title:`Worldbook V2 ${slot}`, layer:"worldbook", modeIds:worldbookContext.modeId?[worldbookContext.modeId]:[], taskIds:worldbookContext.taskId?[worldbookContext.taskId]:[], trigger:{ type:"worldbook-context-pack", contextPackId:worldbookContext.contextPackId }, role:"system", position:SLOT_TO_POSITION[slot] || "context", priority:slot==="gm_only_context"?650:420, order:SLOT_ORDER[slot] || 100, required:false, content:`【Worldbook V2 / ${slot}】\n${content}`, tags:["worldbook-v2", slot] }));
    }
    return blocks;
  }
  return legacyEntriesToPromptBlocks(flattenWorldbookContextPack(worldbookContext), options);
}

function legacyEntriesToPromptBlocks(entries=[], options={}) {
  if (!entries.length) return [];
  return [createPromptBlock({ id:"worldbook.v2.legacy", title:"Worldbook V2 Legacy Context", layer:"worldbook", modeIds:options.modeId?[options.modeId]:[], taskIds:options.taskId?[options.taskId]:[], trigger:{ type:"worldbook-legacy" }, role:"system", position:"context", priority:420, order:100, required:false, content:`【Worldbook】\n${entries.map(e=>e.text || e.content || "").filter(Boolean).join("\n\n")}`, tags:["worldbook-v2","legacy"] })];
}
