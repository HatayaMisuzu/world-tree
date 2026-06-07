import { buildModel } from "../core/data-store.js";
import { moduleKey, moduleTitle } from "../core/normalizers.js";
import { commandText, proposedPatch, startupPacket } from "../core/commands.js";
import { runLocalDiagnostics } from "../core/diagnostics.js";
import { exportOptions } from "../adapters/local.js";
import * as Hermes from "../adapters/hermes.js";
import * as DirectLlm from "../adapters/llm.js";
import { PATH_CATALOG } from "../core/path-catalog.js";
import { injectionPreview, parseCard, worldbookEntriesFromModel } from "../core/cards.js";
import { normalizePowerUser } from "../core/slash-commands.js";
import { buildEnginePacket, normalizeEngineState, prepareTurn } from "../core/world-engine.js";
import { applyPreset, setDataMode } from "../core/engine/modules.js";
import { renderModules, renderTabs, renderView } from "./views.js";
import { t, langOf } from "./i18n.js";

const api = window.worldTreeDesktop;

const state = {
  config: {},
  tree: null,
  model: buildModel(null),
  activeTab: "home",
  healthReport: null,
  hermesStatus: null,
  messages: [],
  gameMessages: [],
  cards: [],
  secrets: {},
  worldbookState: { disabled: {}, notes: {} },
  powerUser: {},
  engineState: {},
  engineManifest: null,
  knowledgeCards: [],
  processingInput: "",
  worldbookPreviewInput: "",
  lastInjectedWorldbook: [],
  personaText: "",
  personaLoaded: false,
  lastProximity: null
};

function importedWorldbookEntries() {
  return state.cards.flatMap((card) => card.kind === "worldbook-card" ? (card.entries || []) : []);
}

function activeWorldbookState() {
  const mode = state.engineState.dataMode || "worldbook";
  const modeState = state.worldbookState.modes?.[mode] || {};
  return {
    ...state.worldbookState,
    ...modeState,
    disabled: { ...(modeState.disabled || {}) },
    importedEntries: importedWorldbookEntries()
  };
}

function saveCardLibrary() {
  localStorage.setItem(`world-tree-card-library-${state.engineState.dataMode || "worldbook"}`, JSON.stringify(state.cards));
}

