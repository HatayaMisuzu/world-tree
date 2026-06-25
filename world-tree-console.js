"use strict";

// Deferred/internal: plugin system is not part of v0.3.0 public product scope.
const ENABLE_DEFERRED_PLUGINS = false;

const CFG = {
  version: "unknown",
  nav: [
    { id: "workbench", label: "工作台", icon: "□", meta: "首页" },
    { id: "chat", label: "对话", icon: "◇", meta: "创作" },
    { id: "library", label: "资料库", icon: "▦", meta: "素材" },
    { id: "worlds", label: "世界管理", icon: "◎", meta: "项目" },
    { id: "observe", label: "观测", icon: "◌", meta: "调试" },
    { id: "settings", label: "设置", icon: "⚙", meta: "配置" },
  ],
};

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

const PROGRESS_STAGES = [
  "导演正在分析你的行动……",
  "生成叙事方向……",
  "故事正在书写……",
  "Guardian 正在审核……",
  "本轮完成"
];
let progressTimer = null;

const AS = {
  view: "workbench",
  workbenchMode: "overview",
  libraryTab: "characters",
  observeTab: "summary",
  settingsTab: "connections",
  activeDrawer: "",
  config: {},
  hasApiKey: false,
  llmConnected: false,
  llmTestResult: "",
  llmDiagnostics: null,
  modules: [],
  examples: [],
  characters: [],
  characterQuery: "",
  selectedModule: null,
  currentCharacterCard: null,
  currentV2Capsule: null,
  currentV2RuntimeContext: null,
  currentV2RuntimeMvp: null,
  characterV2RuntimeAdvancedOpen: false,
  characterPreviewRawOpen: false,
  characterV2Live: { characterId: "", input: "", busy: false, error: "", reply: null, history: [], candidates: null, packetSummary: null, quality: null, advancedOpen: false, dryRun: false },
  worldbookEntries: [],
  worldbookTest: null,
  reviewItems: [],
  manualReviewItems: [],
  reviewLog: [],
  connections: null,
  plugins: null,
  pluginRunResult: null,
  health: null,
  messages: [],
  busy: false,
  quickStartContent: "",
  isQuickStart: false,
  engineState: null,
  lastScene: "",
  lastStatusSections: {},
  dashboardData: {},
  kernel: null,
  kernelBranches: [],
  kernelProcessing: [],
  turnDebug: null,
  worldPack: null,
  importPreview: null,
  pendingPack: null,
  alchemyMode: "import",
  alchemyTarget: "mixed",
  alchemyUserGoal: "",
  alchemyText: "",
  alchemyPreview: null,
  alchemyPreviewId: "",
  alchemyPreviewBusy: false,
  alchemyRefineText: "",
  alchemyCommitBusy: false,
  alchemySelectedItemIds: [],
  alchemyEditingItemId: "",
  alchemyError: "",
  alchemyMechanismDrafts: [],
  alchemyMechanismLibrary: [],
  alchemyMechanismRecommendations: [],
  alchemyMechanismCache: null,
  alchemyEditingMechanismId: "",
  alchemyMechanismTemplateId: "",
  alchemyMechanismQuery: "",
  developerObservabilityOpen: false,
  developerObservabilityTab: "context",
  statusPanelVisible: true,
  statusPanelCollapsed: false,
  statusPanelDensity: "simple",
  selectedTurnId: null,
  selectedMessageId: null,
  selectedTurnFrame: null,
  latestTurnFrame: null,
  turnStateIndex: [],
  workflowStatus: null,
  workflowTypes: [],
  lastWorkflowRun: null,
  progressIndex: -1,
  modePlay: null,
  worldPackOptions: { includeWorldbook: true, includeCharacters: true, includeSharedData: true, includeRuntimeState: false, includeReviewQueue: false, includeMechanisms: false, includeTurnStateFrames: false },
  characterV2Create: { open: false, name: "", text: "", avatar: null, preview: null, error: "", busy: false, advancedOpen: false },
  tabletopV2: { runId: null, module: null, ruleset: null, lastRuling: null, ending: null },
  detectiveV2: { caseId: null, runId: null, importPreview: null, playerCase: null, playerRun: null, currentLocationId: "", currentCharacterId: "", lastInvestigation: null, lastInterview: null, notebookOpen: true, notebook: null, deductionDraft: {}, error: "", busy: false },
};

const C = {
  badge(text, tone = "pending") { return `<span class="badge ${tone}">${U.esc(text)}</span>`; },
  stat(label, value, sub = "") {
    return `<div class="stat"><span>${U.esc(label)}</span><strong>${U.esc(value)}</strong>${sub ? `<span>${U.esc(sub)}</span>` : ""}</div>`;
  },
  empty(title, desc = "") {
    return `<div class="empty"><strong>${U.esc(title)}</strong>${desc ? `<p class="sub">${U.esc(desc)}</p>` : ""}</div>`;
  },
  notice(text, tone = "") { return `<div class="notice ${tone}">${U.esc(text)}</div>`; },
  noticeHtml(html, tone = "") { return `<div class="notice ${tone}">${html}</div>`; },
  tabs(items, active, attr) {
    return `<div class="tabs">${items.map(t => `<button class="${active === t.id ? "active" : ""}" ${attr}="${U.esc(t.id)}">${U.esc(t.label)}${t.count !== undefined ? ` ${C.badge(t.count, "pending")}` : ""}</button>`).join("")}</div>`;
  },
  dataModeLabel(m) {
    if (typeof m === "object" && m?.mode === "quick-setting") return "预设/设定";
    const mode = typeof m === "string" ? m : m?.dataMode;
    return ({ worldbook: "世界书", character_card: "角色卡", preset: "预设", standalone: "独立" }[mode] || mode || "未知");
  },
  moduleCard(m) {
    const selected = AS.selectedModule?.id === m.id;
    return `<div class="module-card ${selected ? "selected" : ""}" data-module-id="${U.esc(m.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${U.esc(m.displayName || m.name || m.id)}</div>
          <div class="sub">${C.dataModeLabel(m)} · ${U.esc(m.subType || m.type || "default")}${m.draft ? " · 草稿" : ""}</div>
        </div>
        ${C.badge(selected ? "当前" : m.draft ? "草稿" : (m.turnCount || 0) + " 回合", selected ? "ok" : m.draft ? "warn" : "pending")}
      </div>
      <p class="muted tiny">${U.esc(U.compact(m.description || "本地创作模块", 100))}</p>
      <div class="actions">
        <button class="small primary" data-action="select-module">加载</button>
        <button class="small" data-action="export-module">导出</button>
        <button class="small danger" data-action="delete-module">删除</button>
      </div>
    </div>`;
  },
  chatMsg(m) {
    const role = m.role || "assistant";
    const tone = role === "user" ? "user" : role === "error" ? "error" : role === "system" ? "system" : "assistant";
    const candidates = Array.isArray(m.candidates) ? m.candidates : [];
    const selectedIndex = Math.max(0, candidates.findIndex(c => c.selected));
    const turnId = m.turnId || (m.round ? `turn-${m.round}` : "");
    return `<div class="chat-message ${tone} ${m.id && AS.selectedMessageId === m.id ? "selected-message" : ""}" data-message-id="${U.esc(m.id || "")}" data-turn-id="${U.esc(turnId)}">
      <div class="chat-meta">
        <strong>${role === "user" ? "你" : role === "assistant" ? "叙事引擎" : role}</strong>
        ${m.favorite ? C.badge("收藏", "warn") : ""}
        ${m.round ? `<span>第 ${U.esc(m.round)} 轮</span>` : ""}
        ${m.ts ? `<span>${U.date(m.ts)}</span>` : ""}
      </div>
      <div class="chat-text">${U.esc(m.content || "")}</div>
      ${candidates.length > 1 ? `<div class="candidate-row">
        <button class="small" data-action="candidate-prev">上一个</button>
        <span>候选 ${selectedIndex + 1} / ${candidates.length}</span>
        <button class="small" data-action="candidate-next">下一个</button>
      </div>` : ""}
      <div class="message-tools">
        <button data-action="copy-message">复制</button>
        <button data-action="edit-message">编辑</button>
        <button data-action="favorite-message">${m.favorite ? "取消收藏" : "收藏"}</button>
        ${role === "assistant" ? `<button data-action="regen-message">重生成</button>` : ""}
        <button class="danger" data-action="delete-message">删除</button>
      </div>
    </div>`;
  },
  chatSurface() {
    const m = AS.selectedModule;
    const title = AS.isQuickStart ? "快速对话" : (m ? (m.displayName || m.name) : "未选择世界");
    return `<div class="chat-layout">
      <section class="panel chat-card">
        <div class="panel-head">
          <div>
            <h2>${U.esc(title)}</h2>
            <p class="sub">${AS.isQuickStart ? "快速项目草稿 · 已保存到本地 runtime" : m ? `${C.dataModeLabel(m)} · ${m.turnCount || 0} 回合${m.draft ? " · 草稿" : ""}` : "请先在工作台或世界管理中加载一个世界"}</p>
          </div>
          <div class="actions">
            <button class="small" data-action="toggle-developer-observability">开发者观测</button>
            <button class="small" data-action="open-command-panel">命令</button>
            <button class="small danger" data-action="clear-chat">清空</button>
          </div>
        </div>
        <div id="chatMessages" class="chat-messages">${AS.messages.length ? AS.messages.map(C.chatMsg).join("") : C.empty("开始对话", "输入行动、台词或 / 命令。")}</div>
        ${renderProgressPanel()}
        <div class="composer">
          <textarea id="chatInput" placeholder="续写这一幕... 输入 / 调用命令，Enter 发送"></textarea>
          <button class="primary" data-action="chat-send" ${AS.busy ? "disabled" : ""}>发送</button>
        </div>
        ${renderKernelPanel()}
        ${renderWorkflowPanel()}
        ${renderModePlayPanel()}
      </section>
      ${renderStatusPanel()}
      ${renderDeveloperObservabilityDrawer()}
    </div>`;
  },
  worldbookRows(limit) {
    const rows = (AS.worldbookEntries || []).slice(0, limit || 100);
    if (!rows.length) return C.empty("暂无世界书条目", "选择世界后点击加载当前世界书。");
    return rows.map(e => `<div class="item" data-entry-id="${U.esc(e.id || "")}">
      <div class="item-head">
        <div><div class="item-title">${U.esc(e.title || e.keys?.[0] || "未命名条目")}</div><div class="sub">关键词：${U.esc((e.keys || []).join(", ") || "-")}</div></div>
        <div class="actions">${C.badge(e.group || "默认", "info")} ${C.badge(e.enabled === false ? "停用" : "启用", e.enabled === false ? "pending" : "ok")} ${C.badge("P" + (e.priority ?? 100), "pending")}</div>
      </div>
      <p class="tiny muted">${U.esc(U.compact(e.content || "", 160))}</p>
      <div class="actions">
        <button class="small" data-action="edit-worldbook-entry">编辑</button>
        <button class="small" data-action="toggle-worldbook-entry">${e.enabled === false ? "启用" : "停用"}</button>
        <button class="small danger" data-action="delete-worldbook-entry">删除</button>
      </div>
    </div>`).join("");
  },
};

function currentTurnStateFrame() {
  return AS.selectedTurnId ? AS.selectedTurnFrame : AS.latestTurnFrame;
}

function renderKernelPanel() {
  if (!AS.selectedModule || AS.selectedModule.type === "profile" || String(AS.selectedModule.id || "").startsWith("char:") || AS.selectedModule.id === "__quick__") return "";
  const kernel = AS.kernel;
  const metrics = kernel?.telemetry?.metrics || {};
  const branches = AS.kernelBranches || [];
  const proposals = kernel?.pendingProposals || [];
  const windows = kernel?.openStopLossWindows || [];
  const candidates = AS.kernelProcessing || [];
  const metricLabels = { stability: "世界稳定", mysteryLoad: "谜团负载", narrativeMomentum: "叙事动量", conflictPressure: "冲突压力", characterStress: "角色压力", memoryLoad: "记忆负载" };
  const levelLabels = { low: "低", medium: "中", high: "高", critical: "危险", stable: "平稳", tense: "紧张", moving: "推进中", stalled: "停滞" };
  return `<details class="kernel-panel" data-kernel-panel>
    <summary><strong>世界内核</strong><span class="tiny muted">${kernel ? `P0/P1/P2 · ${U.esc(kernel.activeBranchId || "main")}` : "点击加载"}</span></summary>
    <div class="kernel-grid">
      <section><div class="item-head"><strong>分支</strong><button class="small" data-action="kernel-create-branch">新建</button></div>
        <div class="chip-row">${branches.map(branch => `<span><button class="small ${branch.id === kernel?.activeBranchId ? "primary" : ""}" data-action="kernel-switch-branch" data-branch-id="${U.esc(branch.id)}" ${branch.status === "archived" ? "disabled" : ""}>${U.esc(branch.label || branch.id)}</button>${branch.id !== "main" ? `<button class="small" data-action="kernel-diff-branch" data-branch-id="${U.esc(branch.id)}">差异</button>` : ""}</span>`).join("") || `<span class="tiny muted">尚未加载</span>`}</div>
      </section>
      <section><div class="item-head"><strong>遥测</strong><button class="small" data-action="kernel-refresh-telemetry">刷新</button></div>
        <p class="tiny muted">${Object.entries(metrics).slice(0, 6).map(([key, value]) => `${U.esc(metricLabels[key] || key)}：${U.esc(levelLabels[value] || value)}`).join(" · ") || "暂无遥测"}</p>
        <button class="small" data-action="kernel-auto-light">Auto-light 预演</button>
      </section>
      <section><div class="item-head"><strong>提案</strong><span class="tiny muted">${proposals.length} 待审</span></div>
        ${proposals.slice(0, 5).map(item => `<div class="proposal-story-card" data-proposal-id="${U.esc(item.id)}"><p>你感到世界的脉络似乎在重新织就……</p><strong>${U.esc(item.title)}</strong><span class="tiny muted">${U.esc(item.summary || "检测到重大世界状态变更")} · ${U.esc(item.impactLevel)}${item.reversible ? " · 可逆" : ""}</span><div class="actions"><button class="small primary" data-action="kernel-approve-proposal" data-impact="${U.esc(item.impactLevel)}" data-second-confirm="${item.requiresSecondConfirm === true}">${item.requiresSecondConfirm || item.impactLevel === "critical" ? "二次确认这个变化" : "接受这个变化"}</button><button class="small" data-action="kernel-delay-proposal">先继续，稍后决定</button><button class="small danger" data-action="kernel-reject-proposal">拒绝这个变化</button></div></div>`).join("") || `<p class="tiny muted">暂无待审提案</p>`}
        ${windows.slice(0, 5).map(item => `<div class="kernel-row"><span>止损窗口：${U.esc(item.proposalId)}</span><button class="small danger" data-action="kernel-reverse-proposal" data-proposal-id="${U.esc(item.proposalId)}">生成逆操作</button></div>`).join("")}
      </section>
      <section><div class="item-head"><strong>素材处理</strong><button class="small" data-action="kernel-ingest-material">导入文本</button></div>
        ${candidates.slice(0, 5).map(item => `<div class="kernel-row"><span title="${U.esc((item.conflicts || []).join(", "))}">${U.esc(item.title || item.name || item.id)} · 风险 ${U.esc(item.riskLevel || "unknown")} · ${U.esc(item.source?.label || "unknown source")}</span><button class="small" data-action="kernel-deliver-candidate" data-candidate-id="${U.esc(item.id)}">投递</button></div>`).join("") || `<p class="tiny muted">暂无候选</p>`}
      </section>
    </div>
  </details>`;
}

function renderWorkflowPanel() {
  if (!AS.selectedModule || String(AS.selectedModule.id || "").startsWith("char:") || AS.selectedModule.id === "__quick__") return "";
  const wf = AS.workflowStatus;
  const types = AS.workflowTypes || [];
  return `<details class="kernel-panel" data-workflow-panel open>
    <summary><strong>Workflow</strong><span class="tiny muted">${wf ? `${wf.workflowLayer || "active"} · ${wf.services?.length || 8} services` : "点击加载"}</span></summary>
    <div class="kernel-grid" style="grid-template-columns:1fr 1fr">
      <section><strong>状态</strong><p class="tiny">${wf ? `preflightProtected: ${wf.preflightProtected} · layer: ${wf.workflowLayer}` : "未加载"}</p>
        <button class="small" data-action="workflow-refresh">刷新</button></section>
      <section><strong>服务</strong><p class="tiny">${wf?.services ? wf.services.join(", ") : "-"}</p></section>
      <section><strong>可用类型</strong><p class="tiny">${types.length ? types.map(item => U.esc(item.type || item)).join(" · ") : "未加载"}</p></section>
      <section><strong>最近运行</strong><p class="tiny">${AS.lastWorkflowRun ? `${U.esc(AS.lastWorkflowRun.status)} · ${U.esc(AS.lastWorkflowRun.totalMs || 0)}ms` : "尚未运行"}</p></section>
    </div>
  </details>`;
}

function renderProgressPanel() {
  if (!AS.busy || AS.progressIndex < 0) return "";
  return `<section class="progress-panel" aria-live="polite" data-progress-stage="${AS.progressIndex}">
    <div class="progress-track">${PROGRESS_STAGES.map((label, index) => `<span class="${index < AS.progressIndex ? "done" : index === AS.progressIndex ? "active" : ""}" title="${U.esc(label)}"></span>`).join("")}</div>
    <strong>${U.esc(PROGRESS_STAGES[AS.progressIndex] || PROGRESS_STAGES[0])}</strong>
    <span class="tiny muted">这是阶段状态提示，不代表流式输出。</span>
  </section>`;
}

function renderModePlayPanel() {
  const modeId = AS.selectedModule?.mode || AS.selectedModule?.type || "";
  const play = AS.modePlay || AS.engineState?.realPlay || {};
  const sections = [];
  const dice = play.tabletop?.lastDiceResult;
  if (modeId === "tabletop") {
    const tv2 = AS.tabletopV2 || {};
    if (tv2.runId) {
      // V2 运行时面板
      sections.push(`<section><strong>🎲 Tabletop V2</strong>
        <p class="tiny">规则集: ${U.esc(tv2.ruleset || "d20_fantasy")} · 模组: ${U.esc(tv2.module || "")}</p>
        ${tv2.lastRuling ? `<div class="roll-card"><span>投骰: ${U.esc(tv2.lastRuling.expression || "—")}</span><strong>${U.esc(tv2.lastRuling.total)}</strong><span class="badge ${tv2.lastRuling.outcome === "success" || tv2.lastRuling.outcome === "critical_success" ? "ok" : tv2.lastRuling.outcome === "partial_success" ? "pending" : "warn"}">${U.esc(tv2.lastRuling.outcome || "—")}</span></div>` : ""}
        ${tv2.lastRuling?.probabilityEstimate !== undefined ? `<p class="tiny muted">概率: ${Math.round(tv2.lastRuling.probabilityEstimate * 100)}%</p>` : ""}
        ${tv2.ending ? `<div class="notice ok">结局摘要已生成</div>` : ""}
        <div class="actions" style="margin-top:6px">
          <button data-action="tabletop-v2-save">💾 存档</button>
          <button data-action="tabletop-v2-branch">🔀 分支</button>
          <button data-action="tabletop-v2-end">📋 结局摘要</button>
          <button data-action="tabletop-v2-clear">✕ 清除</button>
        </div>
      </section>`);
    } else {
      // V2 导入面板（增强：支持预览展示 + 导入提交）
      const preview = tv2.importPreview;
      sections.push(`<section><strong>🎲 Tabletop V2 导入</strong>
        <p class="tiny muted">粘贴模组 JSON、Markdown 或自由文本开始冒险</p>
        <textarea id="tabletopV2ImportText" rows="5" placeholder='${U.esc('{\n  "title": "我的冒险",\n  "sourceType": "quick_start",\n  "playerBrief": { "premise": "..." }\n}')}' class="full-width" style="margin-bottom:6px;font-size:12px"></textarea>
        <div class="actions">
          <button data-action="tabletop-v2-preview-import">🔍 预览</button>
          <button class="primary" data-action="tabletop-v2-start">▶ 快速开始</button>
          <button data-action="tabletop-v2-import-commit">📥 导入并保存</button>
        </div>
        ${preview ? `<div class="notice" style="margin-top:6px"><strong>${U.esc(preview.title || preview.moduleId || "预览")}</strong><br><span class="tiny">场景: ${preview.sceneCount||preview.sceneNames?.length||0} · 角色: ${preview.characterCount||preview.characterNames?.length||0} · 规则: ${U.esc(preview.rulesetProfileId||"")}</span></div>` : ""}
      </section>`);
    }
  }
  const mystery = play.mystery?.discoveredClues ? play.mystery : play.mystery?.clueBoard;
  if (["mystery-puzzle", "murder-mystery"].includes(modeId)) sections.push(`<section><strong>线索卡与假设白板</strong><div class="play-card-grid">${(mystery?.discoveredClues || []).map(item => `<article><b>${U.esc(item.name)}</b><span>${U.esc(item.location || "已发现")}</span></article>`).join("") || `<span class="tiny muted">输入 /clue 线索名 记录已知线索。</span>`}</div>${(mystery?.hypotheses || []).length ? `<p class="tiny">假设：${mystery.hypotheses.map(item => U.esc(item.statement)).join(" · ")}</p>` : `<p class="tiny muted">输入 /hypothesis 假设内容 建立假设。</p>`}</section>`);
  const resources = play.strategy?.resources;
  if (modeId === "strategy-sim") sections.push(`<section><strong>策略资源</strong><div class="resource-grid">${Object.entries(resources || {}).map(([key, item]) => `<article><span>${U.esc(item.label || key)}</span><b>${U.esc(item.value)} / ${U.esc(item.max)}</b><div class="meter-track"><div class="meter-fill" style="width:${Math.max(0, Math.min(100, Number(item.value || 0)))}%"></div></div></article>`).join("") || `<span class="tiny muted">资源状态将在第一轮载入。</span>`}</div><p class="tiny muted">可用：/invest_military · /expand_trade · /fortify_defense · /diplomacy_focus</p></section>`);
  const narrative = play.narrative;
  if (narrative?.rhythmTag || narrative?.goals?.activeQuests?.length || narrative?.latestRecap) sections.push(`<section><strong>旅程</strong><p class="tiny">节奏：${U.esc(narrative.rhythmTag || "breath")}</p>${narrative.latestRecap ? `<p>${U.esc(narrative.latestRecap.summary)}</p>` : ""}${(narrative.goals?.activeQuests || []).map(item => `<p class="tiny">目标：${U.esc(item.name)} · ${U.esc(item.progress)}%</p>`).join("")}</section>`);
  return sections.length ? `<details class="kernel-panel mode-play-panel" open><summary><strong>真实游玩状态</strong><span class="tiny muted">runtime / candidate only</span></summary><div class="kernel-grid">${sections.join("")}</div></details>` : "";
}

