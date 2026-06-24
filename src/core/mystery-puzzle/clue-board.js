function safeText(value, max = 240) { return String(value || "").trim().slice(0, max); }

export function createClueBoard(input = {}) {
  return {
    discoveredClues: Array.isArray(input.discoveredClues) ? input.discoveredClues.map(normalizeClue).filter(Boolean) : [],
    hypotheses: Array.isArray(input.hypotheses) ? input.hypotheses.map(normalizeHypothesis).filter(Boolean) : []
  };
}

export function normalizeClue(input = {}) {
  if (input.revealsTruth === true || input.visibility === "hidden" || input.hiddenTruth !== undefined) return null;
  const name = safeText(input.name || input.title, 120);
  if (!name) return null;
  return { id: safeText(input.id || `clue_${Date.now()}`, 80), name, location: safeText(input.location, 120), foundAtTurn: Number(input.foundAtTurn || 0), linksTo: Array.isArray(input.linksTo) ? input.linksTo.map(v => safeText(v, 80)).filter(Boolean) : [], isRedHerring: input.isRedHerring === true, revealsTruth: false };
}

export function normalizeHypothesis(input = {}) {
  const statement = safeText(input.statement, 240);
  if (!statement) return null;
  return { id: safeText(input.id || `hyp_${Date.now()}`, 80), statement, supportingClues: Array.isArray(input.supportingClues) ? input.supportingClues.map(v => safeText(v, 80)).filter(Boolean) : [], contradictingClues: Array.isArray(input.contradictingClues) ? input.contradictingClues.map(v => safeText(v, 80)).filter(Boolean) : [], status: ["open", "supported", "contradicted", "resolved"].includes(input.status) ? input.status : "open" };
}

export function addDiscoveredClue(board = {}, clue = {}) {
  const next = createClueBoard(board);
  const normalized = normalizeClue(clue);
  if (!normalized) return { ok: false, board: next, error: "hidden or invalid clue" };
  if (!next.discoveredClues.some(item => item.id === normalized.id)) next.discoveredClues.push(normalized);
  return { ok: true, board: next, clue: normalized };
}

export function addHypothesis(board = {}, hypothesis = {}) {
  const next = createClueBoard(board);
  const normalized = normalizeHypothesis(hypothesis);
  if (!normalized) return { ok: false, board: next, error: "invalid hypothesis" };
  next.hypotheses.push(normalized);
  return { ok: true, board: next, hypothesis: normalized };
}

export function buildVisibleClueContext(board = {}) {
  const safe = createClueBoard(board);
  return { discoveredClues: safe.discoveredClues, hypotheses: safe.hypotheses };
}
