// Detective V2 Evidence Board
// Manages evidence discovery state, tags, credibility, and links.

export function createEvidenceBoard(runState = {}) {
  return {
    boardId: `eb_${runState.runId || Date.now()}`,
    entries: (runState.publicState?.discoveredEvidenceIds || []).map((id) => ({
      evidenceId: id,
      tags: [],
      credibility: "unverified",
      notes: "",
      linkedToTestimony: [],
      linkedToHypothesis: [],
    })),
  };
}

export function addEvidenceToBoard({ runState, evidenceId, tags = [], credibility = "unverified" } = {}) {
  const board = createEvidenceBoard(runState);
  const existing = board.entries.find((e) => e.evidenceId === evidenceId);
  if (existing) {
    existing.tags = [...new Set([...existing.tags, ...tags])];
    existing.credibility = credibility;
  } else {
    board.entries.push({ evidenceId, tags, credibility, notes: "", linkedToTestimony: [], linkedToHypothesis: [] });
  }
  return board;
}

export function linkEvidenceToTestimony({ runState, evidenceId, testimonyId, relation = "supports" } = {}) {
  const board = createEvidenceBoard(runState);
  const entry = board.entries.find((e) => e.evidenceId === evidenceId);
  if (entry && !entry.linkedToTestimony.find((l) => l.testimonyId === testimonyId)) {
    entry.linkedToTestimony.push({ testimonyId, relation });
  }
  return board;
}

export function filterEvidenceBoard({ runState, filter = {} } = {}) {
  const board = createEvidenceBoard(runState);
  let entries = board.entries;
  if (filter.tag) entries = entries.filter((e) => e.tags.includes(filter.tag));
  if (filter.credibility) entries = entries.filter((e) => e.credibility === filter.credibility);
  return { ...board, entries };
}
