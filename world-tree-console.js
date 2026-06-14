"use strict";

const CFG = {
  version: "0.1.8",
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
  alchemyReview(data) { return data ? API.post("/api/alchemy/review", data) : API.get("/api/alchemy/review"); },
  loadCharacters() { return API.get("/api/characters"); },
  importCharacter(data) { return API.post("/api/characters/import", data); },
  updateCharacter(data) { return API.post("/api/characters/update", data); },
  loadCharacter(id) { return API.post("/api/characters/load", { id }); },
  loadWorldbook(moduleKey) { return API.get(`/api/worldbook?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
  saveWorldbook(data) { return API.post("/api/worldbook", data); },
  testWorldbook(data) { return API.post("/api/worldbook/test", data); },
  connections(data) { return data ? API.post("/api/connections", data) : API.get("/api/connections"); },
  turnDebug(moduleKey) { return API.get(`/api/turn/debug?moduleKey=${encodeURIComponent(moduleKey || "")}`); },
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
  health() { return API.get("/api/health"); },
};

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
  modules: [],
  examples: [],
  characters: [],
  characterQuery: "",
  selectedModule: null,
  currentCharacterCard: null,
  worldbookEntries: [],
  worldbookTest: null,
  reviewItems: [],
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
  turnDebug: null,
  worldPack: null,
  importPreview: null,
  pendingPack: null,
  worldPackOptions: { includeWorldbook: true, includeCharacters: true, includeSharedData: true, includeRuntimeState: false, includeReviewQueue: false },
};

const C = {
  badge(text, tone = "pending") { return `<span class="badge ${tone}">${U.esc(text)}</span>`; },
  stat(label, value, sub = "") {
    return `<div class="stat"><span>${U.esc(label)}</span><strong>${U.esc(value)}</strong>${sub ? `<span>${U.esc(sub)}</span>` : ""}</div>`;
  },
  empty(title, desc = "") {
    return `<div class="empty"><strong>${U.esc(title)}</strong>${desc ? `<p class="sub">${U.esc(desc)}</p>` : ""}</div>`;
  },
  notice(text, tone = "") { return `<div class="notice ${tone}">${text}</div>`; },
  tabs(items, active, attr) {
    return `<div class="tabs">${items.map(t => `<button class="${active === t.id ? "active" : ""}" ${attr}="${U.esc(t.id)}">${U.esc(t.label)}${t.count !== undefined ? ` ${C.badge(t.count, "pending")}` : ""}</button>`).join("")}</div>`;
  },
  dataModeLabel(m) {
    const mode = typeof m === "string" ? m : m?.dataMode;
    return ({ worldbook: "世界书", character_card: "角色卡", preset: "预设", standalone: "独立" }[mode] || mode || "未知");
  },
  moduleCard(m) {
    const selected = AS.selectedModule?.id === m.id;
    return `<div class="module-card ${selected ? "selected" : ""}" data-module-id="${U.esc(m.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${U.esc(m.displayName || m.name || m.id)}</div>
          <div class="sub">${C.dataModeLabel(m)} · ${U.esc(m.subType || m.type || "default")}</div>
        </div>
        ${C.badge(selected ? "当前" : (m.turnCount || 0) + " 回合", selected ? "ok" : "pending")}
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
    return `<div class="chat-message ${tone}" data-message-id="${U.esc(m.id || "")}">
      <div class="chat-meta">
        <strong>${role === "user" ? "你" : role === "assistant" ? "叙事引擎" : role}</strong>
        ${m.favorite ? C.badge("收藏", "warn") : ""}
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
            <p class="sub">${AS.isQuickStart ? "快速对话不保存正式记录" : m ? `${C.dataModeLabel(m)} · ${m.turnCount || 0} 回合` : "请先在工作台或世界管理中加载一个世界"}</p>
          </div>
          <div class="actions">
            <button class="small" data-action="open-command-panel">命令</button>
            <button class="small danger" data-action="clear-chat">清空</button>
          </div>
        </div>
        <div id="chatMessages" class="chat-messages">${AS.messages.length ? AS.messages.map(C.chatMsg).join("") : C.empty("开始对话", "输入行动、台词或 / 命令。")}</div>
        <div class="composer">
          <textarea id="chatInput" placeholder="续写这一幕... 输入 / 调用命令，Enter 发送"></textarea>
          <button class="primary" data-action="chat-send" ${AS.busy ? "disabled" : ""}>发送</button>
        </div>
      </section>
      ${C.contextPanel()}
    </div>`;
  },
  contextPanel() {
    const hits = AS.turnDebug?.worldbookHits || AS.dashboardData.narrative?.worldbookHits || [];
    const characterState = AS.turnDebug?.characterState || {};
    const memory = AS.turnDebug?.memorySnapshot || AS.dashboardData.narrative?.memory?.recentEntries || [];
    const guardian = AS.turnDebug?.guardian || {};
    const assistants = AS.messages.filter(m => m.role === "assistant");
    const candidateCount = assistants.reduce((sum, m) => sum + Math.max(0, (m.candidates || []).length - 1), 0);
    const favorites = AS.messages.filter(m => m.favorite);
    return `<aside class="context-stack">
      <div class="panel tight">
        <div class="panel-head"><h3>叙事上下文</h3><button class="small" data-action="load-context">刷新</button></div>
        <div class="list">
          <div class="item"><div class="item-head"><strong>世界书命中</strong>${C.badge(Array.isArray(hits) ? hits.length : 0, "info")}</div>${Array.isArray(hits) && hits.length ? hits.slice(0, 3).map(h => `<span class="tiny muted">${U.esc(h.title || h.keys?.[0] || "命中条目")}</span>`).join("") : `<span class="tiny muted">发送一轮对话后生成。</span>`}</div>
          <div class="item"><strong>当前角色状态</strong><span class="tiny muted">${U.esc(U.compact(U.json(characterState), 120))}</span></div>
          <div class="item"><strong>记忆快照</strong><span class="tiny muted">${Array.isArray(memory) && memory.length ? U.esc(U.compact(U.json(memory.slice(0, 3)), 120)) : "暂无快照"}</span></div>
          <details><summary>技术细节（Direction Packet / Guardian）</summary><pre>${U.esc(U.json({ directionPacket: AS.turnDebug?.directionPacket || {}, guardian }))}</pre></details>
        </div>
      </div>
      <div class="panel tight">
        <h3>候选与分支</h3>
        <div class="auto-grid compact">
          ${C.stat("助手回复", assistants.length)}
          ${C.stat("候选版本", candidateCount)}
          ${C.stat("收藏", favorites.length)}
        </div>
        <div class="list">${assistants.filter(m => (m.candidates || []).length > 1 || m.favorite).slice(-4).map(m => `<div class="item"><strong>${m.favorite ? "收藏" : "候选"}</strong><span class="tiny muted">${U.esc(U.compact(m.content || "", 90))}</span></div>`).join("") || `<span class="tiny muted">重生成候选或收藏消息后，这里会形成轻量分支索引。</span>`}</div>
      </div>
    </aside>`;
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
        ? res.messages.map((r, i) => ({ id: r.id || `h_${i}`, role: r.role, content: r.content, ts: r.ts, favorite: !!r.favorite, candidates: r.candidates || [], sections: r.sections || null }))
        : [];
      AS.lastScene = res.lastScene || "";
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
          ${AS.isQuickStart ? C.badge("快速对话 · 不保存正式记录", "warn") : ""}
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
        <div class="panel-head"><div><h2>快速开始</h2><p class="sub">拖拽或粘贴素材，直接进入快速对话（不保存正式记录）。</p></div></div>
        <div id="quickStartDrop" class="drop-zone"><strong>拖拽文件 / 文件夹到此处，或点击选择</strong><span>支持 .md .txt .json</span></div>
        <textarea id="quickStartText" placeholder="或在这里粘贴设定、片段、角色描述..."></textarea>
        <div class="actions"><button class="primary" data-action="quick-start-chat">直接进入快速对话</button><span class="tiny muted">快速对话不保存正式记录。</span></div>
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
              ["includeReviewQueue", "审核队列"]
            ].map(([key, label]) => `<label><input type="checkbox" data-pack-option="${key}" ${AS.worldPackOptions[key] ? "checked" : ""}> ${label}</label>`).join("")}
          </div>
          <div class="actions"><button class="primary" data-action="export-worldpack">导出当前世界</button><button data-action="import-worldpack">导入世界包</button></div>
          <div style="margin-top:12px">${AS.worldPack ? `<pre>${U.esc(U.json(AS.worldPack.summary || AS.worldPack))}</pre><div class="actions"><button class="primary" data-action="download-worldpack">下载 .worldtree</button></div>` : AS.importPreview ? `<div class="notice ${AS.importPreview.summary?.hasConflict ? "warn" : "ok"}">导入预览：${AS.importPreview.preview ? "等待确认" : "已跳过预览"}${AS.importPreview.summary?.hasConflict ? "，检测到同名世界，将自动重命名导入" : ""}</div><pre>${U.esc(U.json(AS.importPreview.summary || AS.importPreview))}</pre><button class="primary" data-action="confirm-worldpack-import">确认导入</button>` : C.empty("尚未选择导入或导出")}</div>
        </div>
        <aside class="panel">
          <h3>默认排除</h3>
          <div class="list"><div class="item">API Key / secrets</div><div class="item">runtime/chat.jsonl</div><div class="item">runtime/memory.jsonl</div><div class="item">runtime/state.json</div><div class="item">未确认素材</div></div>
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
    const tabs = [
      { id: "connections", label: "模型连接" },
      { id: "plugins", label: "插件" },
      { id: "data", label: "数据与备份" },
      { id: "appearance", label: "外观" },
      { id: "advanced", label: "高级" },
    ];
    const body = {
      connections: renderConnections,
      plugins: renderPlugins,
      data: renderDataSettings,
      appearance: renderAppearance,
      advanced: renderAdvanced,
    }[AS.settingsTab]();
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
      <div class="module-grid">${list.length ? list.map(c => `<div class="module-card" data-character-id="${U.esc(c.id)}"><div class="item-head"><strong>${U.esc(c.name)}</strong>${C.badge(c.format || "native", "info")}</div><p class="tiny muted">${U.esc(U.compact(c.description || "无描述", 100))}</p><div class="chip-row">${(c.tags || []).slice(0, 6).map(t => `<span class="chip">${U.esc(t)}</span>`).join("") || `<span class="tiny muted">暂无标签</span>`}</div><div class="actions"><button class="small primary" data-action="rp-character">开始 RP</button><button class="small" data-action="preview-character">预览</button><button class="small" data-action="edit-character-meta">标签/说明</button><button class="small" data-action="backup-character">备份</button><button class="small danger" data-action="delete-character">删除</button></div></div>`).join("") : C.empty("暂无角色卡", "导入角色卡后会显示在这里。")}</div>
    </div>
    <aside class="panel">${AS.currentCharacterCard ? `<h3>角色预览</h3><pre>${U.esc(U.json(AS.currentCharacterCard))}</pre>` : C.empty("角色预览", "选择一张角色卡查看详情。")}</aside>
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
  return `<section class="panel">
    <div class="panel-head"><div><h2>炼金台</h2><p class="sub">把素材提取为待审核条目，不直接写入正式世界。</p></div></div>
    <div id="alchemyDrop" class="drop-zone"><strong>拖拽文件或点击选择</strong><span>支持 .md .txt .json .png</span></div>
    <textarea id="alchemyText" placeholder="或在这里粘贴素材文本..."></textarea>
    <div class="actions"><button class="primary" data-action="alchemy-import">提取到审核队列</button><span id="alchemyResult" class="tiny muted"></span></div>
  </section>`;
}

