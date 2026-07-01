function getDataRoot(deps = {}) {
  return typeof deps.dataRoot === "function" ? deps.dataRoot() : deps.dataRoot;
}

export async function handleDetectiveV2ProductRoute({ path, method, readBody, jsonResponse, deps }) {
  const dataRoot = getDataRoot(deps);

  if (path === "/api/detective-v2/import-preview" && method === "POST") {
    const { previewDetectiveV2Import } = await import("./detective-v2-service.js");
    return jsonResponse(await previewDetectiveV2Import(await readBody()));
  }
  if (path === "/api/detective-v2/import-commit" && method === "POST") {
    const { commitDetectiveV2Import } = await import("./detective-v2-service.js");
    return jsonResponse(await commitDetectiveV2Import(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/start" && method === "POST") {
    const { startDetectiveV2Run } = await import("./detective-v2-service.js");
    return jsonResponse(await startDetectiveV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/investigate" && method === "POST") {
    const { investigateDetectiveV2 } = await import("./detective-v2-service.js");
    return jsonResponse(await investigateDetectiveV2(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/detective-v2/interrogate" && method === "POST") {
    const { interrogateDetectiveV2 } = await import("./detective-v2-service.js");
    return jsonResponse(await interrogateDetectiveV2(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/detective-v2/notebook/extract" && method === "POST") {
    const { extractDetectiveV2Notebook } = await import("./detective-v2-service.js");
    return jsonResponse(await extractDetectiveV2Notebook(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/notebook/update" && method === "POST") {
    const { updateDetectiveV2Notebook } = await import("./detective-v2-service.js");
    return jsonResponse(await updateDetectiveV2Notebook(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/deduction/submit" && method === "POST") {
    const { submitDetectiveV2Deduction } = await import("./detective-v2-service.js");
    return jsonResponse(await submitDetectiveV2Deduction(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/generate-preview" && method === "POST") {
    const { previewDetectiveV2Generate } = await import("./detective-v2-service.js");
    return jsonResponse(await previewDetectiveV2Generate(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/detective-v2/generate-commit" && method === "POST") {
    const { commitDetectiveV2Generate } = await import("./detective-v2-service.js");
    return jsonResponse(await commitDetectiveV2Generate(await readBody(), {
      dataRoot,
      config: await deps.loadConfig(),
      apiKey: await deps.getActiveLlmValue()
    }));
  }
  if (path === "/api/detective-v2/quality-check" && method === "POST") {
    const { checkDetectiveV2Quality } = await import("./detective-v2-service.js");
    return jsonResponse(await checkDetectiveV2Quality(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/review-case-quality" && method === "POST") {
    const { reviewDetectiveV2Case } = await import("./detective-v2-service.js");
    return jsonResponse(await reviewDetectiveV2Case(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/export-run" && method === "POST") {
    const { exportDetectiveV2Run } = await import("./detective-v2-service.js");
    return jsonResponse(await exportDetectiveV2Run(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/export-case-player-pack" && method === "POST") {
    const { exportDetectiveV2PlayerPack } = await import("./detective-v2-service.js");
    return jsonResponse(await exportDetectiveV2PlayerPack(await readBody(), { dataRoot }));
  }
  if (path === "/api/detective-v2/export-case-gm-pack" && method === "POST") {
    const { exportDetectiveV2GMPack } = await import("./detective-v2-service.js");
    return jsonResponse(await exportDetectiveV2GMPack(await readBody(), { dataRoot }));
  }

  return false;
}
