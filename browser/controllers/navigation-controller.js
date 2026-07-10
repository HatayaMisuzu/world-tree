"use strict";

// Navigation, view loading, project selection, and delegated DOM event binding.
function renderNav() {
  const activeView = window.WorldTreeNavigation?.activePrimary(AS.view) || AS.view;
  const nav = CFG.nav.map(n => `<button class="nav-btn ${activeView === n.id ? "active" : ""}" data-view="${n.id}"><span class="nav-icon">${n.icon}</span><strong>${n.label}</strong><span class="nav-meta">${n.meta}</span></button>`).join("");
  U.qs("#primaryNav").innerHTML = nav;
  const mobile = CFG.nav.map(n => `<button class="${activeView === n.id ? "active" : ""}" data-view="${n.id}"><span>${n.icon}</span><span>${n.label}</span></button>`).join("");
  U.qs("#mobileNav").innerHTML = mobile;
}

function render() {
  try {
    renderNav();
    U.qs("#viewTitle").textContent = window.WorldTreeNavigation?.labelFor(AS.view) || CFG.nav.find(v => v.id === AS.view)?.label || "首页";
    const currentName = AS.selectedModule ? (AS.selectedModule.displayName || AS.selectedModule.name) : "未选择世界";
    U.qs("#contextLine").textContent = currentName;
    U.qs("#sideWorldName").textContent = currentName;
    U.qs("#sideWorldMeta").textContent = `${AS.messages.length} 条消息 · ${AS.modules.length} 个模块`;
    const llm = U.qs("#llmStatus");
    llm.textContent = AS.llmConnected ? "已连接" : "未连接";
    llm.className = `badge ${AS.llmConnected ? "ok" : "pending"}`;
    const sideModel = U.qs("#sideModelMeta");
    if (sideModel) sideModel.textContent = AS.llmConnected ? `${AS.config.llmModel || "模型"} · 已连接` : (AS.hasApiKey ? "等待连接" : "未配置");
    const save = U.qs("#saveStatus");
    if (save) {
      save.textContent = AS.busy ? "保存中" : (AS.selectedModule ? "已保存" : "本地就绪");
      save.className = `badge ${AS.busy ? "pending" : "ok"}`;
    }
    U.qs("#main").innerHTML = Views[AS.view] ? Views[AS.view]() : C.empty("未知页面");
    bindEvents();
    const overlay = U.qs('[role="dialog"][aria-modal="true"]');
    if (overlay) requestAnimationFrame(() => overlay.focus());
  } catch (err) {
    console.error(err);
    U.qs("#main").innerHTML = `<div class="panel">${C.noticeHtml(`页面渲染失败：${U.esc(err.message)}`, "bad")}<button onclick="location.reload()">刷新页面</button></div>`;
  }
}

async function loadViewData() {
  try {
    if (AS.view === "library" && AS.libraryTab === "characters") AS.characters = await API.loadCharacters();
    if (AS.view === "library" && AS.libraryTab === "alchemy") {
      if (!AS.alchemyMechanismLibrary.length) await loadMechanismLibrary();
      if (!AS.alchemyG1.capabilities) {
        try { AS.alchemyG1.capabilities = await API.alchemyCapabilities(); } catch { /* non-blocking */ }
      }
    }
    if ((AS.view === "library" && AS.libraryTab === "worldbook") || AS.view === "workbench") await loadWorldbookIfPossible();
    if (AS.view === "library" && AS.libraryTab === "review") await loadReviewFacts();
    if (AS.view === "settings" && ["connections", "narrative"].includes(AS.settingsTab)) AS.connections = await API.connections();
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

function supportsTurnState(module = AS.selectedModule) {
  const id = String(module?.id || "");
  return !!module && id && id !== "__quick__" && module.type !== "profile" && !id.startsWith("profile:");
}

async function loadLatestStatusFrame() {
  if (!supportsTurnState()) {
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
  if (!turnId || !supportsTurnState()) return;
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
  AS.chatDraft = res.example?.suggestedFirstInput || "";
  AS.workbenchMode = "chat";
  createToast("示例已安装");
  render();
}

async function installFirstRunDemo() {
  const demo = AS.examples.find(item => item.recommendedForFirstRun) || AS.examples.find(item => item.kind === "playable_demo");
  if (!demo) return createToast("当前包没有可安装的首跑示例", "warn");
  const res = await API.installExample(demo.id);
  if (res.status !== "ok") throw new Error(res.errorMsg || "示例安装失败");
  await API.saveConfig({ firstRun: false }).catch(() => {});
  AS.config.firstRun = false;
  await refreshModules();
  if (res.module?.id) await selectModule(res.module.id, "workbench");
  AS.chatDraft = res.example?.suggestedFirstInput || demo.suggestedFirstInput || "";
  AS.workbenchMode = "chat";
  AS.view = "workbench";
  createToast("已安装示例世界，首句已放入输入框");
  render();
}

function bindEvents() {
  U.qsa("[data-view]").forEach(btn => {
    btn.onclick = async () => {
      AS.view = btn.dataset.view;
      APP_STORE?.dispatch({ type: "navigation/view", view: AS.view });
      if (AS.view === "workbench") AS.workbenchMode = "overview";
      if (AS.view === "library") AS.libraryTab = "projects";
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
  if (chatInput) chatInput.oninput = () => { AS.chatDraft = chatInput.value; CH.persist(); };

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
    U.qsa("[data-alchemy-g1-target]").forEach(input => {
    input.onchange = () => {
      const target = input.dataset.alchemyG1Target;
      const set = new Set(AS.alchemyG1.selectedTargets || []);
      if (input.checked) set.add(target);
      else set.delete(target);
      AS.alchemyG1.selectedTargets = [...set];
      render();
    };
  });
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
