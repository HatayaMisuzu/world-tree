// Detective V2 Timeline Board
// Player-constructed timeline from evidence and testimony.

export function addTimelineEntry({ runState, sourceId, sourceType, claimedTime, confidence = 0.5, note = "" } = {}) {
  const entries = runState.publicState?.timelineEntries || [];
  return [...entries, {
    entryId: `tl_${Date.now()}`,
    sourceId,
    sourceType,  // "evidence" | "testimony" | "interview" | "deduction"
    claimedTime,
    confidence,
    note: note.slice(0, 500),
    addedAt: new Date().toISOString(),
  }];
}

export function updateTimelineEntry({ runState, entryId, patch = {} } = {}) {
  const entries = runState.publicState?.timelineEntries || [];
  return entries.map((e) => e.entryId === entryId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e);
}

export function comparePublicTimelineToTruth({ runState, truthLedger } = {}) {
  if (!truthLedger) return { matchRate: 0, analysis: "no truth ledger" };

  const entries = runState?.publicState?.timelineEntries || [];
  const realTimeline = truthLedger.realTimeline || [];
  
  // Simple comparison: check if any entry times overlap with truth
  const matches = entries.filter((e) => realTimeline.some(
    (rt) => rt.time === e.claimedTime || Math.abs((new Date(rt.time) - new Date(e.claimedTime)) / 3600000) < 2
  ));

  return {
    matchRate: entries.length > 0 ? matches.length / entries.length : 0,
    totalEntries: entries.length,
    matchingEntries: matches.length,
    truthEntries: realTimeline.length,
  };
}
