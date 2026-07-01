"use strict";

(function attachWorldTreeClientCore(global) {
  const U = {
    qs(s, r) { return (r || document).querySelector(s); },
    qsa(s, r) { return Array.from((r || document).querySelectorAll(s)); },
    esc(v) {
      return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    json(v) { try { return JSON.stringify(v ?? null, null, 2); } catch { return String(v); } },
    compact(v, max = 160) {
      const text = String(v ?? "").replace(/\s+/g, " ").trim();
      return text.length > max ? `${text.slice(0, max)}...` : text;
    },
    date(v) {
      if (!v) return "未知";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleString("zh-CN", { hour12: false });
    },
    rel(v) {
      if (!v) return "未知";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      const diff = Date.now() - d.getTime();
      const abs = Math.abs(diff);
      if (abs < 60000) return "刚刚";
      if (abs < 3600000) return `${Math.round(abs / 60000)} 分钟前`;
      if (abs < 86400000) return `${Math.round(abs / 3600000)} 小时前`;
      return `${Math.round(abs / 86400000)} 天前`;
    },
  };

  const API = {
    base: "",
    async call(method, path, body) {
      const opts = { method, headers: { "Content-Type": "application/json" } };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch((API.base || "") + path, opts);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let payload = null;
        try { payload = JSON.parse(text); } catch {}
        throw new Error(payload?.userMsg || payload?.errorMsg || payload?.error || `HTTP ${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    },
    get(path) { return API.call("GET", path); },
    post(path, body) { return API.call("POST", path, body); },
    loadModules() { return API.get("/api/modules"); },
    createModule(data) { return API.post("/api/modules/create", data); },
    finalizeDraft(data) { return API.post("/api/modules/finalize-draft", data); },
    deleteModule(id) { return API.post("/api/modules/delete", { id }); },
    loadExamples() { return API.get("/api/examples"); },
    installExample(id) { return API.post("/api/examples/install", { id }); },
    loadConfig() { return API.get("/api/config"); },
    saveConfig(data) { return API.post("/api/config", data); },
    getSecrets() { return API.get("/api/secrets"); },
    saveLlmKey(data) { return API.post("/api/secrets/llm", data); },
    testLlm(data) { return API.post("/api/llm/test", data); },
    chatSend(data) { return API.post("/api/llm/chat", data); },
    chatMessage(data) { return API.post("/api/chat/message", data); },
    alchemyImport(data) { return API.post("/api/alchemy/import", data); },
    alchemyPreview(data) { return API.post("/api/alchemy/preview", data); },
    alchemyRefine(data) { return API.post("/api/alchemy/refine", data); },
    alchemyCommit(data) { return API.post("/api/alchemy/commit", data); },
    alchemyReview(data) { return data ? API.post("/api/alchemy/review", data) : API.get("/api/alchemy/review"); },
    alchemyCapabilities() { return API.get("/api/alchemy/capabilities"); },
    alchemyPlan(data) { return API.post("/api/alchemy/plan", data); },
    alchemyGeneratePreview(data) { return API.post("/api/alchemy/generate-preview", data); },
    alchemyLocalize(data) { return API.post("/api/alchemy/localize", data); },
    alchemyDeliver(data) { return API.post("/api/alchemy/deliver", data); },
    alchemyDeliveries(moduleKey = "") {
      return API.get(`/api/alchemy/deliveries?moduleKey=${encodeURIComponent(moduleKey || "")}`);
    },
    mechanismDraft(data) { return API.post("/api/mechanisms/draft/from-alchemy", data); },
    mechanismLibrary({ query = "", moduleKey = "", previewId = "" } = {}) { return API.get(`/api/mechanisms/library?query=${encodeURIComponent(query)}&moduleKey=${encodeURIComponent(moduleKey)}&previewId=${encodeURIComponent(previewId)}`); },
    mechanismWorld(moduleKey) { return API.get(`/api/mechanisms/world?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    mechanismCommit(data) { return API.post("/api/mechanisms/world/commit-drafts", data); },
    reviewPending(moduleKey) { return API.get(`/api/review/pending?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    reviewAction(action, data) { return API.post(`/api/review/${action}`, data); },
    reviewLog(moduleKey) { return API.get(`/api/review/log?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    loadCharacters() { return API.get("/api/characters"); },
    importCharacter(data) { return API.post("/api/characters/import", data); },
    updateCharacter(data) { return API.post("/api/characters/update", data); },
    loadCharacter(id) { return API.post("/api/characters/load", { id }); },
    loadWorldbook(moduleKey) { return API.get(`/api/worldbook?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    saveWorldbook(data) { return API.post("/api/worldbook", data); },
    testWorldbook(data) { return API.post("/api/worldbook/test", data); },
    worldbookV2Load(moduleKey) { return API.get(`/api/worldbook-v2/load?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    worldbookV2CreateCandidate(data) { return API.post("/api/worldbook-v2/candidates/create", data); },
    worldbookV2CandidateDecision(data) { return API.post("/api/worldbook-v2/candidates/decision", data); },
    worldbookV2InjectPreview(data) { return API.post("/api/worldbook-v2/inject-preview", data); },
    worldbookV2Export(data) { return API.post("/api/worldbook-v2/export", data); },
    connections(data) { return data ? API.post("/api/connections", data) : API.get("/api/connections"); },
    turnDebug(moduleKey) { return API.get(`/api/turn/debug?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    statusLatest(moduleKey, saveId = "main") { return API.get(`/api/status/turn/latest?moduleKey=${encodeURIComponent(moduleKey || "")}&saveId=${encodeURIComponent(saveId)}`); },
    statusTurn(moduleKey, turnId, saveId = "main") { return API.get(`/api/status/turn/${encodeURIComponent(turnId)}?moduleKey=${encodeURIComponent(moduleKey || "")}&saveId=${encodeURIComponent(saveId)}`); },
    statusTurns(moduleKey, saveId = "main", limit = 50) { return API.get(`/api/status/turns?moduleKey=${encodeURIComponent(moduleKey || "")}&saveId=${encodeURIComponent(saveId)}&limit=${encodeURIComponent(limit)}`); },
    worldPackExport(data) {
      return typeof data === "object"
        ? API.post("/api/world-pack/export", data)
        : API.get(`/api/world-pack/export?moduleKey=${encodeURIComponent(data || "")}`);
    },
    worldPackImport(data) { return API.post("/api/world-pack/import", data); },
    plugins(data) { return data ? API.post("/api/plugins", data) : API.get("/api/plugins"); },
    telemetry(moduleKey) { return API.get(`/api/dashboard/telemetry?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    entities(moduleKey) { return API.get(`/api/dashboard/entities?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    narrative(moduleKey) { return API.get(`/api/dashboard/narrative?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
    kernel(moduleKey, tail = "kernel/summary") { return API.get(`/api/projects/${encodeURIComponent(moduleKey)}/${tail}`); },
    kernelPost(moduleKey, tail, data = {}) { return API.post(`/api/projects/${encodeURIComponent(moduleKey)}/${tail}`, data); },
    health() { return API.get("/api/health"); },
    workflowStatus() { return API.get("/api/workflow/status"); },
    workflowTypes() { return API.get("/api/workflow/types"); },
    // Tabletop V2
    tabletopV2ImportPreview(data) { return API.post("/api/tabletop-v2/import-preview", data); },
    tabletopV2Start(data) { return API.post("/api/tabletop-v2/start", data); },
    tabletopV2Turn(data) { return API.post("/api/tabletop-v2/turn", data); },
    tabletopV2Save(data) { return API.post("/api/tabletop-v2/save", data); },
    tabletopV2Branch(data) { return API.post("/api/tabletop-v2/branch", data); },
    tabletopV2EndSummary(data) { return API.post("/api/tabletop-v2/end-summary", data); },
    tabletopV2ImportCommit(data) { return API.post("/api/tabletop-v2/import-commit", data); },
    tabletopV2Runs() { return API.get("/api/tabletop-v2/runs"); },
    tabletopV2LoadRun(data) { return API.post("/api/tabletop-v2/load-run", data); },
    tabletopV2RestoreSave(data) { return API.post("/api/tabletop-v2/restore-save", data); },
    tabletopV2SwitchBranch(data) { return API.post("/api/tabletop-v2/switch-branch", data); },
    tabletopV2ExportRun(data) { return API.post("/api/tabletop-v2/export-run", data); },
    // Strategy Sim V2
    strategySimV2Validate(data) { return API.post("/api/strategy-sim-v2/spec/validate", data); },
    strategySimV2Seal(data) { return API.post("/api/strategy-sim-v2/spec/seal", data); },
    strategySimV2Start(data) { return API.post("/api/strategy-sim-v2/start", data); },
    strategySimV2Turn(data) { return API.post("/api/strategy-sim-v2/turn", data); },
    strategySimV2Save(data) { return API.post("/api/strategy-sim-v2/save", data); },
    strategySimV2LoadRun(data) { return API.post("/api/strategy-sim-v2/load-run", data); },
    strategySimV2ExportRun(data) { return API.post("/api/strategy-sim-v2/export-run", data); },
    // Detective V2
    detectiveV2ImportPreview(data) { return API.post("/api/detective-v2/import-preview", data); },
    detectiveV2ImportCommit(data) { return API.post("/api/detective-v2/import-commit", data); },
    detectiveV2Start(data) { return API.post("/api/detective-v2/start", data); },
    detectiveV2Investigate(data) { return API.post("/api/detective-v2/investigate", data); },
    detectiveV2Interrogate(data) { return API.post("/api/detective-v2/interrogate", data); },
    detectiveV2NotebookExtract(data) { return API.post("/api/detective-v2/notebook/extract", data); },
    detectiveV2NotebookUpdate(data) { return API.post("/api/detective-v2/notebook/update", data); },
    detectiveV2DeductionSubmit(data) { return API.post("/api/detective-v2/deduction/submit", data); },
    detectiveV2GeneratePreview(data) { return API.post("/api/detective-v2/generate-preview", data); },
    detectiveV2GenerateCommit(data) { return API.post("/api/detective-v2/generate-commit", data); },
    detectiveV2QualityCheck(data) { return API.post("/api/detective-v2/quality-check", data); },
    detectiveV2ReviewCaseQuality(data) { return API.post("/api/detective-v2/review-case-quality", data); },
    detectiveV2ExportRun(data) { return API.post("/api/detective-v2/export-run", data); },
    detectiveV2ExportPlayerPack(data) { return API.post("/api/detective-v2/export-case-player-pack", data); },
    detectiveV2ExportGMPack(data) { return API.post("/api/detective-v2/export-case-gm-pack", data); },
    // Character V2
    characterV2Candidates(characterId) { return API.get(`/api/characters/v2/candidates?characterId=${encodeURIComponent(characterId || "")}`); },
    characterV2CandidateReview(data) { return API.post("/api/characters/v2/candidates/review", data); },
    characterV2CandidateBulkReview(data) { return API.post("/api/characters/v2/candidates/bulk-review", data); },
    characterV2CandidateUndo(data) { return API.post("/api/characters/v2/candidates/undo", data); },
    // Single Player ScriptKill V2
    singlePlayerScriptKillV2ImportPreview(data) { return API.post("/api/single-player-scriptkill-v2/import-preview", data); },
    singlePlayerScriptKillV2ImportCommit(data) { return API.post("/api/single-player-scriptkill-v2/import-commit", data); },
    singlePlayerScriptKillV2Start(data) { return API.post("/api/single-player-scriptkill-v2/start", data); },
    singlePlayerScriptKillV2ReadRoleAct(data) { return API.post("/api/single-player-scriptkill-v2/read-role-act", data); },
    singlePlayerScriptKillV2PublicTalk(data) { return API.post("/api/single-player-scriptkill-v2/public-talk", data); },
    singlePlayerScriptKillV2PrivateChat(data) { return API.post("/api/single-player-scriptkill-v2/private-chat", data); },
    singlePlayerScriptKillV2Search(data) { return API.post("/api/single-player-scriptkill-v2/search", data); },
    singlePlayerScriptKillV2RevealClue(data) { return API.post("/api/single-player-scriptkill-v2/reveal-clue", data); },
    singlePlayerScriptKillV2AdvancePhase(data) { return API.post("/api/single-player-scriptkill-v2/advance-phase", data); },
    singlePlayerScriptKillV2Vote(data) { return API.post("/api/single-player-scriptkill-v2/vote", data); },
    singlePlayerScriptKillV2Debrief(data) { return API.post("/api/single-player-scriptkill-v2/debrief", data); },
    singlePlayerScriptKillV2ExportRun(data) { return API.post("/api/single-player-scriptkill-v2/export-run", data); },
    singlePlayerScriptKillV2Runs() { return API.get("/api/single-player-scriptkill-v2/runs"); },
    singlePlayerScriptKillV2LoadRun(data) { return API.post("/api/single-player-scriptkill-v2/load-run", data); },
  };

  global.WorldTreeClientCore = Object.freeze({ U, API });
})(window);
