import { normalizeWorldbookEntry } from "./worldbook-entry-schema.js";
import { compileWorldbookContextPack } from "./worldbook-context-compiler.js";
import { createWorldbookUsageLog, appendWorldbookUsage } from "./worldbook-usage-log.js";

export function collectWorldbookEntriesFromModel(model={}, state={}) {
  const raw = [ ...(model.moduleData?.worldbook?.entries || []), ...(model._overlay?.worldbook?.entries || []), ...(state.importedEntries || []), ...(state.canonEntries || []), ...(state.runtimeEntries || []) ];
  return raw.map(e => normalizeWorldbookEntry(e, { worldId: state.worldId || model.id || "" }));
}

export function prepareWorldbookV2Injection(input={}) {
  const { model=null, worldbook=null, worldbookStore=null, entries=null, input:userInput="", engineState={}, messages=[], modeId="world-rpg", taskId="writer", generationType="normal", worldId="", turnId="", audience="writer", usageLog=null, rng=Math.random } = input;
  const collected = entries ? entries.map(e=>normalizeWorldbookEntry(e,{worldId})) : worldbookStore?.entries ? worldbookStore.entries.map(e=>normalizeWorldbookEntry(e,{worldId})) : worldbook?.entries ? worldbook.entries.map(e=>normalizeWorldbookEntry(e,{worldId})) : model ? collectWorldbookEntriesFromModel(model,{worldId}) : [];
  const pack = compileWorldbookContextPack({ entries:collected, modeId, taskId, generationType, worldId:worldId || model?.id || "", turnId, userInput, messages, engineState, audience, rng });
  const usage = appendWorldbookUsage(usageLog || createWorldbookUsageLog({ worldId:worldId || model?.id || "" }), pack, { turnId });
  return { ok:true, worldbookContextPack:pack, injectedWorldbook:Object.values(pack.slots || {}).flat(), diagnostics:pack.diagnostics, usageLog:usage.log, usageRecord:usage.record };
}
