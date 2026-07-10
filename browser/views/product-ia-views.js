"use strict";

// Product-facing information architecture. Contextual engineering views remain
// available through in-flow actions, but do not compete with these five roots.
(function installProductInformationArchitecture() {
  const registry = window.WorldTreeProductRegistry;

  function maturityBadge(entry) {
    const labels = {
      available: ["可用", "ok"],
      recommended: ["推荐", "ok"],
      "early-access": ["抢先体验", "warn"]
    };
    const [label, kind] = labels[entry?.maturity] || ["可用", "info"];
    return C.badge(label, kind);
  }

  function recentProjectRows() {
    const rows = (AS.modules || []).slice(0, 4);
    if (!rows.length) return C.empty("还没有项目", "从示例或一种体验开始，你的世界会保存在本机。");
    return rows.map(module => `<article class="home-project-row">
      <div>
        <strong>${U.esc(module.displayName || module.name || "未命名世界")}</strong>
        <span>${U.esc(C.dataModeLabel(module))} · ${module.turnCount || 0} 回合 · ${module.lastPlayed ? U.rel(module.lastPlayed) : "尚未开始"}</span>
      </div>
      <button class="small" data-module-id="${U.esc(module.id)}" data-action="load-module-from-list">继续</button>
    </article>`).join("");
  }

  function homeView() {
    if (AS.workbenchMode === "chat") {
      return `<div class="grid">
        <div class="actions experience-toolbar">
          <button class="ghost" data-action="workbench-overview">返回首页</button>
          <button data-action="drawer-worldbook">世界书</button>
          <button data-action="drawer-saves">存档</button>
          ${AS.isQuickStart ? C.badge("快速项目草稿", "warn") : ""}
        </div>
        ${C.chatSurface()}
      </div>${renderDrawer()}`;
    }

    const current = AS.selectedModule || AS.modules?.[0] || null;
    const demo = AS.examples.find(item => item.recommendedForFirstRun) || AS.examples.find(item => item.kind === "playable_demo");
    const reviewCount = AS.reviewItems.length;
    const continueAction = current
      ? `<button class="primary" data-module-id="${U.esc(current.id)}" data-action="load-module-from-list">继续这个世界</button>`
      : `<button class="primary" data-view="experiences">选择一种体验</button>`;

    return `<div class="grid product-home">
      <section class="home-hero">
        <div class="home-hero-copy">
          <span class="eyebrow">你的世界仍在生长</span>
          <h1>${current ? `继续「${U.esc(current.displayName || current.name)}」` : "从一个选择，长出持续的世界"}</h1>
          <p>${current ? `上次停在第 ${current.turnCount || 0} 回合。状态、角色和世界记忆都保存在本机。` : "探索一个示例、与角色相遇，或者把自己的灵感变成可继续的项目。"}</p>
          <div class="actions">${continueAction}${demo ? `<button data-action="install-first-run-demo">从示例开始</button>` : ""}</div>
        </div>
        <aside class="home-hero-status" aria-label="当前状态">
          <span>当前项目</span><strong>${current ? U.esc(current.displayName || current.name) : "尚未选择"}</strong>
          <span>模型</span><strong class="${AS.llmConnected ? "status-good" : "status-attention"}">${AS.llmConnected ? U.esc(AS.config.llmModel || "已连接") : "需要配置"}</strong>
          <span>保存位置</span><strong>本机</strong>
        </aside>
      </section>

      <section class="home-section">
        <div class="section-heading"><div><span class="eyebrow">你今天想做什么？</span><h2>从目标开始</h2></div></div>
        <div class="goal-grid">
          <button class="goal-card goal-card-featured" data-view="experiences">
            <span class="goal-number">01</span><strong>进入一个世界</strong><span>自由探索、解谜或推进一段桌面叙事</span><em>浏览体验 →</em>
          </button>
          <button class="goal-card" data-view="experiences">
            <span class="goal-number">02</span><strong>与人物相遇</strong><span>导入人物卡，开始一段可持续的角色互动</span><em>选择人物互动 →</em>
          </button>
          <button class="goal-card" data-view="creation">
            <span class="goal-number">03</span><strong>使用自己的内容</strong><span>粘贴设定或整理素材，构建你的世界</span><em>前往创作 →</em>
          </button>
        </div>
      </section>

      <section class="home-dashboard">
        <div class="panel home-recent">
          <div class="panel-head"><div><span class="eyebrow">最近</span><h2>你的项目</h2></div><button class="small" data-view="library">查看全部</button></div>
          <div class="home-project-list">${recentProjectRows()}</div>
        </div>
        <aside class="panel home-attention">
          <span class="eyebrow">需要留意</span>
          <h2>${reviewCount ? `${reviewCount} 项待确认` : "一切就绪"}</h2>
          <div class="attention-list">
            <button data-view="library"><span>候选内容</span><strong>${reviewCount}</strong></button>
            <button data-view="settings"><span>模型连接</span><strong>${AS.llmConnected ? "正常" : "未配置"}</strong></button>
            <button data-view="library"><span>世界书条目</span><strong>${AS.worldbookEntries.length}</strong></button>
          </div>
        </aside>
      </section>
    </div>`;
  }

  function experienceCard(id, body) {
    const entry = registry.get(id);
    return `<section class="experience-entry" data-product-entry="${entry.id}">
      <header>
        <div><span class="eyebrow">${U.esc(entry.enName)}</span><h2>${U.esc(entry.name)}</h2></div>
        ${maturityBadge(entry)}
      </header>
      <p>${U.esc(entry.guidance)}</p>
      ${body}
      <small>${U.esc(entry.limitation)}</small>
    </section>`;
  }

  function experiencesView() {
    const demo = AS.examples.find(item => item.recommendedForFirstRun) || AS.examples.find(item => item.kind === "playable_demo");
    return `<div class="grid product-catalog">
      <header class="catalog-intro">
        <div><span class="eyebrow">Experience Library</span><h1>选择一种体验</h1><p>所有体验都会把进度保存在同一个世界工作区中。推荐先从“世界探索”或“人物互动”开始。</p></div>
        ${demo ? `<button class="primary" data-action="install-first-run-demo">先用示例体验</button>` : ""}
      </header>
      <div class="experience-grid">
        ${experienceCard("world-rpg", `<label>世界设定或开场<input id="wrpgTitle" placeholder="项目标题（可选）"><textarea id="wrpgText" placeholder="粘贴世界设定、冒险背景或初始场景。"></textarea></label><div class="actions"><button class="primary" data-action="world-rpg-start">创建世界冒险</button></div>`)}
        ${experienceCard("character", `<label>人物卡<input id="charCardTitle" placeholder="角色名（可选）"><textarea id="charCardText" placeholder="粘贴人物卡 JSON、纯文本或角色描述。"></textarea></label><div class="actions"><button class="primary" data-action="character-start-chat">创建人物互动</button></div>`)}
        ${experienceCard("tabletop", `<label>跑团背景<input id="tabletopTitle" placeholder="项目标题（可选）"><textarea id="tabletopText" placeholder="粘贴背景、规则偏好或开场场景。"></textarea></label><div class="actions"><button class="primary" data-action="tabletop-start">创建桌面叙事</button></div>`)}
        ${experienceCard("mystery-puzzle", `<label>谜题素材<input id="mysteryTitle" placeholder="项目标题（可选）"><textarea id="mysteryText" placeholder="粘贴悬疑场景、线索或谜题片段。"></textarea></label><div class="actions"><button class="primary" data-action="mystery-puzzle-start">创建解谜调查</button></div>`)}
        ${experienceCard("strategy-sim", `<label>策略局势<input id="strategyTitle" placeholder="项目标题（可选）"><textarea id="strategyText" placeholder="粘贴阵营、资源、局势或策略目标。"></textarea></label><div class="actions"><button class="primary" data-action="strategy-sim-start">创建策略模拟</button></div>`)}
        ${experienceCard("murder-mystery", `<label>自有案件内容<input id="murderTitle" placeholder="项目标题（可选）"><textarea id="murderText" placeholder="粘贴案件背景、人物和线索设定。"></textarea></label><div class="actions"><button class="primary" data-action="murder-mystery-start">创建单人剧本杀</button><button class="small" data-action="single-player-scriptkill-v2-toggle-panel">打开 V2 导入</button></div>`)}
      </div>
      ${renderSinglePlayerScriptKillV2Panel()}
    </div>`;
  }

  function creationView() {
    const entry = registry.get("quick-setting");
    const forge = registry.get("creation-forge");
    return `<div class="grid creation-hub">
      <header class="catalog-intro">
        <div><span class="eyebrow">Creation Studio</span><h1>把灵感变成可继续的世界</h1><p>先收集素材，再生成草稿，最后由你审核确认。任何候选内容都不会自动写入正式设定。</p></div>
      </header>
      <section class="creation-steps" aria-label="创作流程">
        <span class="active"><b>1</b>提供素材</span><span><b>2</b>生成草稿</span><span><b>3</b>预览审核</span><span><b>4</b>保存交付</span>
      </section>
      <div class="creation-options">
        <section class="panel creation-primary">
          <div class="panel-head"><div><span class="eyebrow">${entry.enName}</span><h2>${entry.name}</h2><p>${entry.guidance}</p></div>${maturityBadge(entry)}</div>
          <div id="quickStartDrop" class="drop-zone"><strong>拖拽 .md、.txt、.json 到这里</strong><span>文件只在本机读取</span></div>
          <label><span class="field-label">设定、片段或人物描述</span><textarea id="quickStartText" placeholder="例如：一座建立在巨树内部的城市，居民用记忆交换魔法……"></textarea></label>
          <div class="actions"><button class="primary" data-action="quick-start-chat">创建草稿并进入体验</button><span class="tiny muted">${entry.limitation}</span></div>
        </section>
        <aside class="panel creation-forge-card">
          <span class="eyebrow">${forge.enName}</span><h2>${forge.name}</h2>
          <p>${forge.guidance}</p>
          <ol><li>整理素材结构</li><li>预览候选条目</li><li>逐项确认后写入</li></ol>
          <button class="primary" data-action="library-alchemy">打开炼金台</button>
          <small>${forge.limitation}</small>
        </aside>
      </div>
    </div>`;
  }

  Views.workbench = homeView;
  Views.experiences = experiencesView;
  Views.creation = creationView;
})();
