// Detective V2 Testimony Board
// Manages testimony state, credibility markers, contradiction links.

export function createTestimonyBoard(runState = {}) {
  return {
    boardId: `tb_${runState.runId || Date.now()}`,
    entries: (runState.publicState?.discoveredTestimonyIds || []).map((id) => ({
      testimonyId: id,
      credibility: "unverified",
      contradictions: [],
      notes: "",
      verifiedByEvidence: [],
    })),
  };
}

export function markTestimonyCredibility({ runState, testimonyId, credibility = "unverified" } = {}) {
  const board = createTestimonyBoard(runState);
  const entry = board.entries.find((t) => t.testimonyId === testimonyId);
  if (entry) entry.credibility = credibility;
  else board.entries.push({ testimonyId, credibility, contradictions: [], notes: "", verifiedByEvidence: [] });
  return board;
}

export function linkContradiction({ runState, testimonyId, evidenceId } = {}) {
  const board = createTestimonyBoard(runState);
  const entry = board.entries.find((t) => t.testimonyId === testimonyId);
  if (entry && !entry.contradictions.includes(evidenceId)) {
    entry.contradictions.push(evidenceId);
  }
  return board;
}