function renderReview() {
  const items = AS.reviewItems || [];
  return `<section class="panel">
    <div class="panel-head"><div><h2>审核队列</h2><p class="sub">未确认内容不得写入正式世界数据。</p></div><button class="small" data-action="load-review">刷新</button></div>
    <textarea id="reviewSourceText" placeholder="粘贴素材，先提取进入审核队列。"></textarea>
    <div class="actions"><button class="primary" data-action="enqueue-review">提取入队</button><span class="tiny muted">当前目标：${AS.selectedModule ? U.esc(AS.selectedModule.displayName || AS.selectedModule.name) : "未选择"}</span></div>
    <div class="list" style="margin-top:12px">${items.length ? items.map(item => `<div class="item" data-review-id="${U.esc(item.id)}"><div class="item-head"><strong>${U.esc(item.entity || item.name || "待审核实体")}</strong><div>${C.badge(item.typeName || item.typeId || item.type || "实体", "info")} ${C.badge(Math.round((item.confidence || 0) * 100) + "%", "warn")}</div></div><p class="tiny muted">${U.esc(U.compact(item.sourceSnippet || item.source || "", 180))}</p><details><summary>结构数据</summary><pre>${U.esc(U.json(item.data || item.structured || {}))}</pre></details><div class="actions"><button class="small primary" data-action="confirm-review">确认写入</button><button class="small" data-action="merge-review">合并/修正</button><button class="small danger" data-action="ignore-review">忽略</button></div></div>`).join("") : C.empty("队列为空", "炼金台提取结果会先停在这里。")}</div>
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
    ${C.stat("控制台版本", CFG.version)}
    ${C.stat("LLM 连接", AS.llmConnected ? "已连接" : "未连接")}
    ${C.stat("API Key", AS.hasApiKey ? "已配置" : "缺失")}
    ${C.stat("数据目录", h?.data?.writable ? "可写" : "未知")}
    ${C.stat("世界数量", h?.data?.worldsCount ?? AS.modules.length)}
    ${C.stat("对话回合", h?.data?.totalTurns ?? 0)}
  </div><div class="panel"><h3>服务状态</h3><pre>${U.esc(U.json(h || {}))}</pre></div></section>`;
}

