function getDataRoot(deps = {}) {
  return typeof deps.dataRoot === "function" ? deps.dataRoot() : deps.dataRoot;
}

export async function handleSinglePlayerScriptKillV2ProductRoute({ path, method, readBody, jsonResponse, deps }) {
  const dataRoot = getDataRoot(deps);

  if (path === "/api/single-player-scriptkill-v2/import-preview" && method === "POST") {
    const { previewSinglePlayerScriptKillV2Import } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await previewSinglePlayerScriptKillV2Import(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/import-commit" && method === "POST") {
    const { commitSinglePlayerScriptKillV2Import } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await commitSinglePlayerScriptKillV2Import(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/start" && method === "POST") {
    const { startSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await startSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/read-role-act" && method === "POST") {
    const { readSinglePlayerScriptKillV2RoleAct } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await readSinglePlayerScriptKillV2RoleAct(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/public-talk" && method === "POST") {
    const { publicTalkSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await publicTalkSinglePlayerScriptKillV2(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/single-player-scriptkill-v2/private-chat" && method === "POST") {
    const { privateChatSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await privateChatSinglePlayerScriptKillV2(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/single-player-scriptkill-v2/search" && method === "POST") {
    const { searchSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await searchSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/reveal-clue" && method === "POST") {
    const { revealClueSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await revealClueSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/advance-phase" && method === "POST") {
    const { advancePhaseSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await advancePhaseSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/vote" && method === "POST") {
    const { voteSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await voteSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/debrief" && method === "POST") {
    const { debriefSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await debriefSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/export-run" && method === "POST") {
    const { exportRunSinglePlayerScriptKillV2 } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await exportRunSinglePlayerScriptKillV2(await readBody(), { dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/runs" && method === "GET") {
    const { listSinglePlayerScriptKillV2Runs } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await listSinglePlayerScriptKillV2Runs({ dataRoot }));
  }
  if (path === "/api/single-player-scriptkill-v2/load-run" && method === "POST") {
    const { loadSinglePlayerScriptKillV2Run } = await import("./single-player-scriptkill-v2-service.js");
    return jsonResponse(await loadSinglePlayerScriptKillV2Run(await readBody(), { dataRoot }));
  }

  return false;
}
