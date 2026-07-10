"use strict";

// Creation, review, observability, settings, and drawer views.
function renderAlchemyG1Panel() {
  const g1 = AS.alchemyG1 || {};
  const caps = g1.capabilities || {};
  const plan = g1.plan;
  const preview = g1.preview;
  const draft = g1.localFolderDraft;
  const targets = caps.deliveryTargets || [
    "world_module",
    "worldbook",
    "character",
    "mechanism",
    "strategy_sim_spec",
    "tabletop_module",
    "detective_case",
    "scriptkill_case",
    "candidate_only"
  ];

  const targetLabels = {
    world_module: "可玩世界",
    worldbook: "世界书",
    character: "角色",
    mechanism: "机制",
    strategy_sim_spec: "策略模拟",
    tabletop_module: "跑团模组",
    detective_case: "推理案件",
    scriptkill_case: "剧本杀案件",
    candidate_only: "只保存候选"
  };

  const selected = new Set(g1.selectedTargets || []);
  const entryMap = plan?.entrypointMap || [];

  return `<section class="panel alchemy-g1-panel">
    <div class="panel-head">
      <div>
        <h2>炼金台 G1：创作闭环</h2>
        <p class="sub">输入简单灵感或完整设定；LLM 推荐功能入口和机制，但最终输出目标由你决定。</p>
      </div>
      ${g1.busy ? C.badge("处理中", "warn") : C.badge("G1", "ok")}
    </div>

    <div class="stack">
      <label>
        <span class="field-label">用户自由补充</span>
        <textarea id="alchemyG1Supplement" maxlength="12000" placeholder="你可以补充偏好，例如：更像开放世界、不要战斗、重点做角色关系、策略玩法要简单。">${U.esc(g1.userSupplement || "")}</textarea>
      </label>

      <div class="actions">
        <button class="primary" data-action="alchemy-g1-plan" ${g1.busy ? "disabled" : ""}>1. 生成创作地图</button>
        <button data-action="alchemy-g1-generate-preview" ${!plan || !selected.size || g1.busy ? "disabled" : ""}>2. 生成内容预览</button>
        <button data-action="alchemy-g1-localize" ${!preview || g1.busy ? "disabled" : ""}>3. 生成本地文件夹草案</button>
        <button class="primary" data-action="alchemy-g1-deliver" ${!draft || !selected.size || g1.busy ? "disabled" : ""}>4. 确认交付</button>
      </div>

      ${g1.error ? C.notice(g1.error, "bad") : ""}

      ${plan ? `<div class="alchemy-section">
        <h3>创作地图</h3>
        <div class="notice ok">${U.esc(plan.summary?.userIntent || plan.summary?.title || "已生成创作地图")}</div>
        <div class="list">${entryMap.map(item => `<div class="item">
          <div class="item-head">
            <strong>${U.esc(item.entrypointId)}</strong>
            ${C.badge(item.recommendation || "optional", item.recommendation === "strong" ? "ok" : item.recommendation === "not_recommended" ? "pending" : "info")}
          </div>
          <p class="tiny muted">${U.esc(item.reason || "")}</p>
          ${item.llmDefault?.brief ? `<p class="tiny">默认方案：${U.esc(item.llmDefault.brief)}</p>` : ""}
          ${(item.mechanismSuggestions || []).length ? `<div class="chip-row">${item.mechanismSuggestions.slice(0, 6).map(m => `<span class="chip">${U.esc(m.label || m.id)}</span>`).join("")}</div>` : ""}
        </div>`).join("")}</div>
      </div>` : C.empty("尚未生成创作地图", "先输入素材/灵感，然后点击生成创作地图。")}

      <div class="alchemy-section">
        <h3>选择最终输出目标</h3>
        <div class="check-grid">
          ${targets.map(target => `<label>
            <input type="checkbox" data-alchemy-g1-target="${U.esc(target)}" ${selected.has(target) ? "checked" : ""}>
            ${U.esc(targetLabels[target] || target)}
          </label>`).join("")}
        </div>
        <p class="tiny muted">LLM 只能推荐；这里必须由用户选择。</p>
      </div>

      ${preview ? `<div class="alchemy-section">
        <h3>内容预览</h3>
        <pre>${U.esc(U.json({
          title: preview.title,
          mode: preview.mode,
          worldbookEntries: preview.worldbookEntries?.length || 0,
          characters: preview.characters?.length || 0,
          mechanisms: preview.mechanismDrafts?.length || 0,
          warnings: preview.warnings || []
        }))}</pre>
      </div>` : ""}

      ${draft ? `<div class="alchemy-section">
        <h3>本地文件夹草案</h3>
        <pre>${U.esc(U.json(draft.summary || draft))}</pre>
      </div>` : ""}

      ${(g1.deliveries || []).length ? `<div class="alchemy-section">
        <h3>最近交付</h3>
        <div class="list">${g1.deliveries.slice(0, 5).map(item => `<div class="item">
          <strong>${U.esc(item.deliveryId || "delivery")}</strong>
          <span class="tiny muted">${U.esc(item.createdAt || "")}</span>
          <pre>${U.esc(U.json(item.targetPaths || []))}</pre>
        </div>`).join("")}</div>
      </div>` : ""}
    </div>
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
  ${renderAlchemyG1Panel()}
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
  const profiles = data.pipelineProfiles?.profiles || [];
  const diag = AS.llmDiagnostics;
  return `<section class="layout-2">
    <div class="panel">
      <div class="panel-head"><h2>连接档案</h2><button class="small" data-action="load-connections">刷新</button></div>
      <div class="list">${(data.items || []).map(c => `<div class="item" data-connection-id="${U.esc(c.id)}"><div class="item-head"><strong>${U.esc(c.label || c.name)}</strong>${C.badge(c.active ? "默认" : "档案", c.active ? "ok" : "pending")}</div><span class="tiny muted">${U.esc(c.provider || "openai-compatible")} · ${U.esc(c.model || "")}</span><div class="chip-row"><span class="chip">temp ${c.temperature ?? "-"}</span><span class="chip">max ${c.maxTokens ?? "-"}</span><span class="chip">top_p ${c.topP ?? "-"}</span><span class="chip">thinking ${U.esc(c.thinking || "auto")}</span>${c.hasApiKey ? `<span class="chip ok">key ${U.esc(c.maskedKey || "saved")}</span>` : `<span class="chip warn">no key</span>`}</div><div class="actions"><button class="small" data-action="set-default-connection">设为默认</button><button class="small" data-action="test-connection">测试</button><button class="small" data-action="duplicate-connection">复制</button><button class="small danger" data-action="delete-connection">删除</button></div></div>`).join("") || C.empty("暂无连接档案")}</div>
      <div class="panel tight" style="margin-top:12px"><h3>叙事档位</h3><div class="list">${profiles.map(p => `<div class="item"><div class="item-head"><strong>${U.esc(p.label)}</strong>${C.badge(p.id === data.pipelineProfiles?.default ? "默认" : "档位", p.id === data.pipelineProfiles?.default ? "ok" : "pending")}</div><div class="chip-row"><span class="chip">质量 ${U.esc(p.quality)}</span><span class="chip">速度 ${U.esc(p.speed)}</span><span class="chip">成本 ${U.esc(p.cost)}</span></div></div>`).join("") || C.empty("暂无叙事档位")}</div></div>
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
      <label>Thinking<select id="connThinking"><option value="auto">Auto</option><option value="disabled">Disabled</option><option value="enabled">Enabled</option></select></label>
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

function renderNarrativeSettings() {
  const data = AS.connections || { pipelineProfiles: { profiles: [] } };
  const profiles = data.pipelineProfiles?.profiles || [];
  return `<section class="grid">
    <div class="layout-2">
      <div class="panel settings-narrative-card">
        <div class="panel-head"><div><h2>叙事设置</h2><p class="sub">选择适合当前故事的质量、速度与成本档位；连接档案仍在“连接”卡中维护。</p></div>${C.badge(data.pipelineProfiles?.default || "默认", "info")}</div>
        <div class="list">${profiles.map(p => `<div class="item"><div class="item-head"><strong>${U.esc(p.label || p.id)}</strong>${C.badge(p.id === data.pipelineProfiles?.default ? "默认" : "可选", p.id === data.pipelineProfiles?.default ? "ok" : "pending")}</div><p class="tiny muted">${U.esc(p.description || "叙事管线档位")}</p><div class="chip-row"><span class="chip">质量 ${U.esc(p.quality || "-")}</span><span class="chip">速度 ${U.esc(p.speed || "-")}</span><span class="chip">成本 ${U.esc(p.cost || "-")}</span></div></div>`).join("") || C.empty("暂无叙事档位", "连接服务返回 pipeline profiles 后会显示在这里。")}</div>
      </div>
      <aside class="panel settings-visual-card">
        <h2>视觉语言</h2>
        <p class="sub">保留纸张、森林绿、手记式工作台气质，并跟随系统深色主题切换。</p>
        <div class="chip-row"><span class="chip">cream paper</span><span class="chip ok">forest green</span><span class="chip">dark theme</span></div>
      </aside>
    </div>
    ${renderDataSettings()}
  </section>`;
}

function renderAdvancedSettingsCard() {
  return `<section class="grid">
    ${ENABLE_DEFERRED_PLUGINS ? renderPlugins() : ""}
    ${renderAdvanced()}
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
  const branches = AS.kernelBranches || AS.kernel?.branches || [];
  const configs = {
    worldbook: ["世界书 · 快速查看", `<div class="list">${C.worldbookRows(8)}</div>`],
    branches: ["分支 · 快速切换", `<div class="list">${branches.map(branch => `<div class="item"><div class="item-head"><strong>${U.esc(branch.label || branch.id)}</strong>${C.badge(branch.id === AS.kernel?.activeBranchId ? "当前" : branch.status || "分支", branch.id === AS.kernel?.activeBranchId ? "ok" : "pending")}</div><span class="tiny muted">${U.esc(branch.description || branch.id || "")}</span><div class="actions"><button class="small ${branch.id === AS.kernel?.activeBranchId ? "primary" : ""}" data-action="kernel-switch-branch" data-branch-id="${U.esc(branch.id)}" ${branch.status === "archived" ? "disabled" : ""}>切换</button>${branch.id && branch.id !== "main" ? `<button class="small" data-action="kernel-diff-branch" data-branch-id="${U.esc(branch.id)}">差异</button>` : ""}</div></div>`).join("") || C.empty("尚未加载分支", "进入世界后会显示主线和候选分支。")}</div>`],
    saves: ["存档 · 快速切换", `<div class="list">${AS.modules.slice(0, 8).map(m => `<div class="item"><strong>${U.esc(m.displayName || m.name)}</strong><span class="tiny muted">${m.turnCount || 0} 回合</span><button class="small" data-module-id="${U.esc(m.id)}" data-action="load-module-from-list">切换</button></div>`).join("")}</div>`]
  };
  const [title, body] = configs[AS.activeDrawer] || configs.saves;
  return `<div class="overlay-backdrop open" data-action="close-drawer"><div class="drawer" onclick="event.stopPropagation()"><div class="overlay-head"><h3>${title}</h3><button data-action="close-drawer">关闭</button></div>${body}</div></div>`;
}
