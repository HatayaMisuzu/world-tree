"use strict";

// Shared experience workspace, streaming chat, Tabletop V2, and message controls.
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
  AS.tabletopV2.importText = text;
  AS.tabletopV2.busy = true;
  AS.tabletopV2.error = "";
  render();
  try {
    const res = await API.tabletopV2ImportPreview({ text });
    if (res.status === "ok") {
      AS.tabletopV2.importPreview = res;
      createToast("Tabletop V2 后端预览已生成");
    } else {
      AS.tabletopV2.error = res.errorMsg || "预览失败";
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

function normalizeTabletopV2PublicState(source = {}) {
  const state = source.publicState || source.run?.publicState || source || {};
  return {
    sceneTitle: state.sceneTitle || state.currentScene || state.currentSceneTitle || "",
    lastNarrative: state.lastNarrative || "",
    publicClocks: state.publicClocks || state.clocks || [],
    resources: state.resources || {},
    inventory: state.inventory || [],
    questLog: state.questLog || [],
    visibleNpcs: state.visibleNpcs || state.npcs || [],
    diceLog: state.diceLog || state.diceLogPublic || [],
  };
}

async function startTabletopV2FromUI() {
  const text = U.qs("#tabletopV2ImportText")?.value.trim();
  if (!text && !AS.tabletopV2.importPreview) return createToast("请先粘贴模组内容并预览", "warn");
  try {
    AS.tabletopV2.busy = true; render();
    AS.tabletopV2.importText = text || AS.tabletopV2.importText || "";
    const preview = AS.tabletopV2.importPreview || await API.tabletopV2ImportPreview({ text: AS.tabletopV2.importText });
    if (preview.status && preview.status !== "ok") throw new Error(preview.errorMsg || "预览失败");
    AS.tabletopV2.importPreview = preview;
    const module = preview.moduleDraft || preview.module || buildTabletopV2ModuleDraftFromText(AS.tabletopV2.importText, preview);
    const res = await API.tabletopV2Start({ module, playerCharacter: null });
    if (res.status === "ok") {
      const publicState = normalizeTabletopV2PublicState(res);
      AS.tabletopV2.runId = res.run.runId;
      AS.tabletopV2.module = publicState.sceneTitle || res.moduleId;
      AS.tabletopV2.ruleset = res.rulesetKind;
      AS.tabletopV2.lastRuling = null;
      AS.tabletopV2.endingAvailable = false;
      AS.tabletopV2.currentScene = publicState.sceneTitle;
      AS.tabletopV2.lastNarrative = publicState.lastNarrative;
      AS.tabletopV2.publicClocks = publicState.publicClocks;
      AS.tabletopV2.resources = publicState.resources;
      AS.tabletopV2.inventory = publicState.inventory;
      AS.tabletopV2.questLog = publicState.questLog;
      AS.tabletopV2.visibleNpcs = publicState.visibleNpcs;
      AS.tabletopV2.diceLog = publicState.diceLog;
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

async function handleTabletopV2TurnInput() {
  const input = document.getElementById("tabletopV2PlayerIntent");
  const playerIntent = input?.value.trim();
  if (!playerIntent) return createToast("请输入你的行动", "warn");
  input.value = "";
  return sendTabletopV2Turn(playerIntent);
}

async function sendTabletopV2Turn(playerIntent) {
  AS.busy = true;
  setProgressProfile("tabletop-v2");
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
      const publicState = normalizeTabletopV2PublicState(res);
      AS.tabletopV2.lastRuling = res.ruling?.roll || null;
      AS.tabletopV2.endingAvailable = res.endingAvailable || false;
      AS.tabletopV2.lastNarrative = res.narrative || "";
      AS.tabletopV2.currentScene = publicState.sceneTitle || AS.tabletopV2.currentScene || "";
      AS.tabletopV2.publicClocks = publicState.publicClocks.length ? publicState.publicClocks : AS.tabletopV2.publicClocks || [];
      AS.tabletopV2.resources = publicState.resources;
      AS.tabletopV2.inventory = publicState.inventory.length ? publicState.inventory : AS.tabletopV2.inventory || [];
      AS.tabletopV2.questLog = publicState.questLog.length ? publicState.questLog : AS.tabletopV2.questLog || [];
      AS.tabletopV2.visibleNpcs = publicState.visibleNpcs.length ? publicState.visibleNpcs : AS.tabletopV2.visibleNpcs || [];
      AS.tabletopV2.diceLog = publicState.diceLog.length ? publicState.diceLog : AS.tabletopV2.diceLog || [];
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
    AS.tabletopV2.importText = text;
    const preview = AS.tabletopV2.importPreview || await API.tabletopV2ImportPreview({ text });
    if (preview.status && preview.status !== "ok") throw new Error(preview.errorMsg || "预览失败");
    AS.tabletopV2.importPreview = preview;
    const module = preview.moduleDraft || preview.module || buildTabletopV2ModuleDraftFromText(text, preview);
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

function buildChatPayload(text, messages) {
  return {
    input: text,
    moduleKey: AS.selectedModule.id,
    modeId: AS.selectedModule.mode || AS.selectedModule.type || (AS.selectedModule.dataMode === "character_card" ? "character" : "world-rpg"),
    dataMode: AS.selectedModule.dataMode || "worldbook",
    engineState: AS.engineState || { turnCount: AS.selectedModule.turnCount || 0, dataMode: AS.selectedModule.dataMode || "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
    pipelineProfileId: AS.connections?.pipelineProfiles?.default || "balanced",
    messages,
  };
}

function currentChatHistory() {
  let messages = AS.messages.map(m => ({ role: m.role, content: m.content })).slice(-40);
  if (AS.isQuickStart && AS.quickStartContent) messages = [{ role: "system", content: `以下为叙事设定背景：\n${AS.quickStartContent}` }, ...messages];
  return messages;
}

function cssIdent(value) {
  if (window.CSS?.escape) return CSS.escape(String(value || ""));
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function updateChatMessageNode(msg) {
  if (!msg?.id) return false;
  const node = U.qs(`.chat-message[data-message-id="${cssIdent(msg.id)}"] .chat-text`);
  if (!node) return false;
  node.innerHTML = U.md(msg.content || "");
  return true;
}

async function applyChatSuccess(res, userMessage, assistantMessage = null) {
  const narrative = res.narrative || "（无回应）";
  const turnId = res.persistedIds?.turnId || (res.turnCount ? `turn-${res.turnCount}` : "");
  if (res.persistedIds?.userId) userMessage.id = res.persistedIds.userId;
  userMessage.turnId = turnId;
  userMessage.round = res.turnCount || null;
  const assistant = assistantMessage || CH.add("assistant", narrative);
  assistant.content = narrative;
  assistant.id = res.persistedIds?.assistantId || assistant.id;
  assistant.turnId = turnId;
  assistant.round = res.turnCount || null;
  assistant.streaming = false;
  assistant.candidates = res.persistedIds?.assistantId ? [{ id: `${res.persistedIds.assistantId}-c0`, content: narrative, selected: true, createdAt: new Date().toISOString() }] : (assistant.candidates || []);
  CH.persist();
  AS.lastStatusSections = res.parsedSections || {};
  AS.usageSummary = res.usage || AS.usageSummary;
  AS.engineState = res.engineState || AS.engineState;
  AS.modePlay = res.modePlay || AS.engineState?.realPlay || AS.modePlay;
  AS.lastWorkflowRun = { status: "completed", totalMs: res._progress?.totalMs || 0, stages: res._progress?.stages || [] };
  AS.kernel = res.kernel || AS.kernel;
  if (res.turnCount && AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
  if (AS.selectedModule?.id !== "__quick__") await Promise.all([loadLatestStatusFrame(), refreshObserve(), loadKernelData()]);
}

async function sendChatNonStreaming(text, userMessage, messages) {
  const res = await API.chatSend(buildChatPayload(text, messages));
  if (res.status === "ok") return applyChatSuccess(res, userMessage);
  AS.chatDraft = text;
  CH.persist();
  addChatErrorFromPayload(res);
}

function stopChatStream() {
  if (!activeChatAbortController) return;
  activeChatAbortController.abort();
  createToast("已停止生成。当前页面保留可见片段；服务端仅在完成后保存。", "warn");
}

async function sendChat() {
  const input = U.qs("#chatInput");
  const text = input?.value.trim();
  if (!text || AS.busy) return;
  if (!AS.selectedModule) return createToast("请先加载一个世界", "warn");
  AS.chatDraft = "";
  CH.persist();
  input.value = "";
  AS.busy = true;
  setProgressProfile((AS.selectedModule?.mode || AS.selectedModule?.type || "") === "world-rpg" ? "dual-stage-chat" : "chat-default");
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
    if (!activeChatAbortController) render();
  }, 1400);
  try {
    const messages = currentChatHistory();
    const assistantMessage = CH.add("assistant", "", { streaming: true });
    assistantMessage.sourceInput = text;
    render();
    activeChatAbortController = new AbortController();
    let donePayload = null;
    let errorPayload = null;
    await API.chatStream(buildChatPayload(text, messages), {
      signal: activeChatAbortController.signal,
      onEvent(event, payload) {
        if (event === "stage") {
          AS.lastWorkflowRun = { status: "running", totalMs: 0, stages: [{ name: payload?.label || payload?.name || "stream", active: true }] };
        }
        if (event === "delta") {
          assistantMessage.content += payload?.content || "";
          updateChatMessageNode(assistantMessage);
        }
        if (event === "done") donePayload = payload;
        if (event === "error") errorPayload = payload;
      }
    });
    activeChatAbortController = null;
    if (errorPayload) {
      AS.messages = AS.messages.filter(m => m.id !== assistantMessage.id || assistantMessage.content);
      AS.chatDraft = text;
      CH.persist();
      addChatErrorFromPayload(errorPayload);
    } else if (donePayload?.status === "ok") {
      await applyChatSuccess(donePayload, userMessage, assistantMessage);
    } else if (donePayload) {
      AS.chatDraft = text;
      CH.persist();
      addChatErrorFromPayload(donePayload);
    } else {
      AS.messages = AS.messages.filter(m => m.id !== assistantMessage.id || assistantMessage.content);
      await sendChatNonStreaming(text, userMessage, messages);
    }
  } catch (err) {
    const aborted = err?.name === "AbortError";
    activeChatAbortController = null;
    const streamingAssistant = [...AS.messages].reverse().find(m => m.role === "assistant" && m.streaming);
    if (aborted) {
      if (streamingAssistant) {
        streamingAssistant.streaming = false;
        streamingAssistant.aborted = true;
        streamingAssistant.turnStatus = "partial";
        streamingAssistant.sourceInput = text;
        streamingAssistant.content = streamingAssistant.content || "（已停止，未完成落盘）";
        CH.persist();
      }
    } else {
      if (streamingAssistant) AS.messages = AS.messages.filter(m => m.id !== streamingAssistant.id);
      try {
        await sendChatNonStreaming(text, userMessage, currentChatHistory());
      } catch (fallbackErr) {
        AS.chatDraft = text;
        CH.persist();
        addChatErrorFromPayload(fallbackErr.payload || err.payload || { errorMsg: fallbackErr.message || err.message || String(err) });
        AS.lastWorkflowRun = { status: "failed", totalMs: 0, stages: [] };
      }
    }
  }
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  AS.progressIndex = 4;
  AS.busy = false;
  render();
}

function addChatErrorFromPayload(payload = {}) {
  const persisted = payload.persistedIds || {};
  CH.add("error", payload.userMessage || payload.userMsg || payload.errorMsg || "LLM 返回错误", {
    id: persisted.errorId,
    turnId: persisted.failedTurnId,
    failedTurnId: persisted.failedTurnId,
    code: payload.code || payload.error || "",
    userMessage: payload.userMessage || payload.userMsg || payload.errorMsg || "",
    detail: payload.detail || "",
    retryable: payload.retryable !== false,
    turnStatus: "failed",
    inputRefId: persisted.userId || ""
  });
}

async function retryFailedMessage(id) {
  const msg = AS.messages.find(m => m.id === id);
  if (!msg || AS.busy) return;
  if (!AS.selectedModule) return createToast("请先加载一个世界", "warn");
  const failedTurnId = msg.failedTurnId || msg.turnId || msg.id;
  if (!failedTurnId) return createToast("这条错误消息缺少失败回合标识", "warn");
  AS.busy = true;
  msg.retrying = true;
  setProgressProfile("chat-default");
  render();
  try {
    const messages = AS.messages
      .filter(m => m.role === "user" || m.role === "assistant" || m.role === "system")
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-40);
    const res = await API.chatRetry({
      moduleKey: AS.selectedModule.id,
      failedTurnId,
      modeId: AS.selectedModule.mode || AS.selectedModule.type || (AS.selectedModule.dataMode === "character_card" ? "character" : "world-rpg"),
      dataMode: AS.selectedModule.dataMode || "worldbook",
      engineState: AS.engineState || { turnCount: AS.selectedModule.turnCount || 0, dataMode: AS.selectedModule.dataMode || "worldbook" },
      messages
    });
    if (res.status !== "ok") {
      addChatErrorFromPayload(res);
      return;
    }
    msg.recoveredAt = new Date().toISOString();
    const narrative = res.narrative || "（无回应）";
    const turnId = res.persistedIds?.turnId || (res.turnCount ? `turn-${res.turnCount}` : "");
    CH.add("assistant", narrative, {
      id: res.persistedIds?.assistantId,
      turnId,
      round: res.turnCount || null,
      retryOf: failedTurnId,
      supersedesErrorId: msg.id,
      candidates: res.persistedIds?.assistantId ? [{ id: `${res.persistedIds.assistantId}-c0`, content: narrative, selected: true, createdAt: new Date().toISOString() }] : []
    });
    AS.lastStatusSections = res.parsedSections || {};
    AS.engineState = res.engineState || AS.engineState;
    AS.modePlay = res.modePlay || AS.engineState?.realPlay || AS.modePlay;
    AS.kernel = res.kernel || AS.kernel;
    if (res.turnCount && AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
    if (AS.selectedModule?.id !== "__quick__") await Promise.all([loadLatestStatusFrame(), refreshObserve(), loadKernelData()]);
  } catch (err) {
    addChatErrorFromPayload(err.payload || { errorMsg: err.message || String(err) });
  } finally {
    msg.retrying = false;
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
    AS.progressIndex = 4;
    AS.busy = false;
    render();
  }
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
  if (action === "retry-message") return retryFailedMessage(id);
  if (action === "retry-partial") {
    AS.chatDraft = msg.sourceInput || [...AS.messages].slice(0, AS.messages.indexOf(msg)).reverse().find(item => item.role === "user")?.content || "";
    CH.persist();
    render();
    setTimeout(() => U.qs("#chatInput")?.focus(), 0);
    return createToast("原问题已放回输入框；确认后可重新发送。", "ok");
  }
  if (action === "open-settings") {
    AS.view = "settings";
    AS.settingsTab = "connections";
    await loadViewData();
    return render();
  }
  if (action === "copy-message") {
    await navigator.clipboard?.writeText(msg.content);
    return createToast("已复制");
  }
  if (action === "edit-message") {
    const content = prompt("编辑消息", msg.content);
    if (content == null) return;
    msg.content = content;
    CH.persist();
    API.chatEdit({ moduleKey: AS.selectedModule?.id, messageId: id, action: "edit", content }).catch(() => {});
  }
  if (action === "favorite-message") {
    msg.favorite = !msg.favorite;
    CH.persist();
    API.chatEdit({ moduleKey: AS.selectedModule?.id, messageId: id, action: "favorite", favorite: msg.favorite }).catch(() => {});
  }
  if (action === "delete-message") {
    if (!confirm("删除这条消息？")) return;
    AS.messages = AS.messages.filter(m => m.id !== id);
    CH.persist();
    API.chatEdit({ moduleKey: AS.selectedModule?.id, messageId: id, action: "delete" }).catch(() => {});
  }
  if (action === "regen-message") {
    const content = prompt("添加一个候选回复版本", msg.content);
    if (!content) return;
    msg.candidates = Array.isArray(msg.candidates) && msg.candidates.length ? msg.candidates : [{ id: `${id}-c0`, content: msg.content, selected: true, createdAt: msg.ts }];
    const candidate = { id: `${id}-c${msg.candidates.length}`, content, selected: false, createdAt: new Date().toISOString() };
    msg.candidates.push(candidate);
    CH.persist();
    API.chatEdit({ moduleKey: AS.selectedModule?.id, messageId: id, action: "add-candidate", content }).catch(() => {});
  }
  if (action === "candidate-prev" || action === "candidate-next") {
    const candidates = msg.candidates || [];
    if (!candidates.length) return;
    const current = Math.max(0, candidates.findIndex(c => c.selected));
    const next = action === "candidate-next" ? (current + 1) % candidates.length : (current - 1 + candidates.length) % candidates.length;
    msg.candidates = candidates.map((c, i) => ({ ...c, selected: i === next }));
    msg.content = msg.candidates[next].content;
    CH.persist();
    API.chatEdit({ moduleKey: AS.selectedModule?.id, messageId: id, action: "select-candidate", candidateId: msg.candidates[next].id }).catch(() => {});
  }
  render();
}