function renderConnections() {
  const data = AS.connections || { items: [], templates: [] };
  return `<section class="layout-2">
    <div class="panel">
      <div class="panel-head"><h2>连接档案</h2><button class="small" data-action="load-connections">刷新</button></div>
      <div class="list">${(data.items || []).map(c => `<div class="item" data-connection-id="${U.esc(c.id)}"><div class="item-head"><strong>${U.esc(c.label || c.name)}</strong>${C.badge(c.active ? "默认" : "档案", c.active ? "ok" : "pending")}</div><span class="tiny muted">${U.esc(c.provider || "openai-compatible")} · ${U.esc(c.model || "")}</span><div class="chip-row"><span class="chip">temp ${c.temperature ?? "-"}</span><span class="chip">max ${c.maxTokens ?? "-"}</span><span class="chip">top_p ${c.topP ?? "-"}</span>${c.hasApiKey ? `<span class="chip ok">key ${U.esc(c.maskedKey || "saved")}</span>` : `<span class="chip warn">no key</span>`}</div><div class="actions"><button class="small" data-action="set-default-connection">设为默认</button><button class="small" data-action="test-connection">测试</button><button class="small" data-action="duplicate-connection">复制</button><button class="small danger" data-action="delete-connection">删除</button></div></div>`).join("") || C.empty("暂无连接档案")}</div>
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
    <div class="list">${plugins.length ? plugins.map(p => `<div class="item" data-plugin-id="${U.esc(p.id)}"><div class="item-head"><strong>${U.esc(p.name)}</strong>${C.badge(p.enabled ? "启用" : "禁用", p.enabled ? "ok" : "pending")}</div><div class="actions">${(p.capabilities || []).map(x => C.badge(x, "info")).join("")}</div>${p.errors?.length ? C.notice(U.esc(p.errors.join("；")), "bad") : ""}<details><summary>权限与 Manifest</summary><pre>${U.esc(U.json({ permissions: p.permissions || [], entry: p.entry, manifest: p.manifest || {} }))}</pre></details><div class="actions"><button class="small" data-action="${p.enabled ? "disable-plugin" : "enable-plugin"}">${p.enabled ? "禁用" : "启用"}</button><button class="small" data-action="run-plugin">Dry-run</button></div></div>`).join("") : C.empty("暂无本地插件", "把插件目录放到 userData/plugins/{plugin}/plugin.json。")}</div>
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
  return `<section class="grid"><div class="panel"><h2>高级模式</h2><p class="sub">原始 JSON、debug logs、engine manifest 和内部模块 id 仅在这里展示。</p><div class="actions"><button data-action="refresh-debug">刷新 debug logs</button><button data-action="toggle-debug">打开日志面板</button></div></div><div class="panel"><h3>Engine Manifest</h3><pre>${U.esc(U.json({ version: CFG.version, modules: "M1-M19", selectedModule: AS.selectedModule?.id || null, api: ["/api/data/export", "/api/data/import"] }))}</pre></div></section>`;
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
    U.qs("#main").innerHTML = `<div class="panel">${C.notice(`页面渲染失败：${U.esc(err.message)}`, "bad")}<button onclick="location.reload()">刷新页面</button></div>`;
  }
}

async function loadViewData() {
  try {
    if (AS.view === "library" && AS.libraryTab === "characters") AS.characters = await API.loadCharacters();
    if ((AS.view === "library" && AS.libraryTab === "worldbook") || AS.view === "workbench") await loadWorldbookIfPossible();
    if (AS.view === "library" && AS.libraryTab === "review") AS.reviewItems = (await API.alchemyReview()).items || [];
    if (AS.view === "settings" && AS.settingsTab === "connections") AS.connections = await API.connections();
    if (AS.view === "settings" && AS.settingsTab === "plugins") AS.plugins = await API.plugins();
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

async function selectModule(id, targetView = "chat") {
  const mod = AS.modules.find(m => m.id === id);
  if (!mod) return;
  AS.selectedModule = mod;
  AS.isQuickStart = false;
  AS.quickStartContent = "";
  AS.dashboardData = {};
  AS.turnDebug = null;
  if (mod.dataMode === "character_card") {
    try {
      const res = await API.loadCharacter(mod._characterId || mod.id.replace("char:", ""));
      if (res.status === "ok") AS.currentCharacterCard = res.card;
    } catch {}
  }
  await CH.loadServer(mod);
  await loadWorldbookIfPossible();
  AS.view = targetView;
}

async function refreshModules() {
  const mods = await API.loadModules();
  let chars = [];
  try { chars = await API.loadCharacters(); } catch {}
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

  U.qsa("[data-action]").forEach(btn => {
    btn.onclick = e => handleAction(e, btn);
  });
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
    if (texts.length) ta.value = texts.join("\n\n---\n\n");
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
      if (texts.length) ta.value = texts.join("\n\n---\n\n");
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
    if (action === "chat-send") return sendChat();
    if (action === "clear-chat") return confirmClearChat();
    if (action === "open-command-panel") return openCommandPanel();
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
    if (action === "load-worldbook") { await loadWorldbookIfPossible(); return render(); }
    if (action === "import-worldbook-json") return importWorldbookJson();
    if (action === "export-worldbook-json") return exportWorldbookJson();
    if (action === "new-worldbook-entry") return editWorldbookEntry();
    if (action === "edit-worldbook-entry") return editWorldbookEntry(btn.closest("[data-entry-id]")?.dataset.entryId);
    if (action === "toggle-worldbook-entry") return toggleWorldbookEntry(btn.closest("[data-entry-id]")?.dataset.entryId);
    if (action === "delete-worldbook-entry") return deleteWorldbookEntry(btn.closest("[data-entry-id]")?.dataset.entryId);
    if (action === "test-worldbook") return testWorldbook();
    if (action === "alchemy-import") return alchemyImport();
    if (action === "enqueue-review") return enqueueReview();
    if (action === "load-review") { AS.reviewItems = (await API.alchemyReview()).items || []; return render(); }
    if (["confirm-review", "ignore-review", "merge-review"].includes(action)) return reviewAction(action, btn.closest("[data-review-id]")?.dataset.reviewId);
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

function quickStartChat() {
  const text = U.qs("#quickStartText")?.value.trim();
  if (!text) return createToast("请先粘贴内容或拖拽文件", "warn");
  AS.quickStartContent = text;
  AS.isQuickStart = true;
  AS.selectedModule = { id: "__quick__", name: "快速对话", displayName: "快速对话", dataMode: "worldbook", turnCount: 0 };
  AS.messages = [];
  AS.workbenchMode = "chat";
  AS.view = "workbench";
  render();
}

async function sendChat() {
  const input = U.qs("#chatInput");
  const text = input?.value.trim();
  if (!text || AS.busy) return;
  if (!AS.selectedModule) return createToast("请先加载一个世界", "warn");
  input.value = "";
  AS.busy = true;
  CH.add("user", text);
  render();
  try {
    let messages = AS.messages.map(m => ({ role: m.role, content: m.content })).slice(-40);
    if (AS.isQuickStart && AS.quickStartContent) messages = [{ role: "system", content: `以下为叙事设定背景：\n${AS.quickStartContent}` }, ...messages];
    const res = await API.chatSend({
      input: text,
      moduleKey: AS.selectedModule.id,
      dataMode: AS.selectedModule.dataMode || "worldbook",
      engineState: AS.engineState || { turnCount: AS.selectedModule.turnCount || 0, dataMode: AS.selectedModule.dataMode || "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
      messages,
    });
    if (res.status === "ok") {
      const narrative = res.narrative || "（无回应）";
      CH.add("assistant", narrative, { id: res.persistedIds?.assistantId, candidates: res.persistedIds?.assistantId ? [{ id: `${res.persistedIds.assistantId}-c0`, content: narrative, selected: true, createdAt: new Date().toISOString() }] : [] });
      AS.lastStatusSections = res.parsedSections || {};
      AS.engineState = res.engineState || AS.engineState;
      if (res.turnCount && AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
      if (AS.selectedModule?.id !== "__quick__") await refreshObserve();
    } else {
      CH.add("error", res.errorMsg || "LLM 返回错误");
    }
  } catch (err) {
    CH.add("error", err.message || String(err));
  }
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
  const commands = ["/recap", "/world", "/save", "/branch", "/who", "/审查 check"].join("\n");
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
  if (res.status === "ok") AS.currentCharacterCard = res.card;
  render();
}

async function rpCharacter(id) {
  if (!id) return;
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
  const res = await API.alchemyImport({ text });
  if (res.status !== "ok") throw new Error(res.errorMsg || "提取失败");
  AS.reviewItems = (await API.alchemyReview()).items || [];
  createToast(`已加入审核队列 ${res.reviewItems?.length || 0} 项`);
  AS.libraryTab = "review";
  render();
}

async function enqueueReview() {
  const text = U.qs("#reviewSourceText")?.value.trim();
  if (!text) return createToast("请先粘贴素材", "warn");
  const res = await API.alchemyImport({ text });
  if (res.status !== "ok") throw new Error(res.errorMsg || "提取失败");
  AS.reviewItems = (await API.alchemyReview()).items || [];
  render();
}

async function reviewAction(action, id) {
  if (!id) return;
  const payload = { id, moduleKey: AS.selectedModule?.id };
  if (action === "confirm-review") payload.action = "confirm";
  if (action === "ignore-review") payload.action = "ignore";
  if (action === "merge-review") {
    payload.action = "merge";
    const item = AS.reviewItems.find(x => x.id === id) || {};
    const entity = prompt("实体名修正", item.entity || "");
    if (entity) payload.entity = entity;
    const patch = prompt("字段修正 JSON（可留空）", "{}");
    if (patch && patch.trim() && patch.trim() !== "{}") {
      try { payload.data = JSON.parse(patch); }
      catch { return createToast("字段 JSON 格式不正确", "bad"); }
    }
  }
  const res = await API.alchemyReview(payload);
  AS.reviewItems = res.items || [];
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
  createToast("连接档案已保存");
  render();
}

async function connectionAction(action, id) {
  const map = { "set-default-connection": "setDefault", "test-connection": "test", "duplicate-connection": "duplicate", "delete-connection": "delete" };
  const res = await API.connections({ action: map[action], id });
  if (action === "test-connection") createToast(res.status === "ok" ? `连接成功 ${res.latencyMs}ms` : (res.errorMsg || "连接失败"), res.status === "ok" ? "" : "bad");
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
    if (AS.health?.llm?.status === "connected") AS.llmConnected = true;
    const debug = U.qs("#debugToggle");
    if (debug && AS.health?.debugMode) debug.style.display = "block";
  } catch {}
}

async function init() {
  for (const base of ["http://localhost:3000", window.location.origin]) {
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) { API.base = base; break; }
    } catch {}
  }
  try { Object.assign(AS.config, await API.loadConfig()); } catch {}
  try {
    const secrets = await API.getSecrets();
    AS.hasApiKey = !!secrets?.llm?.items?.length;
  } catch {}
  try {
    const ex = await API.loadExamples();
    AS.examples = ex.examples || [];
  } catch {}
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
    await CH.loadServer(AS.selectedModule);
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
