"use strict";

// Shared UI primitives, status renderers, and chat persistence helpers.
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
    const displayText = role === "error" ? (m.userMessage || m.content || "AI 调用失败") : (m.content || "");
    return `<div class="chat-message ${tone} ${m.id && AS.selectedMessageId === m.id ? "selected-message" : ""}" data-message-id="${U.esc(m.id || "")}" data-turn-id="${U.esc(turnId)}">
      <div class="chat-meta">
        <strong>${role === "user" ? "你" : role === "assistant" ? "叙事引擎" : role === "error" ? "错误" : role}</strong>
        ${m.favorite ? C.badge("收藏", "warn") : ""}
        ${role === "error" && m.code ? C.badge(m.code, m.retryable === false ? "warn" : "bad") : ""}
        ${role === "error" && m.retryOf ? C.badge("重试失败", "warn") : ""}
        ${m.round ? `<span>第 ${U.esc(m.round)} 轮</span>` : ""}
        ${m.ts ? `<span>${U.date(m.ts)}</span>` : ""}
      </div>
      <div class="chat-text">${U.md(displayText)}</div>
      ${role === "error" && m.detail ? `<details class="tiny"><summary>技术细节</summary><pre>${U.esc(U.compact(m.detail, 1200))}</pre></details>` : ""}
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
        ${role === "error" && m.retryable !== false ? `<button data-action="retry-message">重试</button>` : ""}
        ${role === "error" ? `<button data-action="open-settings">设置</button>` : ""}
        <button class="danger" data-action="delete-message">删除</button>
      </div>
    </div>`;
  },
  chatSurface() {
    const m = AS.selectedModule;
    const title = AS.isQuickStart ? "快速对话" : (m ? (m.displayName || m.name) : "未选择世界");
    const usage = C.usageBadge();
    const proposalCount = (AS.kernel?.pendingProposals || []).length + (AS.reviewItems || []).length;
    return `<div class="chat-layout">
      <section class="panel chat-card">
        <div class="panel-head">
          <div>
            <h2>${U.esc(title)}</h2>
            <p class="sub">${AS.isQuickStart ? "快速项目草稿 · 已保存到本地 runtime" : m ? `${C.dataModeLabel(m)} · ${m.turnCount || 0} 回合${m.draft ? " · 草稿" : ""}` : "请先在工作台或世界管理中加载一个世界"}</p>
            ${usage}
          </div>
          <div class="actions">
            <button class="small" data-action="toggle-developer-observability">开发者观测</button>
            <button class="small proposal-dot-button ${proposalCount ? "has-dot" : ""}" data-action="library-review">提案审阅${proposalCount ? `<span>${proposalCount}</span>` : ""}</button>
            <button class="small" data-action="drawer-branches">分支</button>
            <button class="small" data-action="open-command-panel">命令</button>
            <button class="small danger" data-action="clear-chat">清空</button>
          </div>
        </div>
        <div id="chatMessages" class="chat-messages">${AS.messages.length ? AS.messages.map(C.chatMsg).join("") : C.openingSuggestions()}</div>
        ${renderProgressPanel()}
        <div class="composer">
          <textarea id="chatInput" placeholder="续写这一幕... 输入 / 调用命令，Enter 发送">${U.esc(AS.chatDraft || "")}</textarea>
          ${AS.busy ? `<button class="danger" data-action="chat-stop">停止</button>` : `<button class="primary" data-action="chat-send">发送</button>`}
        </div>
        ${renderKernelPanel()}
        ${renderWorkflowPanel()}
        ${renderModePlayPanel()}\n        ${shouldShowSinglePlayerScriptKillV2Panel() ? renderSinglePlayerScriptKillV2Panel() : ""}
      </section>
      ${renderStatusPanel()}
      ${renderDeveloperObservabilityDrawer()}
    </div>`;
  },
  usageBadge() {
    const usage = AS.usageSummary;
    if (!usage?.turn && !usage?.session) return "";
    const turn = usage.turn || {};
    const session = usage.session || {};
    const turnTokens = Number(turn.totalTokens || 0);
    const sessionTokens = Number(session.totalTokens || 0);
    const cost = Number((turn.estimatedCostCny || 0) + (session.estimatedCostCny || 0));
    return `<div class="chip-row usage-row">
      <span class="chip">本轮 ~${U.esc(String(turnTokens))} tokens</span>
      <span class="chip">本局 ~${U.esc(String(sessionTokens))} tokens</span>
      ${cost > 0 ? `<span class="chip">估算 ¥${U.esc(cost.toFixed(4))}</span>` : ""}
    </div>`;
  },
  openingSuggestions() {
    const suggestions = ["观察周围", "询问同伴", "继续当前目标", "/recap"];
    return `<div class="opening-suggestions">
      <strong>开场建议</strong>
      <p class="tiny muted">可以从一个动作、问题或命令开始。</p>
      <div class="chip-row">${suggestions.map(text => `<button class="small" data-action="use-opening-suggestion" data-suggestion="${U.esc(text)}">${U.esc(text)}</button>`).join("")}</div>
    </div>`;
  },
  lobbyEntryDetails(firstRunDemo) {
    const demoName = firstRunDemo ? (firstRunDemo.title || firstRunDemo.name || "内置示例") : "内置示例";
    const cards = [
      ["这是什么", "World Tree 是可以持续保存世界状态的文字冒险大厅；你可以从示例、素材或空白世界进入。", "open-settings", "检查连接"],
      ["示例回放", `先用「${demoName}」跑一轮，确认模型连接、消息流和审核路径都能工作。`, "install-first-run-demo", "安装示例"],
      ["用示例开始", "选择官方示例或模板，创建可继续、可导出、可回滚的本地世界。", "install-first-run-demo", "用示例开始"],
      ["导入素材", "把设定、角色卡、世界书或片段交给炼金台，候选内容先进入审核队列。", "library-alchemy", "导入素材"],
      ["空白开始", "从一个空白世界出发，逐步补充世界书、角色、机制和开场剧情。", "create-world", "空白开始"]
    ];
    return `<section class="panel lobby-entry-details">
      <div class="panel-head"><div><h2>开始新的冒险</h2><p class="sub">入口详情页把第一次进入的关键选择放在同一屏：理解产品、试跑示例、导入素材或空白开始。</p></div>${C.badge("示例/新建", "info")}</div>
      <div class="entry-grid">${cards.map(([title, text, action, cta]) => `<article class="entry-card">
        <strong>${U.esc(title)}</strong>
        <p>${U.esc(text)}</p>
        <button class="small ${title === "用示例开始" || title === "空白开始" ? "primary" : ""}" data-action="${U.esc(action)}">${U.esc(cta)}</button>
      </article>`).join("")}</div>
    </section>`;
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
  const stages = getProgressStages(AS.progressProfile);
  return `<section class="progress-panel" aria-live="polite" data-progress-stage="${AS.progressIndex}">
    <div class="progress-track">${stages.map((label, index) => `<span class="${index < AS.progressIndex ? "done" : index === AS.progressIndex ? "active" : ""}" title="${U.esc(label)}"></span>`).join("")}</div>
    <strong>${U.esc(stages[AS.progressIndex] || stages[0])}</strong>
    <span class="tiny muted">这是阶段状态提示，不代表流式输出。</span>
  </section>`;
}

