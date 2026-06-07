import { renderCommand, startupPacket } from "../core/commands.js";
import { moduleKey, moduleTitle } from "../core/normalizers.js";
import { sessionsFor } from "../adapters/hermes.js";
import { PATH_CATALOG } from "../core/path-catalog.js";
import { canUseDirectLlm } from "../adapters/llm.js";
import { injectionPreview, worldbookEntriesFromModel } from "../core/cards.js";
import { defaultSlashCommandRows, slashCommandsFor } from "../core/slash-commands.js";
import { scoreMaterial } from "../core/data/processing-engine.js";
import { t } from "./i18n.js";

export const TABS = [
  ["game", "game"],
  ["archives", "archives"],
  ["settings", "settings"],
  ["monitor", "monitor"]
];

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function badge(text, kind = "info") {
  return `<span class="badge ${kind}">${esc(text)}</span>`;
}

export function empty(text) {
  return `<div class="empty">${esc(text)}</div>`;
}

function panel(title, body, sub = "") {
  return `<section class="panel"><div class="panel-head"><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${body}</section>`;
}

function returnHomeBar() {
  return "";
}

function jsonBlock(value) {
  return `<pre>${esc(JSON.stringify(value || {}, null, 2))}</pre>`;
}

export function renderTabs(activeTab, config) {
  return TABS.map(([id, labelKey]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${esc(t(config, labelKey))}</button>`).join("");
}

export function renderModules(model, config) {
  if (!model.modules.length) return `<div class="module-empty">${esc(t(config, "noWorldsLoaded"))}</div>`;
  return model.modules.map((module) => `
    <button class="module-card ${model.selected && moduleKey(model.selected) === moduleKey(module) ? "active" : ""}" data-module-key="${esc(moduleKey(module))}">
      <strong>${esc(moduleTitle(module))}</strong>
      <span>${esc(module.path)} / ${esc(module.branch || "main")}</span>
    </button>
  `).join("");
}

function secretAvailable(secrets) {
  return Boolean(secrets?.llm?.items?.some((item) => item.active && item.masked));
}

function activeSecretLabel(secrets, config) {
  const active = secrets?.llm?.items?.find((item) => item.active);
  if (!active) return t(config, "noSecret");
  return `${active.label} ${active.masked ? `(${active.masked})` : ""}`;
}

function ornament(name, alt = "") {
  return `<img class="ui-ornament ${esc(name)}" src="./assets/ornaments/${esc(name)}@1x.png" srcset="./assets/ornaments/${esc(name)}@1x.png 1x, ./assets/ornaments/${esc(name)}@2x.png 2x, ./assets/ornaments/${esc(name)}@3x.png 3x" alt="${esc(alt)}" aria-hidden="${alt ? "false" : "true"}">`;
}

function worldPulseSnapshot(engineState = {}) {
  return engineState.telemetrySnapshot || engineState.telemetry?.snapshot || engineState.lastTurn?.telemetry?.snapshot || null;
}

function pulseRows(snapshot) {
  const dimensions = snapshot?.dimensions || {};
  const preferred = [
    ["stability", "稳定度"],
    ["chaos", "混乱度"],
    ["mystery", "神秘度"],
    ["war_risk", "战争风险"],
    ["character_stress", "角色压力"],
    ["faction_conflict", "阵营冲突"],
    ["rule_integrity", "规则完整度"],
    ["memory_load", "记忆负载"]
  ];
  const rows = preferred
    .map(([id, fallback]) => [id, dimensions[id]])
    .filter(([, item]) => item)
    .map(([id, item]) => ({
      id,
      name: item.name || preferred.find(([key]) => key === id)?.[1] || id,
      value: Math.max(0, Math.min(100, Number(item.value) || 0)),
      status: item.status || "normal"
    }));
  return rows;
}

function renderPulseCards(snapshot) {
  const rows = pulseRows(snapshot);
  if (!rows.length) {
    return `<div class="pulse-empty">
      <strong>等待世界脉象</strong>
      <span>开始一轮互动后，终端会从已有世界状态读取稳定度、战争风险、角色压力等读数。</span>
    </div>`;
  }
  return `<div class="pulse-grid">${rows.map((item) => `
    <article class="pulse-card ${esc(item.status)}">
      <div><strong>${esc(item.name)}</strong><span>${esc(item.status)}</span></div>
      <b>${esc(item.value)}</b>
      <i style="--value:${esc(item.value)}%"></i>
    </article>
  `).join("")}</div>`;
}

function renderPageShell(title, subtitle, body, className = "") {
  return `<section class="wt-page ${esc(className)}">
    <div class="wt-page-ornament top-left" aria-hidden="true"></div>
    <div class="wt-page-ornament bottom-right" aria-hidden="true"></div>
    <div class="wt-page-head">
      <div>
        <span class="leaf-kicker">${ornament("leaf-icon")} World Tree</span>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
      </div>
      <button class="return-home-action page-head-return" data-return-home>${ornament("leaf-icon")}<span>主菜单</span></button>
    </div>
    ${body}
  </section>`;
}

function cardKindLabel(kind, config) {
  if (kind === "dm-card") return t(config, "dmCard");
  if (kind === "character-card") return t(config, "characterCard");
  if (kind === "worldbook-card") return t(config, "worldbookCard");
  return t(config, "unknownCard");
}

export function renderHome(state) {
  const config = state.config;
  const ready = canUseDirectLlm(config, secretAvailable(state.secrets));
  const worldName = state.model.selected ? moduleTitle(state.model.selected) : "等待选择世界";
  const moduleCount = state.model.modules?.length || 0;
  const archiveCount = state.model.moduleData?.archives?.length || 0;
  const actions = [
    ["homeStartBtn", "leaf-icon", "开始旅程", "进入当前世界，开始对话与推进剧情。", "primary"],
    ["homeLoadBtn", "memory-book", "读取记忆", "查看存档、会话记录与世界书。", ""],
    ["homeSettingsBtn", "world-setting", "世界设定", "调整模型连接、叙事模式与素材库。", ""],
    ["homeMonitorBtn", "observatory", "观测终端", "查看世界脉象、提案与运行状态。", ""]
  ];

  return `<section class="home-screen">
    <div class="home-scene" aria-hidden="true">
      <div class="home-layer sky"></div>
      <div class="home-layer canopy"></div>
      <div class="home-layer water"></div>
      <div class="home-layer grass"></div>
      <div class="home-layer hair"></div>
      <div class="home-layer dress"></div>
      <div class="home-wind"></div>
      <div class="home-leaves"></div>
    </div>
    <div class="home-veil"></div>
    <div class="home-menu">
      <div class="home-brand-mark">${ornament("world-tree-badge", "World Tree")}</div>
      <div class="home-title">
        <span>WORLD TREE</span>
        <strong>${esc(worldName)}</strong>
      </div>
      <div class="home-actions">
        ${actions.map(([id, icon, label, hint, kind]) => `
          <button id="${esc(id)}" class="home-action ${esc(kind)}">
            ${ornament(icon, label)}
            <span>${esc(label)}</span>
            <small>${esc(hint)}</small>
          </button>
        `).join("")}
      </div>
      <div class="home-footer">
        <span>世界 ${esc(moduleCount)}</span>
        <span>记忆 ${esc(archiveCount)}</span>
        <span class="${ready ? "online" : "offline"}">LLM LINK ${esc(ready ? "ONLINE" : "OFFLINE")}</span>
      </div>
    </div>
  </section>`;
}

export function renderGame(model, config, messages = [], personaLoaded = false, secrets = {}, injected = [], engineState = {}) {
  const ready = canUseDirectLlm(config, secretAvailable(secrets));
  const title = model.selected ? moduleTitle(model.selected) : t(config, "untitledSession");
  const snapshot = worldPulseSnapshot(engineState);
  const context = snapshot ? `世界脉象 ${snapshot.overall ?? "--"} / ${snapshot.overallStatus || "normal"}` : "沉浸对话";
  const log = messages.length ? messages.map((msg) => `
        <div class="chat-msg ${esc(msg.role)}">
          <strong>${esc(msg.role === "assistant" ? t(config, "dm") : msg.role === "user" ? t(config, "you") : msg.role)}</strong>
          <p>${esc(msg.content)}</p>
        </div>
      `).join("") : `<div class="dialogue-empty"><strong>世界树正在等待你的第一句话</strong><span>输入一个行动、问题或场景意图，导演会根据当前世界状态继续推进。</span></div>`;

  return `<div class="dialogue-shell">
    <div class="dialogue-aura"></div>
    <div class="dialogue-particles" aria-hidden="true"></div>
    <div class="dialogue-corner left" aria-hidden="true"></div>
    <div class="dialogue-corner right" aria-hidden="true"></div>
    <button id="returnHomeFloatBtn" class="return-home-float">${ornament("leaf-icon")}<span>主菜单</span></button>
    <section class="dialogue-panel">
      <div class="dialogue-topbar">
        <div class="dialogue-title">
          ${ornament("world-tree-badge")}
          <div>
          <strong>${esc(title)}</strong>
          <span>${esc(context)}</span>
          </div>
        </div>
        <div class="meta quiet">${badge(ready ? t(config, "llmReady") : t(config, "llmOff"), ready ? "ok" : "warn")}${personaLoaded ? badge(t(config, "dmLoaded"), "ok") : badge(t(config, "noPersona"), "warn")}${injected.length ? badge(`${injected.length} ${t(config, "worldbook")}`, "purple") : ""}</div>
      </div>

      <div class="chat-log dialogue-log">${log}</div>

      <div class="composer dialogue-composer">
        <div class="composer-row">
          <textarea id="gameInput" placeholder="${esc(t(config, "playerPlaceholder"))}" ${ready ? "" : "disabled"}></textarea>
          <button id="sendGameBtn" class="primary icon-send" ${ready ? "" : "disabled"}>${ornament("send-arrow", t(config, "send"))}<span>${esc(t(config, "send"))}</span></button>
        </div>
        <details class="settings-drawer compact-drawer">
          <summary>${esc("模型连接")}</summary>
          <div class="settings-grid">
            <label>${esc(t(config, "baseUrl"))}<input id="llmBaseUrl" value="${esc(config.llmBaseUrl || "")}" placeholder="https://api.openai.com/v1"></label>
            <label>${esc(t(config, "model"))}<input id="llmModel" value="${esc(config.llmModel || "")}" placeholder="gpt-4.1"></label>
            <label>${esc(t(config, "apiKey"))}<input id="llmApiKey" type="password" value="" placeholder="sk-..."></label>
            <div class="secret-note"><strong>${esc(t(config, "activeSecret"))}</strong><span>${esc(activeSecretLabel(secrets, config))}</span><small>${esc(t(config, "keyStoredApart"))}</small></div>
            <button id="saveLlmSettingsBtn">${esc(t(config, "save"))}</button>
          </div>
        </details>
      </div>
    </section>
  </div>`;
}

function modeDescription
(config, mode) {
  if (mode === "character_card") return t(config, "modeCharacterDesc");
  if (mode === "preset") return t(config, "modePresetDesc");
  return t(config, "modeWorldbookDesc");
}

export function renderModeSettings(state) {
  const config = state.config;
  const mode = state.engineState?.dataMode || "worldbook";
  const dm = state.engineState?.directorMode || "hybrid";
  const dmLabels = { js: "纯 JS", hybrid: "混合(LLM分析)", llm: "LLM Director" };
  const dmDescs = {
    js: "纯 JavaScript 方向包，零 LLM 消耗。适合快速响应和低 Token 场景。",
    hybrid: "轻量 LLM 分析(150-250t)语义+情绪弦外音，JS 守卫做冷却/缓存等确定计算。性价比最高。",
    llm: "完整 LLM 调用生成 JSON 方向包。最深度叙事理解，消耗更高 Token。解析失败自动回退 JS。"
  };
  return panel(t(config, "engineSettings"), `
    <div class="settings-grid mode-grid">
      <label>${esc(t(config, "dataMode"))}
        <select id="dataModeSelect">
          <option value="worldbook" ${mode === "worldbook" ? "selected" : ""}>${esc(t(config, "worldbook"))}</option>
          <option value="character_card" ${mode === "character_card" ? "selected" : ""}>${esc(t(config, "characterCardMode"))}</option>
          <option value="preset" ${mode === "preset" ? "selected" : ""}>${esc(t(config, "presetMode"))}</option>
        </select>
      </label>
      <label>${esc("Director")}
        <select id="directorModeSelect">
          <option value="js" ${dm === "js" ? "selected" : ""}>${esc(dmLabels.js)}</option>
          <option value="hybrid" ${dm === "hybrid" ? "selected" : ""}>${esc(dmLabels.hybrid)}</option>
          <option value="llm" ${dm === "llm" ? "selected" : ""}>${esc(dmLabels.llm)}</option>
        </select>
      </label>
      <label>${esc("叙事者")}
        <select id="storytellerSelect">
          <optgroup label="基础">
            <option value="classic" ${(state.engineState?.storyteller||"classic")==="classic"?"selected":""}>稳定剧作家</option>
            <option value="gentle" ${state.engineState?.storyteller==="gentle"?"selected":""}>温柔看护者</option>
            <option value="cruel" ${state.engineState?.storyteller==="cruel"?"selected":""}>残酷命运</option>
            <option value="mystery" ${state.engineState?.storyteller==="mystery"?"selected":""}>悬疑织网者</option>
            <option value="chaos" ${state.engineState?.storyteller==="chaos"?"selected":""}>疯狂骰子</option>
          </optgroup>
          <optgroup label="高级">
            <option value="epic" ${state.engineState?.storyteller==="epic"?"selected":""}>史诗编年史家</option>
            <option value="intimate" ${state.engineState?.storyteller==="intimate"?"selected":""}>角色导演</option>
            <option value="adventure" ${state.engineState?.storyteller==="adventure"?"selected":""}>冒险主持人</option>
          </optgroup>
        </select>
      </label>
      <label>${esc(t(config, "model"))}<input id="enginePresetInput" value="${esc(state.engineState?.preset || "epic")}"></label>
      <label>${esc("Context")}<input id="engineBudgetInput" value="${esc(state.engineState?.contextBudget || "balanced")}"></label>
      <button id="saveEngineModeBtn" class="primary">${esc(t(config, "save"))}</button>
    </div>
    <div class="notice">${esc(modeDescription(config, mode))}</div>
    <div class="meta">${badge(`Director: ${dmLabels[dm]}`, "purple")}${badge(`overlay: data/engine/runs/${mode}`, "purple")}${badge((state.engineState?.activeModules || []).join(", "))}</div>
    <p class="hint">${esc(dmDescs[dm] || "")}</p>
  `);
}

export function renderCards(cards = [], config) {
  const body = cards.length ? cards.map((card) => {
    const detail = card.kind === "character-card"
      ? [card.description, card.personality, card.scenario].filter(Boolean).join("\n\n").slice(0, 1200)
      : card.kind === "dm-card"
        ? (card.personaText || "").slice(0, 1200)
        : card.kind === "worldbook-card"
          ? `${card.entries?.length || 0} ${t(config, "worldbookEntries")}`
          : JSON.stringify(card.raw || {}, null, 2).slice(0, 1200);
    return `<article class="item">
      <div class="item-head">
        <div>
          <div class="item-title">${esc(card.name)}</div>
          <div class="meta">${badge(cardKindLabel(card.kind, config), card.kind === "unknown-card" ? "warn" : "purple")}</div>
        </div>
        ${card.kind === "dm-card" ? `<button data-use-dm-card="${esc(card.id)}">${esc(t(config, "useDmCard"))}</button>` : ""}
      </div>
      ${card.source ? `<div class="kv"><span>${esc(t(config, "importedSource"))}</span><strong>${esc(card.source)}</strong></div>` : ""}
      <pre>${esc(detail)}</pre>
    </article>`;
  }).join("") : empty(t(config, "noCards"));
  return `<div class="toolbar-inline"><button id="importCardBtn" class="primary">${esc(t(config, "importCard"))}</button></div><div class="list">${body}</div>`;
}

export function renderWorldbook(model, config, worldbookState = {}, previewInput = "") {
  const entries = worldbookEntriesFromModel(model, worldbookState);
  const preview = injectionPreview(entries, previewInput);
  const list = entries.length ? entries.map((entry) => `
    <article class="item worldbook-entry">
      <div class="item-head">
        <div>
          <div class="item-title">${esc(entry.title)}</div>
          <div class="meta">${badge(entry.enabled ? t(config, "enabled") : t(config, "disabled"), entry.enabled ? "ok" : "warn")}${badge(String(entry.priority))}</div>
        </div>
        <button data-toggle-worldbook="${esc(entry.id)}" data-enabled="${entry.enabled ? "1" : "0"}">${esc(entry.enabled ? t(config, "disabled") : t(config, "enabled"))}</button>
      </div>
      <div class="kv"><span>${esc(t(config, "triggerKeys"))}</span><strong>${esc((Array.isArray(entry.keys) ? entry.keys : [entry.keys]).filter(Boolean).join(", ") || "always")}</strong></div>
      <p>${esc(entry.content || "")}</p>
    </article>
  `).join("") : empty(t(config, "noWorldbook"));

  const previewBody = preview.length ? preview.map((entry) => `
    <article class="item compact">
      <div class="item-title">${esc(entry.title)}</div>
      <div class="meta">${(entry.matched || []).map((key) => badge(key, "ok")).join("")}</div>
      <p>${esc(entry.content || "")}</p>
    </article>
  `).join("") : empty(t(config, "noInjection"));

  return `<div class="grid two">
    ${panel(t(config, "worldbookEntries"), `<div class="list">${list}</div>`)}
    ${panel(t(config, "injectionPreview"), `
      <textarea id="worldbookPreviewInput" placeholder="${esc(t(config, "previewInput"))}">${esc(previewInput)}</textarea>
      <div class="actions"><button id="worldbookPreviewBtn">${esc(t(config, "preview"))}</button></div>
      <div class="list">${previewBody}</div>
    `)}
  </div>`;
}

export function renderOverview(model, config) {
  if (!model.loaded) return empty(t(config, "openWorldHint"));
  const module = model.selected;
  const data = model.moduleData;
  return `
    <div class="stat-grid">
      <div class="stat"><strong>${model.modules.length}</strong><span>${esc(t(config, "worlds"))}</span></div>
      <div class="stat"><strong>${model.fileCount}</strong><span>${esc(t(config, "files"))}</span></div>
      <div class="stat"><strong>${data?.archives.length || 0}</strong><span>${esc(t(config, "archives"))}</span></div>
      <div class="stat"><strong>${model.warnings.length}</strong><span>${esc(t(config, "warnings"))}</span></div>
    </div>
    <div class="grid two">
      ${panel(t(config, "currentWorld"), module ? `
        <div class="kv"><span>${esc(t(config, "name"))}</span><strong>${esc(moduleTitle(module))}</strong></div>
        <div class="kv"><span>${esc(t(config, "path"))}</span><strong>${esc(module.path)}</strong></div>
        <div class="kv"><span>${esc(t(config, "branch"))}</span><strong>${esc(module.branch || "main")}</strong></div>
        <div class="actions"><button data-copy="${esc(`/引擎 load ${module.name || module.id || module.path}`)}">${esc(t(config, "copyLoad"))}</button></div>
      ` : empty(t(config, "noWorldSelected")))}
      ${panel("Index", jsonBlock(model.index))}
      ${panel(t(config, "warnings"), model.warnings.length ? model.warnings.map((item) => `<div class="notice warn"><strong>${esc(item.path)}</strong><br>${esc(item.message)}</div>`).join("") : `<div class="notice ok">${esc(t(config, "noParseWarnings"))}</div>`)}
    </div>
  `;
}

export function renderCharacters(model, config) {
  const items = model.moduleData?.characters || [];
  if (!items.length) return empty(t(config, "noCharacterState"));
  return `<div class="list">${items.map((item) => `
    <article class="item">
      <div class="item-title">${esc(item.name)}</div>
      <div class="meta">${badge(item.role || "role", "purple")}${badge(item.status || "status", "info")}${item.location ? badge(item.location, "ok") : ""}</div>
      <p>${esc(item.summary || t(config, "noSummary"))}</p>
    </article>
  `).join("")}</div>`;
}

export function renderScenes(model, config) {
  const items = model.moduleData?.scenes || [];
  if (!items.length) return empty(t(config, "noSceneChain"));
  return `<div class="timeline">${items.map((item) => `
    <article class="item">
      <div class="item-title">${esc(item.title)}</div>
      <div class="meta">${item.time ? badge(item.time) : ""}${item.location ? badge(item.location, "ok") : ""}</div>
      <p>${esc(item.summary || t(config, "noSummary"))}</p>
    </article>
  `).join("")}</div>`;
}

export function renderState(model, config) {
  const data = model.moduleData;
  if (!data) return empty(t(config, "noWorldSelected"));
  return `<div class="grid two">
    ${panel("Canon", jsonBlock(data.canon))}
    ${panel("Runtime", jsonBlock(data.runtime))}
    ${panel("World State", jsonBlock(data.worldState))}
    ${panel("Organizations", jsonBlock(data.organizations))}
    ${panel("Cognition", jsonBlock(data.cognition))}
    ${panel("Rules", jsonBlock(data.rules))}
  </div>`;
}

export function renderTracking(model, config) {
  const items = model.moduleData?.tracking || [];
  return `<div class="grid two">${items.map((item) => panel(item.name, `<div class="meta">${badge(`${item.count} entries`)}</div><pre>${esc(item.preview)}</pre>`)).join("")}</div>`;
}

export function renderBranches(model, config) {
  const branches = model.moduleData?.branches || [];
  if (!branches.length) return empty(t(config, "noBranchData"));
  return `<div class="list">${branches.map((branch) => `
    <article class="item">
      <div class="item-head">
        <div><div class="item-title">${esc(branch.id)}</div><div class="meta">${branch.active ? badge(t(config, "active"), "ok") : badge(t(config, "available"))}</div></div>
        <button data-copy="${esc(`/分支 switch ${branch.id}`)}">${esc(t(config, "copySwitch"))}</button>
      </div>
      <pre>${esc(JSON.stringify(branch.canon || {}, null, 2).slice(0, 1400))}</pre>
    </article>
  `).join("")}</div>`;
}

export function renderArchives(model, config, engineState = {}) {
  const archives = model.moduleData?.archives || [];
  const mode = engineState.dataMode || "worldbook";
  const header = `<div class="notice soft">当前记忆库：${esc(mode)}。技术路径已收起，普通使用时不需要处理。</div>`;
  const body = !archives.length ? `${header}${empty(t(config, "noArchives"))}` : `${header}<div class="list archive-list">${archives.map((item) => `
    <article class="item">
      <div class="item-title">${esc(item.title)}</div>
      <div class="meta">${badge(item.name)}${item.createdAt ? badge(item.createdAt, "ok") : ""}</div>
      <p>${esc(item.summary || t(config, "noSummary"))}</p>
      <details><summary>${esc(t(config, "rawJson"))}</summary><pre>${esc(item.raw.slice(0, 3000))}</pre></details>
    </article>
  `).join("")}</div>`;
  return renderPageShell("读取记忆", "存档、会话记录与世界书会在这里归档。", body, "archive-page");
}

export function renderCommands(model, config, powerUser = {}) {
  const commands = slashCommandsFor(powerUser);
  return `<div class="grid two">${commands.map((item) => {
    const command = renderCommand(item.command, model);
    return panel(`${item.group} / ${item.label}`, `<div class="meta">${badge(item.source === "user" ? t(config, "userSource") : t(config, "defaultSource"), item.source === "user" ? "purple" : "info")}</div><pre>${esc(command)}</pre><div class="actions"><button data-copy="${esc(command)}">${esc(t(config, "copy"))}</button></div>`);
  }).join("")}</div>`;
}

function pathRows(paths = {}, config) {
  const rows = [
    [t(config, "defaultContent"), paths.defaultContentRoot],
    [t(config, "userData"), paths.userData],
    [t(config, "normalConfig"), paths.config],
    [t(config, "secret"), paths.secrets],
    [t(config, "powerSettings"), paths.powerUser],
    [t(config, "engineProfile"), paths.embeddedEngine],
    [t(config, "worldbook"), paths.worldbookState],
    [t(config, "cardLibrary"), paths.cardLibrary]
  ];
  return rows.map(([label, value]) => `<div class="kv"><span>${esc(label)}</span><strong>${esc(value || "")}</strong></div>`).join("");
}

export function renderPowerUser(powerUser = {}, config) {
  const defaults = defaultSlashCommandRows(powerUser);
  const userCommands = powerUser.slashCommands?.userCommands || [];
  const draft = powerUser.userCommandsDraft ?? JSON.stringify(userCommands, null, 2);
  const disabledCount = defaults.filter((item) => !item.enabled).length;
  const engineManifest = powerUser.engineManifest || {};
  return `<div class="grid two">
    ${panel(t(config, "dataBoundaries"), `
      <div class="notice">${esc(t(config, "boundaryNote"))}</div>
      ${pathRows(powerUser.paths || {}, config)}
    `)}
    ${panel(t(config, "powerUser"), `
      <div class="stat-grid mini">
        <div class="stat"><strong>${slashCommandsFor(powerUser).length}</strong><span>${esc(t(config, "commandCount"))}</span></div>
        <div class="stat"><strong>${disabledCount}</strong><span>${esc(t(config, "disabledDefaults"))}</span></div>
        <div class="stat"><strong>${engineManifest.count || 0}</strong><span>${esc(t(config, "engineFiles"))}</span></div>
        <div class="stat"><strong>${engineManifest.fulltextCount || 0}</strong><span>${esc(t(config, "fulltextFiles"))}</span></div>
      </div>
      <div class="actions"><button id="resetSlashDraftBtn">${esc(t(config, "resetDraft"))}</button><button id="saveSlashCommandsBtn" class="primary">${esc(t(config, "saveCommands"))}</button></div>
    `)}
    ${panel(t(config, "defaultSlashCommands"), `<div class="list">${defaults.map((item) => `
      <article class="item compact">
        <div class="item-head">
          <div>
            <div class="item-title">${esc(item.group)} / ${esc(item.label)}</div>
            <div class="meta">${badge(item.id)}${badge(item.enabled ? t(config, "enabled") : t(config, "disabled"), item.enabled ? "ok" : "warn")}</div>
          </div>
          <button data-toggle-slash-default="${esc(item.id)}" data-enabled="${item.enabled ? "1" : "0"}">${esc(item.enabled ? t(config, "disabled") : t(config, "enabled"))}</button>
        </div>
        <pre>${esc(item.command)}</pre>
      </article>
    `).join("")}</div>`)}
    ${panel(t(config, "userSlashCommands"), `
      <textarea id="userSlashCommandsInput" class="code-input" placeholder="${esc(t(config, "addSlashCommandHint"))}">${esc(draft)}</textarea>
      ${userCommands.length ? `<div class="list">${userCommands.map((item) => `<article class="item compact"><div class="item-title">${esc(item.group)} / ${esc(item.label)}</div><pre>${esc(item.command)}</pre></article>`).join("")}</div>` : empty(t(config, "noUserCommands"))}
    `)}
  </div>`;
}

export function renderSettings(state) {
  const config = state.config;
  const mode = state.engineState?.dataMode || "worldbook";
  const modeWorldbookState = state.worldbookState?.modes?.[mode] || {};
  const mergedWorldbookState = {
    ...(state.worldbookState || {}),
    ...modeWorldbookState,
    disabled: { ...(modeWorldbookState.disabled || {}) },
    importedEntries: (state.cards || []).flatMap((card) => card.kind === "worldbook-card" ? (card.entries || []) : [])
  };
  const body = `<div class="settings-layout">
    <aside class="settings-rail">
      <button class="active" data-settings-section="general">${ornament("leaf-icon")} 通用</button>
      <button data-settings-section="model">${ornament("world-setting")} 模型</button>
      <button data-settings-section="memory">${ornament("memory-book")} 记忆</button>
      <button data-settings-section="atelier">${ornament("send-arrow")} 工坊</button>
      <button data-settings-section="advanced">${ornament("observatory")} 高级</button>
    </aside>
    <div class="settings-content">
      <section class="settings-section active" data-settings-panel="general">
        ${panel("旅程模式", `
          <div class="settings-grid">
            <label>${esc(t(config, "dataMode"))}
              <select id="dataModeSelect">
                <option value="worldbook" ${mode === "worldbook" ? "selected" : ""}>${esc(t(config, "worldbook"))}</option>
                <option value="character_card" ${mode === "character_card" ? "selected" : ""}>${esc(t(config, "characterCardMode"))}</option>
                <option value="preset" ${mode === "preset" ? "selected" : ""}>${esc(t(config, "presetMode"))}</option>
              </select>
            </label>
            <label>${esc("导演模式")}
              <select id="directorModeSelect">
                <option value="js" ${(state.engineState?.directorMode || "hybrid") === "js" ? "selected" : ""}>轻量本地</option>
                <option value="hybrid" ${(state.engineState?.directorMode || "hybrid") === "hybrid" ? "selected" : ""}>混合导演</option>
                <option value="llm" ${(state.engineState?.directorMode || "hybrid") === "llm" ? "selected" : ""}>深度导演</option>
              </select>
            </label>
            <label>${esc("叙事者")}
              <select id="storytellerSelect">
                <option value="classic" ${(state.engineState?.storyteller||"classic")==="classic"?"selected":""}>稳定剧作家</option>
                <option value="gentle" ${state.engineState?.storyteller==="gentle"?"selected":""}>温柔看护者</option>
                <option value="cruel" ${state.engineState?.storyteller==="cruel"?"selected":""}>残酷命运</option>
                <option value="mystery" ${state.engineState?.storyteller==="mystery"?"selected":""}>悬疑织网者</option>
                <option value="chaos" ${state.engineState?.storyteller==="chaos"?"selected":""}>疯狂骰子</option>
                <option value="epic" ${state.engineState?.storyteller==="epic"?"selected":""}>史诗编年史家</option>
              </select>
            </label>
            <label>${esc(t(config, "model"))}<input id="enginePresetInput" value="${esc(state.engineState?.preset || "epic")}"></label>
            <label>${esc("Context")}<input id="engineBudgetInput" value="${esc(state.engineState?.contextBudget || "balanced")}"></label>
            <button id="saveEngineModeBtn" class="primary">${esc(t(config, "save"))}</button>
          </div>
          <div class="notice soft">${esc(modeDescription(config, mode))}</div>
        `)}
      </section>
      <section class="settings-section" data-settings-panel="model">
        ${panel("模型连接", `
          <div class="settings-grid">
            <label>${esc("服务地址")}<input id="llmBaseUrl" value="${esc(config.llmBaseUrl || "")}" placeholder="https://api.openai.com/v1"></label>
            <label>${esc(t(config, "model"))}<input id="llmModel" value="${esc(config.llmModel || "")}" placeholder="gpt-4.1"></label>
            <label>${esc("访问密钥")}<input id="llmApiKey" type="password" value="" placeholder="sk-..."></label>
            <div class="secret-note"><strong>${esc(t(config, "activeSecret"))}</strong><span>${esc(activeSecretLabel(state.secrets, config))}</span><small>${esc(t(config, "keyStoredApart"))}</small></div>
            <button id="saveLlmSettingsBtn">${esc(t(config, "save"))}</button>
          </div>
        `)}
      </section>
      <section class="settings-section" data-settings-panel="memory">
      ${panel("世界内容", `
      <details open><summary>${esc(t(config, "worldbook"))}</summary>${renderWorldbook(state.model, config, {
        ...mergedWorldbookState
      }, state.worldbookPreviewInput)}</details>
      <details><summary>${esc(t(config, "cards"))}</summary>${renderCards(state.cards || [], config)}</details>
      `)}
      </section>
      <section class="settings-section" data-settings-panel="atelier">
        ${panel("素材整理工坊", renderProcessing(config, state.processingInput || ""))}
      </section>
      <section class="settings-section" data-settings-panel="advanced">
        <details class="expert-drawer" open><summary>高级与指令库</summary>${renderPowerUser(state.powerUser || {}, config)}${renderCommands(state.model, config, state.powerUser)}</details>
        <details class="expert-drawer"><summary>数据边界与帮助</summary>${renderPaths(config)}${renderHelp(state)}</details>
      </section>
    </div>
  </div>`;
  return renderPageShell("世界设定", "只把玩家会频繁调整的内容放在表面，工程细节收进高级区。", body, "settings-page");
}

export function renderMonitor(state) {
  const config = state.config;
  const snapshot = worldPulseSnapshot(state.engineState);
  const body = `<div class="monitor-layout">
    ${panel("世界脉象", `
      <div class="pulse-summary">
        ${ornament("observatory")}
        <div><strong>${esc(snapshot?.overall ?? "--")}</strong><span>${esc(snapshot?.overallStatus || "等待刷新")}</span></div>
      </div>
      ${renderPulseCards(snapshot)}
      ${snapshot?.hints?.length ? `<div class="notice soft">${esc(snapshot.hints.join(" / "))}</div>` : ""}
    `)}
    ${panel("叙事视窗", `<div class="grid two">${renderOverview(state.model, config)}${renderCharacters(state.model, config)}${renderScenes(state.model, config)}${renderState(state.model, config)}</div>`)}
    ${panel("世界变更", `<div class="grid two">${renderTracking(state.model, config)}${renderBranches(state.model, config)}</div>`)}
    <details class="expert-drawer"><summary>系统诊断</summary>
      <div class="stat-grid mini">
        <div class="stat"><strong>${esc(state.engineState?.dataMode || "worldbook")}</strong><span>${esc(t(config, "dataMode"))}</span></div>
        <div class="stat"><strong>${esc(state.engineState?.status || "idle")}</strong><span>Engine</span></div>
        <div class="stat"><strong>${esc((state.engineState?.activeModules || []).length)}</strong><span>Modules</span></div>
        <div class="stat"><strong>${esc(state.lastInjectedWorldbook?.length || 0)}</strong><span>${esc(t(config, "worldbook"))}</span></div>
      </div>
      ${renderHealth(state.healthReport, state.hermesStatus, config)}
    </details>
  </div>`;
  return renderPageShell("观测终端", "观察这个世界正在发生什么，而不是让技术信息占据主视图。", body, "monitor-page");
}

export function renderProcessing(config, material = "") {
  const report = material ? scoreMaterial(material) : [];
  return `<div class="grid two">
    ${panel(t(config, "processingEngine"), `
      <textarea id="processingInput" class="code-input" placeholder="${esc(t(config, "materialInput"))}">${esc(material)}</textarea>
      <div class="actions"><button id="runProcessingBtn" class="primary">${esc(t(config, "runProcessing"))}</button></div>
    `)}
    ${panel(t(config, "report"), report.length ? `<div class="list">${report.map((item) => `
      <article class="item compact"><div class="item-title">${esc(item.step)}. ${esc(item.name)}</div><div class="meta">${badge(String(item.score), item.score >= 28 ? "ok" : "warn")}</div><p>${esc(item.notes)}</p></article>
    `).join("")}</div>` : empty(t(config, "noReport")))}
  </div>`;
}

export function renderHelp(state) {
  const config = state.config;
  const manifest = state.engineManifest || {};
  return `<div class="grid two">
    ${panel(t(config, "helpCenter"), `<div class="notice">${esc(t(config, "helpText"))}</div>
      <div class="kv"><span>${esc(t(config, "engineProfile"))}</span><strong>${esc(manifest.root || "")}</strong></div>
      <div class="kv"><span>${esc(t(config, "fulltextFiles"))}</span><strong>${esc(manifest.fulltextCount || 0)}</strong></div>
      <div class="kv"><span>${esc(t(config, "engineFiles"))}</span><strong>${esc(manifest.count || 0)}</strong></div>
    `)}
    ${panel(t(config, "commands"), `<pre>${esc(JSON.stringify((state.powerUser || {}).slashCommands || {}, null, 2))}</pre>`)}
  </div>`;
}

export function renderPaths(config) {
  return `<div class="grid two">${PATH_CATALOG.map((item) => panel(item.label, `
    <div class="meta">${badge(item.kind, "purple")}</div>
    <pre>${esc(item.path)}</pre>
    <p>${esc(item.description)}</p>
    <div class="actions"><button data-copy="${esc(item.path)}">${esc(t(config, "copyPath"))}</button></div>
  `)).join("")}</div>`;
}

export function renderChat(model, config, messages = []) {
  const sessions = sessionsFor(model);
  const disabled = !config.hermesBaseUrl || !model.selected;
  return `<div class="chat-layout">
    <section class="panel chat-main">
      <div class="panel-head">
        <h3>Hermes</h3>
        <p>${disabled ? esc(t(config, "noHermesSession")) : esc(config.hermesBaseUrl)}</p>
      </div>
      <div class="chat-log">${messages.length ? messages.map((msg) => `<div class="chat-msg ${esc(msg.role)}"><strong>${esc(msg.role)}</strong><p>${esc(msg.content)}</p></div>`).join("") : ""}</div>
      <textarea id="chatInput" placeholder="${esc(t(config, "messageHermes"))}" ${disabled ? "disabled" : ""}></textarea>
      <div class="actions">
        <button id="newSessionBtn" ${disabled ? "disabled" : ""}>${esc(t(config, "newSession"))}</button>
        <button id="sendChatBtn" class="primary" ${disabled ? "disabled" : ""}>${esc(t(config, "send"))}</button>
        <button data-copy-startup>${esc(t(config, "copyStartup"))}</button>
      </div>
    </section>
    <aside class="chat-side">
      ${panel(t(config, "startup"), `<pre>${esc(startupPacket(model))}</pre>`)}
      ${panel(t(config, "sessions"), sessions.length ? sessions.map((item) => `<div class="item"><div class="item-title">${esc(item.title || item.id)}</div><div class="meta">${badge(item.id)}${badge(item.bootstrapped ? t(config, "bootstrapped") : t(config, "pending"), item.bootstrapped ? "ok" : "warn")}</div></div>`).join("") : empty(t(config, "noSessions")))}
    </aside>
  </div>`;
}

export function renderHealth(report, hermesStatus, config) {
  if (!report) return empty(t(config, "noReport"));
  return `<div class="grid two">
    ${panel(t(config, "local"), report.checks.map((item) => `<div class="check ${item.ok ? "ok" : "bad"}"><strong>${esc(item.label)}</strong><span>${esc(item.detail)}</span></div>`).join(""))}
    ${panel("Hermes", hermesStatus ? `<pre>${esc(JSON.stringify(hermesStatus, null, 2))}</pre>` : `<div class="notice">${esc(t(config, "notChecked"))}</div>`)}
    ${panel(t(config, "report"), `<pre>${esc(JSON.stringify(report, null, 2))}</pre>`)}
  </div>`;
}

export function renderView(tab, state) {
  const config = state.config;
  if (tab === "home") return renderHome(state);
  if (tab === "game") return renderGame(state.model, config, state.gameMessages, state.personaLoaded, state.secrets, state.lastInjectedWorldbook || [], state.engineState);
  if (tab === "settings") return returnHomeBar() + renderSettings(state);
  if (tab === "monitor") return returnHomeBar() + renderMonitor(state);
  if (tab === "overview") return renderOverview(state.model, config);
  if (tab === "worldbook") return renderWorldbook(state.model, config, {
    ...(state.worldbookState || {}),
    ...(state.worldbookState?.modes?.[state.engineState?.dataMode || "worldbook"] || {}),
    disabled: { ...((state.worldbookState?.modes?.[state.engineState?.dataMode || "worldbook"] || {}).disabled || {}) },
    importedEntries: (state.cards || []).flatMap((card) => card.kind === "worldbook-card" ? (card.entries || []) : [])
  }, state.worldbookPreviewInput);
  if (tab === "cards") return renderCards(state.cards || [], config);
  if (tab === "characters") return renderCharacters(state.model, config);
  if (tab === "scenes") return renderScenes(state.model, config);
  if (tab === "state") return renderState(state.model, config);
  if (tab === "tracking") return renderTracking(state.model, config);
  if (tab === "branches") return renderBranches(state.model, config);
  if (tab === "archives") return returnHomeBar() + renderArchives(state.model, config, state.engineState);
  if (tab === "commands") return renderCommands(state.model, config, state.powerUser);
  if (tab === "processing") return renderProcessing(config, state.processingInput || "");
  if (tab === "help") return renderHelp(state);
  if (tab === "power") return renderPowerUser(state.powerUser || {}, config);
  if (tab === "paths") return renderPaths(config);
  if (tab === "chat") return renderChat(state.model, config, state.messages);
  if (tab === "health") return renderHealth(state.healthReport, state.hermesStatus, config);
  return renderHome(state);
}
