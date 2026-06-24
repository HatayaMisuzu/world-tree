import { buildVisibleClueContext, createClueBoard } from "./clue-board.js";

export function createSoloMysteryPuzzleContext(project = {}, input = {}, options = {}) {
  const clueBoard = buildVisibleClueContext(createClueBoard(options.clueBoard || project.runtime?.clueBoard || project.clueBoard));
  return { modeId: "mystery-puzzle", modeMeaning: "solo_mystery_puzzle", timestamp: new Date().toISOString(), inputText: input.text || "", clueBoard };
}
export function createSoloMysteryPuzzleTurnPacket(project = {}, input = {}, options = {}) {
  const context = createSoloMysteryPuzzleContext(project, input, options);
  return { schemaVersion: 1, mode: "mystery-puzzle", modeMeaning: "solo_mystery_puzzle", proposals: [], runtime: { cacheKey: `mystery-puzzle.turn.${Date.now()}`, clueBoard: context.clueBoard, canonWrites: [] } };
}
export function runSoloMysteryPuzzleTurn(project = {}, input = {}, options = {}) {
  const packet = createSoloMysteryPuzzleTurnPacket(project, input, options);
  return { status: "ready", packet, cacheKey: packet.runtime.cacheKey };
}
export function createSoloMysteryPuzzleModeSummary(project = {}, options = {}) {
  return { mode: "mystery-puzzle", modeMeaning: "solo_mystery_puzzle", ready: true };
}