function renderChangeMark(value, status = "") {
  if (value === undefined || value === null || value === "") return "";
  const text = typeof value === "number" && value > 0 ? `+${value}` : String(value);
  const tone = status === "down" || (typeof value === "number" && value < 0) ? "down" : status === "new" ? "new" : "up";
  return `<span class="state-change ${tone}">${U.esc(text)}</span>`;
}

function renderStatBar(card) {
  const min = Number(card.min || 0);
  const max = Number(card.max || 100);
  const value = Number(card.value || 0);
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return `<article class="status-card stat-bar-card">
    <div class="item-head"><strong>${U.esc(card.title || "状态")}</strong><span>${U.esc(value)} / ${U.esc(max)} ${renderChangeMark(card.delta)}</span></div>
    <div class="meter-track"><div class="meter-fill" style="width:${pct.toFixed(2)}%"></div></div>
    ${card.label || card.hint ? `<span class="tiny muted">${U.esc(card.label || card.hint)}</span>` : ""}
  </article>`;
}

function renderInventoryGrid(card) {
  const items = Array.isArray(card.items) ? card.items : [];
  return `<article class="status-card"><strong>${U.esc(card.title || "背包")}</strong>
    <div class="inventory-grid">${items.map(item => `<div class="inventory-item"><span>${U.esc(item.name || "物品")}</span><strong>×${U.esc(item.count ?? 0)}</strong>${renderChangeMark(item.delta, item.delta > 0 ? "new" : "down")}</div>`).join("") || `<span class="tiny muted">暂无物品</span>`}</div>
  </article>`;
}

function renderStatusList(card) {
  const items = Array.isArray(card.items) ? card.items : [];
  return `<article class="status-card"><strong>${U.esc(card.title || "状态")}</strong>
    <div class="status-list">${items.map(item => `<div><span>${U.esc(item.label || "状态")}</span><strong>${U.esc(item.value ?? "")}</strong>${renderChangeMark(item.delta || (item.status === "new" ? "NEW" : item.status === "changed" ? "CHANGED" : ""), item.status)}</div>`).join("") || `<span class="tiny muted">暂无状态</span>`}</div>
  </article>`;
}

function renderVisualPacket(packet) {
  const cards = Array.isArray(packet?.cards) ? packet.cards : [];
  return cards.map(card => {
    if (card.type === "stat_bar") return renderStatBar(card);
    if (card.type === "inventory_grid") return renderInventoryGrid(card);
    if (card.type === "status_list") return renderStatusList(card);
    return "";
  }).join("");
}

function renderStatusFrameSimple(frame) {
  const visual = renderVisualPacket(frame?.visual);
  if (visual) return `<div class="status-cards">${visual}</div>`;
  return C.empty("本轮暂无状态变化", "状态帧已保存；后续确认的角色、世界、背包、任务和机制状态会显示在这里。");
}

function renderStatusFrameDetailed(frame) {
  const changes = Array.isArray(frame?.changes) ? frame.changes : [];
  if (!changes.length) return renderStatusFrameSimple(frame);
  return `<div class="status-cards">${changes.map(change => `<article class="status-card detail-change">
    <div class="item-head"><strong>${U.esc(change.label || change.target || "状态")}</strong>${renderChangeMark(change.delta ?? (change.type === "new" ? "NEW" : "CHANGED"), change.type === "decrease" ? "down" : change.type)}</div>
    <div><span class="muted">${U.esc(change.before ?? "-")}</span> → <strong>${U.esc(change.after ?? "-")}</strong></div>
    ${change.reason ? `<p class="tiny muted">原因：${U.esc(change.reason)}</p>` : ""}
    ${change.evidence ? `<p class="tiny muted">证据：${U.esc(change.evidence)}</p>` : ""}
    ${change.confidence !== undefined ? `<span class="tiny muted">置信度：${U.esc(change.confidence)}</span>` : ""}
  </article>`).join("")}</div>`;
}

function renderStatusPanel() {
  if (!AS.statusPanelVisible) return `<aside class="status-panel status-panel--hidden"><button class="small" data-action="show-status-panel">显示状态</button></aside>`;
  const frame = currentTurnStateFrame();
  const historical = Boolean(AS.selectedTurnId);
  const title = historical ? `状态快照 · 第 ${frame?.round || "?"} 轮` : "状态 · 最新";
  return `<aside class="panel status-panel ${AS.statusPanelCollapsed ? "status-panel--collapsed" : ""}">
    <div class="panel-head">
      <div><h3>${U.esc(title)}</h3>${frame?.createdAt ? `<span class="tiny muted">${U.date(frame.createdAt)}</span>` : ""}</div>
      <div class="actions">
        ${historical ? `<button class="small" data-action="status-latest">返回最新</button>` : ""}
        <button class="small" data-action="status-density">${AS.statusPanelDensity === "simple" ? "详细" : "简洁"}</button>
        <button class="small" data-action="toggle-status-collapse">${AS.statusPanelCollapsed ? "展开" : "收敛"}</button>
        <button class="small ghost" data-action="hide-status-panel">隐藏</button>
      </div>
    </div>
    ${AS.statusPanelCollapsed ? `<span class="tiny muted">${frame?.changes?.length || 0} 项最新变化</span>` : frame ? (AS.statusPanelDensity === "detailed" ? renderStatusFrameDetailed(frame) : renderStatusFrameSimple(frame)) : C.empty("暂无状态帧", "完成一轮对话后，这里会显示已确认状态。")}
  </aside>`;
}

function renderNarrativeContextDebug() {
  const hits = AS.turnDebug?.worldbookHits || AS.dashboardData.narrative?.worldbookHits || [];
  const characterState = AS.turnDebug?.characterState || {};
  const memory = AS.turnDebug?.memorySnapshot || AS.dashboardData.narrative?.memory?.recentEntries || [];
  return `<div class="list">
    <div class="item"><div class="item-head"><strong>世界书命中</strong>${C.badge(Array.isArray(hits) ? hits.length : 0, "info")}</div>${Array.isArray(hits) && hits.length ? hits.slice(0, 8).map(hit => `<span class="tiny muted">${U.esc(hit.title || hit.keys?.[0] || "命中条目")}</span>`).join("") : `<span class="tiny muted">发送一轮对话后生成。</span>`}</div>
    <div class="item"><strong>当前角色状态</strong><pre>${U.esc(U.json(characterState))}</pre></div>
    <div class="item"><strong>记忆快照</strong><pre>${U.esc(U.json(memory))}</pre></div>
    <details><summary>Direction Packet</summary><pre>${U.esc(U.json(AS.turnDebug?.directionPacket || {}))}</pre></details>
    <details><summary>Guardian</summary><pre>${U.esc(U.json(AS.turnDebug?.guardian || {}))}</pre></details>
  </div>`;
}

function renderBranchDebug() {
  const assistants = AS.messages.filter(message => message.role === "assistant");
  const candidateCount = assistants.reduce((sum, message) => sum + Math.max(0, (message.candidates || []).length - 1), 0);
  const favorites = AS.messages.filter(message => message.favorite);
  return `<div class="grid"><div class="auto-grid compact">${C.stat("助手回复", assistants.length)}${C.stat("候选版本", candidateCount)}${C.stat("收藏", favorites.length)}</div>
    <div class="list">${assistants.filter(message => (message.candidates || []).length > 1 || message.favorite).slice(-10).map(message => `<div class="item"><strong>${message.favorite ? "收藏" : "候选"}</strong><span class="tiny muted">${U.esc(U.compact(message.content || "", 160))}</span></div>`).join("") || `<span class="tiny muted">候选与收藏只形成分支索引，不会篡改已确认状态帧。</span>`}</div></div>`;
}

function renderMechanismDebug() {
  const frame = currentTurnStateFrame();
  return `<div class="list">
    <div class="item"><strong>机制更新 proposal</strong><span class="tiny muted">未确认 proposal 不进入状态栏，仅在专用机制流程确认后写入缓存。</span></div>
    <div class="item"><strong>已应用变化</strong><pre>${U.esc(U.json((frame?.changes || []).filter(change => change.category === "mechanism" && change.applied)))}</pre></div>
    <div class="item"><strong>当前 TurnStateFrame</strong><span class="tiny muted">${U.esc(frame?.turnId || "暂无")}</span></div>
    <div class="item"><strong>状态 hash</strong><span class="tiny muted mono">${U.esc(frame?.afterStateHash || "暂无")}</span></div>
  </div>`;
}

function renderVisualDebug() {
  const packet = currentTurnStateFrame()?.visual || { version: "visual-dsl.v1", mode: "simple", cards: [] };
  return `<div class="list"><div class="item"><strong>当前 visual packet</strong><pre>${U.esc(U.json(packet))}</pre></div><div class="item"><strong>渲染警告</strong><span class="tiny muted">未知卡片类型与 raw HTML / JS / CSS 会被安全拒绝。</span></div></div>`;
}

function renderDeveloperObservabilityDrawer() {
  if (!AS.developerObservabilityOpen) return "";
  const tabs = [
    ["context", "叙事上下文"], ["branches", "候选与分支"], ["mechanisms", "机制调试"], ["visual", "Visual DSL"]
  ];
  const body = ({ context: renderNarrativeContextDebug, branches: renderBranchDebug, mechanisms: renderMechanismDebug, visual: renderVisualDebug }[AS.developerObservabilityTab] || renderNarrativeContextDebug)();
  return `<div class="developer-observability-drawer developer-observability-drawer--open" data-action="close-developer-observability">
    <aside class="developer-observability-sheet" onclick="event.stopPropagation()">
      <div class="overlay-head"><div><h3>开发者观测</h3><span class="tiny muted">当前对话现场调试数据</span></div><button data-action="close-developer-observability">关闭</button></div>
      <div class="tabs developer-observability-tabs">${tabs.map(([id, label]) => `<button class="${AS.developerObservabilityTab === id ? "active" : ""}" data-action="developer-observability-tab" data-observability-tab="${U.esc(id)}">${U.esc(label)}</button>`).join("")}</div>
      <div class="developer-observability-content">${body}</div>
    </aside>
  </div>`;
}

