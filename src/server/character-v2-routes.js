import { join } from "node:path";

function getDataRoot(deps = {}) {
  return typeof deps.dataRoot === "function" ? deps.dataRoot() : deps.dataRoot;
}

function charactersRoot(dataRoot) {
  return join(dataRoot, "engine", "characters");
}

export async function handleCharacterV2ProductRoute({ path, method, url, readBody, jsonResponse, deps }) {
  const dataRoot = getDataRoot(deps);
  const root = charactersRoot(dataRoot);

  if (path === "/api/characters/v2/turn" && method === "POST") {
    const body = await readBody();
    const { handleCharacterV2LiveTurn } = await import("./character-v2-live-turn-service.js");
    return jsonResponse(await handleCharacterV2LiveTurn(body, {
      charactersRoot: root,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/characters/v2/candidates/save" && method === "POST") {
    const body = await readBody();
    const { saveCharacterV2CandidatesForReview } = await import("./character-v2-candidate-workbench-service.js");
    return jsonResponse(saveCharacterV2CandidatesForReview(root, body.characterId, body.candidates || {}));
  }
  if (path === "/api/characters/v2/candidates/list" && method === "POST") {
    const body = await readBody();
    const { listCharacterV2CandidateReview } = await import("./character-v2-candidate-workbench-service.js");
    return jsonResponse(listCharacterV2CandidateReview(root, body.characterId));
  }
  if (path === "/api/characters/v2/candidates/decision" && method === "POST") {
    const body = await readBody();
    const { decideCharacterV2Candidate } = await import("./character-v2-candidate-workbench-service.js");
    return jsonResponse(decideCharacterV2Candidate(root, body.characterId, body.candidateId, body.decision));
  }
  if (path === "/api/characters/v2/export" && method === "POST") {
    const body = await readBody();
    const { exportCharacterV2 } = await import("./character-v2-export-service.js");
    return jsonResponse(exportCharacterV2(root, body.characterId, body.format, body));
  }
  if (path === "/api/characters/v2/candidates" && method === "GET") {
    const body = { characterId: url.searchParams.get("characterId") || "" };
    const { listCharacterV2Candidates } = await import("./character-v2-candidate-review-service.js");
    return jsonResponse(await listCharacterV2Candidates(body, { dataRoot }));
  }
  if (path === "/api/characters/v2/candidates/review" && method === "POST") {
    const body = await readBody();
    const { reviewCharacterV2Candidate } = await import("./character-v2-candidate-review-service.js");
    return jsonResponse(await reviewCharacterV2Candidate(body, { dataRoot }));
  }
  if (path === "/api/characters/v2/candidates/bulk-review" && method === "POST") {
    const body = await readBody();
    const { bulkReviewCharacterV2Candidates } = await import("./character-v2-candidate-review-service.js");
    return jsonResponse(await bulkReviewCharacterV2Candidates(body, { dataRoot }));
  }
  if (path === "/api/characters/v2/candidates/undo" && method === "POST") {
    const body = await readBody();
    const { undoCharacterV2Decision } = await import("./character-v2-candidate-review-service.js");
    return jsonResponse(await undoCharacterV2Decision(body, { dataRoot }));
  }

  return false;
}
