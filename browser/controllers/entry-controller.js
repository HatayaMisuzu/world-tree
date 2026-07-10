"use strict";

// Canonical-entry and V2 product action dispatch.
async function handleAction(e, btn) {
  e.stopPropagation();
// ── V2 product UI handlers ──
async function handleWorldbookV2Action(action) {
  const s = AS.worldbookV2;
  const moduleKey = AS.selectedModule?.id || "";
  if (!moduleKey) return createToast("请先选择世界", "warn");
  s.entryText = U.qs("#worldbookV2EntryText")?.value || s.entryText || "";
  s.input = U.qs("#worldbookV2Input")?.value || s.input || "";
  try {
    s.busy = true; s.error = ""; s.lastResult = null;
    let result;
    if (action === "worldbook-v2-load") {
      result = await API.worldbookV2Load(moduleKey);
      s.loaded = result;
    } else if (action === "worldbook-v2-create-candidate") {
      const entry = buildWorldbookV2EntryFromText(s.entryText);
      result = await API.worldbookV2CreateCandidate({ moduleKey, entry });
      s.candidate = result.candidate || null;
      s.loaded = await API.worldbookV2Load(moduleKey).catch(() => s.loaded);
    } else if (action === "worldbook-v2-adopt-candidate") {
      const latest = s.candidate || (s.loaded?.candidates || []).slice().reverse().find(item => item.status === "pending") || (s.loaded?.candidates || []).slice(-1)[0];
      if (!latest?.candidateId) return createToast("没有可采纳的候选条目", "warn");
      result = await API.worldbookV2CandidateDecision({ moduleKey, candidateId: latest.candidateId, decision: "adopt" });
      s.loaded = await API.worldbookV2Load(moduleKey).catch(() => s.loaded);
    } else if (action === "worldbook-v2-inject-preview") {
      result = await API.worldbookV2InjectPreview({ moduleKey, userInput: s.input });
      s.preview = result;
    } else if (action === "worldbook-v2-export") {
      result = await API.worldbookV2Export({ moduleKey });
      s.exportResult = result;
    }
    s.lastResult = result;
  } catch (err) {
    s.error = err.message || String(err);
  } finally {
    s.busy = false;
    render();
  }
}

async function handleStrategySimV2Action(action) {
  const s = AS.strategySimV2;
  s.specText = U.qs("#strategySimV2SpecText")?.value || s.specText || U.json(strategySimV2DefaultSpec());
  s.runId = U.qs("#strategySimV2RunId")?.value || s.runId || "";
  s.actionText = U.qs("#strategySimV2ActionText")?.value || s.actionText || "";
  const spec = parseJsonObjectInput(s.specText, strategySimV2DefaultSpec());
  try {
    s.busy = true; s.error = ""; s.lastResult = null;
    let result;
    if (action === "strategy-sim-v2-validate") {
      result = await API.strategySimV2Validate({ spec });
    } else if (action === "strategy-sim-v2-seal") {
      result = await API.strategySimV2Seal({ spec });
      if (result.status === "ok") s.sealedSpec = result.spec;
    } else if (action === "strategy-sim-v2-start") {
      const sealedSpec = s.sealedSpec || (await API.strategySimV2Seal({ spec })).spec;
      const runId = s.runId || `strategy-ui-${Date.now()}`;
      result = await API.strategySimV2Start({ runId, sealedSpec });
      s.runId = result.runId || runId;
      s.publicView = result.publicView || s.publicView;
    } else if (action === "strategy-sim-v2-turn") {
      result = await API.strategySimV2Turn({ runId: s.runId, action: s.actionText });
      s.publicView = result.publicView || s.publicView;
    } else if (action === "strategy-sim-v2-save") {
      result = await API.strategySimV2Save({ runId: s.runId });
    } else if (action === "strategy-sim-v2-load-run") {
      result = await API.strategySimV2LoadRun({ runId: s.runId });
      s.publicView = result.publicView || s.publicView;
    } else if (action === "strategy-sim-v2-export-run") {
      result = await API.strategySimV2ExportRun({ runId: s.runId });
    }
    s.lastResult = result;
  } catch (err) {
    s.error = err.message || String(err);
  } finally {
    s.busy = false;
    render();
  }
}

async function handleDetectiveV2Action(action) {
  const s = AS.detectiveV2;
  s.importText = U.qs("#detectiveV2ImportText")?.value || s.importText || "";
  s.currentLocationId = U.qs("#detectiveV2LocationId")?.value || s.currentLocationId || "";
  s.currentCharacterId = U.qs("#detectiveV2CharacterId")?.value || s.currentCharacterId || "";
  s.currentEvidenceId = U.qs("#detectiveV2EvidenceSelect")?.value || U.qs("#detectiveV2EvidenceId")?.value || s.currentEvidenceId || "";
  s.question = U.qs("#detectiveV2Question")?.value || s.question || "";
  s.notebookEntryId = U.qs("#detectiveV2NotebookEntryId")?.value || s.notebookEntryId || "";
  s.notebookSummary = U.qs("#detectiveV2NotebookSummary")?.value || s.notebookSummary || "";
  s.deductionCulpritId = U.qs("#detectiveV2DeductionCulpritId")?.value || s.deductionCulpritId || "";
  s.deductionMethod = U.qs("#detectiveV2DeductionMethod")?.value || s.deductionMethod || "";
  try {
    s.busy = true; s.error = ""; s.lastResult = null;
    let result;
    if (action === "detective-v2-import-preview") {
      result = await API.detectiveV2ImportPreview({ text: s.importText });
      s.importPreview = result;
      s.playerCase = result.playerCaseView || result.preview || s.playerCase;
    } else if (action === "detective-v2-import-commit") {
      result = await API.detectiveV2ImportCommit({ text: s.importText });
      s.caseId = result.caseId || s.caseId;
      s.playerCase = result.case || s.playerCase;
    } else if (action === "detective-v2-start") {
      result = await API.detectiveV2Start({ caseId: s.caseId });
      s.runId = result.run?.runId || s.runId;
      s.playerRun = result.run || s.playerRun;
      s.playerCase = result.case || s.playerCase;
    } else if (action === "detective-v2-investigate") {
      result = await API.detectiveV2Investigate({ runId: s.runId, locationId: s.currentLocationId });
      s.lastInvestigation = result;
      s.playerRun = result.run || s.playerRun;
    } else if (action === "detective-v2-interrogate") {
      result = await API.detectiveV2Interrogate({ runId: s.runId, characterId: s.currentCharacterId, question: s.question });
      s.lastInterview = result;
      s.playerRun = result.run || s.playerRun;
    } else if (action === "detective-v2-notebook-extract") {
      const evidenceId = s.currentEvidenceId || (s.playerRun?.discoveredEvidenceIds || s.lastInvestigation?.newEvidenceIds || [])[0];
      if (!evidenceId) return createToast("请先调查并发现线索", "warn");
      result = await API.detectiveV2NotebookExtract({ runId: s.runId, selection: { sourceType: "evidence", sourceId: evidenceId } });
      s.notebookEntryId = result.entry?.noteId || s.notebookEntryId;
      s.notebook = result.notebook || s.notebook;
      s.playerRun = result.run || s.playerRun;
    } else if (action === "detective-v2-notebook-update") {
      result = await API.detectiveV2NotebookUpdate({ runId: s.runId, entryId: s.notebookEntryId, patch: { summary: s.notebookSummary } });
      s.notebook = result.notebook || s.notebook;
      s.playerRun = result.run || s.playerRun;
    } else if (action === "detective-v2-deduction-submit") {
      result = await API.detectiveV2DeductionSubmit({ runId: s.runId, report: { culpritId: s.deductionCulpritId, method: s.deductionMethod } });
      s.playerRun = result.run || s.playerRun;
    } else if (action === "detective-v2-export-run") {
      result = await API.detectiveV2ExportRun({ runId: s.runId });
      s.exportResult = result;
    } else if (action === "detective-v2-export-player-pack") {
      result = await API.detectiveV2ExportPlayerPack({ runId: s.runId });
      s.exportResult = result;
    }
    s.lastResult = result;
  } catch (err) {
    s.error = err.message || String(err);
  } finally {
    s.busy = false;
    render();
  }
}

// ── Single Player ScriptKill V2 UI handler ──
async function handleSinglePlayerScriptKillV2Action(action) {
  const s = AS.singlePlayerScriptKillV2;
  const textEl = U.qs("#singlePlayerScriptKillV2ImportText");
  const ownershipEl = U.qs("#singlePlayerScriptKillV2Ownership");
  const scriptIdEl = U.qs("#singlePlayerScriptKillV2ScriptId");
  const roleEl = U.qs("#singlePlayerScriptKillV2SelectedRole");
  const currentTextEl = U.qs("#singlePlayerScriptKillV2CurrentText");
  const targetRoleEl = U.qs("#singlePlayerScriptKillV2TargetRole");
  const locationEl = U.qs("#singlePlayerScriptKillV2LocationId");
  const clueEl = U.qs("#singlePlayerScriptKillV2ClueId");
  const voteEl = U.qs("#singlePlayerScriptKillV2VoteTarget");
  const nextPhaseEl = U.qs("#singlePlayerScriptKillV2NextPhase");

  s.importText = textEl?.value || s.importText || "";
  s.scriptId = scriptIdEl?.value || s.scriptId || "";
  s.selectedRoleId = roleEl?.value || s.selectedRoleId || "";
  s.currentText = currentTextEl?.value || "";
  s.targetRoleId = targetRoleEl?.value || "";
  s.locationId = locationEl?.value || "";
  s.clueId = clueEl?.value || "";
  s.voteTargetRoleId = voteEl?.value || "";
  s.nextPhaseId = nextPhaseEl?.value || "";

  const ownershipDeclaration = { userConfirmedLegalAccess: ownershipEl?.checked !== false, localPrivateUseOnly: true, noRedistribution: true };
  const bodyBase = { runId: s.runId };
  try {
    s.busy = true; s.error = ""; s.lastResult = null;
    let result;
    if (action === "single-player-scriptkill-v2-import-preview") {
      result = await API.singlePlayerScriptKillV2ImportPreview({ text: s.importText, ownershipDeclaration });
      s.importPreview = result;
    } else if (action === "single-player-scriptkill-v2-import-commit") {
      result = await API.singlePlayerScriptKillV2ImportCommit({ package: s.importPreview?.packageDraft, ownershipDeclaration });
      s.scriptId = result.scriptId || s.scriptId;
    } else if (action === "single-player-scriptkill-v2-start") {
      result = await API.singlePlayerScriptKillV2Start({ scriptId: s.scriptId, realPlayerRoleId: s.selectedRoleId });
      s.runId = result.runId || s.runId;
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-read-role-act") {
      result = await API.singlePlayerScriptKillV2ReadRoleAct(bodyBase);
    } else if (action === "single-player-scriptkill-v2-public-talk") {
      result = await API.singlePlayerScriptKillV2PublicTalk({ ...bodyBase, text: s.currentText });
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-private-chat") {
      result = await API.singlePlayerScriptKillV2PrivateChat({ ...bodyBase, targetRoleId: s.targetRoleId, text: s.currentText });
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-search") {
      result = await API.singlePlayerScriptKillV2Search({ ...bodyBase, locationId: s.locationId, clueId: s.clueId, keepPrivate: true });
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-reveal-clue") {
      result = await API.singlePlayerScriptKillV2RevealClue({ ...bodyBase, clueId: s.clueId });
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-advance-phase") {
      result = await API.singlePlayerScriptKillV2AdvancePhase({ ...bodyBase, nextPhaseId: s.nextPhaseId || undefined });
      s.playerRun = result.playerRun || result.runState || s.playerRun;
      const loaded = await API.singlePlayerScriptKillV2LoadRun(bodyBase).catch(() => null);
      if (loaded?.playerRun) s.playerRun = loaded.playerRun;
    } else if (action === "single-player-scriptkill-v2-vote") {
      result = await API.singlePlayerScriptKillV2Vote({ ...bodyBase, targetRoleId: s.voteTargetRoleId, reason: "玩家投票" });
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-debrief") {
      result = await API.singlePlayerScriptKillV2Debrief(bodyBase);
    } else if (action === "single-player-scriptkill-v2-export-run") {
      result = await API.singlePlayerScriptKillV2ExportRun(bodyBase);
    } else if (action === "single-player-scriptkill-v2-load-run") {
      result = await API.singlePlayerScriptKillV2LoadRun(bodyBase);
      s.playerRun = result.playerRun || s.playerRun;
    } else if (action === "single-player-scriptkill-v2-list-runs") {
      result = await API.singlePlayerScriptKillV2Runs();
    }
    s.lastResult = result;
  } catch (err) { s.error = err.message || String(err); }
  finally { s.busy = false; render(); }
}

  const action = btn.dataset.action;
  try {
    if (action === "single-player-scriptkill-v2-toggle-panel") {
    AS.singlePlayerScriptKillV2.panelOpen = !AS.singlePlayerScriptKillV2.panelOpen;
    AS.view = "workbench";
    AS.workbenchMode = "chat";
    return render();
  }
  if (action && action.startsWith("worldbook-v2-")) {
    return handleWorldbookV2Action(action);
  }
  if (action && action.startsWith("strategy-sim-v2-")) {
    return handleStrategySimV2Action(action);
  }
  if (action && action.startsWith("detective-v2-")) {
    return handleDetectiveV2Action(action);
  }
  if (action && action.startsWith("single-player-scriptkill-v2-")) {
    return handleSinglePlayerScriptKillV2Action(action);
  }
  if (action === "refresh-debug") return refreshDebugLogs();
    if (action === "toggle-debug") return toggleDebugPanel();
    if (action === "close-drawer") { AS.activeDrawer = ""; return render(); }
    if (action === "drawer-worldbook") { AS.activeDrawer = "worldbook"; return render(); }
    if (action === "drawer-saves") { AS.activeDrawer = "saves"; return render(); }
    if (action === "drawer-branches") { AS.activeDrawer = "branches"; return render(); }
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
    if (action === "tabletop-v2-send-turn") return handleTabletopV2TurnInput();
    if (action === "tabletop-v2-import-commit") return commitTabletopV2Import();
    if (action === "tabletop-v2-export") return exportTabletopV2FromUI();
    if (action === "tabletop-v2-load-save") return loadTabletopV2SaveFromUI(btn.dataset.saveId);
    if (action === "strategy-sim-start") return multiModeStart("strategy-sim", "#strategyTitle", "#strategyText");
    if (action === "murder-mystery-start") return multiModeStart("murder-mystery", "#murderTitle", "#murderText");
    if (action === "chat-send") return sendChat();
    if (action === "chat-stop") return stopChatStream();
    if (action === "workflow-refresh") { const [status, types] = await Promise.all([API.workflowStatus(), API.workflowTypes()]); AS.workflowStatus = status; AS.workflowTypes = types.types || []; return render(); }
    if (action.startsWith("kernel-")) return kernelAction(action, btn);
    if (action === "clear-chat") return confirmClearChat();
    if (action === "open-command-panel") return openCommandPanel();
    if (action === "use-opening-suggestion") {
      AS.chatDraft = btn.dataset.suggestion || "";
      CH.persist();
      render();
      setTimeout(() => U.qs("#chatInput")?.focus(), 0);
      return;
    }
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
    if (action === "install-first-run-demo") return installFirstRunDemo();
    if (action === "load-module-from-list") { await selectModule(btn.dataset.moduleId, "workbench"); AS.workbenchMode = "chat"; return render(); }
    if (action === "install-example") return installExample(btn.closest("[data-example-id]")?.dataset.exampleId);
    if (action === "select-module") { await selectModule(btn.closest("[data-module-id]")?.dataset.moduleId, "chat"); return render(); }
    if (action === "delete-module") return deleteModule(btn.closest("[data-module-id]")?.dataset.moduleId);
    if (action === "export-module") return legacyExport(btn.closest("[data-module-id]")?.dataset.moduleId);
    if (action === "create-world") return showCreateDialog("worldbook", "世界");
    if (action === "create-from-material" || action === "library-alchemy") { AS.view = "library"; AS.libraryTab = "alchemy"; return render(); }
    if (action === "library-review") { AS.view = "library"; AS.libraryTab = "review"; await loadViewData(); return render(); }
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
    if (action === "alchemy-g1-plan") return alchemyG1Plan();
    if (action === "alchemy-g1-generate-preview") return alchemyG1GeneratePreview();
    if (action === "alchemy-g1-localize") return alchemyG1Localize();
    if (action === "alchemy-g1-deliver") return alchemyG1Deliver();
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
    if (action === "settings-card-open") { AS.settingsTab = btn.dataset.settingsTab || "connections"; await loadViewData(); return render(); }
    if (action === "load-plugins") { AS.plugins = await API.plugins(); return render(); }
    if (["enable-plugin", "disable-plugin"].includes(action)) return pluginAction(action, btn.closest("[data-plugin-id]")?.dataset.pluginId);
    if (action === "run-plugin") return runPlugin(btn.closest("[data-plugin-id]")?.dataset.pluginId);
    if (action === "open-settings") { AS.view = "settings"; AS.settingsTab = "connections"; await loadViewData(); return render(); }
    if (["copy-message", "edit-message", "favorite-message", "delete-message", "regen-message", "candidate-prev", "candidate-next", "retry-message", "retry-partial"].includes(action)) return messageAction(action, btn.closest("[data-message-id]")?.dataset.messageId);
    if (action === "legacy-export") return legacyExport(AS.selectedModule?.id);
    if (action === "legacy-import") return createToast("旧版 JSON 导入入口已保留在高级工具中，当前演示未自动覆盖数据。", "warn");
  } catch (err) {
    createToast(err.message || String(err), "bad");
  }
}