const CH = {
  key(m) { return `wt-chat-${m?.id || "global"}`; },
  loadLocal(m) {
    try { AS.messages = JSON.parse(localStorage.getItem(CH.key(m)) || "[]"); } catch { AS.messages = []; }
  },
  persist() {
    if (AS.isQuickStart || !AS.selectedModule) return;
    localStorage.setItem(CH.key(AS.selectedModule), JSON.stringify(AS.messages.slice(-200)));
  },
  add(role, content, ext = {}) {
    const msg = { id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`, role, content, ts: new Date().toISOString(), ...ext };
    AS.messages.push(msg);
    CH.persist();
    return msg;
  },
  async loadServer(m) {
    if (!m || m.id === "__quick__") return CH.loadLocal(m);
    try {
      const res = await API.get(`/api/modules/${encodeURIComponent(m.id)}/history?limit=80`);
      AS.messages = Array.isArray(res.messages)
        ? res.messages.map((r, i) => ({ id: r.id || `h_${i}`, role: r.role, content: r.content, ts: r.ts, favorite: !!r.favorite, candidates: r.candidates || [], sections: r.sections || null, round: r.round || null, turnId: r.turnId || (r.round ? `turn-${r.round}` : "") }))
        : [];
      AS.lastScene = res.lastScene || "";
      AS.engineState = res.engineState || AS.engineState;
      if (res.turnCount && AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
    } catch {
      CH.loadLocal(m);
    }
  },
};

const Views = {
  workbench() {
    if (AS.workbenchMode === "chat") {
      return `<div class="grid">
        <div class="actions">
          <button class="ghost" data-action="workbench-overview">返回总览</button>
          <button data-action="drawer-worldbook">世界书</button>
          <button data-action="drawer-saves">存档</button>
          ${AS.isQuickStart ? C.badge("快速项目草稿", "warn") : ""}
        </div>
        ${C.chatSurface()}
      </div>${renderDrawer()}`;
    }

    const current = AS.selectedModule || AS.modules.find(m => m.type === "world") || AS.modules[0];
    const worldName = current ? (current.displayName || current.name) : "未选择世界";
    const reviewCount = AS.reviewItems.length;
    return `<div class="grid">
      <section class="panel hero">
        <div class="hero-row">
          <div>
            ${C.badge(current ? "当前世界" : "等待选择", current ? "ok" : "pending")}
            <div class="hero-title">${U.esc(worldName)}</div>
            <p class="sub">${current ? `${C.dataModeLabel(current)} · ${current.subType || "classic"}` : "创建或导入一个世界后开始创作。"}</p>
          </div>
          <div class="actions">
            <button class="primary" data-action="load-and-chat">加载并开始对话</button>
            <button data-action="create-world">新建世界</button>
            <button data-action="library-alchemy">导入素材</button>
          </div>
        </div>
      </section>

      <section class="cols-4">
        ${C.stat("模型连接", AS.llmConnected ? "已连接" : "未连接", AS.config.llmModel || "")}
        ${C.stat("当前回合", current?.turnCount || 0)}
        ${C.stat("世界书条目", AS.worldbookEntries.length)}
        ${C.stat("待审核", reviewCount, reviewCount ? "等待确认" : "无")}
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>预设/设定：粘贴设定，快速开始 AI 互动</h2><p class="sub">适合轻度用户、AI 设定爱好者和文字冒险玩家。你可以直接粘贴角色、世界观、开场剧情或规则片段，World Tree 会创建一个可继续、可审核、可导出的草稿世界。</p></div></div>
        <div id="quickStartDrop" class="drop-zone"><strong>拖拽文件 / 文件夹到此处，或点击选择</strong><span>支持 .md .txt .json</span></div>
        <textarea id="quickStartText" placeholder="或在这里粘贴设定、片段、角色描述..."></textarea>
        <div class="actions"><button class="primary" data-action="quick-start-chat">创建预设/设定草稿并开始</button><span class="tiny muted">不需要先写完整世界书。后续可以把草稿整理成正式世界。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>世界冒险 / World RPG <span class="badge beta">Beta</span></h2><p class="sub">以 GM 方式在开放世界中冒险。粘贴世界设定或冒险背景。</p></div></div>
        <input id="wrpgTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="wrpgText" placeholder="粘贴世界设定、冒险背景、初始场景。"></textarea>
        <div class="actions"><button class="primary" data-action="world-rpg-start">创建世界冒险</button><span class="tiny muted">最小闭环版本，任务/战斗/成长系统后续开放。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>解谜推理 / Mystery Puzzle <span class="badge exp">Experimental</span></h2><p class="sub">在谜题主持人的引导下探索线索、解开谜题。</p></div></div>
        <input id="mysteryTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="mysteryText" placeholder="粘贴谜题、悬疑场景、线索片段。"></textarea>
        <div class="actions"><button class="primary" data-action="mystery-puzzle-start">创建解谜项目</button><span class="tiny muted">已提供线索卡与假设白板薄切片；完整推理引擎未实现。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>跑团 / Tabletop <span class="badge exp">Experimental</span></h2><p class="sub">在跑团 GM 主持下进行自由规则的角色扮演冒险。</p></div></div>
        <input id="tabletopTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="tabletopText" placeholder="粘贴跑团背景、规则偏好、开场场景。"></textarea>
        <div class="actions"><button class="primary" data-action="tabletop-start">创建跑团项目</button><span class="tiny muted">支持 /roll 骰子薄切片；不是完整 DND 规则系统。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>策略模拟 / Strategy Sim <span class="badge exp">Experimental</span></h2><p class="sub">在策略顾问协助下进行阵营经营与决策推演。</p></div></div>
        <input id="strategyTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="strategyText" placeholder="粘贴阵营、局势、资源或策略目标。"></textarea>
        <div class="actions"><button class="primary" data-action="strategy-sim-start">创建策略项目</button><span class="tiny muted">已提供四项资源与决策薄切片；不是完整 4X。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>剧本杀 / Murder Mystery <span class="badge exp">Experimental</span></h2><p class="sub">在案件主持人引导下调查线索、推理真相。</p></div></div>
        <input id="murderTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="murderText" placeholder="粘贴案件背景、角色、线索设定。"></textarea>
        <div class="actions"><button class="primary" data-action="murder-mystery-start">创建剧本杀项目</button><span class="tiny muted">真相锁继续生效，并提供玩家可见线索板薄切片。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>人物卡 / Character：粘贴人物卡，开始角色扮演</h2><p class="sub">粘贴任意格式的人物卡文本（JSON / 纯文本 / 角色描述），World Tree 会创建一个 character 模式项目并使用人物卡引擎进行对话。</p></div></div>
        <input id="charCardTitle" placeholder="角色名 / 项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="charCardText" placeholder="在这里粘贴人物卡内容..."></textarea>
        <div class="actions"><button class="primary" data-action="character-start-chat">创建人物卡并开始对话</button><span class="tiny muted">支持 SillyTavern v2/v3 JSON、纯文本角色描述。后续可在角色库中管理。</span></div>
      </section>

      <section class="cols-2">
        <div class="panel">
          <div class="panel-head"><div><h2>世界书总览</h2><p class="sub">展示与快速进入，完整编辑在资料库。</p></div><button class="small" data-action="load-worldbook">加载</button></div>
          <div class="list">${C.worldbookRows(3)}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>存档总览</h2><p class="sub">最近故事和模块历史。</p></div>${C.badge(AS.messages.length + " 条消息", "pending")}</div>
          ${AS.lastScene ? `<div class="notice">上一幕：${U.esc(U.compact(AS.lastScene, 120))}</div>` : ""}
          <div class="list">
            ${(AS.modules || []).slice(0, 4).map(m => `<div class="item"><div class="item-head"><strong>${U.esc(m.displayName || m.name)}</strong>${C.badge((m.turnCount || 0) + " 回合")}</div><span class="tiny muted">${m.lastPlayed ? U.rel(m.lastPlayed) : "未开始"}</span><button class="small" data-module-id="${U.esc(m.id)}" data-action="load-module-from-list">继续</button></div>`).join("") || C.empty("暂无存档")}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>示例与模板</h2><p class="sub">当前开源包默认不携带原创素材；你后续放入 defaults/examples manifest 后可从这里安装。</p></div>${C.badge(AS.examples.length + " 个示例", "pending")}</div>
        <div class="list">${AS.examples.length ? AS.examples.map(ex => `<div class="item" data-example-id="${U.esc(ex.id)}"><div class="item-head"><strong>${U.esc(ex.title || ex.name || ex.id)}</strong>${C.badge(ex.kind || "example", "info")}</div><span class="tiny muted">${U.esc(ex.description || "可安装为本地世界。")}</span><button class="small primary" data-action="install-example">安装示例</button></div>`).join("") : C.empty("暂无内置示例", "保持无授权素材策略，等待你后续提供素材。")}</div>
      </section>
    </div>`;
  },

  chat() { return C.chatSurface(); },

  library() {
    const tabs = [
      { id: "characters", label: "角色库", count: AS.characters.length },
      { id: "worldbook", label: "世界书", count: AS.worldbookEntries.length },
      { id: "worlddata", label: "世界数据" },
      { id: "alchemy", label: "炼金台" },
      { id: "review", label: "审核队列", count: AS.reviewItems.length },
    ];
    const body = {
      characters: renderCharacters,
      worldbook: renderWorldbook,
      worlddata: renderWorldData,
      alchemy: renderAlchemy,
      review: renderReview,
    }[AS.libraryTab]();
    return `<div class="grid">
      <div><h2>资料库</h2><p class="sub">角色、世界书、世界数据、炼金台与审核队列。</p></div>
      ${C.tabs(tabs, AS.libraryTab, "data-library-tab")}
      ${body}
    </div>`;
  },

  worlds() {
    return `<div class="grid">
      <div><h2>世界管理</h2><p class="sub">世界、模块、存档、备份、世界包与危险操作。</p></div>
      <section class="cols-2">
        <div class="panel">
          <div class="panel-head"><h2>世界 / 模块列表</h2><button class="small" data-action="refresh-modules">刷新</button></div>
          <div class="module-grid">${AS.modules.length ? AS.modules.map(C.moduleCard).join("") : C.empty("暂无世界", "请新建世界或导入世界包。")}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>创建</h2></div>
          <div class="actions">
            <button class="primary" data-action="create-world">空白世界</button>
            <button data-action="create-from-material">从素材创建</button>
            <button data-action="library-alchemy">打开炼金台</button>
          </div>
          <div class="notice warn" style="margin-top:12px">删除、覆盖导入、清空 runtime 等危险操作必须二次确认。</div>
        </div>
      </section>
      <section class="layout-2">
        <div class="panel">
          <div class="panel-head"><h2>.worldtree 世界包</h2></div>
          <div class="check-grid">
            ${[
              ["includeWorldbook", "世界书"],
              ["includeCharacters", "角色"],
              ["includeSharedData", "其他 shared 数据"],
              ["includeRuntimeState", "运行状态"],
              ["includeReviewQueue", "审核队列（未确认）"],
              ["includeMechanisms", "已确认机制缓存"],
              ["includeTurnStateFrames", "TurnStateFrame 历史"]
            ].map(([key, label]) => `<label><input type="checkbox" data-pack-option="${key}" ${AS.worldPackOptions[key] ? "checked" : ""}> ${label}</label>`).join("")}
          </div>
          <div class="actions"><button class="primary" data-action="export-worldpack">导出当前世界</button><button data-action="import-worldpack">导入世界包</button></div>
          <div style="margin-top:12px">${AS.worldPack ? `<pre>${U.esc(U.json(AS.worldPack.summary || AS.worldPack))}</pre><div class="actions"><button class="primary" data-action="download-worldpack">下载 .worldtree</button></div>` : AS.importPreview ? `<div class="notice ${AS.importPreview.summary?.hasConflict ? "warn" : "ok"}">导入预览：${AS.importPreview.preview ? "等待确认" : "已跳过预览"}${AS.importPreview.summary?.hasConflict ? "，检测到同名世界，将自动重命名导入" : ""}</div><pre>${U.esc(U.json(AS.importPreview.summary || AS.importPreview))}</pre><button class="primary" data-action="confirm-worldpack-import">确认导入</button>` : C.empty("尚未选择导入或导出")}</div>
        </div>
        <aside class="panel">
          <h3>默认排除</h3>
          <div class="list"><div class="item">API Key / secrets</div><div class="item">debug / proposal / session</div><div class="item">runtime/chat.jsonl</div><div class="item">runtime/memory.jsonl</div><div class="item">runtime/state.json</div><div class="item">未确认素材与机制草稿</div></div>
        </aside>
      </section>
    </div>`;
  },

  observe() {
    const tabs = [
      { id: "summary", label: "摘要" },
      { id: "blackbox", label: "叙事黑盒" },
      { id: "telemetry", label: "世界脉象" },
      { id: "entities", label: "世界构成" },
      { id: "health", label: "健康体检" },
    ];
    const body = {
      summary: renderObserveSummary,
      blackbox: renderBlackbox,
      telemetry: renderTelemetry,
      entities: renderEntities,
      health: renderHealth,
    }[AS.observeTab]();
    return `<div class="grid">
      <div><h2>观测</h2><p class="sub">理解与调试叙事引擎，技术细节默认折叠。</p></div>
      <div class="actions">${C.tabs(tabs, AS.observeTab, "data-observe-tab")}<button data-action="refresh-observe">刷新观测</button></div>
      ${body}
    </div>`;
  },

  settings() {
    // Fallback: if deferred plugins are hidden but user had stale tab state
    if (!ENABLE_DEFERRED_PLUGINS && AS.settingsTab === "plugins") AS.settingsTab = "connections";
    const tabs = [];
    tabs.push({ id: "connections", label: "模型连接" });
    if (ENABLE_DEFERRED_PLUGINS) tabs.push({ id: "plugins", label: "插件" });
    tabs.push({ id: "data", label: "数据与备份" });
    tabs.push({ id: "appearance", label: "外观" });
    tabs.push({ id: "advanced", label: "高级" });
    const body = (ENABLE_DEFERRED_PLUGINS
      ? { connections: renderConnections, plugins: renderPlugins, data: renderDataSettings, appearance: renderAppearance, advanced: renderAdvanced }
      : { connections: renderConnections, data: renderDataSettings, appearance: renderAppearance, advanced: renderAdvanced })[AS.settingsTab]();
    return `<div class="grid">
      <div><h2>设置</h2><p class="sub">低频、敏感与技术性操作集中在这里。</p></div>
      ${C.tabs(tabs, AS.settingsTab, "data-settings-tab")}
      ${body}
    </div>`;
  },
};

function renderCharacters() {
  const q = (AS.characterQuery || "").toLowerCase();
  const list = (AS.characters || []).filter(c => !q || [c.name, c.description, (c.tags || []).join(" ")].join(" ").toLowerCase().includes(q));
  return `<section class="layout-2">
    <div class="panel">
      <div class="panel-head"><div><h2>角色库</h2><p class="sub">支持 ST v2/v3 JSON，PNG metadata 会尝试解析。</p></div><button class="small" data-action="refresh-characters">刷新</button></div>
      <div class="actions"><button class="primary" data-action="import-character-json">批量导入 JSON/PNG</button><input id="characterSearch" placeholder="搜索角色 / 标签" value="${U.esc(AS.characterQuery)}"></div>
      <p class="tiny muted">数据位置：<code>data/engine/characters</code></p>
      <div class="actions" style="margin-bottom:10px"><button class="small wt-secondary-button" type="button" data-character-v2-advanced-toggle="character-v2-advanced">高级设置</button></div>
      <div class="panel character-v2-create-panel" style="margin-bottom:12px">
        <div class="panel-head"><h3>创建 Text-first 角色</h3><span class="tiny muted">输入角色名和设定，World Tree 会整理为角色运行胶囊。高级设置默认隐藏。</span></div>
        <input id="v2CreateName" placeholder="角色名（必填）" class="full-width" style="margin-bottom:8px" value="${U.esc(AS.characterV2Create.name)}">
        <textarea id="v2CreateText" placeholder="角色设定（自由文本，如：普通日本学生，语气温和，有点嘴硬。）" style="min-height:80px">${U.esc(AS.characterV2Create.text)}</textarea>
        <div style="margin-top:8px"><input type="file" id="v2CreateAvatar" accept="image/png,image/jpeg,image/webp" style="display:none"><button class="small" data-action="character-v2-avatar-select" type="button">${AS.characterV2Create.avatar ? "更换头像" : "选择头像（可选）"}</button><span class="tiny muted" id="v2CreateAvatarLabel" style="margin-left:8px">${AS.characterV2Create.avatar ? U.esc(AS.characterV2Create.avatar.label || "已选择") : ""}</span></div>
        ${AS.characterV2Create.preview ? `<div class="character-v2-create-summary" style="margin-top:8px;padding:8px;background:var(--surface-2);border-radius:8px"><strong>${U.esc(AS.characterV2Create.preview.title || "预览")}</strong><p class="tiny">${U.esc(AS.characterV2Create.preview.subtitle || "")}</p>${(AS.characterV2Create.preview.lines || []).map(l => `<p class="tiny muted">${U.esc(l)}</p>`).join("")}</div>` : ""}
        ${AS.characterV2Create.error ? `<p class="tiny" style="color:var(--bad)">${U.esc(AS.characterV2Create.error)}</p>` : ""}
        <div class="actions" style="margin-top:8px">
          <button class="small primary" data-action="character-v2-preview">预览角色草案</button>
          <button class="small" data-action="character-v2-confirm" ${!AS.characterV2Create.preview ? "disabled" : ""}>确认创建角色</button>
          <button class="small" data-action="character-v2-advanced-toggle" type="button">${AS.characterV2Create.advancedOpen ? "隐藏高级设置" : "高级设置"}</button>
        </div>
        ${AS.characterV2Create.advancedOpen ? `<div class="character-v2-advanced-panel is-open" style="margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px"><p class="tiny muted"><strong>来源类型</strong>：manual（手动文本）</p><p class="tiny muted"><strong>运行契约</strong>：角色不自称 AI/模型，不讨论 prompt/token/API</p><p class="tiny muted"><strong>常识认知</strong>：熟悉日常概念（微信/手机等），专业/技术知识受限</p><p class="tiny muted"><strong>表现指纹</strong>：待后续编辑完善</p><p class="tiny muted"><strong>头像状态</strong>：UI-only，不参与角色理解</p></div>` : ""}
      </div>
      <div class="module-grid">${list.length ? list.map(c => `<div class="module-card" data-character-id="${U.esc(c.id)}"><div class="item-head"><strong>${U.esc(c.name)}</strong>${C.badge(c.format || "native", "info")}</div><p class="tiny muted">${U.esc(U.compact(c.description || "无描述", 100))}</p><div class="chip-row">${(c.tags || []).slice(0, 6).map(t => `<span class="chip">${U.esc(t)}</span>`).join("") || `<span class="tiny muted">暂无标签</span>`}</div><div class="actions"><button class="small primary" data-action="rp-character">开始 RP</button><button class="small" data-action="preview-character">预览</button><button class="small" data-action="edit-character-meta">标签/说明</button><button class="small" data-action="backup-character">备份</button><button class="small danger" data-action="delete-character">删除</button></div></div>`).join("") : C.empty("暂无角色卡", "导入角色卡后会显示在这里。")}</div>
    </div>
${AS.currentV2RuntimeMvp?.available ? `<div class="character-v2-create-summary" style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:8px"><strong>V2 角色回复（实验）</strong><textarea id="characterV2LiveInput" placeholder="对这个角色说一句话……" style="width:100%;min-height:50px;margin-top:8px" ${AS.characterV2Live.busy ? "disabled" : ""}>${U.esc(AS.characterV2Live.input)}</textarea>${AS.characterV2Live.reply ? `<div style="margin-top:8px;padding:8px;background:var(--surface);border-radius:6px"><strong>${U.esc(AS.currentV2RuntimeMvp.displayName || "角色")}：</strong><p class="tiny">${U.esc(AS.characterV2Live.reply)}</p></div>` : ""}${AS.characterV2Live.candidates ? `<p class="tiny muted">候选：记忆 ${AS.characterV2Live.candidates.memory} · 关系 ${AS.characterV2Live.candidates.relationship} · 质量 ${AS.characterV2Live.candidates.quality}</p>` : ""}${AS.characterV2Live.quality && !AS.characterV2Live.quality.ok ? `<p class="tiny" style="color:var(--bad)">⚠ 质量风险</p>` : ""}${AS.characterV2Live.error ? `<p class="tiny" style="color:var(--bad)">${U.esc(AS.characterV2Live.error)}</p>` : ""}<div class="actions" style="margin-top:6px"><button class="small primary" data-action="character-v2-live-send" ${AS.characterV2Live.busy ? "disabled" : ""}>发送给角色</button><button class="small" data-action="character-v2-live-dry-run" ${AS.characterV2Live.busy ? "disabled" : ""}>Dry Run</button>${AS.characterV2Live.candidateEnvelope ? `<button class="small primary" data-action="character-v2-candidates-save">保存候选到审核队列</button>` : ""}<button class="small" data-action="character-v2-live-advanced-toggle">${AS.characterV2Live.advancedOpen ? "隐藏高级" : "高级详情"}</button></div>${AS.characterV2Live.advancedOpen ? `<div class="character-v2-advanced-panel is-open" style="margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px">${AS.characterV2Live.packetSummary ? `<p class="tiny muted">Packet：${AS.characterV2Live.packetSummary.packetChars || 0} chars</p>` : ""}${AS.characterV2Live.quality ? `<p class="tiny muted">质量：${AS.characterV2Live.quality.ok ? "通过" : "风险"} · ${(AS.characterV2Live.quality.risks || []).length} 风险</p>` : ""}</div>` : ""}</div>` : ""}
    <aside class="panel">${AS.currentCharacterCard ? `<h3>角色预览</h3>${AS.currentV2Capsule ? `<div class="character-v2-create-summary" style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:8px"><strong>${U.esc(AS.currentV2Capsule.displayName || "角色胶囊")}</strong><p class="tiny">${U.esc(AS.currentV2Capsule.summary?.subtitle || "")}</p>${(AS.currentV2Capsule.summary?.lines || []).map(l => `<p class="tiny muted">${U.esc(l)}</p>`).join("")}${AS.currentV2Capsule.avatar ? `<p class="tiny muted">头像：UI-only 展示资产</p>` : ""}</div>` : ""}${AS.currentV2RuntimeMvp?.available ? `<div class="character-v2-create-summary" style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:8px"><strong>${U.esc(AS.currentV2RuntimeMvp.normalSummary?.title || "Runtime MVP")}</strong><p class="tiny">${U.esc(AS.currentV2RuntimeMvp.normalSummary?.subtitle || "")}</p>${(AS.currentV2RuntimeMvp.normalSummary?.lines || []).map(l => `<p class="tiny muted">${U.esc(l)}</p>`).join("")}${AS.currentV2RuntimeMvp.candidates ? `<p class="tiny muted">候选：记忆 ${AS.currentV2RuntimeMvp.candidates.memoryCount} · 关系 ${AS.currentV2RuntimeMvp.candidates.relationshipCount} · 质量 ${AS.currentV2RuntimeMvp.candidates.qualityCount}</p>` : ""}<div class="actions"><button class="small" data-action="character-v2-runtime-advanced" type="button">${AS.characterV2RuntimeAdvancedOpen ? "隐藏高级详情" : "高级详情"}</button></div>${AS.characterV2RuntimeAdvancedOpen ? `<div class="character-v2-advanced-panel is-open" style="margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px"><p class="tiny muted"><strong>Prompt Preview</strong>：${AS.currentV2RuntimeMvp.promptPacketSummary?.blockCount || 0} blocks</p><p class="tiny muted"><strong>First-turn Template</strong>：${(AS.currentV2RuntimeMvp.firstTurnDraftTemplate?.template || []).length} lines</p><p class="tiny muted"><strong>Safety</strong>：previewOnly · readOnly · 未注入 LLM</p>${(AS.currentV2RuntimeMvp.advancedSummary?.errors || []).map(e => `<p class="tiny" style="color:var(--bad)">${U.esc(e)}</p>`).join("")}</div>` : ""}</div>` : ""}${AS.currentV2RuntimeContext?.available && !AS.currentV2RuntimeMvp?.available ? `<div class="character-v2-create-summary" style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:8px"><strong>运行上下文：已就绪</strong><p class="tiny muted">Read-only · 未注入 LLM</p>${(AS.currentV2RuntimeContext.normalSummary?.lines || []).map(l => `<p class="tiny muted">${U.esc(l)}</p>`).join("")}</div>` : ""}${AS.currentV2Capsule ? `<div class="actions" style="margin-bottom:8px"><button class="small" data-action="character-preview-raw-toggle" type="button">${AS.characterPreviewRawOpen ? "隐藏原始 JSON" : "显示原始 JSON"}</button></div>${AS.characterPreviewRawOpen ? `<pre>${U.esc(U.json(AS.currentCharacterCard))}</pre>` : ""}` : `<pre>${U.esc(U.json(AS.currentCharacterCard))}</pre>`}` : C.empty("角色预览", "选择一张角色卡查看详情。")}</aside>
  </section>
  <section class="panel character-v2-advanced-panel" data-character-v2-advanced-panel="character-v2-advanced" hidden>
    <div class="panel-head"><h3>高级设置</h3><span class="tiny muted">Character Capsule V2 — 已启用 Text-first Runtime</span></div>
    <p class="tiny muted">此处将展示完整字段编辑、表现指纹、记忆详细管理、关系详细管理、Lore 管理、CHARACTER.md 预览/导出、Prompt 预览、模块调用摘要、OOC/drift 分数、Dialogue regression、Token budget、来源映射等高级功能。当前这些模块尚未实现。</p>
  </section>`;
}

function renderWorldbook() {
  const groups = [...new Set((AS.worldbookEntries || []).map(e => e.group || "默认"))];
  return `<section class="layout-2">
    <div class="panel">
      <div class="panel-head"><div><h2>世界书</h2><p class="sub">兼容 <code>shared/worldbook.json</code>，支持批量导入导出和分组。</p></div><div class="actions"><button class="small" data-action="load-worldbook">加载</button><button class="small" data-action="import-worldbook-json">导入</button><button class="small" data-action="export-worldbook-json">导出</button><button class="small primary" data-action="new-worldbook-entry">新增条目</button></div></div>
      <div class="chip-row">${groups.map(g => `<span class="chip">${U.esc(g)}</span>`).join("") || `<span class="tiny muted">暂无分组</span>`}</div>
      <div class="list">${C.worldbookRows()}</div>
    </div>
    <aside class="panel">
      <h3>触发测试</h3>
      <textarea id="worldbookTestInput" placeholder="输入玩家行动或场景文本，测试会命中哪些条目。"></textarea>
      <button class="primary" data-action="test-worldbook">测试触发</button>
      <div class="list" style="margin-top:10px">${AS.worldbookTest?.hits?.length ? AS.worldbookTest.hits.map(h => `<div class="item"><strong>${U.esc(h.title || h.keys?.[0] || "命中条目")}</strong><span class="tiny muted">${U.esc(h.reason || "")}</span><pre>${U.esc(h.content || "")}</pre></div>`).join("") : C.empty("等待测试", "命中条目会显示排序原因。")}</div>
    </aside>
  </section>`;
}

function renderWorldData() {
  const d = AS.dashboardData.entities || {};
  const rows = [
    ["角色", d.characters?.length || 0],
    ["场景", d.scenes?.length || 0],
    ["组织", d.organizations?.length || 0],
    ["地点", d.locations?.length || 0],
    ["世界书条目", d.worldbookCount || AS.worldbookEntries.length],
  ];
  return `<section class="grid">
    <div class="auto-grid">${rows.map(([k, v]) => C.stat(k, v)).join("")}</div>
    <div class="panel"><div class="panel-head"><h2>结构化世界数据</h2><button class="small" data-action="load-worlddata">刷新</button></div><pre>${U.esc(U.json({ characters: d.characters || [], scenes: d.scenes || [], organizations: d.organizations || [], locations: d.locations || [] }))}</pre></div>
  </section>`;
}

function renderAlchemy() {
  const modes = [
    ["import", "素材导入"], ["co_create", "协作创作"], ["polish", "整理润色"], ["structure", "结构预览"]
  ];
  const targets = [
    ["mixed", "自动识别"], ["worldbook", "世界书条目"], ["character", "角色设定"], ["location", "地点"],
    ["faction", "组织 / 阵营"], ["rule", "规则 / 魔法体系"], ["plot", "剧情线"], ["opening", "开场场景"], ["world_draft", "草稿世界"]
  ];
  const busy = AS.alchemyPreviewBusy || AS.alchemyCommitBusy;
  return `<section class="alchemy-workbench">
    <div class="alchemy-main grid"><div class="panel">
      <div class="panel-head"><div><h2>炼金台</h2><p class="sub">把灵感、片段和角色资料整理为可审核的世界数据。预览不会写入审核队列或正式世界。</p></div></div>
      <div class="stack">
        <div><label class="field-label">模式</label><div class="tabs alchemy-modes">${modes.map(([id, label]) => `<button class="${AS.alchemyMode === id ? "active" : ""}" data-action="alchemy-set-mode" data-alchemy-mode="${id}" ${busy ? "disabled" : ""}>${U.esc(label)}</button>`).join("")}</div></div>
        <div class="cols-2 alchemy-fields">
          <label><span class="field-label">目标类型</span><select id="alchemyTarget" ${busy ? "disabled" : ""}>${targets.map(([id, label]) => `<option value="${id}" ${AS.alchemyTarget === id ? "selected" : ""}>${U.esc(label)}</option>`).join("")}</select></label>
          <label><span class="field-label">用户目标 / 创作方向</span><input id="alchemyUserGoal" maxlength="4000" value="${U.esc(AS.alchemyUserGoal)}" placeholder="可选，例如：突出终端系统，不要神明化" ${busy ? "disabled" : ""}></label>
        </div>
        <div id="alchemyDrop" class="drop-zone"><strong>拖拽文件或点击选择</strong><span>支持 .md .txt .json .png</span></div>
        <label><span class="field-label">素材 / 灵感文本</span><textarea id="alchemyText" maxlength="120000" placeholder="粘贴设定资料，或写下一句尚未成形的灵感..." ${busy ? "disabled" : ""}>${U.esc(AS.alchemyText)}</textarea></label>
        ${AS.alchemyError ? C.notice(AS.alchemyError, "bad") : ""}
        <div class="actions">
          <button class="primary" data-action="alchemy-preview" ${busy ? "disabled" : ""}>${AS.alchemyPreviewBusy ? "处理中..." : "预览处理结果"}</button>
          <button data-action="alchemy-import" ${busy ? "disabled" : ""}>直接提取到审核队列</button>
          <span id="alchemyResult" class="tiny muted">旧流程会跳过预览并直接入队。</span>
        </div>
      </div>
    </div>
    ${renderAlchemyPreview()}</div>
    ${renderMechanismLibraryPanel()}
  </section>`;
}

function renderAlchemyPreview() {
  const preview = AS.alchemyPreview;
  if (!preview) return C.empty("暂无处理预览", "输入素材后点击“预览处理结果”。");
  const counts = preview.summary?.counts || {};
  const countLabels = [["character", "角色"], ["location", "地点"], ["faction", "组织"], ["rule", "规则"], ["plot", "剧情"], ["worldbook", "世界书"], ["other", "其他"]];
  const listBlock = (title, values, renderValue) => values?.length ? `<div class="alchemy-section"><h3>${U.esc(title)}</h3><div class="list">${values.map(renderValue).join("")}</div></div>` : "";
  const itemCards = (preview.items || []).map(item => {
    const editing = AS.alchemyEditingItemId === item.id;
    const selected = item.selected !== false && AS.alchemySelectedItemIds.includes(item.id);
    const refs = (item.sourceRefs || []).map(ref => `${ref.label || "来源"}${ref.excerpt ? `：${U.compact(ref.excerpt, 180)}` : ""}`).join("；");
    return `<article class="item alchemy-item ${selected ? "selected" : "ignored"}" data-alchemy-item-id="${U.esc(item.id)}">
      <div class="item-head">
        <label class="alchemy-item-select"><input type="checkbox" data-alchemy-select="${U.esc(item.id)}" ${selected ? "checked" : ""}><span>${C.badge(item.type || "other", "info")} <strong>${U.esc(item.title || "未命名条目")}</strong></span></label>
        ${C.badge(`${Math.round(Number(item.confidence || 0) * 100)}%`, Number(item.confidence || 0) >= .7 ? "ok" : "pending")}
      </div>
      ${editing ? `<div class="stack alchemy-edit-fields">
        <label><span class="field-label">标题</span><input data-alchemy-edit-title="${U.esc(item.id)}" value="${U.esc(item.title)}" maxlength="240"></label>
        <label><span class="field-label">内容</span><textarea data-alchemy-edit-content="${U.esc(item.id)}" maxlength="12000">${U.esc(item.content)}</textarea></label>
      </div>` : `<p>${U.esc(U.compact(item.summary || item.content, 420))}</p><details><summary>内容与字段</summary><p class="alchemy-content">${U.esc(U.compact(item.content, 2400))}</p><pre>${U.esc(U.json(item.fields || {}))}</pre></details>`}
      ${refs ? `<p class="tiny muted">${U.esc(refs)}</p>` : ""}
      ${item.suggestions?.length ? `<p class="tiny"><strong>建议：</strong>${U.esc(item.suggestions.join("；"))}</p>` : ""}
      ${item.warnings?.length ? C.notice(item.warnings.join("；"), "warn") : ""}
      <div class="actions"><button class="small" data-action="alchemy-edit-item">${editing ? "完成编辑" : "编辑"}</button><button class="small" data-action="alchemy-ignore-item">忽略</button></div>
    </article>`;
  }).join("");
  return `<div class="panel alchemy-preview">
    <div class="panel-head"><div><h2>处理预览</h2><p class="sub">${U.esc(preview.summary?.description || "请检查候选条目后再提交。")}</p></div>${preview.previousPreviewId ? C.badge("已继续处理", "info") : C.badge("未提交", "pending")}</div>
    <div class="auto-grid compact">${countLabels.map(([key, label]) => C.stat(label, counts[key] || 0)).join("")}</div>
    <div class="alchemy-meta chip-row">${C.badge(preview.mode || AS.alchemyMode, "info")}${C.badge(preview.target || AS.alchemyTarget, "pending")}${C.badge(preview.stats?.llmUsed ? "LLM" : "本地规则", preview.stats?.llmUsed ? "ok" : "warn")}${C.badge(`${preview.stats?.inputLength || 0} 字符`, "pending")}</div>
    ${preview.warnings?.length ? C.notice(preview.warnings.join("；"), "warn") : ""}
    ${listBlock("冲突", preview.conflicts, conflict => `<div class="item"><strong>${U.esc(conflict.title)}</strong><p>${U.esc(conflict.description)}</p><span class="tiny muted">${U.esc(conflict.suggestion || "")}</span></div>`)}
    ${listBlock("缺失信息", preview.missingFields, field => `<div class="item"><strong>${U.esc(field.question)}</strong><span class="tiny muted">${U.esc(field.reason)} · ${U.esc(field.priority)}</span></div>`)}
    ${listBlock("下一步建议", preview.suggestions, suggestion => `<div class="item"><strong>${U.esc(suggestion.text)}</strong><span class="tiny muted">${U.esc(suggestion.actionHint || "")}</span></div>`)}
    ${renderAlchemyMechanismDrafts()}
    <div class="alchemy-section"><h3>候选条目</h3><div class="list">${itemCards || C.empty("没有候选条目", "请补充素材或调整模式后重试。")}</div></div>
    <div class="alchemy-section"><label><span class="field-label">继续处理</span><textarea id="alchemyRefineText" maxlength="12000" placeholder="例如：把世界树统一成超古代终端，不要传统神明化。">${U.esc(AS.alchemyRefineText)}</textarea></label></div>
    <div class="actions">
      <button data-action="alchemy-refine" ${AS.alchemyPreviewBusy || AS.alchemyCommitBusy ? "disabled" : ""}>${AS.alchemyPreviewBusy ? "处理中..." : "按要求继续处理"}</button>
      <button class="primary" data-action="alchemy-commit" ${AS.alchemyPreviewBusy || AS.alchemyCommitBusy ? "disabled" : ""}>${AS.alchemyCommitBusy ? "提交中..." : "加入审核队列"}</button>
      <button class="ghost" data-action="alchemy-clear" ${AS.alchemyPreviewBusy || AS.alchemyCommitBusy ? "disabled" : ""}>清空预览</button>
    </div>
  </div>`;
}

function renderAlchemyMechanismDrafts() {
  const drafts = AS.alchemyMechanismDrafts || [];
  const options = (values, selected) => values.map(value => `<option value="${U.esc(value)}" ${value === selected ? "selected" : ""}>${U.esc(value)}</option>`).join("");
  return `<div class="alchemy-section mechanism-drafts">
    <div class="panel-head"><div><h3>从输入中识别到的机制</h3><p class="sub">以下机制来自你的输入内容，已默认加入本次结果。你可以编辑或移除。</p></div>${C.badge(drafts.length, drafts.length ? "ok" : "pending")}</div>
    <div class="list">${drafts.map(draft => {
      const editing = AS.alchemyEditingMechanismId === draft.id;
      const schema = draft.stateSchema || {};
      return `<article class="item mechanism-draft-card" data-mechanism-draft-id="${U.esc(draft.id)}">
      <div class="item-head"><div><strong>${U.esc(draft.name || "未命名机制")}</strong><div class="tiny muted">来源：${U.esc(draft.source === "input" ? "输入内容" : draft.source === "library" ? "机制库" : "手动添加")} · 类型：${U.esc(draft.type || "custom")}</div></div>${C.badge(draft.selected === false ? "已移除" : "默认加入", draft.selected === false ? "pending" : "ok")}</div>
      ${editing ? `<div class="mechanism-edit-grid">
        <label><span class="field-label">名称</span><input data-mechanism-field="name" value="${U.esc(draft.name || "")}" maxlength="120"></label>
        <label><span class="field-label">类型</span><select data-mechanism-field="type">${options(["affinity","exploration","inventory","quest","reputation","meter","flag","counter","custom"], draft.type || "custom")}</select></label>
        <label class="mechanism-edit-wide"><span class="field-label">说明</span><textarea data-mechanism-field="description" maxlength="500">${U.esc(draft.description || "")}</textarea></label>
        <label><span class="field-label">作用域</span><select data-mechanism-field="scope">${options(["save","world","session"], draft.scope || "save")}</select></label>
        <label><span class="field-label">状态类型</span><select data-mechanism-field="kind">${options(["number","progress","inventory","flags","custom"], schema.kind || "custom")}</select></label>
        <label><span class="field-label">最小值</span><input data-mechanism-field="min" type="number" value="${U.esc(schema.min ?? "")}"></label>
        <label><span class="field-label">最大值</span><input data-mechanism-field="max" type="number" value="${U.esc(schema.max ?? "")}"></label>
        <label><span class="field-label">默认值</span><input data-mechanism-field="defaultValue" type="number" value="${U.esc(schema.defaultValue ?? "")}"></label>
        <label><span class="field-label">状态栏组件</span><select data-mechanism-field="preferredType">${options(["stat_bar","inventory_grid","status_list"], draft.visualHint?.preferredType || "status_list")}</select></label>
        <label class="mechanism-check"><input data-mechanism-field="showToPlayer" type="checkbox" ${draft.visualHint?.showToPlayer === false ? "" : "checked"}> 玩家可见</label>
      </div>` : `<p class="tiny muted">${U.esc(U.compact(draft.description || "", 240))}</p><div class="tiny">作用域：${U.esc(draft.scope || "save")} · 推荐展示：${U.esc(draft.visualHint?.preferredType || "status_list")}</div>`}
      <div class="actions"><button class="small" data-action="edit-mechanism-draft">${editing ? "保存" : "编辑"}</button><button class="small danger" data-action="remove-mechanism-draft">移除</button></div>
    </article>`; }).join("") || C.empty("未识别到明确机制", "输入中出现好感度、背包、探索度、任务或状态数值后会自动加入。")}</div>
    <div class="actions"><button class="primary" data-action="commit-mechanism-drafts" ${drafts.some(draft => draft.selected !== false) ? "" : "disabled"}>提交机制到世界缓存</button><span class="tiny muted">机制不会进入普通 worldbook 审核队列。</span></div>
  </div>`;
}

function renderMechanismLibraryPanel() {
  const recommendations = AS.alchemyMechanismRecommendations || [];
  const templates = AS.alchemyMechanismLibrary || [];
  const selected = templates.find(template => template.templateId === AS.alchemyMechanismTemplateId);
  const card = template => `<article class="mechanism-template ${selected?.templateId === template.templateId ? "selected" : ""}" data-template-id="${U.esc(template.templateId)}">
    <button class="mechanism-template-open" data-action="select-mechanism-template"><strong>${U.esc(template.name)}</strong><span>${U.esc(template.category || template.type)}</span></button>
    <button class="small" data-action="add-mechanism-template">添加</button>
  </article>`;
  return `<aside class="panel mechanism-library-panel">
    <div class="panel-head"><div><h2>机制库</h2><p class="sub">通用模板仅作补充，点击后才加入本次机制。</p></div></div>
    <div class="mechanism-search"><input id="mechanismLibraryQuery" value="${U.esc(AS.alchemyMechanismQuery)}" placeholder="搜索机制..."><button class="small" data-action="search-mechanism-library">搜索</button></div>
    ${recommendations.length ? `<div class="alchemy-section"><h3>推荐匹配</h3><div class="mechanism-template-list">${recommendations.map(card).join("")}</div></div>` : ""}
    <div class="alchemy-section"><h3>全部机制</h3><div class="mechanism-template-list">${templates.map(card).join("") || C.empty("机制库加载中", "进入炼金台后会读取内置模板。")}</div></div>
    ${selected ? `<div class="mechanism-template-detail"><h3>${U.esc(selected.name)}</h3><p>${U.esc(selected.description || "")}</p><div class="tiny muted">适合：${U.esc((selected.keywords || []).join("、"))}</div><div class="tiny muted">推荐展示：${U.esc(selected.visualHint?.preferredType || "status_list")}</div><button class="primary" data-action="add-mechanism-template" data-template-id="${U.esc(selected.templateId)}">添加到本次机制</button></div>` : ""}
  </aside>`;
}

function renderReview() {
  const items = AS.reviewItems || [];
  const manual = AS.manualReviewItems || [];
  const logs = AS.reviewLog || [];
  const reviewCard = (item, tone = "pending") => {
    const after = item.after || item.data || item.structured || {};
    const label = item.entity || after.name || after.title || item.name || "待审核实体";
    return `<div class="item" data-review-id="${U.esc(item.id)}">
      <div class="item-head"><strong>${U.esc(label)}</strong><div>${C.badge(item.targetType || item.typeName || item.typeId || item.type || "实体", "info")} ${C.badge(Math.round((item.confidence || 0) * 100) + "%", tone)}</div></div>
      <p class="tiny muted">${U.esc(U.compact(item.sourceSnippet || item.source || item.reason || "", 180))}</p>
      <details><summary>结构数据</summary><pre>${U.esc(U.json(after))}</pre></details>
      <div class="actions">
        <button class="small primary" data-action="${item.status === "manual" ? "adopt-manual-review" : "confirm-review"}">采纳写入</button>
        <button class="small" data-action="merge-review">编辑后采纳</button>
        <button class="small danger" data-action="ignore-review">拒绝</button>
      </div>
    </div>`;
  };
  return `<section class="panel">
    <div class="panel-head"><div><h2>审核队列</h2><p class="sub">未确认内容不得写入正式世界数据。</p></div><button class="small" data-action="load-review">刷新</button></div>
    <textarea id="reviewSourceText" placeholder="粘贴素材，先提取进入审核队列。"></textarea>
    <div class="actions"><button class="primary" data-action="enqueue-review">提取入队</button><span class="tiny muted">当前目标：${AS.selectedModule ? U.esc(AS.selectedModule.displayName || AS.selectedModule.name) : "未选择"}</span></div>
    <div class="auto-grid compact" style="margin-top:12px">${C.stat("待审核", items.length)}${C.stat("手动确认", manual.length)}${C.stat("审核日志", logs.length)}</div>
    <div class="list" style="margin-top:12px">${items.length ? items.map(item => reviewCard(item, "warn")).join("") : C.empty("队列为空", "炼金台提取结果会先停在这里。")}</div>
    ${manual.length ? `<h3 style="margin:14px 0 8px">手动确认</h3><div class="list">${manual.map(item => reviewCard(item, "pending")).join("")}</div>` : ""}
    ${logs.length ? `<details style="margin-top:14px"><summary>审核日志</summary><pre>${U.esc(U.json(logs.slice(-20)))}</pre></details>` : ""}
  </section>`;
}

function renderObserveSummary() {
  const hits = AS.turnDebug?.worldbookHits?.length || 0;
  const dims = AS.dashboardData.telemetry?.telemetry?.dimensions || {};
  const top = Object.entries(dims).sort((a, b) => (b[1].value || 0) - (a[1].value || 0))[0];
  return `<section class="auto-grid">
    ${C.stat("Guardian", AS.turnDebug?.guardian?.verdict || AS.turnDebug?.guardian?.score || "待生成")}
    ${C.stat("世界书命中", hits)}
    ${C.stat("记忆负载", dims.memory_load?.value ?? "未知")}
    ${C.stat("突出脉象", top ? `${top[0]} ${top[1].value}` : "暂无")}
  </section>`;
}

function renderBlackbox() {
  const dbg = AS.turnDebug;
  const trace = dbg ? [
    ["输入进入", AS.selectedModule?.displayName || AS.selectedModule?.name || "当前世界"],
    ["世界书命中", `${(dbg.worldbookHits || []).length} 条`],
    ["角色状态", Object.keys(dbg.characterState || {}).length ? "已读取" : "无"],
    ["记忆快照", Object.keys(dbg.memorySnapshot || {}).length ? "已生成" : "无"],
    ["Direction Packet", Object.keys(dbg.directionPacket || {}).length ? "已组装" : "无"],
    ["Guardian", dbg.guardian?.verdict || dbg.guardian?.score || "待生成"]
  ] : [];
  return `<section class="panel">
    <div class="panel-head"><h2>叙事黑盒</h2><button class="small" data-action="load-context">刷新</button></div>
    ${dbg ? `<div class="timeline">${trace.map(([k, v]) => `<div class="timeline-step"><strong>${U.esc(k)}</strong><span>${U.esc(v)}</span></div>`).join("")}</div><div class="list">
      <details open><summary>世界书命中</summary><pre>${U.esc(U.json(dbg.worldbookHits || []))}</pre></details>
      <details><summary>角色状态</summary><pre>${U.esc(U.json(dbg.characterState || {}))}</pre></details>
      <details><summary>记忆快照</summary><pre>${U.esc(U.json(dbg.memorySnapshot || {}))}</pre></details>
      <details><summary>Direction Packet</summary><pre>${U.esc(U.json(dbg.directionPacket || {}))}</pre></details>
      <details><summary>Guardian 结果</summary><pre>${U.esc(U.json(dbg.guardian || {}))}</pre></details>
    </div>` : C.empty("暂无叙事黑盒", "发送一轮对话后会生成。")}
  </section>`;
}

function renderTelemetry() {
  const d = AS.dashboardData.telemetry;
  const dims = d?.telemetry?.dimensions || {};
  const labels = { stability: "稳定度", chaos: "混乱度", mystery: "神秘度", war_risk: "战争风险", character_stress: "角色压力", faction_conflict: "阵营冲突", rule_completeness: "规则完整度", narrative_momentum: "叙事动能", memory_load: "记忆负载" };
  return `<section class="panel"><div class="panel-head"><h2>世界脉象</h2><button class="small" data-action="load-telemetry">刷新</button></div><div class="grid">${Object.keys(labels).map(k => { const v = dims[k]?.value ?? 0; return `<div class="meter"><div class="meter-head"><span>${labels[k]}</span><strong>${v}</strong></div><div class="meter-track"><div class="meter-fill" style="width:${Math.max(0, Math.min(100, v))}%"></div></div></div>`; }).join("")}</div></section>`;
}

function renderEntities() {
  return `<section class="panel"><div class="panel-head"><h2>世界构成</h2><button class="small" data-action="load-worlddata">刷新</button></div>${renderWorldData()}</section>`;
}

function renderHealth() {
  const h = AS.health;
  return `<section class="grid"><div class="auto-grid">
    ${C.stat("控制台版本", h?.version || CFG.version)}
    ${C.stat("LLM 连接", AS.llmConnected ? "已连接" : "未连接")}
    ${C.stat("API Key", AS.hasApiKey ? "已配置" : "缺失")}
    ${C.stat("数据目录", h?.data?.writable ? "可写" : "未知")}
    ${C.stat("世界数量", h?.data?.worldsCount ?? AS.modules.length)}
    ${C.stat("对话回合", h?.data?.totalTurns ?? 0)}
  </div><div class="panel"><h3>服务状态</h3><pre>${U.esc(U.json(h || {}))}</pre></div></section>`;
}

function renderConnections() {
  const data = AS.connections || { items: [], templates: [] };
  const diag = AS.llmDiagnostics;
  return `<section class="layout-2">
    <div class="panel">
      <div class="panel-head"><h2>连接档案</h2><button class="small" data-action="load-connections">刷新</button></div>
      <div class="list">${(data.items || []).map(c => `<div class="item" data-connection-id="${U.esc(c.id)}"><div class="item-head"><strong>${U.esc(c.label || c.name)}</strong>${C.badge(c.active ? "默认" : "档案", c.active ? "ok" : "pending")}</div><span class="tiny muted">${U.esc(c.provider || "openai-compatible")} · ${U.esc(c.model || "")}</span><div class="chip-row"><span class="chip">temp ${c.temperature ?? "-"}</span><span class="chip">max ${c.maxTokens ?? "-"}</span><span class="chip">top_p ${c.topP ?? "-"}</span>${c.hasApiKey ? `<span class="chip ok">key ${U.esc(c.maskedKey || "saved")}</span>` : `<span class="chip warn">no key</span>`}</div><div class="actions"><button class="small" data-action="set-default-connection">设为默认</button><button class="small" data-action="test-connection">测试</button><button class="small" data-action="duplicate-connection">复制</button><button class="small danger" data-action="delete-connection">删除</button></div></div>`).join("") || C.empty("暂无连接档案")}</div>
      ${diag ? `<div class="panel tight" style="margin-top:12px"><div class="panel-head"><h3>最近诊断</h3>${C.badge(diag.safeToSave ? "可保存" : "需修正", diag.safeToSave ? "ok" : "bad")}</div><div class="list">${(diag.checks || []).map(c => `<div class="item"><div class="item-head"><strong>${U.esc(c.label || c.id)}</strong>${C.badge(c.status || "unknown", c.status === "ok" ? "ok" : c.status === "fail" ? "bad" : "warn")}</div><span class="tiny muted">${U.esc(c.detail || "")}</span></div>`).join("")}</div>${diag.suggestions?.length ? C.notice(U.esc(diag.suggestions.join("；")), diag.safeToSave ? "warn" : "bad") : ""}</div>` : ""}
    </div>
    <aside class="panel">
      <h3>新增 / 更新连接</h3>
      <label>模板<select id="connTemplate">${(data.templates || []).map(t => `<option value="${U.esc(t.id)}">${U.esc(t.label)}</option>`).join("")}</select></label>
      <label>名称<input id="connLabel" placeholder="DeepSeek / Local Ollama"></label>
      <label>Base URL<input id="connBaseUrl" placeholder="https://api.deepseek.com/v1"></label>
      <label>模型<input id="connModel" placeholder="deepseek-v4-flash"></label>
      <div class="cols-3">
        <label>Temperature<input id="connTemperature" type="number" step="0.1" min="0" max="2" placeholder="0.7"></label>
        <label>Max tokens<input id="connMaxTokens" type="number" min="1" placeholder="4096"></label>
        <label>Top P<input id="connTopP" type="number" step="0.05" min="0" max="1" placeholder="1"></label>
      </div>
      <label>API Key<input id="connKey" type="password" placeholder="留空则不覆盖"></label>
      <div class="actions"><button class="primary" data-action="save-connection">保存档案</button><button data-action="apply-connection-template">套用模板</button></div>
      ${C.notice("API Key 只写入本机 secrets，不进入仓库或 .worldtree。", "ok")}
    </aside>
  </section>`;
}

function renderPlugins() {
  const plugins = AS.plugins?.plugins || [];
  return `<section class="panel">
    <div class="panel-head"><div><h2>本地插件</h2><p class="sub">仅支持 importer / reviewer，不提供远程插件市场。</p></div><button class="small" data-action="load-plugins">刷新</button></div>
    <div class="list">${plugins.length ? plugins.map(p => `<div class="item" data-plugin-id="${U.esc(p.id)}"><div class="item-head"><strong>${U.esc(p.name)}</strong>${C.badge(p.enabled ? "启用" : "禁用", p.enabled ? "ok" : "pending")}</div><div class="actions">${(p.capabilities || []).map(x => C.badge(x, "info")).join("")}</div>${p.errors?.length ? C.noticeHtml(U.esc(p.errors.join("；")), "bad") : ""}<details><summary>权限与 Manifest</summary><pre>${U.esc(U.json({ permissions: p.permissions || [], entry: p.entry, manifest: p.manifest || {} }))}</pre></details><div class="actions"><button class="small" data-action="${p.enabled ? "disable-plugin" : "enable-plugin"}">${p.enabled ? "禁用" : "启用"}</button><button class="small" data-action="run-plugin">Dry-run</button></div></div>`).join("") : C.empty("暂无本地插件", "把插件目录放到 userData/plugins/{plugin}/plugin.json。")}</div>
    ${AS.pluginRunResult ? `<div class="panel tight" style="margin-top:12px"><h3>插件运行结果</h3><pre>${U.esc(U.json(AS.pluginRunResult))}</pre></div>` : ""}
  </section>`;
}

function renderDataSettings() {
  return `<section class="panel"><h2>数据与备份</h2><div class="list"><div class="item"><strong>本地优先</strong><span class="tiny muted">世界、角色、运行记录默认保存在本机数据目录。</span></div><div class="item"><strong>旧版导入导出</strong><span class="tiny muted">高级用户仍可使用旧版 /api/data/export 和 /api/data/import。</span></div></div><div class="actions"><button data-action="legacy-export">导出当前模块 JSON</button><button data-action="legacy-import">导入旧版 JSON</button></div></section>`;
}

function renderAppearance() {
  return `<section class="panel"><h2>外观</h2><p class="sub">中文优先，关键技术词保留英文辅助。当前版本使用固定浅色创作者工作台主题。</p></section>`;
}

function renderAdvanced() {
  return `<section class="grid"><div class="panel"><h2>高级模式</h2><p class="sub">原始 JSON、debug logs、engine manifest 和内部模块 id 仅在这里展示。</p><div class="actions"><button data-action="refresh-debug">刷新 debug logs</button><button data-action="toggle-debug">打开日志面板</button></div></div><div class="panel"><h3>Engine Manifest</h3><pre>${U.esc(U.json({ version: AS.health?.version || CFG.version, modules: "M1-M19", selectedModule: AS.selectedModule?.id || null, api: ["/api/data/export", "/api/data/import"] }))}</pre></div></section>`;
}

function renderDrawer() {
  if (!AS.activeDrawer) return "";
  const title = AS.activeDrawer === "worldbook" ? "世界书 · 快速查看" : "存档 · 快速切换";
  const body = AS.activeDrawer === "worldbook"
    ? `<div class="list">${C.worldbookRows(8)}</div>`
    : `<div class="list">${AS.modules.slice(0, 8).map(m => `<div class="item"><strong>${U.esc(m.displayName || m.name)}</strong><span class="tiny muted">${m.turnCount || 0} 回合</span><button class="small" data-module-id="${U.esc(m.id)}" data-action="load-module-from-list">切换</button></div>`).join("")}</div>`;
  return `<div class="overlay-backdrop open" data-action="close-drawer"><div class="drawer" onclick="event.stopPropagation()"><div class="overlay-head"><h3>${title}</h3><button data-action="close-drawer">关闭</button></div>${body}</div></div>`;
}

function renderNav() {
  const nav = CFG.nav.map(n => `<button class="nav-btn ${AS.view === n.id ? "active" : ""}" data-view="${n.id}"><span class="nav-icon">${n.icon}</span><strong>${n.label}</strong><span class="nav-meta">${n.meta}</span></button>`).join("");
  U.qs("#primaryNav").innerHTML = nav;
  const mobile = CFG.nav.slice(0, 5).map(n => `<button class="${AS.view === n.id ? "active" : ""}" data-view="${n.id}"><span>${n.icon}</span><span>${n.label}</span></button>`).join("");
  U.qs("#mobileNav").innerHTML = mobile;
}

function render() {
  try {
    renderNav();
    const viewDef = CFG.nav.find(v => v.id === AS.view) || CFG.nav[0];
    U.qs("#viewTitle").textContent = viewDef.label;
    const currentName = AS.selectedModule ? (AS.selectedModule.displayName || AS.selectedModule.name) : "未选择世界";
    U.qs("#contextLine").textContent = currentName;
    U.qs("#sideWorldName").textContent = currentName;
    U.qs("#sideWorldMeta").textContent = `${AS.messages.length} 条消息 · ${AS.modules.length} 个模块`;
    const llm = U.qs("#llmStatus");
    llm.textContent = AS.llmConnected ? "已连接" : "未连接";
    llm.className = `badge ${AS.llmConnected ? "ok" : "pending"}`;
    U.qs("#main").innerHTML = Views[AS.view] ? Views[AS.view]() : C.empty("未知页面");
    bindEvents();
  } catch (err) {
    console.error(err);
    U.qs("#main").innerHTML = `<div class="panel">${C.noticeHtml(`页面渲染失败：${U.esc(err.message)}`, "bad")}<button onclick="location.reload()">刷新页面</button></div>`;
  }
}

async function loadViewData() {
  try {
    if (AS.view === "library" && AS.libraryTab === "characters") AS.characters = await API.loadCharacters();
    if (AS.view === "library" && AS.libraryTab === "alchemy" && !AS.alchemyMechanismLibrary.length) await loadMechanismLibrary();
    if ((AS.view === "library" && AS.libraryTab === "worldbook") || AS.view === "workbench") await loadWorldbookIfPossible();
    if (AS.view === "library" && AS.libraryTab === "review") await loadReviewFacts();
    if (AS.view === "settings" && AS.settingsTab === "connections") AS.connections = await API.connections();
    if (AS.view === "settings" && AS.settingsTab === "plugins" && ENABLE_DEFERRED_PLUGINS) AS.plugins = await API.plugins();
    if (AS.view === "observe") await refreshObserve();
  } catch (err) {
    console.warn("加载视图数据失败", err);
  }
}

async function loadWorldbookIfPossible() {
  const m = AS.selectedModule;
  if (!m || m.id === "__quick__" || m.id.startsWith("char:")) return;
  const wb = await API.loadWorldbook(m.id);
  if (wb.status === "ok") AS.worldbookEntries = wb.entries || [];
}

async function loadReviewFacts() {
  const moduleKey = activeAlchemyModuleKey();
  if (!moduleKey || moduleKey.startsWith("char:")) {
    const legacy = await API.alchemyReview();
    AS.reviewItems = legacy.items || [];
    AS.manualReviewItems = [];
    AS.reviewLog = [];
    return;
  }
  const facts = await API.reviewPending(moduleKey);
  AS.reviewItems = facts.pending || facts.items || [];
  AS.manualReviewItems = facts.manual || [];
  try { AS.reviewLog = (await API.reviewLog(moduleKey)).log || []; } catch { AS.reviewLog = []; }
}

async function refreshObserve() {
  if (!AS.selectedModule || AS.selectedModule.id === "__quick__") return;
  const id = AS.selectedModule.id;
  const jobs = [
    API.turnDebug(id).then(d => { AS.turnDebug = d.debug || null; }).catch(() => {}),
    API.telemetry(id).then(d => { AS.dashboardData.telemetry = d; }).catch(() => {}),
    API.entities(id).then(d => { AS.dashboardData.entities = d; }).catch(() => {}),
    API.narrative(id).then(d => { AS.dashboardData.narrative = d; }).catch(() => {}),
  ];
  await Promise.all(jobs);
}

async function loadLatestStatusFrame() {
  if (!AS.selectedModule || AS.selectedModule.id === "__quick__") {
    AS.latestTurnFrame = null;
    AS.turnStateIndex = [];
    return;
  }
  const moduleKey = AS.selectedModule.id;
  const [latest, index] = await Promise.all([
    API.statusLatest(moduleKey).catch(() => ({ frame: null })),
    API.statusTurns(moduleKey).catch(() => ({ turns: [] }))
  ]);
  AS.latestTurnFrame = latest.frame || null;
  AS.turnStateIndex = index.turns || [];
  if (!AS.selectedTurnId) AS.selectedTurnFrame = null;
}

async function selectTurnState(turnId, messageId = "") {
  if (!turnId || !AS.selectedModule || AS.selectedModule.id === "__quick__") return;
  const result = await API.statusTurn(AS.selectedModule.id, turnId);
  if (!result.frame) return createToast("这一轮尚无可读取的状态帧", "warn");
  AS.selectedTurnId = turnId;
  AS.selectedMessageId = messageId;
  AS.selectedTurnFrame = result.frame;
  AS.statusPanelVisible = true;
  AS.statusPanelCollapsed = false;
  render();
}

function returnToLatestStatus() {
  AS.selectedTurnId = null;
  AS.selectedMessageId = null;
  AS.selectedTurnFrame = null;
  AS.statusPanelVisible = true;
  render();
}

async function selectModule(id, targetView = "chat") {
  const mod = AS.modules.find(m => m.id === id);
  if (!mod) return;
  AS.selectedModule = mod;
  AS.isQuickStart = false;
  AS.quickStartContent = "";
  AS.dashboardData = {};
  AS.turnDebug = null;
  AS.selectedTurnId = null;
  AS.selectedMessageId = null;
  AS.selectedTurnFrame = null;
  AS.latestTurnFrame = null;
  AS.developerObservabilityOpen = false;
  if (mod.dataMode === "character_card") {
    try {
      const res = await API.loadCharacter(mod._characterId || mod.id.replace("char:", ""));
      if (res.status === "ok") AS.currentCharacterCard = res.card;
    } catch (err) { console.warn("[moduleSelect] character card unavailable (non-fatal):", err?.message || "unknown error"); }
  }
  await CH.loadServer(mod);
  await loadLatestStatusFrame();
  await loadWorldbookIfPossible();
  await loadKernelData();
  AS.view = targetView;
}

async function loadKernelData() {
  const id = AS.selectedModule?.id || "";
  if (!id || AS.selectedModule?.type === "profile" || id.startsWith("char:") || id === "__quick__") {
    AS.kernel = null; AS.kernelBranches = []; AS.kernelProcessing = [];
    return;
  }
  try {
    const [summary, branchData, processing] = await Promise.all([
      API.kernel(id), API.kernel(id, "branches"), API.kernel(id, "processing/candidates")
    ]);
    AS.kernel = summary;
    AS.kernelBranches = branchData.branches || [];
    AS.kernelProcessing = processing.candidates || [];
  } catch (err) {
    AS.kernel = null; AS.kernelBranches = []; AS.kernelProcessing = [];
    console.warn("[kernel] project sidecar unavailable (non-fatal):", err?.message || "unknown error");
  }
}

async function kernelAction(action, btn) {
  const id = AS.selectedModule?.id || "";
  if (!id || id.startsWith("char:") || id === "__quick__") return createToast("请先选择世界项目", "warn");
  if (action === "kernel-create-branch") {
    const label = prompt("新分支名称");
    if (!label) return;
    const normalized = label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const branchId = normalized || `branch-${Date.now().toString(36)}`;
    await API.kernelPost(id, "branches/create", { id: branchId, label });
  } else if (action === "kernel-switch-branch") {
    await API.kernelPost(id, `branches/${encodeURIComponent(btn.dataset.branchId)}/switch`);
  } else if (action === "kernel-diff-branch") {
    const result = await API.kernel(id, `branches/${encodeURIComponent(btn.dataset.branchId)}/diff?from=main`);
    alert(`与 main 的差异摘要：\n${U.json(result.diff || {})}`);
  } else if (action === "kernel-refresh-telemetry") {
    await API.kernelPost(id, "telemetry/refresh");
  } else if (action === "kernel-auto-light") {
    const result = await API.kernelPost(id, "advance/auto-light", { userInput: "继续" });
    createToast(result.result?.status === "ready" ? "Auto-light 预演已就绪" : `Auto-light 已拦截：${result.result?.reason || "需用户决策"}`, result.result?.status === "ready" ? "ok" : "warn");
  } else if (action === "kernel-approve-proposal") {
    const proposalId = btn.closest("[data-proposal-id]")?.dataset.proposalId;
    const critical = btn.dataset.impact === "critical" || btn.dataset.secondConfirm === "true";
    if (!confirm(critical ? "这是关键提案。确认进入第二次批准？" : "批准此提案？")) return;
    if (critical && !confirm("第二次确认：允许该关键提案进入已批准状态？")) return;
    await API.kernelPost(id, `proposals/${encodeURIComponent(proposalId)}/approve`, { secondConfirm: critical, currentTurn: AS.selectedModule.turnCount || 0 });
  } else if (action === "kernel-delay-proposal") {
    createToast("变化仍保留在待审队列，你可以继续故事。", "warn");
    return;
  } else if (action === "kernel-reject-proposal") {
    const proposalId = btn.closest("[data-proposal-id]")?.dataset.proposalId;
    if (!confirm("拒绝这个变化？它不会写入 shared canon。")) return;
    await API.kernelPost(id, `proposals/${encodeURIComponent(proposalId)}/reject`);
  } else if (action === "kernel-reverse-proposal") {
    if (!confirm("生成一个待审逆操作提案？原变更不会立即被修改。")) return;
    await API.kernelPost(id, `proposals/${encodeURIComponent(btn.dataset.proposalId)}/reverse`);
  } else if (action === "kernel-ingest-material") {
    const text = prompt("粘贴要提取的素材文本");
    if (!text) return;
    await API.kernelPost(id, "processing/ingest", { text, sourceType: "manual-ui" });
  } else if (action === "kernel-deliver-candidate") {
    await API.kernelPost(id, `processing/candidates/${encodeURIComponent(btn.dataset.candidateId)}/deliver`);
  }
  await loadKernelData();
  render();
}

async function refreshModules() {
  const mods = await API.loadModules();
  let chars = [];
  try { chars = await API.loadCharacters(); } catch (err) { console.warn("[modules] character list unavailable (non-fatal):", err?.message || "unknown error"); }
  AS.characters = chars || [];
  const charModules = AS.characters.map(c => ({
    id: `char:${c.id}`,
    name: c.displayName || c.name,
    displayName: c.displayName || c.name,
    description: c.description || "",
    dataMode: "character_card",
    type: "character",
    subType: "default",
    turnCount: 0,
    _characterId: c.id,
  }));
  AS.modules = [...(mods || []), ...charModules];
  if (!AS.selectedModule && AS.modules.length) AS.selectedModule = AS.modules[0];
}

async function installExample(id) {
  if (!id) return;
  const res = await API.installExample(id);
  if (res.status !== "ok") throw new Error(res.errorMsg || "示例安装失败");
  await refreshModules();
  if (res.module?.id) await selectModule(res.module.id, "workbench");
  AS.workbenchMode = "chat";
  createToast("示例已安装");
  render();
}

function bindEvents() {
  U.qsa("[data-view]").forEach(btn => {
    btn.onclick = async () => {
      AS.view = btn.dataset.view;
      AS.workbenchMode = AS.view === "workbench" ? AS.workbenchMode : AS.workbenchMode;
      await loadViewData();
      render();
    };
  });

  U.qsa("[data-library-tab]").forEach(btn => {
    btn.onclick = async () => { AS.libraryTab = btn.dataset.libraryTab; await loadViewData(); render(); };
  });
  U.qsa("[data-observe-tab]").forEach(btn => {
    btn.onclick = async () => { AS.observeTab = btn.dataset.observeTab; await loadViewData(); render(); };
  });
  U.qsa("[data-settings-tab]").forEach(btn => {
    btn.onclick = async () => { AS.settingsTab = btn.dataset.settingsTab; await loadViewData(); render(); };
  });

  const search = U.qs("#characterSearch");
  if (search) search.oninput = () => { AS.characterQuery = search.value; render(); };

  U.qsa("[data-pack-option]").forEach(input => {
    input.onchange = () => {
      AS.worldPackOptions[input.dataset.packOption] = input.checked;
    };
  });

  const chatInput = U.qs("#chatInput");
  if (chatInput) chatInput.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  };

  bindDrop("#quickStartDrop", "#quickStartText", ".md,.txt,.json", true);
  bindDrop("#alchemyDrop", "#alchemyText", ".md,.txt,.json,.png", false);

  const alchemyTarget = U.qs("#alchemyTarget");
  if (alchemyTarget) alchemyTarget.onchange = () => { AS.alchemyTarget = alchemyTarget.value; };
  const alchemyGoal = U.qs("#alchemyUserGoal");
  if (alchemyGoal) alchemyGoal.oninput = () => { AS.alchemyUserGoal = alchemyGoal.value; };
  const alchemyText = U.qs("#alchemyText");
  if (alchemyText) alchemyText.oninput = () => { AS.alchemyText = alchemyText.value; };
  const refineText = U.qs("#alchemyRefineText");
  if (refineText) refineText.oninput = () => { AS.alchemyRefineText = refineText.value; };
  const mechanismQuery = U.qs("#mechanismLibraryQuery");
  if (mechanismQuery) mechanismQuery.oninput = () => { AS.alchemyMechanismQuery = mechanismQuery.value; };
  U.qsa("[data-alchemy-select]").forEach(input => {
    input.onchange = () => {
      const id = input.dataset.alchemySelect;
      const item = AS.alchemyPreview?.items?.find(entry => entry.id === id);
      if (item) item.selected = input.checked;
      AS.alchemySelectedItemIds = (AS.alchemyPreview?.items || []).filter(entry => entry.selected !== false).map(entry => entry.id);
      input.closest(".alchemy-item")?.classList.toggle("ignored", !input.checked);
      input.closest(".alchemy-item")?.classList.toggle("selected", input.checked);
    };
  });
  U.qsa("[data-alchemy-edit-title]").forEach(input => {
    input.oninput = () => updateAlchemyItem(input.dataset.alchemyEditTitle, { title: input.value });
  });
  U.qsa("[data-alchemy-edit-content]").forEach(input => {
    input.oninput = () => updateAlchemyItem(input.dataset.alchemyEditContent, { content: input.value, summary: U.compact(input.value, 600) });
  });

  U.qsa("[data-action]").forEach(btn => {
    btn.onclick = e => handleAction(e, btn);
  });
  U.qsa(".chat-message[data-turn-id]").forEach(message => {
    if (!message.dataset.turnId) return;
    message.onclick = () => selectTurnState(message.dataset.turnId, message.dataset.messageId || "");
  });

  U.qsa("[data-character-v2-advanced-toggle]").forEach(btn => {
    const targetId = btn.getAttribute("data-character-v2-advanced-toggle");
    const panel = targetId ? document.querySelector('[data-character-v2-advanced-panel="' + targetId + '"]') : null;
    if (!panel) return;
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.onclick = () => {
      const nextVisible = panel.hidden;
      panel.hidden = !nextVisible;
      btn.setAttribute("aria-expanded", String(nextVisible));
      btn.textContent = nextVisible ? "隐藏高级设置" : "高级设置";
    };
  });

  const avatarInput = U.qs("#v2CreateAvatar");
  if (avatarInput) {
    avatarInput.onchange = () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      if (file.size > 700000) { AS.characterV2Create.error = "头像文件过大，请换一张小图。"; return render(); }
      const reader = new FileReader();
      reader.onload = () => {
        AS.characterV2Create.avatar = {
          label: file.name || "手动头像",
          mime: file.type || "",
          dataUri: reader.result,
          uiOnly: true,
          participatesInPrompt: false,
          participatesInCognition: false,
          metadataParsed: false
        };
        AS.characterV2Create.error = "";
        render();
      };
      reader.onerror = () => {
        AS.characterV2Create.error = "头像读取失败，请换一张较小图片。";
        render();
      };
      reader.readAsDataURL(file);
    };
  }
}

function bindDrop(dropSel, textSel, accept, directory) {
  const drop = U.qs(dropSel);
  const ta = U.qs(textSel);
  if (!drop || !ta) return;
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("dragover"); };
  drop.ondragleave = () => drop.classList.remove("dragover");
  drop.ondrop = async e => {
    e.preventDefault();
    drop.classList.remove("dragover");
    const texts = await readDroppedTexts(e.dataTransfer);
    if (texts.length) { ta.value = texts.join("\n\n---\n\n"); ta.dispatchEvent(new Event("input", { bubbles: true })); }
    else createToast("没有读取到支持的文本文件", "warn");
  };
  drop.onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (directory) input.webkitdirectory = true;
    input.onchange = async () => {
      const texts = [];
      for (const f of Array.from(input.files || [])) {
        if (/\.(md|txt|json)$/i.test(f.name)) texts.push(`【${f.webkitRelativePath || f.name}】\n${await f.text()}`);
      }
      if (texts.length) { ta.value = texts.join("\n\n---\n\n"); ta.dispatchEvent(new Event("input", { bubbles: true })); }
    };
    input.click();
  };
}

async function readDroppedTexts(dt) {
  const files = Array.from(dt?.files || []);
  const texts = [];
  for (const f of files) {
    if (/\.(md|txt|json)$/i.test(f.name)) texts.push(`【${f.name}】\n${await f.text()}`);
  }
  return texts;
}

async function handleAction(e, btn) {
  e.stopPropagation();
  const action = btn.dataset.action;
  try {
    if (action === "refresh-debug") return refreshDebugLogs();
    if (action === "toggle-debug") return toggleDebugPanel();
    if (action === "close-drawer") { AS.activeDrawer = ""; return render(); }
    if (action === "drawer-worldbook") { AS.activeDrawer = "worldbook"; return render(); }
    if (action === "drawer-saves") { AS.activeDrawer = "saves"; return render(); }
    if (action === "workbench-overview") { AS.workbenchMode = "overview"; AS.activeDrawer = ""; return render(); }
    if (action === "load-and-chat") return loadAndChat();
    if (action === "quick-start-chat") return quickStartChat();
    if (action === "character-start-chat") return characterStartChat();
    if (action === "world-rpg-start") return multiModeStart("world-rpg", "#wrpgTitle", "#wrpgText");
    if (action === "mystery-puzzle-start") return multiModeStart("mystery-puzzle", "#mysteryTitle", "#mysteryText");
    if (action === "tabletop-start") return multiModeStart("tabletop", "#tabletopTitle", "#tabletopText");
    // Tabletop V2
    if (action === "tabletop-v2-preview-import") return previewTabletopV2Import();
    if (action === "tabletop-v2-start") return startTabletopV2FromUI();
    if (action === "tabletop-v2-save") return saveTabletopV2FromUI();
    if (action === "tabletop-v2-branch") return branchTabletopV2FromUI();
    if (action === "tabletop-v2-end") return endTabletopV2FromUI();
    if (action === "tabletop-v2-clear") { AS.tabletopV2 = { runId: null, module: null, ruleset: null, lastRuling: null, ending: null, endingAvailable: false, importText: "", importPreview: null, playerIntent: "", lastNarrative: "", currentScene: "", diceLog: [], publicClocks: [], resources: {}, inventory: [], questLog: [], visibleNpcs: [], saveSlots: [], branches: [], activeTab: "scene", busy: false, error: "" }; return render(); }
    if (action === "tabletop-v2-tab") { AS.tabletopV2.activeTab = btn.dataset.tab || "scene"; return render(); }
    if (action === "tabletop-v2-send-turn") return sendTabletopV2TurnFromInput();
    if (action === "tabletop-v2-import-commit") return commitTabletopV2Import();
    if (action === "tabletop-v2-export") return exportTabletopV2FromUI();
    if (action === "tabletop-v2-load-save") return loadTabletopV2SaveFromUI(btn.dataset.saveId);
    if (action === "strategy-sim-start") return multiModeStart("strategy-sim", "#strategyTitle", "#strategyText");
    if (action === "murder-mystery-start") return multiModeStart("murder-mystery", "#murderTitle", "#murderText");
    if (action === "chat-send") return sendChat();
    if (action === "workflow-refresh") { const [status, types] = await Promise.all([API.workflowStatus(), API.workflowTypes()]); AS.workflowStatus = status; AS.workflowTypes = types.types || []; return render(); }
    if (action.startsWith("kernel-")) return kernelAction(action, btn);
    if (action === "clear-chat") return confirmClearChat();
    if (action === "open-command-panel") return openCommandPanel();
    if (action === "toggle-developer-observability") { AS.developerObservabilityOpen = !AS.developerObservabilityOpen; if (AS.developerObservabilityOpen) await refreshObserve(); return render(); }
    if (action === "close-developer-observability") { AS.developerObservabilityOpen = false; return render(); }
    if (action === "developer-observability-tab") { AS.developerObservabilityTab = btn.dataset.observabilityTab || "context"; return render(); }
    if (action === "toggle-status-collapse") { AS.statusPanelCollapsed = !AS.statusPanelCollapsed; return render(); }
    if (action === "hide-status-panel") { AS.statusPanelVisible = false; return render(); }
    if (action === "show-status-panel") { AS.statusPanelVisible = true; return render(); }
    if (action === "status-density") { AS.statusPanelDensity = AS.statusPanelDensity === "simple" ? "detailed" : "simple"; return render(); }
    if (action === "status-latest") return returnToLatestStatus();
    if (action === "load-context") { await refreshObserve(); return render(); }
    if (action === "refresh-observe") { await refreshObserve(); return render(); }
    if (action === "load-telemetry") { if (AS.selectedModule) AS.dashboardData.telemetry = await API.telemetry(AS.selectedModule.id); return render(); }
    if (action === "load-worlddata") { if (AS.selectedModule) AS.dashboardData.entities = await API.entities(AS.selectedModule.id); return render(); }
    if (action === "refresh-modules") { await refreshModules(); return render(); }
    if (action === "load-module-from-list") { await selectModule(btn.dataset.moduleId, "workbench"); AS.workbenchMode = "chat"; return render(); }
    if (action === "install-example") return installExample(btn.closest("[data-example-id]")?.dataset.exampleId);
    if (action === "select-module") { await selectModule(btn.closest("[data-module-id]")?.dataset.moduleId, "chat"); return render(); }
    if (action === "delete-module") return deleteModule(btn.closest("[data-module-id]")?.dataset.moduleId);
    if (action === "export-module") return legacyExport(btn.closest("[data-module-id]")?.dataset.moduleId);
    if (action === "create-world") return showCreateDialog("worldbook", "世界");
    if (action === "create-from-material" || action === "library-alchemy") { AS.view = "library"; AS.libraryTab = "alchemy"; return render(); }
    if (action === "refresh-characters") { AS.characters = await API.loadCharacters(); return render(); }
    if (action === "import-character-json") return importCharacterFile();
    if (action === "preview-character") return previewCharacter(btn.closest("[data-character-id]")?.dataset.characterId);
    if (action === "edit-character-meta") return editCharacterMeta(btn.closest("[data-character-id]")?.dataset.characterId);
    if (action === "rp-character") return rpCharacter(btn.closest("[data-character-id]")?.dataset.characterId);
    if (action === "backup-character") return backupCharacter(btn.closest("[data-character-id]")?.dataset.characterId);
    if (action === "delete-character") return deleteCharacter(btn.closest("[data-character-id]")?.dataset.characterId);
    if (action === "character-v2-preview") return characterV2Preview();
    if (action === "character-v2-confirm") return characterV2Confirm();
    if (action === "character-v2-advanced-toggle") { AS.characterV2Create.advancedOpen = !AS.characterV2Create.advancedOpen; return render(); }
    if (action === "character-v2-avatar-select") { document.getElementById("v2CreateAvatar")?.click(); return; }
    if (action === "character-preview-raw-toggle") { AS.characterPreviewRawOpen = !AS.characterPreviewRawOpen; return render(); }
    if (action === "character-v2-runtime-advanced") { AS.characterV2RuntimeAdvancedOpen = !AS.characterV2RuntimeAdvancedOpen; return render(); }
    if (action === "character-v2-live-send") return sendCharacterV2LiveTurn(false);
    if (action === "character-v2-live-dry-run") return sendCharacterV2LiveTurn(true);
    if (action === "character-v2-live-advanced-toggle") { AS.characterV2Live.advancedOpen = !AS.characterV2Live.advancedOpen; return render(); }
    if (action === "character-v2-candidates-save") return saveCharacterV2Candidates();
    if (action === "character-v2-export-md") return exportCharacterV2File("character_md");
    if (action === "character-v2-export-bundle") return exportCharacterV2File("export_bundle_json");
    if (action === "load-worldbook") { await loadWorldbookIfPossible(); return render(); }
    if (action === "import-worldbook-json") return importWorldbookJson();
    if (action === "export-worldbook-json") return exportWorldbookJson();
    if (action === "new-worldbook-entry") return editWorldbookEntry();
    if (action === "edit-worldbook-entry") return editWorldbookEntry(btn.closest("[data-entry-id]")?.dataset.entryId);
    if (action === "toggle-worldbook-entry") return toggleWorldbookEntry(btn.closest("[data-entry-id]")?.dataset.entryId);
    if (action === "delete-worldbook-entry") return deleteWorldbookEntry(btn.closest("[data-entry-id]")?.dataset.entryId);
    if (action === "test-worldbook") return testWorldbook();
    if (action === "alchemy-set-mode") { AS.alchemyMode = btn.dataset.alchemyMode || "import"; return render(); }
    if (action === "alchemy-preview") return createAlchemyPreview();
    if (action === "alchemy-import") return alchemyImport();
    if (action === "alchemy-edit-item") return toggleAlchemyItemEdit(btn.closest("[data-alchemy-item-id]")?.dataset.alchemyItemId);
    if (action === "alchemy-ignore-item") return ignoreAlchemyItem(btn.closest("[data-alchemy-item-id]")?.dataset.alchemyItemId);
    if (action === "alchemy-refine") return refineAlchemyPreview();
    if (action === "alchemy-commit") return commitAlchemyPreview();
    if (action === "alchemy-clear") return clearAlchemyPreview();
    if (action === "search-mechanism-library") return loadMechanismLibrary(AS.alchemyMechanismQuery);
    if (action === "select-mechanism-template") { AS.alchemyMechanismTemplateId = btn.closest("[data-template-id]")?.dataset.templateId || ""; return render(); }
    if (action === "add-mechanism-template") return addMechanismTemplate(btn.dataset.templateId || btn.closest("[data-template-id]")?.dataset.templateId);
    if (action === "edit-mechanism-draft") return editMechanismDraft(btn.closest("[data-mechanism-draft-id]")?.dataset.mechanismDraftId);
    if (action === "remove-mechanism-draft") return removeMechanismDraft(btn.closest("[data-mechanism-draft-id]")?.dataset.mechanismDraftId);
    if (action === "commit-mechanism-drafts") return commitMechanismDraftsToWorld();
    if (action === "enqueue-review") return enqueueReview();
    if (action === "load-review") { await loadReviewFacts(); return render(); }
    if (["confirm-review", "ignore-review", "merge-review", "adopt-manual-review"].includes(action)) return reviewAction(action, btn.closest("[data-review-id]")?.dataset.reviewId);
    if (action === "export-worldpack") return exportWorldpack();
    if (action === "download-worldpack") return downloadWorldpack();
    if (action === "import-worldpack") return importWorldpack();
    if (action === "confirm-worldpack-import") return confirmWorldpackImport();
    if (action === "load-connections") { AS.connections = await API.connections(); return render(); }
    if (action === "apply-connection-template") return applyConnectionTemplate();
    if (action === "save-connection") return saveConnection();
    if (["set-default-connection", "test-connection", "duplicate-connection", "delete-connection"].includes(action)) return connectionAction(action, btn.closest("[data-connection-id]")?.dataset.connectionId);
    if (action === "load-plugins") { AS.plugins = await API.plugins(); return render(); }
    if (["enable-plugin", "disable-plugin"].includes(action)) return pluginAction(action, btn.closest("[data-plugin-id]")?.dataset.pluginId);
    if (action === "run-plugin") return runPlugin(btn.closest("[data-plugin-id]")?.dataset.pluginId);
    if (["copy-message", "edit-message", "favorite-message", "delete-message", "regen-message", "candidate-prev", "candidate-next"].includes(action)) return messageAction(action, btn.closest("[data-message-id]")?.dataset.messageId);
    if (action === "legacy-export") return legacyExport(AS.selectedModule?.id);
    if (action === "legacy-import") return createToast("旧版 JSON 导入入口已保留在高级工具中，当前演示未自动覆盖数据。", "warn");
  } catch (err) {
    createToast(err.message || String(err), "bad");
  }
}

async function loadAndChat() {
  if (!AS.selectedModule && AS.modules.length) AS.selectedModule = AS.modules[0];
  if (!AS.selectedModule) return createToast("请先创建或导入一个世界", "warn");
  await selectModule(AS.selectedModule.id, "workbench");
  AS.workbenchMode = "chat";
  AS.view = "workbench";
  render();
}

async function quickStartChat() {
  const text = U.qs("#quickStartText")?.value.trim();
  if (!text) return createToast("请先粘贴内容或拖拽文件", "warn");
  AS.quickStartContent = text;
  AS.isQuickStart = true;
  const title = text.split(/\r?\n/).map(x => x.trim()).find(Boolean)?.slice(0, 18) || "快速项目";
  const res = await API.createModule({
    name: `快速项目_${Date.now()}`,
    displayName: title,
    mode: "quick-setting",
    dataMode: "preset",
    subType: "classic",
    preset: "preset",
    quickProject: true,
    draft: true,
    sourceType: "pasted_text",
    sourceText: text
  });
  if (res.status !== "ok") throw new Error(res.errorMsg || "创建草稿失败");
  await refreshModules();
  AS.selectedModule = AS.modules.find(m => m.id === res.module.id) || res.module;
  AS.messages = [];
  AS.workbenchMode = "chat";
  AS.view = "workbench";
  createToast("已创建快速项目草稿");
  render();
}

// ── Tabletop V2 UI handlers ──

async function previewTabletopV2Import() {
  const text = U.qs("#tabletopV2ImportText")?.value.trim();
  if (!text) return createToast("请粘贴 Tabletop V2 模组 JSON 或文本", "warn");
  try {
    const data = JSON.parse(text);
    AS.tabletopV2.importPreview = data;
    createToast("导入预览已生成");
  } catch {
    AS.tabletopV2.importPreview = { title: "文本导入", playerBrief: { premise: text.slice(0, 200) } };
  }
  render();
}

async function startTabletopV2FromUI() {
  const text = U.qs("#tabletopV2ImportText")?.value.trim();
  if (!text && !AS.tabletopV2.importPreview) return createToast("请先粘贴模组内容并预览", "warn");
  try {
    AS.tabletopV2.busy = true; render();
    let module;
    try { module = JSON.parse(text); } catch { module = { title: "快速冒险", sourceType: "quick_start", playerBrief: { premise: text.slice(0, 500) } }; }
    const res = await API.tabletopV2Start({ module, playerCharacter: null });
    if (res.status === "ok") {
      AS.tabletopV2.runId = res.run.runId;
      AS.tabletopV2.module = res.run.publicState?.sceneTitle || res.moduleId;
      AS.tabletopV2.ruleset = res.rulesetKind;
      AS.tabletopV2.lastRuling = null;
      AS.tabletopV2.endingAvailable = false;
      AS.tabletopV2.error = "";
      createToast("Tabletop V2 冒险已开始！");
    } else {
      AS.tabletopV2.error = res.errorMsg || "启动失败";
      createToast(AS.tabletopV2.error, "warn");
    }
  } catch (e) {
    AS.tabletopV2.error = e.message;
    createToast(e.message, "warn");
  } finally {
    AS.tabletopV2.busy = false;
    render();
  }
}

async function saveTabletopV2FromUI() {
  if (!AS.tabletopV2.runId) return createToast("请先开始一个 Tabletop V2 冒险", "warn");
  try {
    const res = await API.tabletopV2Save({ runId: AS.tabletopV2.runId, label: `手动存档 ${new Date().toLocaleTimeString()}` });
    if (res.status === "ok") {
      createToast(`存档已创建: ${res.label}`);
    } else {
      createToast(res.errorMsg || "存档失败", "warn");
    }
  } catch (e) { createToast(e.message, "warn"); }
}

async function branchTabletopV2FromUI() {
  if (!AS.tabletopV2.runId) return createToast("请先开始一个 Tabletop V2 冒险", "warn");
  try {
    // Use latest save or create a quick save first
    const saveRes = await API.tabletopV2Save({ runId: AS.tabletopV2.runId, label: `分支前存档 ${new Date().toLocaleTimeString()}` });
    if (saveRes.status !== "ok") return createToast("请先存档再分支", "warn");
    const res = await API.tabletopV2Branch({ runId: AS.tabletopV2.runId, saveId: saveRes.saveId, branchLabel: `分支 ${new Date().toLocaleTimeString()}` });
    if (res.status === "ok") {
      createToast(`分支已创建: ${res.label || res.branchId}`);
    } else {
      createToast(res.errorMsg || "分支失败", "warn");
    }
  } catch (e) { createToast(e.message, "warn"); }
}

async function endTabletopV2FromUI() {
  if (!AS.tabletopV2.runId) return createToast("请先开始一个 Tabletop V2 冒险", "warn");
  try {
    const res = await API.tabletopV2EndSummary({ runId: AS.tabletopV2.runId });
    if (res.status === "ok") {
      AS.tabletopV2.ending = res.summary;
      createToast("结局摘要已生成，请查看面板");
    } else {
      createToast(res.errorMsg || "生成结局失败", "warn");
    }
  } catch (e) { createToast(e.message, "warn"); }
  render();
}

async function sendTabletopV2TurnFromInput() {
  const input = document.getElementById("tabletopV2PlayerIntent");
  const playerIntent = input?.value.trim();
  if (!playerIntent) return createToast("请输入你的行动", "warn");
  input.value = "";
  return sendTabletopV2Turn(playerIntent);
}

async function sendTabletopV2Turn(playerIntent) {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!AS.busy) return;
    AS.progressIndex = Math.min(3, AS.progressIndex + 1);
    render();
  }, 1400);
  try {
    const res = await API.tabletopV2Turn({
      runId: AS.tabletopV2.runId,
      playerIntent,
    });
    if (res.status === "ok") {
      AS.tabletopV2.lastRuling = res.ruling?.roll || null;
      AS.tabletopV2.endingAvailable = res.endingAvailable || false;
      CH.add("assistant", res.narrative || "（Tabletop V2 无叙事返回）");
      CH.persist();
      render();
      return;
    }
    if (res.status === "blocked_by_book") {
      const text = [
        "【行动被本子阻止】",
        res.bookCheck?.reason || "该行动不符合当前本子或场景限制。",
        res.bookCheck?.suggestion ? `【建议】${res.bookCheck.suggestion}` : "",
      ].filter(Boolean).join("\n\n");
      CH.add("assistant", text);
      CH.persist();
      render();
      return;
    }
    CH.add("error", res.errorMsg || "Tabletop V2 回合失败");
    CH.persist();
    render();
  } catch (err) {
    CH.add("error", err.message || String(err));
    CH.persist();
    render();
  } finally {
    AS.busy = false;
    AS.progressIndex = 4;
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
  }
}

// ── Tabletop V2 additional UI handlers ──

async function commitTabletopV2Import() {
  const text = U.qs("#tabletopV2ImportText")?.value.trim();
  if (!text) return createToast("请粘贴模组内容", "warn");
  try {
    AS.tabletopV2.busy = true; render();
    let module;
    try { module = JSON.parse(text); } catch { module = { title: "导入模组", sourceType: "external_text", playerBrief: { premise: text.slice(0, 500) } }; }
    const res = await API.tabletopV2ImportCommit({ module });
    if (res.status === "ok") {
      createToast("模组已导入: " + res.title + " (" + res.sceneCount + " 场景)");
      AS.tabletopV2.importPreview = res;
    } else {
      createToast(res.errorMsg || "导入失败", "warn");
    }
  } catch (e) { createToast(e.message, "warn"); }
  finally { AS.tabletopV2.busy = false; render(); }
}

async function exportTabletopV2FromUI() {
  if (!AS.tabletopV2.runId) return createToast("请先开始冒险", "warn");
  try {
    const res = await API.tabletopV2ExportRun({ runId: AS.tabletopV2.runId });
    if (res.status === "ok") {
      createToast("跑团记录已导出");
      try { await navigator.clipboard.writeText(JSON.stringify(res.export, null, 2)); createToast("已复制到剪贴板"); } catch {}
    } else {
      createToast(res.errorMsg || "导出失败", "warn");
    }
  } catch (e) { createToast(e.message, "warn"); }
}

async function loadTabletopV2SaveFromUI(saveId) {
  if (!AS.tabletopV2.runId || !saveId) return createToast("缺少存档信息", "warn");
  try {
    const res = await API.tabletopV2RestoreSave({ runId: AS.tabletopV2.runId, saveId });
    if (res.status === "ok") {
      AS.tabletopV2.lastNarrative = res.run?.publicState?.lastNarrative || "";
      AS.tabletopV2.currentScene = res.run?.publicState?.sceneTitle || "";
      createToast("已恢复存档 (回合 " + res.restoredTurnIndex + ")");
    } else {
      createToast(res.errorMsg || "加载失败", "warn");
    }
  } catch (e) { createToast(e.message, "warn"); }
  render();
}

async function characterStartChat() {
  const text = U.qs("#charCardText")?.value.trim();
  if (!text) return createToast("请先粘贴人物卡内容", "warn");
  const nameInput = U.qs("#charCardTitle")?.value.trim();
  const title = nameInput || text.split("\n").map(x => x.trim()).find(Boolean)?.slice(0, 18) || "未命名人物卡";
  const res = await API.createModule({
    name: `人物卡_${Date.now()}`,
    displayName: title,
    mode: "character",
    dataMode: "character_card",
    subType: "classic",
    preset: "character_card",
    draft: true,
    sourceType: "character_card",
    sourceText: text,
    cardText: text
  });
  if (res.status !== "ok") throw new Error(res.errorMsg || "创建人物卡项目失败");
  await refreshModules();
  AS.selectedModule = AS.modules.find(m => m.id === res.module.id) || res.module;
  AS.messages = [];
  AS.workbenchMode = "chat";
  AS.view = "workbench";
  createToast("已创建人物卡项目");
  render();
}

async function multiModeStart(modeId, titleSel, textSel) {
  const text = U.qs(textSel)?.value.trim();
  if (!text) return createToast("请先粘贴内容", "warn");
  const nameInput = U.qs(titleSel)?.value.trim();
  const title = nameInput || text.split("\n").map(x => x.trim()).find(Boolean)?.slice(0, 18) || modeId;
  const res = await API.createModule({
    name: `新模式_${Date.now()}`,
    displayName: title,
    mode: modeId,
    dataMode: "worldbook",
    subType: "classic",
    preset: "epic",
    draft: true,
    sourceType: "pasted_text",
    sourceText: text,
    content: text
  });
  if (res.status !== "ok") throw new Error(res.errorMsg || "创建失败");
  await refreshModules();
  AS.selectedModule = AS.modules.find(m => m.id === res.module.id) || res.module;
  AS.messages = [];
  AS.workbenchMode = "chat";
  AS.view = "workbench";
  createToast(`已创建 ${modeId} 项目`);
  render();
}

async function sendChat() {
  const input = U.qs("#chatInput");
  const text = input?.value.trim();
  if (!text || AS.busy) return;
  if (!AS.selectedModule) return createToast("请先加载一个世界", "warn");
  input.value = "";
  AS.busy = true;
  AS.progressIndex = 0;
  const userMessage = CH.add("user", text);
  render();

  // Tabletop V2: route active run turns to tabletop engine
  const modeId = AS.selectedModule?.mode || AS.selectedModule?.type || "";
  if (modeId === "tabletop" && AS.tabletopV2?.runId) {
    return sendTabletopV2Turn(text);
  }

  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!AS.busy) return;
    AS.progressIndex = Math.min(3, AS.progressIndex + 1);
    render();
  }, 1400);
  try {
    let messages = AS.messages.map(m => ({ role: m.role, content: m.content })).slice(-40);
    if (AS.isQuickStart && AS.quickStartContent) messages = [{ role: "system", content: `以下为叙事设定背景：\n${AS.quickStartContent}` }, ...messages];
    const res = await API.chatSend({
      input: text,
      moduleKey: AS.selectedModule.id,
      modeId: AS.selectedModule.mode || AS.selectedModule.type || (AS.selectedModule.dataMode === "character_card" ? "character" : "world-rpg"),
      dataMode: AS.selectedModule.dataMode || "worldbook",
      engineState: AS.engineState || { turnCount: AS.selectedModule.turnCount || 0, dataMode: AS.selectedModule.dataMode || "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
      messages,
    });
    if (res.status === "ok") {
      const narrative = res.narrative || "（无回应）";
      const turnId = res.persistedIds?.turnId || (res.turnCount ? `turn-${res.turnCount}` : "");
      if (res.persistedIds?.userId) userMessage.id = res.persistedIds.userId;
      userMessage.turnId = turnId;
      userMessage.round = res.turnCount || null;
      CH.add("assistant", narrative, { id: res.persistedIds?.assistantId, turnId, round: res.turnCount || null, candidates: res.persistedIds?.assistantId ? [{ id: `${res.persistedIds.assistantId}-c0`, content: narrative, selected: true, createdAt: new Date().toISOString() }] : [] });
      CH.persist();
      AS.lastStatusSections = res.parsedSections || {};
      AS.engineState = res.engineState || AS.engineState;
      AS.modePlay = res.modePlay || AS.engineState?.realPlay || AS.modePlay;
      AS.lastWorkflowRun = { status: "completed", totalMs: res._progress?.totalMs || 0, stages: res._progress?.stages || [] };
      AS.kernel = res.kernel || AS.kernel;
      if (res.turnCount && AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
      if (AS.selectedModule?.id !== "__quick__") await Promise.all([loadLatestStatusFrame(), refreshObserve(), loadKernelData()]);
    } else {
      CH.add("error", res.errorMsg || "LLM 返回错误");
    }
  } catch (err) {
    CH.add("error", err.message || String(err));
    AS.lastWorkflowRun = { status: "failed", totalMs: 0, stages: [] };
  }
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  AS.progressIndex = 4;
  AS.busy = false;
  render();
}

function confirmClearChat() {
  if (!confirm("清空当前对话显示？")) return;
  AS.messages = [];
  CH.persist();
  render();
}

function openCommandPanel() {
  const commands = ["/recap", "/world", "/save", "/branch", "/who", "/roll 1d20+3", "/clue 线索名", "/hypothesis 假设内容", "/goal 长期目标", "/invest_military", "/expand_trade", "/fortify_defense", "/diplomacy_focus", "/审查 check"].join("\n");
  alert(`可用命令：\n${commands}`);
}

async function messageAction(action, id) {
  const msg = AS.messages.find(m => m.id === id);
  if (!msg) return;
  if (action === "copy-message") {
    await navigator.clipboard?.writeText(msg.content);
    return createToast("已复制");
  }
  if (action === "edit-message") {
    const content = prompt("编辑消息", msg.content);
    if (content == null) return;
    msg.content = content;
    CH.persist();
    API.chatMessage({ moduleKey: AS.selectedModule?.id, messageId: id, action: "edit", content }).catch(() => {});
  }
  if (action === "favorite-message") {
    msg.favorite = !msg.favorite;
    CH.persist();
    API.chatMessage({ moduleKey: AS.selectedModule?.id, messageId: id, action: "favorite", favorite: msg.favorite }).catch(() => {});
  }
  if (action === "delete-message") {
    if (!confirm("删除这条消息？")) return;
    AS.messages = AS.messages.filter(m => m.id !== id);
    CH.persist();
    API.chatMessage({ moduleKey: AS.selectedModule?.id, messageId: id, action: "delete" }).catch(() => {});
  }
  if (action === "regen-message") {
    const content = prompt("添加一个候选回复版本", msg.content);
    if (!content) return;
    msg.candidates = Array.isArray(msg.candidates) && msg.candidates.length ? msg.candidates : [{ id: `${id}-c0`, content: msg.content, selected: true, createdAt: msg.ts }];
    const candidate = { id: `${id}-c${msg.candidates.length}`, content, selected: false, createdAt: new Date().toISOString() };
    msg.candidates.push(candidate);
    CH.persist();
    API.chatMessage({ moduleKey: AS.selectedModule?.id, messageId: id, action: "add-candidate", content }).catch(() => {});
  }
  if (action === "candidate-prev" || action === "candidate-next") {
    const candidates = msg.candidates || [];
    if (!candidates.length) return;
    const current = Math.max(0, candidates.findIndex(c => c.selected));
    const next = action === "candidate-next" ? (current + 1) % candidates.length : (current - 1 + candidates.length) % candidates.length;
    msg.candidates = candidates.map((c, i) => ({ ...c, selected: i === next }));
    msg.content = msg.candidates[next].content;
    CH.persist();
    API.chatMessage({ moduleKey: AS.selectedModule?.id, messageId: id, action: "select-candidate", candidateId: msg.candidates[next].id }).catch(() => {});
  }
  render();
}

function showCreateDialog(dataMode, label) {
  const name = prompt(`输入${label}名称`);
  if (!name?.trim()) return;
  API.createModule({ name: name.trim(), displayName: name.trim(), dataMode, subType: dataMode === "worldbook" ? "classic" : "default", preset: dataMode === "worldbook" ? "epic" : "minimal" })
    .then(async res => {
      if (res.status !== "ok") throw new Error(res.errorMsg || "创建失败");
      await refreshModules();
      AS.selectedModule = AS.modules.find(m => m.id === res.module.id) || AS.selectedModule;
      createToast("已创建");
      render();
    })
    .catch(err => createToast(err.message, "bad"));
}

async function deleteModule(id) {
  if (!id) return;
  const mod = AS.modules.find(m => m.id === id);
  if (!confirm(`确定删除「${mod?.displayName || mod?.name || id}」？此操作不可恢复。`)) return;
  if (mod?.dataMode === "character_card") await API.post("/api/characters/delete", { id: mod._characterId || id.replace("char:", "") });
  else await API.deleteModule(id);
  if (AS.selectedModule?.id === id) AS.selectedModule = null;
  await refreshModules();
  render();
}

async function importCharacterFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.png";
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    let ok = 0;
    const failed = [];
    for (const file of files) {
      try {
        let content;
        let encoding = "text";
        if (file.name.toLowerCase().endsWith(".png")) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (const b of bytes) binary += String.fromCharCode(b);
          content = btoa(binary);
          encoding = "base64";
        } else {
          content = await file.text();
        }
        const res = await API.importCharacter({ filename: file.name, content, encoding });
        if (res.status !== "ok") throw new Error(res.errorMsg || "导入失败");
        ok += 1;
      } catch (err) {
        failed.push(`${file.name}: ${err.message || err}`);
      }
    }
    AS.characters = await API.loadCharacters();
    await refreshModules();
    createToast(`角色卡导入 ${ok}/${files.length}${failed.length ? "，有失败项" : ""}`, failed.length ? "warn" : "");
    if (failed.length) console.warn("角色导入失败", failed);
    render();
  };
  input.click();
}

async function editCharacterMeta(id) {
  if (!id) return;
  const current = AS.characters.find(c => c.id === id) || {};
  const name = prompt("角色显示名", current.name || id);
  if (name == null) return;
  const tags = prompt("标签，用逗号分隔", (current.tags || []).join(", "));
  if (tags == null) return;
  const description = prompt("短说明", current.description || "");
  if (description == null) return;
  const res = await API.updateCharacter({ id, name, tags, description });
  if (res.status !== "ok") throw new Error(res.errorMsg || "更新失败");
  AS.characters = await API.loadCharacters();
  await refreshModules();
  createToast("角色信息已更新");
  render();
}

async function previewCharacter(id) {
  if (!id) return;
  const res = await API.loadCharacter(id);
  if (res.status === "ok") { AS.currentCharacterCard = res.card; AS.currentV2Capsule = res.v2Capsule || null; AS.currentV2RuntimeContext = res.v2RuntimeContext || null; AS.currentV2RuntimeMvp = res.v2RuntimeMvp || null; }
  else { AS.currentV2Capsule = null; AS.currentV2RuntimeContext = null; AS.currentV2RuntimeMvp = null; }
  render();
}

async function rpCharacter(id) {
  if (!id) return;
  try {
    const res = await API.loadCharacter(id);
    if (res.status === "ok") {
      AS.currentV2Capsule = res.v2Capsule || null;
      AS.currentV2RuntimeMvp = res.v2RuntimeMvp || null;
      if (AS.currentV2RuntimeMvp?.available) {
        createToast("V2 Runtime 已就绪：可在 V2 角色回复面板中进行受控 Text-first 回复。", "ok");
      } else if (AS.currentV2RuntimeContext?.available) {
        createToast("V2 角色运行上下文已就绪（尚未注入 LLM）", "ok");
      }
    }
  } catch { /* non-blocking */ }
  let mod = AS.modules.find(m => m.id === `char:${id}`);
  if (!mod) {
    const c = AS.characters.find(x => x.id === id);
    mod = { id: `char:${id}`, displayName: c?.name || id, dataMode: "character_card", _characterId: id };
    AS.modules.push(mod);
  }
  await selectModule(mod.id, "chat");
  render();
}

async function backupCharacter(id) {
  if (!id) return;
  await API.post("/api/characters/backup", { id });
  createToast("角色卡已备份");
}

async function deleteCharacter(id) {
  if (!id || !confirm("确定删除这张角色卡？")) return;
  await API.post("/api/characters/delete", { id });
  AS.characters = await API.loadCharacters();
  await refreshModules();
  render();
}

async function editWorldbookEntry(id) {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  const entry = AS.worldbookEntries.find(e => (e.id || "") === id) || {};
  const title = prompt("条目标题", entry.title || entry.keys?.[0] || "");
  if (!title) return;
  const keys = prompt("关键词，用逗号分隔", Array.isArray(entry.keys) ? entry.keys.join(", ") : title) || title;
  const group = prompt("分组", entry.group || "默认") || "默认";
  const content = prompt("条目内容", entry.content || "") || "";
  const priority = Number(prompt("优先级", entry.priority ?? 100) || entry.priority || 100);
  const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "upsert", entry: { ...entry, title, keys, group, content, priority, enabled: entry.enabled !== false } });
  if (res.status !== "ok") throw new Error(res.errorMsg || "保存失败");
  AS.worldbookEntries = res.entries || [];
  render();
}

function exportWorldbookJson() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  downloadJsonFile(`${AS.selectedModule.id}-worldbook.json`, { entries: AS.worldbookEntries || [] });
}

function importWorldbookJson() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const json = JSON.parse(await file.text());
    const entries = Array.isArray(json) ? json : (json.entries || json.worldbook?.entries || []);
    if (!Array.isArray(entries) || !entries.length) return createToast("没有识别到世界书 entries", "bad");
    const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "append", entries });
    if (res.status !== "ok") throw new Error(res.errorMsg || "导入失败");
    AS.worldbookEntries = res.entries || [];
    createToast(`已导入 ${entries.length} 条世界书`);
    render();
  };
  input.click();
}

async function toggleWorldbookEntry(id) {
  const entry = AS.worldbookEntries.find(e => (e.id || "") === id);
  const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "toggle", id, enabled: entry?.enabled === false });
  if (res.status === "ok") AS.worldbookEntries = res.entries || [];
  render();
}

async function deleteWorldbookEntry(id) {
  if (!id || !confirm("删除该世界书条目？")) return;
  const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "delete", id });
  if (res.status === "ok") AS.worldbookEntries = res.entries || [];
  render();
}

async function testWorldbook() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  AS.worldbookTest = await API.testWorldbook({ moduleKey: AS.selectedModule.id, input: U.qs("#worldbookTestInput")?.value || "" });
  render();
}

async function alchemyImport() {
  const text = U.qs("#alchemyText")?.value.trim();
  if (!text) return createToast("请先粘贴素材", "warn");
  const res = await API.alchemyImport({ text, moduleKey: activeAlchemyModuleKey() });
  if (res.status !== "ok") throw new Error(res.errorMsg || "提取失败");
  await loadReviewFacts();
  createToast(`已加入审核队列 ${res.reviewItems?.length || 0} 项`);
  AS.libraryTab = "review";
  render();
}

function updateAlchemyItem(id, patch) {
  const item = AS.alchemyPreview?.items?.find(entry => entry.id === id);
  if (item) Object.assign(item, patch);
}

function activeAlchemyModuleKey() {
  const module = AS.selectedModule;
  return module && module.type !== "profile" && !String(module.id || "").startsWith("profile:") ? module.id : "";
}

function setAlchemyPreview(result) {
  AS.alchemyPreview = result.preview || null;
  AS.alchemyPreviewId = result.previewId || result.preview?.id || "";
  AS.alchemySelectedItemIds = (AS.alchemyPreview?.items || []).filter(item => item.selected !== false).map(item => item.id);
  AS.alchemyEditingItemId = "";
  AS.alchemyEditingMechanismId = "";
  AS.alchemyError = "";
}

async function loadMechanismLibrary(query = AS.alchemyMechanismQuery) {
  AS.alchemyMechanismQuery = String(query || "");
  const result = await API.mechanismLibrary({ query: AS.alchemyMechanismQuery, moduleKey: activeAlchemyModuleKey(), previewId: AS.alchemyPreviewId });
  AS.alchemyMechanismLibrary = result.templates || [];
  if (!AS.alchemyMechanismQuery && result.recommendations?.length) AS.alchemyMechanismRecommendations = result.recommendations;
  render();
}

async function loadAlchemyMechanismsFromInput() {
  const result = await API.mechanismDraft({
    previewId: AS.alchemyPreviewId,
    text: AS.alchemyText,
    moduleKey: activeAlchemyModuleKey(),
    userGoal: AS.alchemyUserGoal
  });
  const libraryDrafts = AS.alchemyMechanismDrafts.filter(draft => draft.source === "library" || draft.source === "manual");
  AS.alchemyMechanismDrafts = [...(result.drafts || []), ...libraryDrafts];
  AS.alchemyMechanismRecommendations = result.libraryRecommendations || [];
  await loadMechanismLibrary();
}

function addMechanismTemplate(templateId) {
  const template = AS.alchemyMechanismLibrary.find(item => item.templateId === templateId) || AS.alchemyMechanismRecommendations.find(item => item.templateId === templateId);
  if (!template) return createToast("没有找到这个机制模板", "warn");
  if (AS.alchemyMechanismDrafts.some(draft => draft.sourceRef?.templateId === template.templateId)) return createToast("这个模板已加入本次机制", "warn");
  const defaults = template.defaultDraft || {};
  AS.alchemyMechanismDrafts.push({
    id: globalThis.crypto?.randomUUID?.() || `mechanism-${Date.now()}`,
    source: "library",
    sourceRef: { templateId: template.templateId },
    name: defaults.name || template.name,
    type: defaults.type || template.type || "custom",
    description: defaults.description || template.description || "",
    scope: defaults.scope || ((defaults.type || template.type) === "custom" ? "world" : "save"),
    stateSchema: defaults.stateSchema || { kind: "custom" },
    visualHint: defaults.visualHint || template.visualHint || { preferredType: "status_list", showToPlayer: true },
    selected: true,
    warnings: []
  });
  createToast(`已添加：${template.name}`);
  render();
}

function editMechanismDraft(id) {
  const draft = AS.alchemyMechanismDrafts.find(item => item.id === id);
  if (!draft) return;
  if (AS.alchemyEditingMechanismId !== id) {
    AS.alchemyEditingMechanismId = id;
    return render();
  }
  const card = document.querySelector(`[data-mechanism-draft-id="${globalThis.CSS?.escape?.(id) || id}"]`);
  const field = name => card?.querySelector(`[data-mechanism-field="${name}"]`);
  const numberOrUndefined = name => field(name)?.value === "" ? undefined : Number(field(name)?.value);
  const min = numberOrUndefined("min");
  const max = numberOrUndefined("max");
  const defaultValue = numberOrUndefined("defaultValue");
  if (min !== undefined && max !== undefined && min > max) return createToast("最小值不能大于最大值", "bad");
  if (defaultValue !== undefined && min !== undefined && defaultValue < min) return createToast("默认值不能小于最小值", "bad");
  if (defaultValue !== undefined && max !== undefined && defaultValue > max) return createToast("默认值不能大于最大值", "bad");
  draft.name = String(field("name")?.value || "").trim().slice(0, 120) || draft.name;
  draft.type = field("type")?.value || "custom";
  draft.description = String(field("description")?.value || "").trim().slice(0, 500);
  draft.scope = field("scope")?.value || "save";
  draft.stateSchema = { kind: field("kind")?.value || "custom", ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(defaultValue !== undefined ? { defaultValue } : {}) };
  draft.visualHint = { preferredType: field("preferredType")?.value || "status_list", showToPlayer: Boolean(field("showToPlayer")?.checked) };
  AS.alchemyEditingMechanismId = "";
  render();
}

function removeMechanismDraft(id) {
  AS.alchemyMechanismDrafts = AS.alchemyMechanismDrafts.filter(item => item.id !== id);
  if (AS.alchemyEditingMechanismId === id) AS.alchemyEditingMechanismId = "";
  render();
}

async function commitMechanismDraftsToWorld() {
  const moduleKey = activeAlchemyModuleKey();
  if (!moduleKey || moduleKey === "__quick__") return createToast("请先选择要写入机制缓存的世界", "warn");
  const result = await API.mechanismCommit({ moduleKey, drafts: AS.alchemyMechanismDrafts });
  AS.alchemyMechanismCache = result.cache || null;
  createToast(`已提交 ${result.committed || 0} 项机制；跳过 ${result.skipped || 0} 项`);
}

async function createAlchemyPreview() {
  AS.alchemyText = U.qs("#alchemyText")?.value || AS.alchemyText;
  AS.alchemyUserGoal = U.qs("#alchemyUserGoal")?.value || "";
  AS.alchemyTarget = U.qs("#alchemyTarget")?.value || AS.alchemyTarget;
  const text = AS.alchemyText.trim();
  if (!text) return createToast("请先输入素材或灵感", "warn");
  if (text.length > 120000) return createToast("文本过长，请分段处理。", "warn");
  AS.alchemyPreviewBusy = true;
  AS.alchemyError = "";
  render();
  try {
    const result = await API.alchemyPreview({
      text,
      moduleKey: activeAlchemyModuleKey(),
      mode: AS.alchemyMode,
      target: AS.alchemyTarget,
      userGoal: AS.alchemyUserGoal,
      options: { autoRelations: true, detectConflicts: true, suggestMissingFields: true, preserveSource: false }
    });
    setAlchemyPreview(result);
    await loadAlchemyMechanismsFromInput();
    createToast(`已生成 ${result.preview?.items?.length || 0} 个候选条目`);
  } catch (err) {
    AS.alchemyError = err.message || "预览处理失败";
    createToast(AS.alchemyError, "bad");
  } finally {
    AS.alchemyPreviewBusy = false;
    render();
  }
}

function toggleAlchemyItemEdit(id) {
  if (!id) return;
  AS.alchemyEditingItemId = AS.alchemyEditingItemId === id ? "" : id;
  render();
}

function ignoreAlchemyItem(id) {
  const item = AS.alchemyPreview?.items?.find(entry => entry.id === id);
  if (!item) return;
  item.selected = false;
  AS.alchemySelectedItemIds = AS.alchemySelectedItemIds.filter(itemId => itemId !== id);
  render();
}

async function refineAlchemyPreview() {
  if (!AS.alchemyPreviewId) return createToast("请先生成预览", "warn");
  AS.alchemyRefineText = U.qs("#alchemyRefineText")?.value || AS.alchemyRefineText;
  const instruction = AS.alchemyRefineText.trim();
  if (!instruction) return createToast("请输入继续处理的要求", "warn");
  if (!AS.alchemySelectedItemIds.length) return createToast("没有选中的条目可继续处理。", "warn");
  AS.alchemyPreviewBusy = true;
  AS.alchemyError = "";
  render();
  try {
    const result = await API.alchemyRefine({
      previewId: AS.alchemyPreviewId,
      instruction,
      selectedItemIds: AS.alchemySelectedItemIds,
      mode: AS.alchemyMode === "import" ? "polish" : AS.alchemyMode
    });
    setAlchemyPreview(result);
    await loadAlchemyMechanismsFromInput();
    AS.alchemyRefineText = "";
    createToast("已按要求生成新的预览版本");
  } catch (err) {
    AS.alchemyError = err.message || "继续处理失败";
    createToast(AS.alchemyError, "bad");
  } finally {
    AS.alchemyPreviewBusy = false;
    render();
  }
}

async function commitAlchemyPreview() {
  if (!AS.alchemyPreviewId) return createToast("请先生成预览", "warn");
  if (!AS.alchemySelectedItemIds.length) return createToast("没有选中的条目可加入审核队列。", "warn");
  AS.alchemyCommitBusy = true;
  AS.alchemyError = "";
  render();
  try {
    const result = await API.alchemyCommit({
      previewId: AS.alchemyPreviewId,
      action: "enqueue_review",
      selectedItemIds: AS.alchemySelectedItemIds,
      editedItems: AS.alchemyPreview?.items || []
    });
    await loadReviewFacts();
    createToast(`已加入审核队列 ${result.stats?.enqueued || 0} 条`);
    AS.libraryTab = "review";
  } catch (err) {
    AS.alchemyError = err.message || "加入审核队列失败";
    createToast(AS.alchemyError, "bad");
  } finally {
    AS.alchemyCommitBusy = false;
    render();
  }
}

function clearAlchemyPreview() {
  AS.alchemyPreview = null;
  AS.alchemyPreviewId = "";
  AS.alchemySelectedItemIds = [];
  AS.alchemyEditingItemId = "";
  AS.alchemyRefineText = "";
  AS.alchemyMechanismDrafts = [];
  AS.alchemyMechanismRecommendations = [];
  AS.alchemyMechanismTemplateId = "";
  AS.alchemyError = "";
  render();
}

async function enqueueReview() {
  const text = U.qs("#reviewSourceText")?.value.trim();
  if (!text) return createToast("请先粘贴素材", "warn");
  const res = await API.alchemyImport({ text, moduleKey: activeAlchemyModuleKey() });
  if (res.status !== "ok") throw new Error(res.errorMsg || "提取失败");
  await loadReviewFacts();
  render();
}

async function reviewAction(action, id) {
  if (!id) return;
  const payload = { id, moduleKey: AS.selectedModule?.id };
  if (!payload.moduleKey || payload.moduleKey === "__quick__") {
    if (action === "confirm-review") payload.action = "confirm";
    if (action === "ignore-review") payload.action = "ignore";
    if (action === "merge-review") payload.action = "merge";
    const res = await API.alchemyReview(payload);
    AS.reviewItems = res.items || [];
    return render();
  }
  let endpoint = action === "ignore-review" ? "reject" : "adopt";
  if (action === "merge-review") {
    endpoint = "edit-and-adopt";
    const item = AS.reviewItems.find(x => x.id === id) || {};
    const patch = prompt("编辑后的 after JSON", U.json(item.after || item.data || {}));
    if (patch && patch.trim()) {
      try { payload.after = JSON.parse(patch); }
      catch { return createToast("字段 JSON 格式不正确", "bad"); }
    }
  }
  const res = await API.reviewAction(endpoint, payload);
  if (res.status !== "ok") throw new Error(res.errorMsg || "审核操作失败");
  await loadReviewFacts();
  render();
}

async function exportWorldpack() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  AS.worldPack = await API.worldPackExport({ moduleKey: AS.selectedModule.id, ...AS.worldPackOptions });
  AS.importPreview = null;
  render();
}

function downloadWorldpack() {
  if (!AS.worldPack?.pack) return;
  downloadJsonFile(AS.worldPack.filename || "world.worldtree", AS.worldPack.pack);
}

function importWorldpack() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".worldtree,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    AS.pendingPack = JSON.parse(await file.text());
    AS.importPreview = await API.worldPackImport({ pack: AS.pendingPack, preview: true });
    AS.worldPack = null;
    render();
  };
  input.click();
}

async function confirmWorldpackImport() {
  if (!AS.pendingPack) return;
  const res = await API.worldPackImport({ pack: AS.pendingPack, confirm: true });
  if (res.status !== "ok") throw new Error(res.errorMsg || "导入失败");
  await refreshModules();
  AS.importPreview = null;
  createToast("世界包已导入");
  render();
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyConnectionTemplate() {
  const id = U.qs("#connTemplate")?.value;
  const t = AS.connections?.templates?.find(x => x.id === id);
  if (!t) return;
  U.qs("#connLabel").value = t.label || "";
  U.qs("#connBaseUrl").value = t.baseUrl || "";
  U.qs("#connModel").value = t.model || "";
  if (U.qs("#connTemperature")) U.qs("#connTemperature").value = t.temperature ?? "";
  if (U.qs("#connMaxTokens")) U.qs("#connMaxTokens").value = t.maxTokens ?? "";
  if (U.qs("#connTopP")) U.qs("#connTopP").value = t.topP ?? "";
}

async function saveConnection() {
  const profile = {
    label: U.qs("#connLabel")?.value,
    baseUrl: U.qs("#connBaseUrl")?.value,
    model: U.qs("#connModel")?.value,
    temperature: U.qs("#connTemperature")?.value,
    maxTokens: U.qs("#connMaxTokens")?.value,
    topP: U.qs("#connTopP")?.value,
    apiKey: U.qs("#connKey")?.value,
    provider: U.qs("#connTemplate")?.value
  };
  AS.connections = await API.connections({ action: "upsert", profile, setDefault: true });
  AS.llmDiagnostics = null;
  createToast("连接档案已保存");
  render();
}

async function connectionAction(action, id) {
  const map = { "set-default-connection": "setDefault", "test-connection": "test", "duplicate-connection": "duplicate", "delete-connection": "delete" };
  const res = await API.connections({ action: map[action], id });
  if (action === "test-connection") {
    AS.llmDiagnostics = res;
    createToast(res.status === "ok" || res.status === "partial" ? `诊断完成 ${res.latencyMs || 0}ms` : (res.errorMsg || "连接失败"), res.status === "ok" || res.status === "partial" ? "" : "bad");
    render();
  }
  else { AS.connections = res; render(); }
}

async function pluginAction(action, id) {
  AS.plugins = await API.plugins({ id, action: action === "enable-plugin" ? "enable" : "disable" });
  render();
}

async function runPlugin(id) {
  if (!id) return;
  const res = await API.plugins({ id, action: "run" });
  AS.pluginRunResult = res;
  createToast(res.status === "ok" ? "插件 dry-run 完成" : (res.errorMsg || "插件运行失败"), res.status === "ok" ? "" : "bad");
  render();
}

async function legacyExport(id) {
  if (!id) return createToast("请先选择模块", "warn");
  const res = await API.get(`/api/data/export?moduleKey=${encodeURIComponent(id)}`);
  downloadJsonFile(`${id}.json`, res);
}

async function refreshDebugLogs() {
  try {
    const res = await API.get("/api/debug/logs?limit=80");
    U.qs("#debugLogContent").innerHTML = (res.logs || []).map(l => `<div class="debug-entry"><span>${U.esc((l.ts || "").slice(11, 19))}</span><span>${U.esc(l.category || "")}</span><span>${U.esc(l.message || "")} ${l.data ? U.esc(l.data) : ""}</span></div>`).join("") || "暂无日志";
  } catch (err) {
    U.qs("#debugLogContent").innerHTML = U.esc(err.message);
  }
}

function toggleDebugPanel() {
  U.qs("#debugPanel").classList.toggle("open");
  if (U.qs("#debugPanel").classList.contains("open")) refreshDebugLogs();
}

function createToast(msg, tone = "") {
  const host = U.qs("#toastHost");
  const el = document.createElement("div");
  el.className = `toast ${tone}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function updateHealth() {
  try {
    AS.health = await API.health();
    const [workflowStatus, workflowTypes] = await Promise.all([
      API.workflowStatus().catch(() => null),
      API.workflowTypes().catch(() => ({ types: [] }))
    ]);
    AS.workflowStatus = workflowStatus;
    AS.workflowTypes = workflowTypes.types || [];
    if (AS.health?.version) CFG.version = AS.health.version;
    const versionNode = U.qs("#appVersion");
    if (versionNode) versionNode.textContent = `叙事引擎 v${CFG.version}`;
    if (AS.health?.llm?.status === "connected") AS.llmConnected = true;
    const debug = U.qs("#debugToggle");
    if (debug && AS.health?.debugMode) debug.style.display = "block";
  } catch (err) { console.warn("[health] status refresh failed (non-fatal):", err?.message || "unknown error"); }
}

async function init() {
  for (const base of ["http://localhost:3000", window.location.origin]) {
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) { API.base = base; break; }
    } catch (err) { console.warn("[init] API probe failed (non-fatal):", err?.message || "unknown error"); }
  }
  try { Object.assign(AS.config, await API.loadConfig()); } catch (err) { console.warn("[init] config load failed (non-fatal):", err?.message || "unknown error"); }
  try {
    const secrets = await API.getSecrets();
    AS.hasApiKey = !!secrets?.llm?.items?.length;
  } catch (err) { console.warn("[init] secret state unavailable (non-fatal):", err?.message || "unknown error"); }
  try {
    const ex = await API.loadExamples();
    AS.examples = ex.examples || [];
  } catch (err) { console.warn("[init] examples unavailable (non-fatal):", err?.message || "unknown error"); }
  await refreshModules().catch(err => createToast(`模块加载失败：${err.message}`, "bad"));
  await Promise.all([
    API.connections().then(d => { AS.connections = d; }).catch(() => {}),
    API.alchemyReview().then(d => { AS.reviewItems = d.items || []; }).catch(() => {}),
    updateHealth(),
  ]);
  if (AS.hasApiKey && AS.config.llmBaseUrl) {
    API.testLlm({ config: AS.config }).then(res => { AS.llmConnected = res.status === "ok"; render(); }).catch(() => {});
  }
  if (AS.selectedModule) {
    await Promise.all([CH.loadServer(AS.selectedModule), loadLatestStatusFrame()]);
    await loadWorldbookIfPossible().catch(() => {});
  }
  render();
  setInterval(updateHealth, 30000);
}

U.qs("#refreshBtn").onclick = async () => { await refreshModules(); await loadViewData(); render(); };
U.qs("#settingsBtn").onclick = async () => { AS.view = "settings"; await loadViewData(); render(); };
U.qs("#debugToggle").onclick = toggleDebugPanel;
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    toggleDebugPanel();
  }
});