function renderWorldbookV2Panel() {
  const s = AS.worldbookV2 || {};
  const moduleKey = AS.selectedModule?.id || "";
  const candidates = s.loaded?.candidates || [];
  return `<section class="panel worldbook-v2-panel">
    <div class="panel-head"><div><h2>Worldbook V2</h2><p class="sub">候选条目 · 显式采纳 · 玩家可见注入预览</p></div><div class="actions"><button class="small" data-action="worldbook-v2-load">读取V2</button><button class="small" data-action="worldbook-v2-export">导出V2</button></div></div>
    ${moduleKey ? "" : C.notice("请先选择或创建一个世界项目。", "warn")}
    <div class="grid two">
      <section><h3>候选条目</h3><textarea id="worldbookV2EntryText" placeholder='{"title":"Public Gate","keys":["gate"],"content":"Player-visible fact.","visibility":"public"}'>${U.esc(s.entryText || "")}</textarea><div class="actions"><button class="small primary" data-action="worldbook-v2-create-candidate">创建候选</button><button class="small" data-action="worldbook-v2-adopt-candidate" ${s.candidate?.candidateId || candidates.length ? "" : "disabled"}>采纳最新候选</button></div></section>
      <section><h3>注入预览</h3><textarea id="worldbookV2Input" placeholder="输入玩家行动或场景文本">${U.esc(s.input || "")}</textarea><div class="actions"><button class="small primary" data-action="worldbook-v2-inject-preview">预览注入</button></div></section>
    </div>
    <div class="grid two">
      <section><h3>当前状态</h3><pre class="tiny">${U.esc(U.json({ entries: s.loaded?.entries || [], candidates: candidates.slice(-5) }))}</pre></section>
      <section><h3>最近结果</h3>${s.error ? C.notice(s.error, "error") : ""}<pre class="tiny">${U.esc(U.json(s.lastResult || s.preview || s.exportResult || null))}</pre></section>
    </div>
  </section>`;
}