function loadCardLibrary() {
  try {
    const value = JSON.parse(localStorage.getItem(`world-tree-card-library-${state.engineState.dataMode || "worldbook"}`) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function loadKnowledgeCards() {
  const modules = normalizeEngineState(state.engineState).activeModules || [];
  const cards = [];
  for (const id of modules) {
    try {
      const card = await api.getKnowledgeCard(id);
      if (card) cards.push(card);
    } catch {
      // Missing cards are tolerated; fulltext search remains available.
    }
  }
  state.knowledgeCards = cards;
}

const els = {
  rootPath: document.querySelector("#rootPath"),
  moduleList: document.querySelector("#moduleList"),
  pageTitle: document.querySelector("#pageTitle"),
  pageSub: document.querySelector("#pageSub"),
  tabs: document.querySelector("#tabs"),
  main: document.querySelector("#main"),
  statusLeft: document.querySelector("#statusLeft"),
  statusRight: document.querySelector("#statusRight"),
  openRootBtn: document.querySelector("#openRootBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  healthBtn: document.querySelector("#healthBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  openConsoleBtn: document.querySelector("#openConsoleBtn")
  ,
  languageSelect: document.querySelector("#languageSelect"),
  brandSub: document.querySelector(".brand p"),
  libraryLabel: document.querySelector(".root-box span")
};

function setStatus(left, right = "") {
  els.statusLeft.textContent = left;
  els.statusRight.textContent = right;
}

function render() {
  document.documentElement.lang = langOf(state.config);
  document.body.dataset.view = state.activeTab;
  els.languageSelect.value = langOf(state.config);
  els.brandSub.textContent = t(state.config, "brandSub");
  els.libraryLabel.textContent = "世界库";
  els.openRootBtn.textContent = t(state.config, "openWorld");
  els.refreshBtn.textContent = t(state.config, "refresh");
  els.healthBtn.textContent = t(state.config, "check");
  els.exportBtn.textContent = t(state.config, "export");
  els.rootPath.textContent = state.model.loaded ? "本地世界库已就绪" : "等待选择世界";
  els.moduleList.innerHTML = renderModules(state.model, state.config);
  els.tabs.innerHTML = renderTabs(state.activeTab, state.config);
  els.main.innerHTML = renderView(state.activeTab, state);
  els.pageTitle.textContent = state.activeTab === "home" ? "World Tree" : state.activeTab === "settings" ? "世界设定" : state.activeTab === "monitor" ? "观测终端" : state.activeTab === "archives" ? "读取记忆" : state.model.selected ? moduleTitle(state.model.selected) : t(state.config, "game");
  els.pageSub.textContent = state.activeTab === "home" ? (state.model.selected ? moduleTitle(state.model.selected) : "等待选择世界") : state.activeTab === "settings" ? "模型、叙事模式、世界内容与高级工具" : state.activeTab === "monitor" ? "世界脉象、叙事视窗与系统诊断" : state.activeTab === "archives" ? "存档与会话记录" : state.model.selected ? `${state.model.fileCount} ${t(state.config, "files")} / ${state.model.modules.length} ${t(state.config, "worlds")}` : t(state.config, "blankSession");
  setStatus(state.model.loaded ? t(state.config, "worldLoaded") : t(state.config, "blankChat"), t(state.config, state.activeTab) || state.activeTab);
  bindDynamicEvents();
}

function selectedModuleKey() {
  return state.model.selected ? moduleKey(state.model.selected) : "";
}

async function loadRoot(rootPath = state.config.dataRoot) {
  try {
    setStatus(t(state.config, "readingWorld"));
    state.tree = await api.readRoot(rootPath);
    state.model = buildModel(state.tree, state.config.lastModuleKey, state.engineState.dataMode || "worldbook");
    if (selectedModuleKey()) await api.saveConfig({ lastModuleKey: selectedModuleKey(), dataRoot: state.model.rootPath });
    state.healthReport = runLocalDiagnostics(state.model, state.config);
    state.worldbookPreviewInput = "";
    state.lastInjectedWorldbook = [];
    render();
  } catch (error) {
    setStatus(`${t(state.config, "readFailed")}: ${error.message}`, "error");
    state.model = buildModel(null);
    render();
  }
}

async function chooseRoot() {
  const tree = await api.chooseRoot();
  if (!tree) return;
  state.tree = tree;
  state.config = await api.getConfig();
  state.model = buildModel(tree, state.config.lastModuleKey, state.engineState.dataMode || "worldbook");
  state.healthReport = runLocalDiagnostics(state.model, state.config);
  render();
}

async function runHealth() {
  state.healthReport = runLocalDiagnostics(state.model, state.config);
  state.hermesStatus = null;
  if (state.config.hermesBaseUrl) {
    try {
      state.hermesStatus = { ok: true, payload: await Hermes.health(state.config) };
    } catch (error) {
      state.hermesStatus = { ok: false, error: error.message };
    }
  }
  state.activeTab = "health";
  render();
}

async function exportBundle() {
  const report = state.healthReport || runLocalDiagnostics(state.model, state.config);
  const options = exportOptions(state.model, report);
  const merged = {
    generatedAt: new Date().toISOString(),
    rootPath: state.model.rootPath,
    startupPacket: startupPacket(state.model),
    commands: commandText(state.model, state.powerUser),
    proposedPatch: proposedPatch(state.model),
    healthReport: report,
    pathCatalog: PATH_CATALOG
  };
  await api.saveText({
    defaultPath: "world-tree-desktop-export.json",
    text: JSON.stringify(merged, null, 2),
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  console.debug("Individual export options", options.map((item) => item.label));
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  setStatus(t(state.config, "copied"), t(state.config, "clipboard"));
}

function bindDynamicEvents() {
  document.querySelector("#homeStartBtn")?.addEventListener("click", () => {
    state.activeTab = "game";
    render();
  });
  document.querySelector("#homeLoadBtn")?.addEventListener("click", () => {
    state.activeTab = "archives";
    render();
  });
  document.querySelector("#homeSettingsBtn")?.addEventListener("click", () => {
    state.activeTab = "settings";
    render();
  });
  document.querySelector("#homeMonitorBtn")?.addEventListener("click", () => {
    state.activeTab = "monitor";
    render();
  });
  document.querySelectorAll("#returnHomeFloatBtn, [data-return-home]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = "home";
      render();
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      render();
    });
  });

  document.querySelectorAll("[data-settings-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.settingsSection;
      document.querySelectorAll("[data-settings-section]").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll("[data-settings-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.settingsPanel === section));
    });
  });

  document.querySelectorAll("[data-module-key]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.moduleKey;
      state.model = buildModel(state.tree, key, state.engineState.dataMode || "worldbook");
      await api.saveConfig({ lastModuleKey: key });
      state.healthReport = runLocalDiagnostics(state.model, state.config);
      render();
    });
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.copy));
  });

  document.querySelectorAll("[data-copy-startup]").forEach((button) => {
    button.addEventListener("click", () => copyText(startupPacket(state.model)));
  });

  document.querySelector("#saveLlmSettingsBtn")?.addEventListener("click", async () => {
    const update = {
      llmBaseUrl: document.querySelector("#llmBaseUrl")?.value.trim() || "",
      llmModel: document.querySelector("#llmModel")?.value.trim() || ""
    };
    state.config = await api.saveConfig(update);
    const key = document.querySelector("#llmApiKey")?.value.trim() || "";
    if (key) {
      state.secrets = await api.saveLlmSecret({ id: "default", label: "Default", value: key });
    } else {
      state.secrets = await api.getSecrets();
    }
    setStatus(t(state.config, "connectionSaved"), "llm");
    render();
  });

  document.querySelector("#saveEngineModeBtn")?.addEventListener("click", async () => {
    saveCardLibrary();
    const dataMode = document.querySelector("#dataModeSelect")?.value || "worldbook";
    const directorMode = document.querySelector("#directorModeSelect")?.value || "hybrid";
    const storyteller = document.querySelector("#storytellerSelect")?.value || "classic";
    const preset = document.querySelector("#enginePresetInput")?.value.trim() || "";
    const contextBudget = document.querySelector("#engineBudgetInput")?.value.trim() || "balanced";
    const previousMode = state.engineState.dataMode || "worldbook";
    let next = setDataMode(state.engineState, dataMode);
    if (dataMode === previousMode && preset && preset !== next.preset) next = applyPreset(next, preset);
    next = normalizeEngineState({ ...next, contextBudget, directorMode, storyteller });
    state.engineState = await api.saveEngineState(next);
    await loadKnowledgeCards();
    state.cards = loadCardLibrary();
    if (state.tree) state.model = buildModel(state.tree, state.config.lastModuleKey, state.engineState.dataMode || "worldbook");
    setStatus(t(state.config, "engineSettings"), dataMode);
    render();
  });

  document.querySelector("#sendGameBtn")?.addEventListener("click", async () => {
    const input = document.querySelector("#gameInput");
    const message = input?.value.trim();
    if (!message) return;
    const injectedWorldbook = injectionPreview(
      worldbookEntriesFromModel(state.model, activeWorldbookState()),
      message
    );
    const turnPrep = prepareTurn({
      model: state.model,
      input: message,
      engineState: state.engineState,
      worldbookState: activeWorldbookState(),
      cards: state.cards,
      knowledgeCards: state.knowledgeCards
    });
    state.lastInjectedWorldbook = injectedWorldbook;
    if (!turnPrep.guard.ok) {
      state.gameMessages.push({ role: "error", content: turnPrep.guard.blockedReason });
      render();
      return;
    }
    if (turnPrep.commandResult?.handled && ["engine-status", "module-list", "module-toggle", "module-preset"].includes(turnPrep.commandResult.patch?.type)) {
      state.gameMessages.push({ role: "assistant", content: turnPrep.commandResult.narrative });
      if (turnPrep.commandResult.engineState) {
        state.engineState = await api.saveEngineState(turnPrep.commandResult.engineState);
        await loadKnowledgeCards();
      }
      try {
        await api.writeOverlay({
          path: `data/engine/runs/${state.engineState.dataMode || "worldbook"}/modules/${selectedModuleKey() || "unloaded"}/command-log.jsonl`,
          mode: "append-jsonl",
          value: turnPrep.commandResult.patch
        });
      } catch {
        // Commands remain usable before a data root is selected; overlay logging starts after root selection.
      }
      render();
      return;
    }
    state.gameMessages.push({ role: "user", content: message });
    input.value = "";
    render();
    try {
      const apiKey = await api.getActiveLlmSecretValue();
      if (!apiKey) throw new Error(t(state.config, "activeSecretValueMissing"));
      const knowledgeSnippets = await api.searchEngineKnowledge({ query: message, limit: 4 });
      const enginePacket = buildEnginePacket({
        model: state.model,
        input: message,
        engineState: state.engineState,
        injectedWorldbook,
        knowledgeSnippets,
        knowledgeCards: state.knowledgeCards,
        cardContext: state.cards.slice(0, 8),
        turnPrep,
        proximityData: state.lastProximity || null
      });
      const result = await DirectLlm.sendDualStageTurn({
        model: state.model,
        config: state.config,
        apiKey,
        messages: state.gameMessages,
        input: message,
        engineState: state.engineState,
        injectedWorldbook,
        knowledgeSnippets,
        knowledgeCards: state.knowledgeCards,
        cardContext: state.cards,
        turnPrep,
        moduleKey: selectedModuleKey() || "unloaded",
        dataMode: state.engineState.dataMode || "worldbook",
        directorMode: state.engineState.directorMode || "hybrid",
        worldSubType: state.engineState.worldSubType || "classic",
        storytellerId: state.engineState.storyteller || "classic"
      });
      state.gameMessages.push({ role: "assistant", content: result.narrative });
      if (result.writeSet?.length) {
        await api.writeOverlayMany({ operations: result.writeSet });
      }
      state.engineState = await api.saveEngineState({
        ...state.engineState,
        ...(result.engineState || {}),
        status: "ready",
        lastParsedSections: result.parsedSections || {}
      });
      // 存储邻近数据供下一轮 prompt 使用
      if (result.overlayPatch?.proximity) {
        state.lastProximity = result.overlayPatch.proximity;
      }
    } catch (error) {
      state.gameMessages.push({ role: "error", content: error.message });
    }
    render();
  });

  document.querySelector("#importCardBtn")?.addEventListener("click", async () => {
    try {
      const imported = await api.importCards();
      const parsed = imported.map((item) => parseCard(item));
      state.cards = [...parsed, ...state.cards];
      saveCardLibrary();
      setStatus(`${parsed.length} ${t(state.config, "cardImported")}`, t(state.config, "cards"));
      render();
    } catch (error) {
      setStatus(error.message, "cards");
    }
  });

  document.querySelectorAll("[data-use-dm-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = state.cards.find((item) => item.id === button.dataset.useDmCard);
      if (!card?.personaText) return;
      state.personaText = [card.personaText, state.personaText].filter(Boolean).join("\n\n---\n\n");
      state.personaLoaded = true;
      setStatus(t(state.config, "dmLoaded"), card.name);
      state.activeTab = "game";
      render();
    });
  });

  document.querySelectorAll("[data-toggle-worldbook]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.toggleWorldbook;
      const isEnabled = button.dataset.enabled === "1";
      const mode = state.engineState.dataMode || "worldbook";
      state.worldbookState = await api.saveWorldbookState({ modes: { [mode]: { disabled: { [id]: isEnabled } } } });
      setStatus(t(state.config, "toggled"), t(state.config, "worldbook"));
      render();
    });
  });

  document.querySelector("#worldbookPreviewBtn")?.addEventListener("click", () => {
    state.worldbookPreviewInput = document.querySelector("#worldbookPreviewInput")?.value || "";
    render();
  });

  document.querySelector("#runProcessingBtn")?.addEventListener("click", async () => {
    state.processingInput = document.querySelector("#processingInput")?.value || "";
    try {
      await api.writeOverlay({
        path: `data/engine/runs/${state.engineState.dataMode || "worldbook"}/processing-engine/pipeline_reports/report-${Date.now()}.json`,
        mode: "write-json",
        value: { material: state.processingInput, createdAt: new Date().toISOString() }
      });
    } catch {
      // Processing preview works before selecting a data root; persistence starts after root selection.
    }
    render();
  });

  document.querySelectorAll("[data-toggle-slash-default]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.toggleSlashDefault;
      const isEnabled = button.dataset.enabled === "1";
      state.powerUser = await api.savePowerUser({
        slashCommands: {
          disabledDefaultIds: { [id]: isEnabled }
        }
      });
      state.powerUser = normalizePowerUser(state.powerUser);
      state.powerUser.paths = (await api.getPowerUser()).paths;
      state.powerUser.engineManifest = state.engineManifest;
      setStatus(t(state.config, "slashCommandsSaved"), t(state.config, "power"));
      render();
    });
  });

  document.querySelector("#resetSlashDraftBtn")?.addEventListener("click", () => {
    state.powerUser.userCommandsDraft = JSON.stringify(state.powerUser.slashCommands?.userCommands || [], null, 2);
    render();
  });

  document.querySelector("#saveSlashCommandsBtn")?.addEventListener("click", async () => {
    const raw = document.querySelector("#userSlashCommandsInput")?.value || "[]";
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error(t(state.config, "invalidJson"));
      state.powerUser = await api.savePowerUser({
        slashCommands: { userCommands: parsed }
      });
      state.powerUser = normalizePowerUser(state.powerUser);
      state.powerUser.paths = (await api.getPowerUser()).paths;
      state.powerUser.engineManifest = state.engineManifest;
      setStatus(t(state.config, "slashCommandsSaved"), t(state.config, "power"));
      render();
    } catch (error) {
      state.powerUser.userCommandsDraft = raw;
      setStatus(`${t(state.config, "invalidJson")}: ${error.message}`, t(state.config, "power"));
    }
  });

  document.querySelector("#newSessionBtn")?.addEventListener("click", async () => {
    try {
      const sessionId = await Hermes.createSession(state.model, state.config);
      state.messages.push({ role: "system", content: `Hermes session: ${sessionId}` });
      render();
    } catch (error) {
      state.messages.push({ role: "error", content: error.message });
      render();
    }
  });

  document.querySelector("#sendChatBtn")?.addEventListener("click", async () => {
    const input = document.querySelector("#chatInput");
    const message = input?.value.trim();
    if (!message) return;
    state.messages.push({ role: "user", content: message });
    input.value = "";
    render();
    try {
      const sessions = Hermes.sessionsFor(state.model);
      const response = await Hermes.sendMessage(state.model, state.config, sessions[0]?.id || "", message);
      state.messages.push({ role: "assistant", content: response.message || response.text || JSON.stringify(response) });
    } catch (error) {
      state.messages.push({ role: "error", content: error.message });
    }
    render();
  });
}