init();

async function characterV2Preview() {
  const name = (U.qs("#v2CreateName")?.value || "").trim();
  const text = (U.qs("#v2CreateText")?.value || "").trim();
  AS.characterV2Create.name = name;
  AS.characterV2Create.text = text;
  if (!name && !text) { AS.characterV2Create.error = "请先输入角色名或角色设定。"; return render(); }
  AS.characterV2Create.error = "";
  AS.characterV2Create.busy = true;
  render();
  try {
    const res = await API.importCharacter({ v2Capsule: true, confirmed: false, input: { name, text, sourceType: "manual", avatar: AS.characterV2Create.avatar } });
    if (res.status === "preview" && res.summary) {
      AS.characterV2Create.preview = res.summary;
      AS.characterV2Create.draft = res.draft;
    } else {
      AS.characterV2Create.error = res.errorMsg || "预览失败，请重试。";
    }
  } catch (err) {
    AS.characterV2Create.error = "角色草案预览失败，请查看控制台或稍后重试。";
  }
  AS.characterV2Create.busy = false;
  render();
}

async function characterV2Confirm() {
  if (!AS.characterV2Create.draft) { AS.characterV2Create.error = "请先预览角色草案。"; return render(); }
  AS.characterV2Create.busy = true;
  render();
  try {
    const res = await API.importCharacter({ v2Capsule: true, confirmed: true, draft: AS.characterV2Create.draft });
    if (res.status === "ok") {
      AS.characters = await API.loadCharacters();
      AS.characterV2Create = { open: false, name: "", text: "", avatar: null, preview: null, error: "", busy: false, advancedOpen: false };
      createToast("角色创建成功！", "ok");
    } else {
      AS.characterV2Create.error = res.errorMsg || "角色草案保存失败，请查看控制台或稍后重试。";
    }
  } catch (err) {
    AS.characterV2Create.error = "角色草案保存失败，请查看控制台或稍后重试。";
  }
  AS.characterV2Create.busy = false;
  render();
}