function renderStrategySimV2Panel() {
  const s = AS.strategySimV2 || {};
  const specText = s.specText || U.json(strategySimV2DefaultSpec());
  return `<section class="panel strategy-sim-v2-panel">
    <div class="panel-head"><div><h2>Strategy Sim V2</h2><p class="sub">Spec 校验/封存 · Run · Turn · Save · Export</p></div><div class="actions"><button class="small" data-action="strategy-sim-v2-load-run">读取Run</button><button class="small" data-action="strategy-sim-v2-export-run">导出Run</button></div></div>
    <div class="grid two">
      <section><h3>Spec</h3><textarea id="strategySimV2SpecText">${U.esc(specText)}</textarea><div class="actions"><button class="small" data-action="strategy-sim-v2-validate">校验</button><button class="small" data-action="strategy-sim-v2-seal">封存</button><button class="small primary" data-action="strategy-sim-v2-start">开始Run</button></div></section>
      <section><h3>行动</h3><input id="strategySimV2RunId" placeholder="runId" value="${U.esc(s.runId || "")}"><textarea id="strategySimV2ActionText" placeholder="ration and scout">${U.esc(s.actionText || "")}</textarea><div class="actions"><button class="small primary" data-action="strategy-sim-v2-turn">执行回合</button><button class="small" data-action="strategy-sim-v2-save">保存</button></div></section>
    </div>
    <div class="grid two">
      <section><h3>Public View</h3><pre class="tiny">${U.esc(U.json(s.publicView || null))}</pre></section>
      <section><h3>最近结果</h3>${s.error ? C.notice(s.error, "error") : ""}<pre class="tiny">${U.esc(U.json(s.lastResult || null))}</pre></section>
    </div>
  </section>`;
}

function renderDetectiveV2Panel() {
  const s = AS.detectiveV2 || {};
  const run = s.playerRun || {};
  const locations = run.caseView?.locations || s.playerCase?.locations || [];
  const characters = run.caseView?.characters || s.playerCase?.characters || [];
  const evidence = run.discoveredEvidenceIds || run.evidenceIds || s.lastInvestigation?.newEvidenceIds || [];
  const evidenceOptions = s.playerCase?.evidence || s.importPreview?.playerCaseView?.evidence || [];
  return `<section class="panel detective-v2-panel">
    <div class="panel-head"><div><h2>Detective V2</h2><p class="sub">案件导入 · 调查/询问 · 笔记 · 推理 · 导出</p></div><div class="actions"><button class="small" data-action="detective-v2-export-run">导出Run</button><button class="small" data-action="detective-v2-export-player-pack">玩家包</button></div></div>
    <div class="grid two">
      <section><h3>案件</h3><textarea id="detectiveV2ImportText" placeholder='{"title":"Case","locations":[...],"evidence":[...],"characters":[...],"truthLedger":{...}}'>${U.esc(s.importText || "")}</textarea><div class="actions"><button class="small" data-action="detective-v2-import-preview">预览案件</button><button class="small" data-action="detective-v2-import-commit">确认导入</button><button class="small primary" data-action="detective-v2-start">开始调查</button></div><p class="tiny muted">caseId: ${U.esc(s.caseId || "")} · runId: ${U.esc(s.runId || "")}</p></section>
      <section><h3>调查 / 询问</h3><select id="detectiveV2LocationId"><option value="">选择地点</option>${locations.map(item => `<option value="${U.esc(item.locationId || item.id)}" ${s.currentLocationId === (item.locationId || item.id) ? "selected" : ""}>${U.esc(item.name || item.title || item.locationId || item.id)}</option>`).join("")}</select><select id="detectiveV2CharacterId"><option value="">选择角色</option>${characters.map(item => `<option value="${U.esc(item.characterId || item.id)}" ${s.currentCharacterId === (item.characterId || item.id) ? "selected" : ""}>${U.esc(item.name || item.characterId || item.id)}</option>`).join("")}</select><textarea id="detectiveV2Question" placeholder="询问问题">${U.esc(s.question || "")}</textarea><div class="actions"><button class="small primary" data-action="detective-v2-investigate">调查地点</button><button class="small" data-action="detective-v2-interrogate">询问角色</button></div></section>
    </div>
    <div class="grid two">
      <section><h3>笔记 / 推理</h3><input id="detectiveV2EvidenceId" placeholder="evidenceId" value="${U.esc(s.currentEvidenceId || evidence[0] || "")}">${evidenceOptions.length ? `<select id="detectiveV2EvidenceSelect"><option value="">选择线索</option>${evidenceOptions.map(item => `<option value="${U.esc(item.evidenceId || item.id)}" ${s.currentEvidenceId === (item.evidenceId || item.id) ? "selected" : ""}>${U.esc(item.name || item.title || item.evidenceId || item.id)}</option>`).join("")}</select>` : ""}<input id="detectiveV2NotebookEntryId" placeholder="notebook entryId" value="${U.esc(s.notebookEntryId || "")}"><textarea id="detectiveV2NotebookSummary" placeholder="笔记摘要">${U.esc(s.notebookSummary || "")}</textarea><input id="detectiveV2DeductionCulpritId" placeholder="culpritId" value="${U.esc(s.deductionCulpritId || "")}"><input id="detectiveV2DeductionMethod" placeholder="method" value="${U.esc(s.deductionMethod || "")}"><div class="actions"><button class="small" data-action="detective-v2-notebook-extract" ${s.runId ? "" : "disabled"}>摘录线索</button><button class="small" data-action="detective-v2-notebook-update">更新笔记</button><button class="small primary" data-action="detective-v2-deduction-submit">提交推理</button></div></section>
      <section><h3>最近结果</h3>${s.error ? C.notice(s.error, "error") : ""}<pre class="tiny">${U.esc(U.json(s.lastResult || s.exportResult || null))}</pre></section>
    </div>
  </section>`;
}

