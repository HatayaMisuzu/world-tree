function getDataRoot(deps = {}) {
  return typeof deps.dataRoot === "function" ? deps.dataRoot() : deps.dataRoot;
}

export async function handleTabletopV2ProductRoute({ path, method, readBody, jsonResponse, deps }) {
  const dataRoot = getDataRoot(deps);

  if (path === "/api/tabletop-v2/import-preview" && method === "POST") {
    const { previewTabletopV2Import } = await import("./tabletop-v2-service.js");
    return jsonResponse(await previewTabletopV2Import(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/start" && method === "POST") {
    const { startTabletopV2Run } = await import("./tabletop-v2-service.js");
    return jsonResponse(await startTabletopV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/turn" && method === "POST") {
    const { handleTabletopV2Turn } = await import("./tabletop-v2-service.js");
    return jsonResponse(await handleTabletopV2Turn(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/tabletop-v2/save" && method === "POST") {
    const { saveTabletopV2Run } = await import("./tabletop-v2-service.js");
    return jsonResponse(await saveTabletopV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/branch" && method === "POST") {
    const { branchTabletopV2Run } = await import("./tabletop-v2-service.js");
    return jsonResponse(await branchTabletopV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/end-summary" && method === "POST") {
    const { endTabletopV2Run } = await import("./tabletop-v2-service.js");
    return jsonResponse(await endTabletopV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/import-commit" && method === "POST") {
    const { commitTabletopV2Import } = await import("./tabletop-v2-service.js");
    return jsonResponse(await commitTabletopV2Import(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/runs" && method === "GET") {
    const { listTabletopV2Runs } = await import("./tabletop-v2-service.js");
    return jsonResponse(await listTabletopV2Runs({ dataRoot }));
  }
  if (path === "/api/tabletop-v2/load-run" && method === "POST") {
    const { loadTabletopV2Run } = await import("./tabletop-v2-service.js");
    return jsonResponse(await loadTabletopV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/restore-save" && method === "POST") {
    const { restoreTabletopV2Save } = await import("./tabletop-v2-service.js");
    return jsonResponse(await restoreTabletopV2Save(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/switch-branch" && method === "POST") {
    const { switchTabletopV2Branch } = await import("./tabletop-v2-service.js");
    return jsonResponse(await switchTabletopV2Branch(await readBody(), { dataRoot }));
  }
  if (path === "/api/tabletop-v2/export-run" && method === "POST") {
    const { exportTabletopV2Run } = await import("./tabletop-v2-service.js");
    return jsonResponse(await exportTabletopV2Run(await readBody(), { dataRoot }));
  }

  return false;
}
