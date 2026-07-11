// Bounded server runtime extracted from server.js.
export function createHttpApiRouter(deps = {}) {
  const {
    checkRateLimit,
    RATE_MAX_API,
    jsonError,
    parseOriginHost,
    isLocalRequest,
    LOCAL_HOSTS,
    handleV2ProductPlayableRoute,
    readBody,
    jsonResponse,
    dataRoot,
    loadConfig,
    getActiveLlmValue,
    moduleWorldDir,
    pathWithinRoot,
    safeEntityId,
    saveConfig,
    getSecretState,
    saveLlmSecret,
    maskSecret,
    testLlmConnection,
    handleLlmChatStream,
    handleLlmChat,
    handleLlmChatRetry,
    handleConnections,
    listModules,
    createModule,
    finalizeDraftModule,
    deleteModule,
    buildModuleModel,
    toPublicModuleModel,
    resolveKernelProject,
    getKernelSummary,
    handleBranchOperation,
    getLatestKernelTelemetry,
    refreshKernelTelemetry,
    previewAutoLight,
    getKernelStopLoss,
    approveKernelProposal,
    rejectKernelProposal,
    reverseKernelProposal,
    ingestProcessingMaterial,
    listProcessingCandidates,
    deliverProcessingById,
    handleWorkflowApiRequest,
    getWorkflowTypesResponse,
    getWorkflowStatus,
    listExamples,
    installExample,
    handleAlchemyImport,
    handleAlchemyPreviewAction,
    handleAlchemyDigest,
    handleAlchemyReview,
    getAlchemyCapabilities,
    alchemyPlannerService,
    alchemyGenerationService,
    alchemyLocalizerService,
    alchemyDeliveryService,
    handleMechanismDraftFromAlchemy,
    handleMechanismLibrary,
    handleMechanismWorld,
    handleMechanismCommitDrafts,
    handleReviewFacts,
    handleReviewLog,
    handleModuleHistory,
    listCharacters,
    handleCharacterImport,
    handleCharacterUpdate,
    join,
    existsSync,
    readJsonSync,
    rmSync,
    CHARACTERS_DIR,
    ensureDir,
    mkdirSync,
    readFileSync,
    writeFileSync,
    handleWorldbook,
    handleWorldbookImport,
    handleWorldbookTest,
    handleChatMessage,
    handleTurnDebug,
    handleLatestTurnState,
    handleTurnStateIndex,
    handleTurnStateById,
    handleWorldPackExport,
    handleWorldPackImport,
    handleWtpackExport,
    handleWtpackImport,
    ENABLE_DEFERRED_PLUGINS,
    DEBUG_MODE,
    handlePlugins,
    handleOverlayPending,
    handleDashboardTelemetry,
    handleDashboardEntities,
    handleDashboardNarrative,
    WORLDS_DIR,
    readdirSync,
    PKG_VERSION,
    getInstanceInfo,
    userDataPath,
    calcDirectorySizeLimited,
    getLatestVersion,
    sanitizeWorldName,
    prepareImportFiles,
    dirname,
    DEBUG_LOG,
    HttpError
  } = deps;
  async function handleAPI(req, res) {
    const requestUrl = req.url || "/api/unknown";
    try {
      const url = new URL(requestUrl, `http://${req.headers.host || "localhost"}`);
      const path = url.pathname;
      const method = req.method;
  
    // 速率限制（API 路由）
    if (!checkRateLimit(req.socket?.remoteAddress || "127.0.0.1", RATE_MAX_API)) {
      return jsonError(res, 429, "RATE_LIMITED", "请求太频繁了。请稍等一分钟再试。", "API rate limit exceeded");
    }
    // CORS — 仅允许本地来源，不反射攻击者 Origin
    const origin = req.headers.origin || "";
    const originHost = parseOriginHost(origin);
    // OPTIONS 预检也必须走本地来源判断
    if (method === "OPTIONS") {
      if (!isLocalRequest(req)) {
        return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。", "Forbidden: non-local preflight");
      }
      res.setHeader("Access-Control-Allow-Origin", origin || "http://localhost:3000");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.writeHead(204).end();
    }
    // 非法 Origin → 403，不设置 ACAO
    if (originHost && !LOCAL_HOSTS.has(originHost)) {
      return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。请不要从公网或其他设备调用此服务。", `Forbidden: non-local Origin ${originHost}`);
    }
    // 本地 Origin 或无 Origin（CLI 请求）→ 设置正确的 CORS 头
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (!isLocalRequest(req)) {
      return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。请不要从公网或其他设备调用此服务。", "Forbidden: non-local request");
    }
  
    try {
      const handledV2ProductRoute = await handleV2ProductPlayableRoute({
        path,
        method,
        url,
        readBody: () => readBody(req),
        jsonResponse: (payload) => jsonResponse(res, payload),
        jsonError: (...args) => jsonError(res, ...args),
        deps: { dataRoot, loadConfig, getActiveLlmValue, moduleWorldDir, pathWithinRoot, safeEntityId }
      });
      if (handledV2ProductRoute !== false) return handledV2ProductRoute;
  
      // ── 配置 ──
      if (path === "/api/config" && method === "GET") return jsonResponse(res, await loadConfig());
      if (path === "/api/config" && method === "POST") return jsonResponse(res, await saveConfig(await readBody(req)));
  
      // ── 密钥 ──
      if (path === "/api/secrets" && method === "GET") return jsonResponse(res, await getSecretState());
      if (path === "/api/secrets/llm" && method === "POST") return jsonResponse(res, await saveLlmSecret(await readBody(req)));
      // 密钥值端点 — 仅供内部 LLM 调用使用，不返回明文
      if (path === "/api/secrets/llm-value" && method === "GET") {
        return jsonResponse(res, { value: maskSecret(await getActiveLlmValue()), masked: true });
      }
  
      // ── LLM ──
      if (path === "/api/llm/test" && method === "POST") return jsonResponse(res, await testLlmConnection(await readBody(req)));
      if (path === "/api/llm/chat/stream" && method === "POST") return handleLlmChatStream(req, res);
      if (path === "/api/llm/chat" && method === "POST") return jsonResponse(res, await handleLlmChat(await readBody(req)));
      if (path === "/api/llm/chat/retry" && method === "POST") return jsonResponse(res, await handleLlmChatRetry(await readBody(req)));
  
      // ── 连接档案 ──
      if (path === "/api/connections" && method === "GET") return jsonResponse(res, await handleConnections({}, "GET"));
      if (path === "/api/connections" && method === "POST") return jsonResponse(res, await handleConnections(await readBody(req), "POST"));
  
      // ── 模组管理 ──
      if (path === "/api/modules" && method === "GET") return jsonResponse(res, listModules());
      if (path === "/api/modules/create" && method === "POST") {
        const result = await createModule(await readBody(req));
        const httpStatus = Number(result?.httpStatus || 200);
        if (result && typeof result === "object") delete result.httpStatus;
        return jsonResponse(res, result, httpStatus);
      }
      if (path === "/api/modules/finalize-draft" && method === "POST") return jsonResponse(res, await finalizeDraftModule(await readBody(req)));
      if (path === "/api/modules/delete" && method === "POST") return jsonResponse(res, await deleteModule((await readBody(req)).id));
      if (path === "/api/modules/load" && method === "POST") {
        const { id } = await readBody(req);
        if (!id) return jsonError(res, 400, "MODULE_ID_MISSING", "缺少模组 ID。请重新选择模组后再试。");
        if (!moduleWorldDir(id)) return jsonError(res, 400, "MODULE_ID_INVALID", "模组 ID 无效。");
        const model = await buildModuleModel(id);
        return jsonResponse(res, { status: "ok", model: toPublicModuleModel(model) });
      }
  
      // ── P0-P2 unified kernel completion APIs ──
      const kernelMatch = path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
      if (kernelMatch) {
        const project = resolveKernelProject(kernelMatch[1]);
        if (!project) return jsonError(res, 404, "KERNEL_PROJECT_NOT_FOUND", "没有找到对应的世界项目。");
        const tail = kernelMatch[2] || "kernel/summary";
        if (tail === "kernel/summary" && method === "GET") return jsonResponse(res, await getKernelSummary(project.projectRoot, { modeId: project.modeId }));
        if (tail === "branches" && method === "GET") return jsonResponse(res, await handleBranchOperation(project.projectRoot, "list"));
        if (tail === "branches/create" && method === "POST") return jsonResponse(res, await handleBranchOperation(project.projectRoot, "create", await readBody(req)));
        let match = tail.match(/^branches\/([^/]+)\/(switch|archive|diff)$/);
        if (match && method === "POST") return jsonResponse(res, await handleBranchOperation(project.projectRoot, match[2], { ...(await readBody(req)), branchId: decodeURIComponent(match[1]) }));
        if (match && match[2] === "diff" && method === "GET") return jsonResponse(res, await handleBranchOperation(project.projectRoot, "diff", { branchId: decodeURIComponent(match[1]), fromBranchId: url.searchParams.get("from") || "main" }));
        if (tail === "telemetry/latest" && method === "GET") return jsonResponse(res, await getLatestKernelTelemetry(project.projectRoot));
        if (tail === "telemetry/refresh" && method === "POST") return jsonResponse(res, await refreshKernelTelemetry(project.projectRoot, await readBody(req)));
        if (tail === "advance/auto-light" && method === "POST") return jsonResponse(res, await previewAutoLight(project.projectRoot, { ...(await readBody(req)), modeId: project.modeId }));
        if (tail === "proposals/stop-loss" && method === "GET") return jsonResponse(res, await getKernelStopLoss(project.projectRoot));
        match = tail.match(/^proposals\/([^/]+)\/(approve|reject|reverse)$/);
        if (match && match[2] === "approve" && method === "POST") return jsonResponse(res, await approveKernelProposal(project.projectRoot, decodeURIComponent(match[1]), await readBody(req)));
        if (match && match[2] === "reject" && method === "POST") return jsonResponse(res, await rejectKernelProposal(project.projectRoot, decodeURIComponent(match[1])));
        if (match && match[2] === "reverse" && method === "POST") return jsonResponse(res, await reverseKernelProposal(project.projectRoot, decodeURIComponent(match[1])));
        if (tail === "processing/ingest" && method === "POST") return jsonResponse(res, await ingestProcessingMaterial(project.projectRoot, await readBody(req)));
        if (tail === "processing/candidates" && method === "GET") return jsonResponse(res, await listProcessingCandidates(project.projectRoot));
        match = tail.match(/^processing\/candidates\/([^/]+)\/deliver$/);
        if (match && method === "POST") return jsonResponse(res, await deliverProcessingById(project.projectRoot, decodeURIComponent(match[1])));
        return jsonError(res, 404, "KERNEL_ROUTE_NOT_FOUND", "没有找到对应的 Kernel 操作。");
      }
  
      // ── Workflow Integration API ──
      if (path === "/api/workflow/run" && method === "POST") {
        const body = await readBody(req);
        const config = await loadConfig();
        const apiKey = await getActiveLlmValue();
        const deps = {
          kernelContext: null,
          llmConfig: config,
          apiKey
        };
        if (body.projectId) {
          const pj = resolveKernelProject(body.projectId);
          if (pj) deps.kernelContext = { projectRoot: pj.projectRoot, modeId: pj.modeId, activeBranchId: body.branchId || "main" };
        }
        const result = await handleWorkflowApiRequest(body, deps);
        return jsonResponse(res, result);
      }
      if (path === "/api/workflow/types" && method === "GET") return jsonResponse(res, getWorkflowTypesResponse());
      if (path === "/api/workflow/status" && method === "GET") return jsonResponse(res, getWorkflowStatus());
  
      // ── 内置示例 ──
      if (path === "/api/examples" && method === "GET") return jsonResponse(res, { status: "ok", examples: listExamples() });
      if (path === "/api/examples/install" && method === "POST") {
        const result = await installExample(await readBody(req));
        if (result.status === "error") {
          const status = result.code === "EXAMPLE_NOT_FOUND" || result.code === "EXAMPLE_SOURCE_MISSING" ? 404 : 400;
          return jsonError(res, status, result.code || "EXAMPLE_INSTALL_FAILED", result.errorMsg || "安装示例失败。");
        }
        return jsonResponse(res, result);
      }
  
      // ── 炼金台 ──
      if (path === "/api/alchemy/import" && method === "POST") return jsonResponse(res, await handleAlchemyImport(await readBody(req)));
      if (path === "/api/alchemy/preview" && method === "POST") return jsonResponse(res, await handleAlchemyPreviewAction("create", await readBody(req)));
      if (path === "/api/alchemy/refine" && method === "POST") return jsonResponse(res, await handleAlchemyPreviewAction("refine", await readBody(req)));
      if (path === "/api/alchemy/commit" && method === "POST") return jsonResponse(res, await handleAlchemyPreviewAction("commit", await readBody(req)));
      if (path === "/api/alchemy/digest" && method === "POST") return jsonResponse(res, await handleAlchemyDigest(await readBody(req)));
      if (path === "/api/alchemy/review" && method === "GET") return jsonResponse(res, await handleAlchemyReview({}, "GET"));
      if (path === "/api/alchemy/review" && method === "POST") return jsonResponse(res, await handleAlchemyReview(await readBody(req), "POST"));
      // ── 炼金台 G1：新路由 ──
      if (path === "/api/alchemy/capabilities" && method === "GET") return jsonResponse(res, getAlchemyCapabilities());
      if (path === "/api/alchemy/plan" && method === "POST") return jsonResponse(res, await alchemyPlannerService.plan(await readBody(req)));
      if (path === "/api/alchemy/generate-preview" && method === "POST") return jsonResponse(res, await alchemyGenerationService.generate(await readBody(req)));
      if (path === "/api/alchemy/localize" && method === "POST") {
        const body = await readBody(req);
        const preview = body.preview || body.editedPreview || {};
        return jsonResponse(res, alchemyLocalizerService.buildInstallableFolderDraft(preview, {
          selectedTargets: body.selectedTargets || []
        }));
      }
      if (path === "/api/alchemy/deliver" && method === "POST") return jsonResponse(res, await alchemyDeliveryService.deliver(await readBody(req)));
      if (path === "/api/alchemy/deliveries" && method === "GET") return jsonResponse(res, await alchemyDeliveryService.listDeliveries({
        moduleKey: url.searchParams.get("moduleKey") || ""
      }));
      if (path === "/api/mechanisms/draft/from-alchemy" && method === "POST") return jsonResponse(res, await handleMechanismDraftFromAlchemy(await readBody(req)));
      if (path === "/api/mechanisms/library" && method === "GET") return jsonResponse(res, await handleMechanismLibrary(url));
      if (path === "/api/mechanisms/world" && method === "GET") return jsonResponse(res, await handleMechanismWorld(url));
      if (path === "/api/mechanisms/world/commit-drafts" && method === "POST") return jsonResponse(res, await handleMechanismCommitDrafts(await readBody(req)));
      if (path === "/api/review/pending" && method === "GET") return jsonResponse(res, await handleReviewFacts({}, "GET", url));
      if (path === "/api/review/pending" && method === "POST") return jsonResponse(res, await handleReviewFacts(await readBody(req), "POST", url));
      if (path === "/api/review/adopt" && method === "POST") return jsonResponse(res, await handleReviewFacts({ ...(await readBody(req)), action: "adopt" }, "POST", url));
      if (path === "/api/review/edit-and-adopt" && method === "POST") return jsonResponse(res, await handleReviewFacts({ ...(await readBody(req)), action: "edit-and-adopt" }, "POST", url));
      if (path === "/api/review/reject" && method === "POST") return jsonResponse(res, await handleReviewFacts({ ...(await readBody(req)), action: "reject" }, "POST", url));
      if (path === "/api/review/log" && method === "GET") return jsonResponse(res, await handleReviewLog(url));
  
      // ── 模组历史 ──
      if (path.startsWith("/api/modules/") && path.endsWith("/history") && method === "GET") {
        const moduleId = decodeURIComponent(path.replace("/api/modules/", "").replace("/history", ""));
        const limit = parseInt(url.searchParams.get("limit") || "50");
        return jsonResponse(res, await handleModuleHistory(moduleId, limit));
      }
  
      // ── 角色卡 ──
      if (path === "/api/characters" && method === "GET") return jsonResponse(res, listCharacters());
      if (path === "/api/characters/import" && method === "POST") return jsonResponse(res, await handleCharacterImport(await readBody(req)));
      if (path === "/api/characters/update" && method === "POST") return jsonResponse(res, await handleCharacterUpdate(await readBody(req)));
      if (path === "/api/characters/load" && method === "POST") {
        const body = await readBody(req);
        const id = safeEntityId(body.id || "", "");
        if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
        const { parseCharacterCard } = await import("../core/data/character-card.js");
        const cardJsonPath = join(dataRoot(), "engine", "characters", id, "card.json");
        const card = existsSync(cardJsonPath) ? readJsonSync(cardJsonPath, null) : null;
        if (!card) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "没有找到这张角色卡。它可能已被删除或移动。");
        const parsed = parseCharacterCard(card);
        let v2Capsule = null;
        let v2RuntimeContext = null;
        let v2RuntimeMvp = null;
        try {
          const { loadCharacterCapsuleSummary, loadCharacterCapsuleRuntimeContext, loadCharacterCapsuleRuntimeMvp } = await import("./character-capsule-service.js");
          const charactersRoot = join(dataRoot(), "engine", "characters");
          v2Capsule = loadCharacterCapsuleSummary(charactersRoot, id);
          v2RuntimeContext = loadCharacterCapsuleRuntimeContext(charactersRoot, id);
          v2RuntimeMvp = loadCharacterCapsuleRuntimeMvp(charactersRoot, id);
        } catch { /* V2 capsule unavailable; legacy-only */ }
        return jsonResponse(res, { status: "ok", card: parsed, ...(v2Capsule ? { v2Capsule } : {}), ...(v2RuntimeContext ? { v2RuntimeContext } : {}), ...(v2RuntimeMvp ? { v2RuntimeMvp } : {}) });
      }
      if (path === "/api/characters/delete" && method === "POST") {
        const body = await readBody(req);
        const id = safeEntityId(body.id || "", "");
        if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
        const targetDir = join(dataRoot(), "engine", "characters", id);
        if (!pathWithinRoot(CHARACTERS_DIR(), targetDir)) return jsonError(res, 400, "CHARACTER_ID_INVALID", "角色卡 ID 无效。");
        if (!existsSync(targetDir)) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "角色卡不存在，可能已经被删除。");
        try {
          rmSync(targetDir, { recursive: true, force: true });
          return jsonResponse(res, { status: "ok" });
        } catch (err) {
          return jsonError(res, 500, "CHARACTER_DELETE_FAILED", "删除角色卡失败。请检查文件是否被其他程序占用。", err.message);
        }
      }
      if (path === "/api/characters/backup" && method === "POST") {
        // 角色卡备份：复制 data/engine/characters/ 到 data/characters-archive/
        const body = await readBody(req);
        const id = safeEntityId(body.id || "", "");
        if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
        const srcDir = join(dataRoot(), "engine", "characters", id);
        if (!pathWithinRoot(CHARACTERS_DIR(), srcDir)) return jsonError(res, 400, "CHARACTER_ID_INVALID", "角色卡 ID 无效。");
        if (!existsSync(srcDir)) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "角色卡不存在，无法备份。");
        try {
          const archiveDir = join(dataRoot(), "characters-archive");
          ensureDir(archiveDir);
          const backupId = `${id}_${Date.now()}`;
          const destDir = join(archiveDir, backupId);
          mkdirSync(destDir, { recursive: true });
          const srcCard = join(srcDir, "card.json");
          if (existsSync(srcCard)) {
            const content = readFileSync(srcCard, "utf-8");
            writeFileSync(join(destDir, "card.json"), content, "utf-8");
          }
          return jsonResponse(res, { status: "ok", backupId, location: "characters-archive" });
        } catch (err) {
          return jsonError(res, 500, "CHARACTER_BACKUP_FAILED", "备份角色卡失败。请检查数据目录是否可写。", err.message);
        }
      }
  
      // Legacy worldbook edit/test routes remain owned by server.js.
      if (path === "/api/worldbook" && method === "GET") return jsonResponse(res, await handleWorldbook({}, "GET", url));
      if (path === "/api/worldbook" && method === "POST") return jsonResponse(res, await handleWorldbook(await readBody(req), "POST", url));
      if (path === "/api/worldbook/import" && method === "POST") return jsonResponse(res, await handleWorldbookImport(await readBody(req)));
      if (path === "/api/worldbook/test" && method === "POST") return jsonResponse(res, await handleWorldbookTest(await readBody(req)));
  
      // ── 聊天消息操作 ──
      if (path === "/api/chat/message-op" && method === "POST") return jsonResponse(res, await handleChatMessage(await readBody(req)));
      if (path === "/api/chat/message" && method === "POST") {
        res.setHeader("Deprecation", "true");
        res.setHeader("Link", "</api/chat/message-op>; rel=\"successor-version\"");
        return jsonResponse(res, await handleChatMessage(await readBody(req)));
      }
  
      // ── 叙事黑盒 ──
      if (path === "/api/turn/debug" && method === "GET") return jsonResponse(res, await handleTurnDebug(url));
  
      // ── 已确认回合状态帧 ──
      if (path === "/api/status/turn/latest" && method === "GET") return jsonResponse(res, await handleLatestTurnState(url));
      if (path === "/api/status/turns" && method === "GET") return jsonResponse(res, await handleTurnStateIndex(url));
      if (path.startsWith("/api/status/turn/") && method === "GET") {
        const turnId = decodeURIComponent(path.slice("/api/status/turn/".length));
        return jsonResponse(res, await handleTurnStateById(url, turnId));
      }
  
      // ── 世界包 ──
      if (path === "/api/world-pack/export" && method === "GET") return jsonResponse(res, await handleWorldPackExport({}, url));
      if (path === "/api/world-pack/export" && method === "POST") return jsonResponse(res, await handleWorldPackExport(await readBody(req), url));
      if (path === "/api/world-pack/import" && method === "POST") return jsonResponse(res, await handleWorldPackImport(await readBody(req)));
      if (path === "/api/wtpack/export" && method === "GET") return jsonResponse(res, await handleWtpackExport({}, url));
      if (path === "/api/wtpack/export" && method === "POST") return jsonResponse(res, await handleWtpackExport(await readBody(req), url));
      if (path === "/api/wtpack/import" && method === "POST") return jsonResponse(res, await handleWtpackImport(await readBody(req)));
  
      // ── 本地插件 (Deferred/internal API. Plugin system is not part of v0.3.0 public product scope.) ──
      if (path === "/api/plugins" && (method === "GET" || method === "POST")) {
        if (!ENABLE_DEFERRED_PLUGINS && !DEBUG_MODE) return jsonError(res, 403, "PLUGINS_DISABLED", "插件接口当前未启用。");
        return jsonResponse(res, await handlePlugins(method === "POST" ? await readBody(req) : {}, method));
      }
  
      // ── Overlay pending 队列 ──
      if (path === "/api/overlay/pending" && method === "GET") return jsonResponse(res, await handleOverlayPending({}, "GET", url));
      if (path === "/api/overlay/pending" && method === "POST") return jsonResponse(res, await handleOverlayPending(await readBody(req), "POST", url));
  
      // ── Dashboard ──
      if (path === "/api/dashboard/telemetry" && method === "GET") {
        const moduleKey = url.searchParams.get("moduleKey") || "";
        if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
        return jsonResponse(res, await handleDashboardTelemetry(moduleKey));
      }
      if (path === "/api/dashboard/entities" && method === "GET") {
        const moduleKey = url.searchParams.get("moduleKey") || "";
        if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
        return jsonResponse(res, await handleDashboardEntities(moduleKey));
      }
      if (path === "/api/dashboard/narrative" && method === "GET") {
        const moduleKey = url.searchParams.get("moduleKey") || "";
        if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
        return jsonResponse(res, await handleDashboardNarrative(moduleKey));
      }
  
      // ── 引擎 ──
      if (path === "/api/engine/manifest" && method === "GET") {
        const { ENGINE_VERSION, MODULES } = await import("../core/engine/modules.js");
        return jsonResponse(res, { engineVersion: ENGINE_VERSION, modules: MODULES.map(m => ({ id: m.id, name: m.name })) });
      }
  
      // ── 世界列表（兼容旧版） ──
      if (path === "/api/worlds" && method === "GET") {
        const worlds = [];
        const worldsDir = WORLDS_DIR();
        if (existsSync(worldsDir)) {
          for (const entry of readdirSync(worldsDir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              const meta = readJsonSync(join(worldsDir, entry.name, "world.json"), {});
              worlds.push({ name: entry.name, displayName: meta.displayName || entry.name, subType: meta.subType || "classic", turnCount: meta.turnCount || 0 });
            }
          }
        }
        return jsonResponse(res, worlds);
      }
  
      // ── 运行状态 ──
      if (path === "/api/status" && method === "GET") {
        const fullDetail = url.searchParams.get("detail") === "full" || DEBUG_MODE;
        const base = {
          version: PKG_VERSION,
          uptime: Math.round(process.uptime()),
          profiles: listModules().length
        };
        if (fullDetail) {
          base.dataRoot = dataRoot();
          base.memory = process.memoryUsage().rss;
        }
        return jsonResponse(res, base);
      }
  
      // ── 健康检查 ──
      if (path === "/api/health" && method === "GET") {
        const fullDetail = url.searchParams.get("detail") === "full";
        const checkLlmRemote = fullDetail && url.searchParams.get("checkLlm") !== "false";
        const config = await loadConfig();
        const apiKey = await getActiveLlmValue();
        const llmProfileConfigured = Boolean(config.llmBaseUrl && config.llmModel);
        const hasApiKey = Boolean(apiKey);
        const llmConfigured = llmProfileConfigured && hasApiKey;
        let llmStatus = llmConfigured ? "configured" : "not_configured";
        let llmDetail = "";
        if (llmConfigured && checkLlmRemote) {
          try {
            const resp = await fetch(`${config.llmBaseUrl.replace(/\/$/, "")}/models`, {
              method: "GET", headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(800)
            });
            llmStatus = resp.ok ? "connected" : "error";
            if (!resp.ok) llmDetail = `HTTP ${resp.status}`;
          } catch (err) {
            llmStatus = "disconnected";
            llmDetail = err?.message || "fetch failed";
          }
        }
  
        let writable = false;
        let writableDetail = "";
        try {
          const probe = userDataPath(`.write-probe-${Date.now()}.tmp`);
          writeFileSync(probe, "ok", "utf8");
          rmSync(probe, { force: true });
          writable = true;
        } catch (err) {
          writableDetail = err?.message || "write probe failed";
        }
  
        let dataSize = null;
        if (fullDetail) {
          try {
            const sizeInfo = await calcDirectorySizeLimited(dataRoot());
            dataSize = { sizeBytes: sizeInfo.sizeBytes, sizeTruncated: sizeInfo.truncated, entries: sizeInfo.entries };
          } catch {
            dataSize = { sizeBytes: 0, sizeTruncated: true, entries: 0 };
          }
        }
  
        const worlds = listModules().filter(m => m.type === "world");
        const totalTurns = worlds.reduce((s, w) => s + (w.turnCount || 0), 0);
  
        const latestVersion = getLatestVersion();
        const hasUpdate = latestVersion && latestVersion !== PKG_VERSION;
  
        // 默认只返回必要状态；detail=full 才返回详细信息
        if (fullDetail) {
          return jsonResponse(res, {
            status: "ok",
            version: PKG_VERSION,
            latestVersion: hasUpdate ? latestVersion : null,
            uptime: Math.round(process.uptime()),
            llm: {
              status: llmStatus,
              configured: llmConfigured,
              profileConfigured: llmProfileConfigured,
              hasApiKey,
              model: config.llmModel,
              baseUrl: config.llmBaseUrl,
              detail: llmDetail
            },
            data: { root: dataRoot(), writable, writableDetail, worldsCount: worlds.length, totalTurns, ...(dataSize || {}) },
            debugMode: DEBUG_MODE
          });
        }
  
        return jsonResponse(res, {
          status: "ok",
          version: PKG_VERSION,
          instance: typeof getInstanceInfo === "function" && getInstanceInfo(),
          uptime: Math.round(process.uptime()),
          llmConfigured,
          llmProfileConfigured,
          llmHasApiKey: hasApiKey,
          dataWritable: writable,
          latestVersion: hasUpdate ? latestVersion : null,
          debug: DEBUG_MODE ? { debugMode: true } : undefined
        });
      }
  
      // ── 数据导出 ──
      if (path === "/api/data/export" && method === "GET") {
        const moduleKey = url.searchParams.get("moduleKey") || "";
        if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
        const worldName = safeEntityId(moduleKey.replace(/^world:/, ""), "");
        const worldDir = moduleWorldDir(moduleKey);
        if (!worldDir || !pathWithinRoot(WORLDS_DIR(), worldDir)) return jsonError(res, 400, "MODULE_KEY_INVALID", "模组标识无效。");
        if (!existsSync(worldDir)) return jsonError(res, 404, "MODULE_NOT_FOUND", "模组不存在，可能已经被删除或移动。");
        try {
          // 收集所有数据文件（默认排除 runtime/ 敏感数据）
          const DEFAULT_EXPORT_EXCLUDES = [
            /^runtime\/chat\.jsonl$/i,
            /^runtime\/memory\.jsonl$/i,
            /^runtime\/state\.json$/i,
            /^runtime\/overlay(?:\/|$)/i,
            /^runtime\/backups(?:\/|$)/i,
            /^runtime\/pending\.jsonl$/i,
            /^runtime\/manual\.jsonl$/i,
            /^runtime\/review-log\.jsonl$/i,
            /^runtime\/snapshots(?:\/|$)/i,
            /^runtime\/alchemy-previews(?:\/|$)/i,
            /^runtime\/status(?:\/|$)/i,
            /^runtime\/mechanisms(?:\/|$)/i,
            /^runtime\/(?:debug|proposal|proposals|session|sessions)(?:\/|$)/i,
            /^runtime\/source\.txt$/i,
            /^shared\/secrets\.json$/i,
          ];
          const includeRuntime = url.searchParams.get("includeRuntime") === "true";
          const shouldExcludeFromSafeExport = (relativePath) => {
            const normalized = relativePath.replace(/\\/g, "/");
            return DEFAULT_EXPORT_EXCLUDES.some((rule) => rule.test(normalized));
          };
          const bundle = { exportedAt: new Date().toISOString(), worldName, files: {} };
          const collectDir = (dir, prefix = "") => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              const full = join(dir, entry.name);
              const key = prefix + entry.name;
              if (entry.isDirectory()) {
                if (!includeRuntime && shouldExcludeFromSafeExport(key + "/")) continue;
                collectDir(full, key + "/");
              }
              else if (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl")) {
                if (!includeRuntime && shouldExcludeFromSafeExport(key)) continue;
                try { bundle.files[key] = readFileSync(full, "utf-8"); } catch (err) { console.warn("[legacyExport] skipped unreadable data file (non-fatal):", err?.message || "unknown error"); }
              }
            }
          };
          collectDir(worldDir);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${worldName}-export.json"`
          });
          res.end(JSON.stringify(bundle, null, 2));
        } catch (err) {
          return jsonError(res, 500, "EXPORT_FAILED", "导出失败。请检查模组文件是否完整。", err.message);
        }
        return;
      }
  
      // ── 数据导入 ──
      if (path === "/api/data/import" && method === "POST") {
        try {
          const body = await readBody(req);
          if (!body.worldName || !body.files) return jsonError(res, 400, "IMPORT_PAYLOAD_INVALID", "导入包缺少必要字段，无法导入。");
          const worldName = safeEntityId(sanitizeWorldName(body.worldName), "");
          if (!worldName) return jsonError(res, 400, "IMPORT_WORLD_NAME_INVALID", "导入世界名无效。");
          const worldDir = join(WORLDS_DIR(), worldName);
          if (!pathWithinRoot(WORLDS_DIR(), worldDir)) return jsonError(res, 400, "IMPORT_WORLD_NAME_INVALID", "导入世界名无效。");
          if (existsSync(worldDir)) return jsonError(res, 409, "IMPORT_NAME_CONFLICT", "目标模组名称已存在。请先重命名导入内容或删除旧模组。");
          const filesToWrite = prepareImportFiles(worldDir, body.files);
          mkdirSync(worldDir, { recursive: true });
          for (const { targetPath, content } of filesToWrite) {
            ensureDir(dirname(targetPath));
            writeFileSync(targetPath, String(content), "utf-8");
          }
          return jsonResponse(res, { status: "ok", worldName });
        } catch (err) {
          const status = String(err.code || "").startsWith("IMPORT_") ? 400 : 500;
          return jsonError(res, status, err.code || "IMPORT_FAILED", "导入失败。请确认文件结构完整且内容合法。", err.message);
        }
      }
  
      // ── 调试日志 ──
      if (path === "/api/debug/logs" && method === "GET") {
        if (!DEBUG_MODE) return jsonError(res, 403, "DEBUG_DISABLED", "调试模式未启用。请用 node server.js --debug 启动。");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        return jsonResponse(res, { logs: DEBUG_LOG.slice(-limit), totalLogs: DEBUG_LOG.length });
      }
  
      // ── 未知路由 ──
      jsonError(res, 404, "NOT_FOUND", "没有找到这个接口。请检查请求路径。", path);
  
      } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(res, err.status, err.code, err.userMsg, err.detail);
      }
      if (err?.code === "BODY_TOO_LARGE") {
        return jsonError(res, 413, "BODY_TOO_LARGE", "请求内容太大。请拆分素材或减少导入包体积。", err.message);
      }
      console.error("[API]", path, err);
      jsonError(res, 500, "INTERNAL_ERROR", "服务端处理失败。请查看控制台日志获取技术细节。", err.message);
      }
    } catch (err) {
      console.error("[API:FATAL]", requestUrl, err);
      if (res.headersSent) {
        if (!res.writableEnded) res.destroy(err);
        return;
      }
      jsonError(res, 500, "INTERNAL_ERROR", "服务端处理失败。请查看控制台日志获取技术细节。", err?.message || String(err));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  //  启动服务器
  // ═══════════════════════════════════════════════════════════════

  return { handleAPI };
}