async function sendCharacterV2LiveTurn(dryRun = false) {
  const characterId = AS.currentV2RuntimeMvp?.characterId || AS.currentV2Capsule?.characterId || "";
  const userInput = (U.qs("#characterV2LiveInput")?.value || "").trim();
  if (!characterId) return createToast("请先预览一个 V2 角色。", "warn");
  if (!userInput && !dryRun) return createToast("请先输入一句话。", "warn");
  AS.characterV2Live.busy = true;
  AS.characterV2Live.error = "";
  render();
  try {
    const res = await API.post("/api/characters/v2/turn", { characterId, userInput: userInput || "你好。", history: AS.characterV2Live.history || [], dryRun });
    if (res.status !== "ok") throw new Error(res.errorMsg || "角色回复失败");
    AS.characterV2Live.reply = res.reply || "";
    AS.characterV2Live.candidates = { memory: res.candidates?.memoryCandidates?.length || 0, relationship: res.candidates?.relationshipCandidates?.length || 0, quality: res.candidates?.qualityCandidates?.length || 0 };
    AS.characterV2Live.candidateEnvelope = res.candidates || null;
    AS.characterV2Live.packetSummary = res.packetSummary || null;
    AS.characterV2Live.quality = res.quality || null;
    if (res.reply) AS.characterV2Live.history = [...AS.characterV2Live.history, { role: "user", content: userInput }, { role: "assistant", content: res.reply }].slice(-24);
    AS.characterV2Live.input = "";
  } catch (err) {
    AS.characterV2Live.error = err.message || String(err);
  }
  AS.characterV2Live.busy = false;
  render();
}

