"use strict";

// Deferred/internal: plugin system is not part of v0.3.0 public product scope.
const ENABLE_DEFERRED_PLUGINS = false;

const CFG = {
  version: "unknown",
  nav: window.WorldTreeNavigation?.primaryNav || [
    { id: "workbench", label: "大厅", icon: "□", meta: "开始" },
    { id: "chat", label: "对话", icon: "◇", meta: "创作" },
    { id: "library", label: "资料库", icon: "▦", meta: "素材" },
    { id: "worlds", label: "世界管理", icon: "◎", meta: "项目" },
    { id: "observe", label: "观测", icon: "◌", meta: "调试" },
    { id: "settings", label: "设置", icon: "⚙", meta: "配置" },
  ],
};

const CLIENT_CORE = window.WorldTreeClientCore || {};
const U = CLIENT_CORE.U;
const API = CLIENT_CORE.API;
const UI_LABELS = window.WT_UI_LABELS || { label: (_id, fallback) => fallback || "" };
const T = (id, fallback = "") => UI_LABELS.label(id, fallback);

if (!U || !API) {
  throw new Error("WorldTreeClientCore failed to load before world-tree-console.js");
}

const PROGRESS_STAGE_PROFILES = {
  "chat-default": [
    "正在读取当前项目上下文……",
    "正在生成本轮回应……",
    "正在整理状态变化……",
    "正在保存本轮结果……",
    "本轮完成"
  ],
  "tabletop-v2": [
    "GM 正在读取当前场景……",
    "规则引擎正在判定行动……",
    "正在生成玩家可见叙事……",
    "正在同步跑团状态……",
    "本轮完成"
  ],
  "dual-stage-chat": [
    "导演正在分析你的行动……",
    "生成叙事方向……",
    "故事正在书写……",
    "Guardian 正在审核……",
    "本轮完成"
  ]
};
const PROGRESS_STAGES = PROGRESS_STAGE_PROFILES["chat-default"];
let progressTimer = null;
let activeChatAbortController = null;

function getProgressStages(profile = "chat-default") {
  return PROGRESS_STAGE_PROFILES[profile] || PROGRESS_STAGE_PROFILES["chat-default"];
}

function setProgressProfile(profile = "chat-default") {
  AS.progressProfile = profile;
  AS.progressIndex = 0;
}

function buildTabletopV2ModuleDraftFromText(text = "", preview = {}) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  const previewInfo = preview.preview || preview;
  return {
    title: previewInfo.title || clean.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.slice(0, 40) || "导入冒险",
    sourceType: "external_text",
    playerBrief: {
      premise: previewInfo.playerBrief?.premise || clean.slice(0, 500),
      objective: previewInfo.playerBrief?.objective || "",
      setting: previewInfo.playerBrief?.setting || "",
      playerCharacters: [],
      allowedActions: []
    },
    gmBook: {
      hiddenTruth: "",
      npcs: [],
      gmScenes: [],
      secretClocks: [],
      twistPoints: []
    },
    scenes: [
      {
        sceneId: "scene_start",
        title: "开场",
        description: previewInfo.playerBrief?.premise || clean.slice(0, 500),
        isStarting: true,
        isHidden: false,
        exitTransitions: []
      }
    ],
    characters: [],
    clocks: [],
    rulesetProfileId: previewInfo.rulesetProfileId || "d20_fantasy"
  };
}

function parseJsonObjectInput(text = "", fallback = {}) {
  const raw = String(text || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function buildWorldbookV2EntryFromText(text = "") {
  const parsed = parseJsonObjectInput(text, null);
  if (parsed) return parsed;
  const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return {
    title: lines[0] || "未命名世界书条目",
    keys: lines[1] ? lines[1].split(/[,，、]/).map(item => item.trim()).filter(Boolean) : [],
    content: lines.slice(2).join("\n") || lines[0] || "",
    visibility: "public"
  };
}

function strategySimV2DefaultSpec() {
  return {
    specId: "ui_strategy_spec",
    title: "UI Strategy Spec",
    resources: [{ id: "supply", label: "Supply", min: 0, max: 10, initial: 5, visibility: "public", maxDeltaPerTurn: 2 }],
    mechanisms: [{ id: "ration", label: "Ration", triggerTags: ["ration"], effects: [{ targetType: "resource", targetId: "supply", delta: -1, reason: "spent supply" }] }],
    probabilityRules: [{ id: "scout", label: "Scout", triggerTags: ["scout"], baseChance: 0.5, visibility: "partial" }],
    balanceProfile: { rngSeed: "ui-seed" }
  };
}

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
  chatDraft: "",
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
  usageSummary: null,
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
  alchemyG1: {
    capabilities: null,
    plan: null,
    preview: null,
    localFolderDraft: null,
    selectedTargets: [],
    userSupplement: "",
    deliveries: [],
    busy: false,
    error: ""
  },
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
  progressProfile: "chat-default",
  modePlay: null,
  worldPackOptions: { includeWorldbook: true, includeCharacters: true, includeSharedData: true, includeRuntimeState: false, includeReviewQueue: false, includeMechanisms: false, includeTurnStateFrames: false },
  characterV2Create: { open: false, name: "", text: "", avatar: null, preview: null, error: "", busy: false, advancedOpen: false },
  worldbookV2: { entryText: "", input: "", loaded: null, candidate: null, preview: null, exportResult: null, lastResult: null, error: "", busy: false },
  strategySimV2: { specText: "", runId: "", actionText: "", sealedSpec: null, publicView: null, lastResult: null, error: "", busy: false },
  tabletopV2: { runId: null, module: null, ruleset: null, lastRuling: null, ending: null },
  singlePlayerScriptKillV2: {
    scriptId: "", runId: "", importText: "", importPreview: null, playerRun: null,
    selectedRoleId: "", currentText: "", targetRoleId: "", locationId: "", clueId: "",
    voteTargetRoleId: "", nextPhaseId: "", lastResult: null, error: "", busy: false, panelOpen: false,
  },
  detectiveV2: { caseId: null, runId: null, importText: "", importPreview: null, playerCase: null, playerRun: null, currentLocationId: "", currentCharacterId: "", currentEvidenceId: "", question: "", notebookEntryId: "", notebookSummary: "", deductionCulpritId: "", deductionMethod: "", lastInvestigation: null, lastInterview: null, notebookOpen: true, notebook: null, deductionDraft: {}, lastResult: null, exportResult: null, error: "", busy: false },
};

const APP_STORE = window.WorldTreeAppStore?.createStore({ view: AS.view }) || null;

// Browser modules are loaded before this compatibility bootstrap by world-tree-console.html.
async function init() {
  const baseCandidates = [window.location.origin, "http://localhost:3000"];
  for (const base of baseCandidates) {
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) { API.base = base; break; }
    } catch (err) {
      if (base === baseCandidates[baseCandidates.length - 1]) console.info("[init] API fallback unavailable:", err?.message || "unknown error");
    }
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
U.qs("#settingsBtn").onclick = async () => { AS.view = "settings"; APP_STORE?.dispatch({ type: "navigation/view", view: AS.view }); await loadViewData(); render(); };
U.qs("#debugToggle").onclick = toggleDebugPanel;
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && AS.activeDrawer) {
    AS.activeDrawer = "";
    render();
    return;
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    toggleDebugPanel();
  }
});

init();
