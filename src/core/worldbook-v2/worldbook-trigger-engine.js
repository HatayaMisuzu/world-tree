import { normalizeWorldbookEntry } from "./worldbook-entry-schema.js";

const ranges = { near:3, "近距":3, mid:5, "中距":5, far:10, "远程":10, global:999, "全局":999 };
const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const low = (v, cs=false) => cs ? String(v||"") : String(v||"").toLowerCase();

function regex(key) { const s = String(key||""); if (!/^\/.*\/[a-z]*$/i.test(s)) return null; const i=s.lastIndexOf("/"); try { return new RegExp(s.slice(1,i), s.slice(i+1)); } catch { return null; } }
function matchPlain(text,key,e) { const hay=low(text,e.caseSensitive), needle=low(key,e.caseSensitive); if (!needle) return false; if (!e.matchWholeWords) return hay.includes(needle); return new RegExp(`(^|[^\\p{L}\\p{N}])${esc(needle)}($|[^\\p{L}\\p{N}])`, e.caseSensitive?"u":"iu").test(text); }
function matchKey(text,key,e) { const r=regex(key); return r ? r.test(text) : matchPlain(text,key,e); }

export function buildWorldbookScanText({ input="", messages=[], additionalSources=[], includeNames=true, scanDepth="mid" } = {}) {
  const n = typeof scanDepth === "number" ? scanDepth : ranges[scanDepth] ?? 5;
  const msg = messages.slice(-n).map(m => typeof m === "string" ? m : `${includeNames && m?.name ? `${m.name}: ` : ""}${m?.content || ""}`).filter(Boolean).join("\n");
  return [msg,input,...additionalSources.map(String)].filter(Boolean).join("\n");
}

function filterMatches(text, filters, e) {
  const any = (xs) => xs.some(k => matchKey(text,k,e));
  const all = (xs) => xs.every(k => matchKey(text,k,e));
  if (filters.requiredAny.length && !any(filters.requiredAny)) return { ok:false, reason:"filter:requiredAny" };
  if (filters.requiredAll.length && !all(filters.requiredAll)) return { ok:false, reason:"filter:requiredAll" };
  if (filters.excludeAny.length && any(filters.excludeAny)) return { ok:false, reason:"filter:excludeAny" };
  if (filters.excludeAll.length && all(filters.excludeAll)) return { ok:false, reason:"filter:excludeAll" };
  return { ok:true };
}

function runtimeFilter(e, req={}) {
  if (e.modeFilter.length && !e.modeFilter.includes(req.modeId)) return { ok:false, reason:"filter:mode" };
  if (e.characterFilter.length && !e.characterFilter.includes(req.characterName) && !e.characterFilter.some(t => req.characterTags?.includes(t))) return { ok:false, reason:"filter:character" };
  if (e.generationFilter.length && !e.generationFilter.includes(req.generationType)) return { ok:false, reason:"filter:generation" };
  if (Number(req.turnCount || 0) < e.delayTurns) return { ok:false, reason:"timed:delay" };
  return { ok:true };
}

export function scoreWorldbookEntryMatch(entry, text) {
  const matchedKeys = [];
  for (const key of [...entry.keys, ...entry.regexKeys]) if (matchKey(text,key,entry)) matchedKeys.push(key);
  if (entry.alwaysOn) return { hit:true, matchedBy:"always_on", matchedKeys, score:1 };
  if (entry.matchLogic === "all") {
    const allKeys = [...entry.keys, ...entry.regexKeys];
    const hit = allKeys.length > 0 && matchedKeys.length === allKeys.length;
    return { hit, matchedBy: hit ? "keyword_all" : "none", matchedKeys, score: hit ? matchedKeys.length : 0 };
  }
  if (matchedKeys.length) return { hit:true, matchedBy: matchedKeys.some(k=>regex(k)) ? "regex" : "keyword", matchedKeys, score: matchedKeys.length };
  return { hit:false, matchedBy:"none", matchedKeys, score:0 };
}

export function activateWorldbookEntries(entries=[], request={}, options={}) {
  const normalized = entries.map(e => normalizeWorldbookEntry(e,{worldId:request.worldId}));
  const scanText = buildWorldbookScanText({ input:request.input, messages:request.messages||[], additionalSources:[request.engineState?.sceneName, request.engineState?.currentScene, ...(request.engineState?.contextTags||[])].filter(Boolean), includeNames:request.includeNames!==false, scanDepth:request.scanDepth||options.scanDepth||"mid" });
  const rng = options.rng || Math.random;
  const activations=[], omitted=[];
  for (const entry of normalized) {
    if (!entry.enabled) { omitted.push(omit(entry,"disabled")); continue; }
    const rt = runtimeFilter(entry, request); if (!rt.ok) { omitted.push(omit(entry,rt.reason)); continue; }
    const m = scoreWorldbookEntryMatch(entry, scanText); if (!m.hit) { omitted.push(omit(entry,"no-trigger")); continue; }
    const f = filterMatches(scanText, entry.filters, entry); if (!f.ok) { omitted.push(omit(entry,f.reason)); continue; }
    if (!entry.alwaysOn && rng() > entry.triggerProbability) { omitted.push(omit(entry,"probability",{probability:entry.triggerProbability})); continue; }
    activations.push(Object.freeze({ entry, entryId:entry.entryId, title:entry.title, matchedBy:m.matchedBy, matchedKeys:m.matchedKeys, score:m.score, contextSlot:entry.contextSlot, insertionOrder:entry.insertionOrder, priority:entry.priority, inclusionGroups:entry.inclusionGroups, groupWeight:entry.groupWeight, included:true, reason:`${m.matchedBy}:${m.matchedKeys.join(",") || "always"}` }));
  }
  return Object.freeze({ ...resolveInclusionGroups(activations, omitted, options), scanTextLength: scanText.length });
}

export function resolveInclusionGroups(activations=[], omitted=[], options={}) {
  const groups = new Map(), drop = new Set(), out = [...omitted];
  for (const a of activations) for (const g of a.inclusionGroups||[]) { if(!groups.has(g)) groups.set(g,[]); groups.get(g).push(a); }
  for (const [g, ms] of groups) {
    if (ms.length <= 1) continue;
    const winner = [...ms].sort((a,b) => (options.useGroupScoring!==false && b.score!==a.score) ? b.score-a.score : b.insertionOrder-a.insertionOrder || b.priority-a.priority || b.groupWeight-a.groupWeight)[0];
    for (const m of ms) if (m !== winner) { drop.add(m.entryId); out.push(omit(m.entry,`inclusionGroup:${g}`,{winner:winner.entryId})); }
  }
  return { activations: activations.filter(a=>!drop.has(a.entryId)).sort((a,b)=>a.contextSlot.localeCompare(b.contextSlot) || a.insertionOrder-b.insertionOrder || b.priority-a.priority), omitted: out };
}
function omit(entry, reason, extra={}) { return Object.freeze({ entryId:entry.entryId, title:entry.title, reason, contextSlot:entry.contextSlot, visibility:entry.visibility, ...extra }); }
