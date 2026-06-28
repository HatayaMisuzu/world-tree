import { normalizeWorldbookEntry, worldbookEntryToPromptText } from "./worldbook-entry-schema.js";
import { sanitizeForLlm, assertNoHiddenKeys } from "../prompts/prompt-hidden-sanitizer.js";
import { checkConsistency, shouldBlockOutput } from "../narrative-radar/narrative-consistency-radar.js";

const ALLOW = Object.freeze({
  player: new Set(["public","player_known"]),
  writer: new Set(["public","player_known","character_known","faction_known"]),
  character: new Set(["public","player_known","character_known"]),
  director: new Set(["public","player_known","character_known","faction_known","private"]),
  gm: new Set(["public","player_known","character_known","faction_known","private","hiddenTruth","gm_only"]),
  system: new Set(["public","player_known","character_known","faction_known","private","hiddenTruth","gm_only","system_only","forbidden"])
});

export function canExposeWorldbookEntry(entry, { audience="writer" } = {}) {
  const e = normalizeWorldbookEntry(entry);
  const allow = ALLOW[audience] || ALLOW.writer;
  if (!allow.has(e.visibility)) return { ok:false, reason:`visibility:${e.visibility}`, entry:e };
  if (e.authority === "candidate" && !["system","gm"].includes(audience)) return { ok:false, reason:"candidate_not_canon", entry:e };
  return { ok:true, entry:e };
}

export function scrubWorldbookEntriesForAudience(entries=[], options={}) {
  const kept=[], omitted=[];
  for (const raw of entries) { const c = canExposeWorldbookEntry(raw, options); if (c.ok) kept.push(c.entry); else omitted.push({ entryId:c.entry.entryId, title:c.entry.title, reason:c.reason, visibility:c.entry.visibility }); }
  return { kept, omitted };
}

export function buildSafeWorldbookPromptText(entry, options={}) {
  const c = canExposeWorldbookEntry(entry, options);
  if (!c.ok) return { ok:false, reason:c.reason, text:"" };
  const text = sanitizeForLlm(worldbookEntryToPromptText(c.entry));
  const radar = checkConsistency(String(text));
  if (shouldBlockOutput(radar)) return { ok:false, reason:"narrative_radar_block", radar, text:"" };
  return { ok:true, text, radar };
}

export function assertNoWorldbookHiddenLeak(value={}) {
  // Only scan content-bearing slots, not metadata like omitted/visibilityWarnings
  const contentOnly = value?.slots
    ? { slots: value.slots }
    : value;
  const sanitized = sanitizeForLlm(contentOnly);
  const hidden = assertNoHiddenKeys(sanitized);
  const text = typeof sanitized === "string" ? sanitized : JSON.stringify(sanitized);
  const hits = ["hiddenTruth","answerLock","truthLock","gm_only","system_only","forbidden"].filter(x => text.includes(x));
  return { ok:hidden.ok && hits.length === 0, hiddenKeys:hidden.hiddenKeys, textHits:hits };
}