async function boot() {
  state.config = await api.getConfig();
  state.secrets = await api.getSecrets();
  state.worldbookState = await api.getWorldbookState();
  const powerUser = await api.getPowerUser();
  state.powerUser = normalizePowerUser(powerUser);
  state.powerUser.paths = powerUser.paths;
  state.engineState = normalizeEngineState(await api.getEngineState());
  state.engineManifest = await api.getEngineManifest();
  state.powerUser.engineManifest = state.engineManifest;
  await loadKnowledgeCards();
  state.cards = loadCardLibrary();
  try {
    const dmManual = await api.readPersona("dm-manual.md");
    const soul = await api.readPersona("hermes-writer-soul.md");
    state.personaText = [soul, dmManual].join("\n\n---\n\n");
    state.personaLoaded = true;
  } catch {
    state.personaText = "";
    state.personaLoaded = false;
  }
  render();
  // 🆕 v0.7.4.1 数据归家

}

els.openRootBtn.addEventListener("click", chooseRoot);
els.refreshBtn.addEventListener("click", () => loadRoot());
els.healthBtn.addEventListener("click", runHealth);
els.exportBtn.addEventListener("click", exportBundle);
els.openConsoleBtn.addEventListener("click", () => api.openConsole().then(r => { if (r !== "") console.log("openConsole:", r); }).catch(e => console.error("openConsole:", e)));
els.languageSelect.addEventListener("change", async () => {
  state.config = await api.saveConfig({ language: els.languageSelect.value });
  render();
});

boot();
