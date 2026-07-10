"use strict";

// Import/export, connection, diagnostics, toast, and health controls.
async function exportWorldpack() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  AS.worldPack = await API.worldPackExport({ moduleKey: AS.selectedModule.id, ...AS.worldPackOptions });
  AS.importPreview = null;
  createToast("世界包已准备好；确认后可下载。", "ok");
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
  if (U.qs("#connThinking")) U.qs("#connThinking").value = t.thinking || "auto";
}

async function saveConnection() {
  const templateId = U.qs("#connTemplate")?.value;
  const template = AS.connections?.templates?.find(x => x.id === templateId);
  const profile = {
    label: U.qs("#connLabel")?.value,
    baseUrl: U.qs("#connBaseUrl")?.value,
    model: U.qs("#connModel")?.value,
    temperature: U.qs("#connTemperature")?.value,
    maxTokens: U.qs("#connMaxTokens")?.value,
    topP: U.qs("#connTopP")?.value,
    thinking: U.qs("#connThinking")?.value || template?.thinking || "auto",
    apiKey: U.qs("#connKey")?.value,
    provider: template?.provider || templateId || "openai-compatible"
  };
  AS.connections = await API.connections({ action: "upsert", profile, setDefault: true });
  AS.llmDiagnostics = null;
  createToast("连接档案已保存");
  render();
}

async function connectionAction(action, id) {
  const map = { "set-default-connection": "setDefault", "test-connection": "test", "duplicate-connection": "duplicate", "delete-connection": "delete" };
  const res = await API.connections({ action: map[action], id });
  if (action === "test-connection") {
    AS.llmDiagnostics = res;
    createToast(res.status === "ok" || res.status === "partial" ? `诊断完成 ${res.latencyMs || 0}ms` : (res.errorMsg || "连接失败"), res.status === "ok" ? "" : res.status === "partial" ? "warn" : "bad");
    render();
  }
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
    const [workflowStatus, workflowTypes] = await Promise.all([
      API.workflowStatus().catch(() => null),
      API.workflowTypes().catch(() => ({ types: [] }))
    ]);
    AS.workflowStatus = workflowStatus;
    AS.workflowTypes = workflowTypes.types || [];
    if (AS.health?.version) CFG.version = AS.health.version;
    const versionNode = U.qs("#appVersion");
    if (versionNode) versionNode.textContent = `叙事引擎 v${CFG.version}`;
    const legacyLlmStatus = AS.health?.llm?.status;
    const llmStatus = deriveLlmUiStatus(AS.health, AS.config, AS.hasApiKey);
    const dataWritable = llmStatus.dataWritable;
    AS.llmConnected = llmStatus.connected;
    AS.hasApiKey = llmStatus.llmConfigured || AS.hasApiKey;
    AS.health.dataWritable = dataWritable;
    AS.health.legacyLlmStatus = legacyLlmStatus || llmStatus.status || "";
    const debug = U.qs("#debugToggle");
    if (debug && AS.health?.debugMode) debug.style.display = "block";
  } catch (err) { console.warn("[health] status refresh failed (non-fatal):", err?.message || "unknown error"); }
}

function deriveLlmUiStatus(health = {}, config = {}, hasApiKey = false) {
  const llmConfigured = Boolean(health?.llmConfigured ?? health?.llm?.configured ?? hasApiKey);
  const status = String(health?.llm?.status || "").toLowerCase();
  const connected = status === "connected" || Boolean(health?.llm?.connected) || (llmConfigured && Boolean(config?.llmBaseUrl || config?.llmModel));
  const dataWritable = Boolean(health?.data?.writable ?? health?.dataWritable ?? health?.writable);
  return { connected, llmConfigured, dataWritable, status };
}
