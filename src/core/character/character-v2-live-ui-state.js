/**
 * Character Capsule V2 live UI state helpers.
 * Pure functions only.
 */

const MAX_HISTORY = 12;

export function createCharacterV2LiveUiState() {
  return {
    characterId: "",
    input: "",
    busy: false,
    error: "",
    reply: null,
    history: [],
    candidates: null,
    packetSummary: null,
    quality: null,
    advancedOpen: false,
    dryRun: false
  };
}

export function beginCharacterV2LiveTurn(state, { characterId, input, dryRun = false } = {}) {
  return { ...state, characterId: characterId || state.characterId, input: input || state.input, busy: true, error: "", dryRun };
}

export function appendCharacterV2LiveHistory(history = [], userInput = "", reply = "") {
  return [...history, { role: "user", content: userInput }, { role: "assistant", content: reply }].slice(-MAX_HISTORY * 2);
}

export function summarizeCharacterV2LiveCandidates(result = {}) {
  const c = result.candidates || {};
  return {
    memory: c.normalSummary?.counts?.memory ?? c.memoryCandidates?.length ?? 0,
    relationship: c.normalSummary?.counts?.relationship ?? c.relationshipCandidates?.length ?? 0,
    quality: c.normalSummary?.counts?.quality ?? c.qualityCandidates?.length ?? 0,
    safeForNormalUi: true
  };
}

export function completeCharacterV2LiveTurn(state, result = {}) {
  const reply = result.reply || "";
  return {
    ...state,
    busy: false,
    error: "",
    reply,
    candidates: summarizeCharacterV2LiveCandidates(result),
    packetSummary: result.packetSummary || null,
    quality: result.quality || null,
    history: appendCharacterV2LiveHistory(state.history, state.input, reply),
    input: ""
  };
}

export function failCharacterV2LiveTurn(state, error) {
  return { ...state, busy: false, error: String(error?.message || error || "角色回复生成失败。") };
}
