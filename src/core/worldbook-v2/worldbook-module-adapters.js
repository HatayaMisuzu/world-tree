import { normalizeWorldbookCandidate, normalizeWorldbookEntry } from "./worldbook-entry-schema.js";
const sr = (...parts) => parts.filter(Boolean).join(":");

export function alchemyCandidateToWorldbookCandidate(candidate={}, options={}) {
  const typeMap = { worldbookCandidate:"note", characterCandidate:"character", locationCandidate:"location", factionCandidate:"faction", ruleCandidate:"rule", relationshipCandidate:"relationship", eventCandidate:"event", sceneTemplateCandidate:"scene" };
  const entryType = typeMap[candidate.type] || "note";
  return normalizeWorldbookCandidate({ candidateId:candidate.id, candidateType:"entry_create", worldId:options.worldId, sourceType:"alchemy", sourceModule:"alchemy-digest", sourceRefs:[sr("alchemy",candidate.materialId), candidate.source?.hash].filter(Boolean), riskLevel:candidate.riskLevel || "medium", visibility:candidate.visibility || "public", status:candidate.status === "confirmed" ? "confirmed" : "pending", requiresApproval:candidate.requiresApproval !== false, conflicts:candidate.conflicts || [], draftEntry:{ entryId:candidate.id, entryType, title:candidate.title || "未命名候选", content:candidate.summary || candidate.title || "", summary:candidate.summary || "", keys:candidate.keys || [candidate.title].filter(Boolean), sourceRefs:[sr("alchemy",candidate.materialId), candidate.source?.hash].filter(Boolean), visibility:candidate.visibility || "public", authority:"candidate", contextSlot:entryType==="rule"?"world_rules":entryType==="character"?"active_characters":entryType==="faction"?"active_factions":"global_lore" } }, options);
}

export function materialWarehouseCandidateToWorldbookCandidate(candidate={}, options={}) {
  return normalizeWorldbookCandidate({ ...candidate, candidateId:candidate.id, sourceType:"material-warehouse", sourceModule:"material-warehouse", sourceRefs:[candidate.sourceId, candidate.source?.hash].filter(Boolean), draftEntry:candidate.draftEntry || { entryId:candidate.id, title:candidate.title, content:candidate.summary || candidate.title || "", summary:candidate.summary || "", keys:candidate.keys || [candidate.title].filter(Boolean), sourceRefs:[candidate.sourceId, candidate.source?.hash].filter(Boolean), contextSlot:"global_lore", visibility:candidate.visibility || "public", authority:"candidate" } }, options);
}

export function characterProfileToWorldbookEntry(profile={}, options={}) {
  const c = profile.canonProfile || profile; const name = c.name || profile.name || profile.characterId || "未命名角色";
  return normalizeWorldbookEntry({ entryId:profile.characterId || `char_${name}`, entryType:"character", title:name, content:`${name} 是一个角色。身份：${c.identity || "未定义"}。外貌：${c.appearance || "未定义"}。性格核心：${c.personalityCore || "未定义"}。欲望：${c.desire || "未定义"}。恐惧：${c.fear || "未定义"}。`, summary:c.personalityCore || c.identity || "", keys:[name], sourceRefs:[sr("character-kernel", profile.characterId || name)], visibility:"public", authority:options.authority || "canon", contextSlot:"active_characters" }, options);
}

export function cognitionMatrixToWorldbookEntries(matrix={}, options={}) {
  return (matrix.entries || []).map((item,i) => normalizeWorldbookEntry({ entryId:`${matrix.characterId || "character"}_knowledge_${i}`, entryType:"character", title:`${matrix.characterId || "角色"} 的认知：${String(item.fact || "").slice(0,40)}`, content:`${matrix.characterId || "该角色"} 对事实「${item.fact}」的认知状态是 ${item.state}。${item.state === "suspected" ? "表达时只能作为怀疑，不可当作事实。" : ""}`, summary:item.fact || "", keys:[matrix.characterId,item.fact].filter(Boolean), sourceRefs:item.sourceRefs || [sr("cognition-matrix", matrix.characterId)], visibility:item.state === "forbidden" ? "forbidden" : item.state === "unknown" ? "private" : "character_known", authority:"runtime", contextSlot:"active_characters" }, options));
}

export function factionGraphToWorldbookEntries(graph={}, options={}) {
  const entries = [];
  for (const f of Object.values(graph.factions || {})) entries.push(normalizeWorldbookEntry({ entryId:f.id, entryType:"faction", title:f.name, content:`${f.name} 是一个${f.type || "组织/阵营"}。目标：${(f.goals || []).join("；") || "未公开"}。`, keys:[f.name,f.id], sourceRefs:[sr("faction-graph", f.id)], visibility:f.knownToPlayer === false ? "hiddenTruth" : "public", authority:"canon", contextSlot:"active_factions" }, options));
  for (const r of graph.relations || []) entries.push(normalizeWorldbookEntry({ entryId:`rel_${r.from}_${r.to}_${r.type}`, entryType:"relationship", title:`${r.from} ↔ ${r.to}`, content:`${r.from} 与 ${r.to} 的关系是 ${r.type}，强度 ${r.strength ?? 0}。`, keys:[r.from,r.to], sourceRefs:[sr("faction-graph", r.from, r.to)], visibility:r.publicKnown === false || r.type === "secret" ? "hiddenTruth" : "public", authority:"canon", contextSlot:"relationship_context" }, options));
  return entries;
}

export function worldRulesToWorldbookEntries(engine={}, options={}) {
  return (engine.rules || []).map(rule => normalizeWorldbookEntry({ entryId:rule.id, entryType:"rule", title:rule.title || rule.id, content:`世界规则「${rule.title || rule.id}」：${rule.rule}。严格度：${rule.strictness || "soft"}；违反策略：${rule.violationPolicy || "warn"}。`, keys:[rule.title, rule.id].filter(Boolean), sourceRefs:[sr("world-rules", rule.id)], visibility:rule.visibility === "hidden" || rule.visibility === "system_only" ? "system_only" : "public", authority:"canon", contextSlot:"world_rules" }, options));
}

export function randomEventToWorldbookCandidate(event={}, options={}) {
  return normalizeWorldbookCandidate({ candidateId:event.id || `event_${Date.now()}`, candidateType:"event_seed", sourceType:"random-event-pool", sourceModule:"random-event-pool", sourceRefs:[sr("random-event",event.id)], riskLevel:event.impactLevel === "major" || event.proposalRequired ? "major" : "light", visibility:event.visibility || "public", status:"pending", requiresApproval:event.impactLevel === "major" || event.proposalRequired, draftEntry:{ entryId:event.id, entryType:"event", title:event.title || event.id, content:`候选事件「${event.title || event.id}」类型为 ${event.type || "flavor"}，影响级别 ${event.impactLevel || "light"}。`, keys:event.keys || [event.title,event.id].filter(Boolean), sourceRefs:[sr("random-event",event.id)], visibility:event.visibility || "public", authority:"candidate", contextSlot:"runtime_hints" } }, options);
}