// ── Single Player ScriptKill V2 Panel ──
function shouldShowSinglePlayerScriptKillV2Panel() {
  const modeId = AS.selectedModule?.mode || AS.selectedModule?.type || "";
  return AS.singlePlayerScriptKillV2?.panelOpen === true || modeId === "murder-mystery" || modeId === "single-player-scriptkill-v2";
}

function renderSinglePlayerScriptKillV2Panel() {
  const s = AS.singlePlayerScriptKillV2 || {};
  const run = s.playerRun || null;
  const roles = run?.packageView?.roleRoster || s.importPreview?.packageDraft?.roleBooks || [];
  const phase = run?.packageView?.phases?.find(p => p.phaseId === run.currentPhaseId) || null;
  const clues = run?.packageView?.publicClues || [];
  const phases = run?.packageView?.phases || [];
  return `<section class="panel single-player-scriptkill-v2-panel" data-single-player-scriptkill-v2-panel>
    <div class="panel-head"><div><h2>单人剧本杀 V2</h2><p class="sub">承接已有剧本 · 单人真实玩家 + 陌生AI玩家代理 · 以剧本流程为准</p></div><div class="actions"><button class="small" data-action="single-player-scriptkill-v2-list-runs">读取存档</button><button class="small" data-action="single-player-scriptkill-v2-load-run">加载Run</button></div></div>
    <div class="grid two">
      <section><h3>导入已有剧本</h3><textarea id="singlePlayerScriptKillV2ImportText" placeholder="粘贴你合法拥有的剧本杀资料">${U.esc(s.importText || "")}</textarea><label class="tiny"><input id="singlePlayerScriptKillV2Ownership" type="checkbox" checked> 我确认合法拥有，仅本地私用，不再分发</label><div class="actions"><button class="small" data-action="single-player-scriptkill-v2-import-preview">预览/检查</button><button class="small primary" data-action="single-player-scriptkill-v2-import-commit">确认导入</button></div>${s.importPreview ? `<pre class="tiny">${U.esc(U.json(s.importPreview.validation || s.importPreview))}</pre>` : ""}</section>
      <section><h3>开局</h3><input id="singlePlayerScriptKillV2ScriptId" placeholder="scriptId" value="${U.esc(s.scriptId || "")}"><select id="singlePlayerScriptKillV2SelectedRole"><option value="">选择我的角色</option>${roles.map(r => `<option value="${U.esc(r.roleId)}" ${s.selectedRoleId === r.roleId ? "selected" : ""}>${U.esc(r.roleName || r.displayName || r.roleId)}</option>`).join("")}</select><div class="actions"><button class="small primary" data-action="single-player-scriptkill-v2-start">开始单人剧本杀</button><button class="small" data-action="single-player-scriptkill-v2-read-role-act">读本</button></div>${run ? `<p class="tiny muted">Run: ${U.esc(run.runId)} · 当前阶段：${U.esc(phase?.title || run.currentPhaseId || "未知")}</p>` : C.empty("尚未开局", "导入并选择角色后开始。")}</section>
    </div>
    ${run ? `<div class="grid two"><section><h3>公聊 / 私聊</h3><textarea id="singlePlayerScriptKillV2CurrentText" placeholder="你要说什么？">${U.esc(s.currentText || "")}</textarea><select id="singlePlayerScriptKillV2TargetRole"><option value="">选择私聊对象</option>${(run.simulatedPlayers || []).map(p => `<option value="${U.esc(p.assignedRoleId)}" ${s.targetRoleId === p.assignedRoleId ? "selected" : ""}>${U.esc(p.roleName || p.displayName || p.assignedRoleId)}</option>`).join("")}</select><div class="actions"><button class="small" data-action="single-player-scriptkill-v2-public-talk">公聊发言</button><button class="small" data-action="single-player-scriptkill-v2-private-chat">私聊</button></div></section><section><h3>搜证 / 投票 / 复盘</h3><input id="singlePlayerScriptKillV2LocationId" placeholder="locationId，可空" value="${U.esc(s.locationId || "")}"><select id="singlePlayerScriptKillV2ClueId"><option value="">选择线索</option>${clues.map(c => `<option value="${U.esc(c.clueId)}" ${s.clueId === c.clueId ? "selected" : ""}>${U.esc(c.title || c.clueId)}</option>`).join("")}</select><select id="singlePlayerScriptKillV2VoteTarget"><option value="">选择投票对象</option>${(run.simulatedPlayers || []).map(p => `<option value="${U.esc(p.assignedRoleId)}" ${s.voteTargetRoleId === p.assignedRoleId ? "selected" : ""}>${U.esc(p.roleName || p.displayName || p.assignedRoleId)}</option>`).join("")}</select><div class="actions"><button class="small" data-action="single-player-scriptkill-v2-search">搜证</button><button class="small" data-action="single-player-scriptkill-v2-reveal-clue">公开线索</button><select id="singlePlayerScriptKillV2NextPhase"><option value="">自动/下一阶段</option>${phases.map(p => `<option value="${U.esc(p.phaseId)}" ${s.nextPhaseId === p.phaseId ? "selected" : ""}>${U.esc(p.title || p.phaseId)}</option>`).join("")}</select>
          <button class="small" data-action="single-player-scriptkill-v2-advance-phase">推进阶段</button><button class="small" data-action="single-player-scriptkill-v2-vote">投票</button><button class="small primary" data-action="single-player-scriptkill-v2-debrief">复盘</button><button class="small" data-action="single-player-scriptkill-v2-export-run">导出回放</button></div></section></div><section><h3>公聊记录</h3>${(run.publicBoard?.transcript || []).slice(-12).map(m => `<div class="item"><strong>${U.esc(m.speaker?.visibleName || m.speaker?.assignedRoleId || "角色")}</strong><p>${U.esc(m.text || "")}</p></div>`).join("") || C.empty("暂无发言")}</section>` : ""}
    ${s.lastResult ? `<pre class="tiny">${U.esc(U.json(s.lastResult))}</pre>` : ""}${s.error ? C.notice(s.error, "error") : ""}
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
          <button data-action="tabletop-v2-export">导出</button>
          <button data-action="tabletop-v2-clear">✕ 清除</button>
        </div>
      </section>`);
    } else {
      // V2 导入面板（增强：支持预览展示 + 导入提交）
      const preview = tv2.importPreview;
      sections.push(`<section><strong>🎲 Tabletop V2 导入</strong>
        <p class="tiny muted">这是 Tabletop 的结构化 V2 导入/游玩切片。普通"跑团 / Tabletop"入口只创建项目草稿。</p>
        <textarea id="tabletopV2ImportText" rows="5" placeholder='${U.esc('{\n  "title": "我的冒险",\n  "sourceType": "quick_start",\n  "playerBrief": { "premise": "..." }\n}')}' class="full-width" style="margin-bottom:6px;font-size:12px">${U.esc(tv2.importText || "")}</textarea>
        <div class="actions">
          <button data-action="tabletop-v2-preview-import">🔍 预览</button>
          <button class="primary" data-action="tabletop-v2-start">▶ 快速开始</button>
          <button data-action="tabletop-v2-import-commit">📥 导入并保存</button>
        </div>
        ${preview ? `<div class="notice" style="margin-top:6px"><strong>${U.esc(preview.title || preview.moduleDraft?.title || preview.moduleId || "预览")}</strong><br><span class="tiny">场景: ${preview.sceneCount || preview.moduleDraft?.scenes?.length || preview.sceneNames?.length || 0} · 角色: ${preview.characterCount || preview.moduleDraft?.characters?.length || preview.characterNames?.length || 0} · 规则: ${U.esc(preview.rulesetProfileId || preview.moduleDraft?.rulesetProfileId || "")}</span></div>` : ""}
      </section>`);
    }
  }
  const mystery = play.mystery?.discoveredClues ? play.mystery : play.mystery?.clueBoard;
  if (["mystery-puzzle", "murder-mystery"].includes(modeId)) {
    sections.push(`<section><strong>线索卡与假设白板</strong><div class="play-card-grid">${(mystery?.discoveredClues || []).map(item => `<article><b>${U.esc(item.name)}</b><span>${U.esc(item.location || "已发现")}</span></article>`).join("") || `<span class="tiny muted">输入 /clue 线索名 记录已知线索。</span>`}</div>${(mystery?.hypotheses || []).length ? `<p class="tiny">假设：${mystery.hypotheses.map(item => U.esc(item.statement)).join(" · ")}</p>` : `<p class="tiny muted">输入 /hypothesis 假设内容 建立假设。</p>`}</section>`);
    sections.push(renderDetectiveV2Panel());
  }
  const resources = play.strategy?.resources;
  if (modeId === "strategy-sim") {
    sections.push(`<section><strong>策略资源</strong><div class="resource-grid">${Object.entries(resources || {}).map(([key, item]) => `<article><span>${U.esc(item.label || key)}</span><b>${U.esc(item.value)} / ${U.esc(item.max)}</b><div class="meter-track"><div class="meter-fill" style="width:${Math.max(0, Math.min(100, Number(item.value || 0)))}%"></div></div></article>`).join("") || `<span class="tiny muted">资源状态将在第一轮载入。</span>`}</div><p class="tiny muted">可用：/invest_military · /expand_trade · /fortify_defense · /diplomacy_focus</p></section>`);
    sections.push(renderStrategySimV2Panel());
  }
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
  draftKey(m) { return `wt-chat-draft-${m?.id || "global"}`; },
  loadLocal(m) {
    AS.messages = [];
    try { AS.chatDraft = localStorage.getItem(CH.draftKey(m)) || AS.chatDraft || ""; } catch { /* draft unavailable */ }
  },
  persist() {
    if (AS.isQuickStart || !AS.selectedModule) return;
    const key = CH.draftKey(AS.selectedModule);
    if (AS.chatDraft) localStorage.setItem(key, AS.chatDraft);
    else localStorage.removeItem(key);
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
        ? res.messages.map((r, i) => ({ id: r.id || `h_${i}`, role: r.role, content: r.content, ts: r.ts, favorite: !!r.favorite, candidates: r.candidates || [], sections: r.sections || null, round: r.round || null, turnId: r.turnId || (r.round ? `turn-${r.round}` : ""), failedTurnId: r.failedTurnId || "", code: r.code || "", userMessage: r.userMessage || "", detail: r.detail || "", retryable: r.retryable, turnStatus: r.turnStatus || "", inputRefId: r.inputRefId || "", retryOf: r.retryOf || "", supersedesErrorId: r.supersedesErrorId || "" }))
        : [];
      localStorage.removeItem(CH.key(m));
      AS.chatDraft = localStorage.getItem(CH.draftKey(m)) || "";
      AS.lastScene = res.lastScene || "";
      AS.engineState = res.engineState || AS.engineState;
      if (res.turnCount && AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
    } catch {
      AS.messages = [];
      try { AS.chatDraft = localStorage.getItem(CH.draftKey(m)) || AS.chatDraft || ""; } catch { /* draft unavailable */ }
    }
  },
};
