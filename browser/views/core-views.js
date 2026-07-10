"use strict";

// Home, experience, library, and world-management view composition.
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
    const firstRunDemo = AS.examples.find(item => item.recommendedForFirstRun) || AS.examples.find(item => item.kind === "playable_demo");
    const firstRunBanner = AS.config.firstRun !== false && firstRunDemo ? `<section class="panel">
        <div class="panel-head"><div><h2>第一次来？</h2><p class="sub">安装示例世界「${U.esc(firstRunDemo.title || firstRunDemo.name)}」，首句会自动放进输入框；配好模型后按 Enter 就能开始。</p></div><button class="primary" data-action="install-first-run-demo">一键安装示例世界并开始</button></div>
      </section>` : "";
    return `<div class="grid">
      ${firstRunBanner}
      <section class="panel hero lobby-hero">
        <div class="hero-row">
          <div>
            ${C.badge("冒险大厅", "ok")}
            <div class="hero-title">继续冒险：${U.esc(worldName)}</div>
            <p class="sub">${current ? `${C.dataModeLabel(current)} · ${current.subType || "classic"} · 最近世界` : "创建或导入一个世界后开始创作。"}</p>
          </div>
          <div class="actions">
            <button class="primary" data-action="load-and-chat">继续冒险</button>
            <button data-action="create-world">新建世界</button>
            <button data-action="library-alchemy">导入素材</button>
            <button data-action="open-settings">设置</button>
          </div>
        </div>
      </section>

      ${C.lobbyEntryDetails(firstRunDemo)}

      <section class="cols-4">
        ${C.stat("模型连接", getModelConnectionUiState().label, AS.config.llmModel || "")}
        ${C.stat("当前回合", current?.turnCount || 0)}
        ${C.stat("世界书条目", AS.worldbookEntries.length)}
        ${C.stat("待审核", reviewCount, reviewCount ? "等待确认" : "无")}
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>快速设定 / Quick Setting：粘贴设定，快速开始 AI 互动</h2><p class="sub">适合轻度用户、AI 设定爱好者和文字冒险玩家。你可以直接粘贴角色、世界观、开场剧情或规则片段，World Tree 会创建一个可继续、可审核、可导出的草稿世界。</p></div></div>
        <div id="quickStartDrop" class="drop-zone"><strong>拖拽文件 / 文件夹到此处，或点击选择</strong><span>支持 .md .txt .json</span></div>
        <textarea id="quickStartText" placeholder="或在这里粘贴设定、片段、角色描述..."></textarea>
        <div class="actions"><button class="primary" data-action="quick-start-chat">创建预设/设定草稿并开始</button><span class="tiny muted">不需要先写完整世界书。后续可以把草稿整理成正式世界。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>世界书大世界 / World RPG <span class="badge beta">Beta</span></h2><p class="sub">以 GM 方式在开放世界中冒险。粘贴世界设定或冒险背景。</p></div></div>
        <input id="wrpgTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="wrpgText" placeholder="粘贴世界设定、冒险背景、初始场景。"></textarea>
        <div class="actions"><button class="primary" data-action="world-rpg-start">创建世界冒险</button>${firstRunDemo ? `<button class="small" data-action="install-first-run-demo">没有素材？用示例试试</button>` : ""}<span class="tiny muted">最小闭环版本，任务/战斗/成长系统后续开放。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>解谜调查 / Mystery Puzzle <span class="badge exp">${T("experimental", "抢先体验")}</span></h2><p class="sub">在谜题主持人的引导下探索线索、解开谜题。</p></div></div>
        <input id="mysteryTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="mysteryText" placeholder="粘贴谜题、悬疑场景、线索片段。"></textarea>
        <div class="actions"><button class="primary" data-action="mystery-puzzle-start">创建解谜项目</button><span class="tiny muted">已提供线索卡与假设白板${T("thinSlice", "基础版")}；完整推理引擎仍在打磨。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>桌面叙事 / Tabletop 项目草稿 <span class="badge exp">${T("experimental", "抢先体验")}</span></h2><p class="sub">创建普通 Tabletop 项目草稿并进入对话；结构化 Tabletop V2 导入会在加载 Tabletop 项目后显示。</p></div></div>
        <input id="tabletopTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="tabletopText" placeholder="粘贴跑团背景、规则偏好、开场场景。"></textarea>
        <div class="actions"><button class="primary" data-action="tabletop-start">创建 Tabletop 草稿</button><span class="tiny muted">支持 /roll 骰子${T("thinSlice", "基础版")}；${T("notFullDnd", "暂不包含完整 DND 规则")}，也不是 Tabletop V2 导入确认。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>策略模拟 / Strategy Sim <span class="badge exp">${T("experimental", "抢先体验")}</span></h2><p class="sub">在策略顾问协助下进行阵营经营与决策推演。</p></div></div>
        <input id="strategyTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="strategyText" placeholder="粘贴阵营、局势、资源或策略目标。"></textarea>
        <div class="actions"><button class="primary" data-action="strategy-sim-start">创建策略项目</button><span class="tiny muted">已提供四项资源与决策${T("thinSlice", "基础版")}；${T("notFull4x", "暂不包含完整 4X 规则")}。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>单人剧本杀 / Murder Mystery <span class="badge exp">${T("experimental", "抢先体验")}</span></h2><p class="sub">在案件主持人引导下调查线索、推理真相。</p></div></div>
        <input id="murderTitle" placeholder="项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="murderText" placeholder="粘贴案件背景、角色、线索设定。"></textarea>
        <div class="actions"><button class="primary" data-action="murder-mystery-start">创建剧本杀项目</button><button class="small" data-action="single-player-scriptkill-v2-toggle-panel">打开单人剧本杀 V2</button><span class="tiny muted">${T("truthLockActive", "剧透保护已开启")}，并提供玩家可见线索板${T("thinSlice", "基础版")}。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>人物卡 / Character：粘贴人物卡，开始角色扮演</h2><p class="sub">粘贴任意格式的人物卡文本（JSON / 纯文本 / 角色描述），World Tree 会创建一个 character 模式项目并使用人物卡引擎进行对话。</p></div></div>
        <input id="charCardTitle" placeholder="角色名 / 项目标题（可选）" class="full-width" style="margin-bottom:8px">
        <textarea id="charCardText" placeholder="在这里粘贴人物卡内容..."></textarea>
        <div class="actions"><button class="primary" data-action="character-start-chat">创建人物卡并开始对话</button><span class="tiny muted">支持 SillyTavern v2/v3 JSON、纯文本角色描述。后续可在角色库中管理。</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>炼金台 / Creation Forge</h2><p class="sub">把灵感、素材或片段整理成候选内容，进入审核队列后再决定是否采用。</p></div></div>
        <div class="actions"><button class="primary" data-action="library-alchemy">打开炼金台</button><span class="tiny muted">candidate-only；不会自动写 canon，也不会新增产品入口。</span></div>
      </section>

      <section class="cols-2">
        <div class="panel">
          <div class="panel-head"><div><h2>世界书总览</h2><p class="sub">展示与快速进入，完整编辑在资料库。</p></div><button class="small" data-action="load-worldbook">加载</button></div>
          <div class="list">${C.worldbookRows(3)}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>最近世界</h2><p class="sub">最近故事和模块历史。</p></div>${C.badge(AS.messages.length + " 条消息", "pending")}</div>
          ${AS.lastScene ? `<div class="notice">上一幕：${U.esc(U.compact(AS.lastScene, 120))}</div>` : ""}
          <div class="list">
            ${(AS.modules || []).slice(0, 4).map(m => `<div class="item"><div class="item-head"><strong>${U.esc(m.displayName || m.name)}</strong>${C.badge((m.turnCount || 0) + " 回合")}</div><span class="tiny muted">${m.lastPlayed ? U.rel(m.lastPlayed) : "未开始"}</span><button class="small" data-module-id="${U.esc(m.id)}" data-action="load-module-from-list">继续</button></div>`).join("") || C.empty("暂无存档")}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>内置示例与模板</h2><p class="sub">示例用于首次试飞；空白模板用于从自己的素材开始。</p></div>${C.badge(AS.examples.length + " 个", "pending")}</div>
        <div class="list">${AS.examples.length ? AS.examples.map(ex => `<div class="item" data-example-id="${U.esc(ex.id)}"><div class="item-head"><strong>${U.esc(ex.title || ex.name || ex.id)}</strong>${C.badge(ex.kind || "blank_template", ex.kind === "playable_demo" ? "ok" : "info")}</div><span class="tiny muted">${U.esc(ex.description || "可安装为本地结构。")}</span>${ex.suggestedActions?.length ? `<div class="chip-row">${ex.suggestedActions.slice(0, 3).map(action => `<span class="chip">${U.esc(action)}</span>`).join("")}</div>` : ""}<button class="small primary" data-action="install-example">${ex.kind === "playable_demo" ? "安装并开始" : "安装模板"}</button></div>`).join("") : C.empty("暂无内置模板", "保持无授权素材策略，等待你后续提供素材。")}</div>
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
    const allowed = ["connections", "narrative", "advanced"];
    if (!allowed.includes(AS.settingsTab)) AS.settingsTab = "connections";
    const tabs = [
      { id: "connections", label: "连接" },
      { id: "narrative", label: "叙事" },
      { id: "advanced", label: "高级" }
    ];
    const body = ({ connections: renderConnections, narrative: renderNarrativeSettings, advanced: renderAdvancedSettingsCard })[AS.settingsTab]();
    return `<div class="grid">
      <div><h2>设置</h2><p class="sub">低频、敏感与技术性操作集中在这里。</p></div>
      <section class="settings-card-grid">
        ${tabs.map(tab => `<button class="settings-card ${AS.settingsTab === tab.id ? "active" : ""}" data-action="settings-card-open" data-settings-tab="${tab.id}"><strong>${tab.label}</strong><span>${tab.id === "connections" ? "模型、Key 与测试连接" : tab.id === "narrative" ? "档位、视觉语言与备份" : "导出、危险操作与调试"}</span></button>`).join("")}
      </section>
      ${C.tabs(tabs, AS.settingsTab, "data-settings-tab")}
      ${body}
    </div>`;
  },
};

function renderCharacters() {
  const list = AS.characters || [];
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

function applyCharacterSearchFilter(rawQuery = "") {
  const query = String(rawQuery || "").trim().toLowerCase();
  AS.characterQuery = String(rawQuery || "");
  const cards = U.qsa("[data-character-id]");
  let visibleCount = 0;
  cards.forEach(card => {
    const visible = !query || String(card.textContent || "").toLowerCase().includes(query);
    card.hidden = !visible;
    card.style.display = visible ? "" : "none";
    if (visible) visibleCount += 1;
  });
  let empty = U.qs("[data-character-search-empty]");
  if (!empty && cards.length) {
    empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.dataset.characterSearchEmpty = "true";
    const grid = cards[0].parentElement;
    grid?.parentElement?.appendChild(empty);
  }
  if (empty) {
    empty.textContent = cards.length ? "没有匹配的角色。请尝试名称、描述或标签。" : "暂无角色卡。导入角色卡后会显示在这里。";
    empty.hidden = visibleCount !== 0;
  }
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
  </section>${renderWorldbookV2Panel()}`;
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