async function saveCharacterV2Candidates() {
  const characterId = AS.currentV2RuntimeMvp?.characterId || AS.currentV2Capsule?.characterId || "";
  const envelope = AS.characterV2Live.candidateEnvelope;
  if (!characterId) return createToast("请先预览一个 V2 角色。", "warn");
  if (!envelope) return createToast("当前没有可保存的候选。", "warn");
  try {
    const res = await API.post("/api/characters/v2/candidates/save", { characterId, candidates: envelope });
    createToast(res.saved > 0 ? `已保存 ${res.saved} 条候选到审核队列。` : "无可保存的候选。", "ok");
  } catch (err) {
    createToast("保存候选失败。", "warn");
  }
}

async function exportCharacterV2File(format) {
  const characterId = AS.currentV2RuntimeMvp?.characterId || AS.currentV2Capsule?.characterId || AS.currentCharacterCard?.id || "";
  if (!characterId) return createToast("请先预览一个角色。", "warn");
  try {
    const res = await API.post("/api/characters/v2/export", { characterId, format });
    if (res.status !== "ok") return createToast(res.errorMsg || "导出失败", "warn");
    const ext = { character_md: "md", wt_profile_json: "json", runtime_summary_json: "json", export_bundle_json: "json" }[format] || "json";
    const blob = new Blob([res.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${characterId}.${format === "character_md" ? "CHARACTER.md" : format === "export_bundle_json" ? "world-tree-character-v2.bundle.json" : `${format}.${ext}`}`;
    a.click();
    URL.revokeObjectURL(url);
    createToast("导出完成", "ok");
  } catch (err) {
    createToast("导出失败：" + (err.message || ""), "warn");
  }
}
