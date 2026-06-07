const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const path = require("node:path");

function portableRoot() {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : path.resolve(__dirname, "..");
}

function portableUserDataRoot() {
  return path.join(portableRoot(), "userData");
}

app.setPath("userData", portableUserDataRoot());

// ═══════════════════════════════════════════════════════════════
//  v1.0.1 便携数据根：运行时数据统一放在 <EXE_OR_PROJECT_ROOT>/data/
//  默认内容仍从 asar / 源码读取，配置与密钥随便携目录走。
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  // dataRoot 已移除——固定为项目内 data/ 目录（见 dataRoot() 函数）
  hermesBaseUrl: "http://127.0.0.1:8642",
  hermesToken: "",
  // 🆕 v0.9.5 多模型分工：每个角色可独立指定模型和API
  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "",
  // 按角色覆盖（留空则回退到 llmBaseUrl/llmModel）
  llmBaseUrlDirector: "",
  llmModelDirector: "",
  llmBaseUrlWriter: "",
  llmModelWriter: "",
  llmBaseUrlGuardian: "",
  llmModelGuardian: "",
  lastModuleKey: "",
  theme: "dark",
  language: "zh-CN"
};

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function secretsPath() {
  return path.join(app.getPath("userData"), "secrets.json");
}

function worldbookStatePath() {
  return path.join(app.getPath("userData"), "worldbook-state.json");
}

function powerUserPath() {
  return path.join(app.getPath("userData"), "power-user.json");
}

function engineStatePath() {
  return path.join(app.getPath("userData"), "world-engine-state.json");
}

function v0UiStatePath() {
  return path.join(app.getPath("userData"), "v0-ui-state.json");
}

function defaultEngineRoot() {
  return path.join(__dirname, "..", "defaults", "engine-profile");
}

function defaultKnowledgeRoot() {
  return path.join(__dirname, "..", "defaults", "engine-knowledge", "fulltext");
}

// 🆕 v0.7.4.1 项目数据根 — 固定为 <PROJECT_ROOT>/data/
// 开发模式：__dirname=<project>/src/ → dataRoot=<project>/data/
// 打包模式：__dirname=<project>/resources/app.asar → dataRoot=<project>/data/
function dataRoot() {
  return path.join(portableRoot(), "data");
}

function userDataPaths() {
  const userData = app.getPath("userData");
  return {
    userData,
    portableRoot: portableRoot(),
    dataRoot: dataRoot(),
    defaultContentRoot: path.join(__dirname, ".."),
    config: configPath(),
    secrets: secretsPath(),
    worldbookState: worldbookStatePath(),
    powerUser: powerUserPath(),
    engineState: engineStatePath(),
    embeddedEngine: defaultEngineRoot(),
    fulltextKnowledge: defaultKnowledgeRoot(),
    cardLibrary: path.join(userData, "Local Storage")
  };
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadConfig() {
  const config = await readJsonFile(configPath(), {});
  return { ...DEFAULT_CONFIG, ...config };
}

async function saveConfig(update) {
  const next = { ...(await loadConfig()), ...update };
  delete next.llmApiKey;
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${"*".repeat(6)}${value.slice(-4)}`;
}

async function loadSecrets() {
  const secrets = await readJsonFile(secretsPath(), {});
  const llm = secrets.llm || {};
  return {
    llm: {
      active: llm.active || "default",
      items: Array.isArray(llm.items) ? llm.items : []
    }
  };
}

async function saveSecrets(secrets) {
  await fs.mkdir(path.dirname(secretsPath()), { recursive: true });
  await fs.writeFile(secretsPath(), JSON.stringify(secrets, null, 2), "utf8");
  return getSecretState();
}

async function getSecretState() {
  const secrets = await loadSecrets();
  const active = secrets.llm.items.find((item) => item.id === secrets.llm.active) || secrets.llm.items[0] || null;
  return {
    llm: {
      active: active?.id || "",
      items: secrets.llm.items.map((item) => ({
        id: item.id,
        label: item.label || item.id,
        masked: maskSecret(item.value || ""),
        active: item.id === (active?.id || "")
      }))
    }
  };
}

async function activeLlmSecret() {
  const secrets = await loadSecrets();
  const active = secrets.llm.items.find((item) => item.id === secrets.llm.active) || secrets.llm.items[0] || null;
  return active?.value || "";
}

async function saveLlmSecret(payload) {
  const label = String(payload?.label || "Default").trim() || "Default";
  const value = String(payload?.value || "").trim();
  const id = String(payload?.id || "default").replace(/[^\w.-]/g, "-") || "default";
  const secrets = await loadSecrets();
  const nextItem = { id, label, value };
  const items = [nextItem, ...secrets.llm.items.filter((item) => item.id !== id)];
  return saveSecrets({ ...secrets, llm: { active: id, items } });
}

async function setActiveLlmSecret(id) {
  const secrets = await loadSecrets();
  if (!secrets.llm.items.some((item) => item.id === id)) throw new Error("Secret not found");
  return saveSecrets({ ...secrets, llm: { ...secrets.llm, active: id } });
}

async function loadWorldbookState() {
  return readJsonFile(worldbookStatePath(), { disabled: {}, notes: {}, modes: {} });
}

async function saveWorldbookState(update) {
  const current = await loadWorldbookState();
  const next = {
    disabled: { ...(current.disabled || {}), ...(update?.disabled || {}) },
    notes: { ...(current.notes || {}), ...(update?.notes || {}) },
    modes: { ...(current.modes || {}) }
  };
  for (const [mode, value] of Object.entries(update?.modes || {})) {
    next.modes[mode] = {
      disabled: { ...(next.modes[mode]?.disabled || {}), ...(value?.disabled || {}) },
      notes: { ...(next.modes[mode]?.notes || {}), ...(value?.notes || {}) }
    };
  }
  await fs.mkdir(path.dirname(worldbookStatePath()), { recursive: true });
  await fs.writeFile(worldbookStatePath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function loadPowerUser() {
  const stored = await readJsonFile(powerUserPath(), {});
  return {
    settings: {
      enabled: stored.settings?.enabled !== false,
      showUserDataPaths: stored.settings?.showUserDataPaths !== false
    },
    slashCommands: {
      disabledDefaultIds: stored.slashCommands?.disabledDefaultIds || {},
      userCommands: Array.isArray(stored.slashCommands?.userCommands) ? stored.slashCommands.userCommands : []
    },
    paths: userDataPaths()
  };
}

async function savePowerUser(update) {
  const current = await loadPowerUser();
  const next = {
    settings: { ...(current.settings || {}), ...(update?.settings || {}) },
    slashCommands: {
      disabledDefaultIds: {
        ...(current.slashCommands?.disabledDefaultIds || {}),
        ...(update?.slashCommands?.disabledDefaultIds || {})
      },
      userCommands: Array.isArray(update?.slashCommands?.userCommands)
        ? update.slashCommands.userCommands
        : current.slashCommands.userCommands
    }
  };
  await fs.mkdir(path.dirname(powerUserPath()), { recursive: true });
  await fs.writeFile(powerUserPath(), JSON.stringify(next, null, 2), "utf8");
  return loadPowerUser();
}

async function loadEngineState() {
  const stored = await readJsonFile(engineStatePath(), {});
  return {
    enabled: stored.enabled !== false,
    dataMode: stored.dataMode || "worldbook",
    preset: stored.preset || "epic",
    activeModules: Array.isArray(stored.activeModules) ? stored.activeModules : [],
    mutationMode: stored.mutationMode || "overlay",
    contextBudget: stored.contextBudget || "balanced",
    requireQualityAudit: stored.requireQualityAudit !== false,
    requireRuleCheck: stored.requireRuleCheck !== false,
    requireScenePrediction: stored.requireScenePrediction !== false
  };
}

async function saveEngineState(update) {
  const next = { ...(await loadEngineState()), ...(update || {}) };
  await fs.mkdir(path.dirname(engineStatePath()), { recursive: true });
  await fs.writeFile(engineStatePath(), JSON.stringify(next, null, 2), "utf8");
  return loadEngineState();
}

async function loadV0UiState() {
  return readJsonFile(v0UiStatePath(), {
    worldName: "",
    worldBook: [],
    cast: [],
    relations: [],
    workshopRuns: [],
    updatedAt: ""
  });
}

async function saveV0UiState(update) {
  const current = await loadV0UiState();
  const next = {
    ...current,
    ...(update || {}),
    worldBook: Array.isArray(update?.worldBook) ? update.worldBook : (current.worldBook || []),
    cast: Array.isArray(update?.cast) ? update.cast : (current.cast || []),
    relations: Array.isArray(update?.relations) ? update.relations : (current.relations || []),
    workshopRuns: Array.isArray(update?.workshopRuns) ? update.workshopRuns : (current.workshopRuns || []),
    updatedAt: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(v0UiStatePath()), { recursive: true });
  await fs.writeFile(v0UiStatePath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function testLlmConnection(payload) {
  const started = Date.now();
  const config = { ...(await loadConfig()), ...(payload?.config || {}) };
  const apiKey = String(payload?.apiKey || (await activeLlmSecret()) || "").trim();
  const baseUrl = String(config.llmBaseUrl || payload?.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return { status: "error", errorMsg: "请先填写服务地址" };
  if (!apiKey) return { status: "error", errorMsg: "访问密钥为空，无法通过鉴权" };
  if (!/^https?:\/\//.test(baseUrl)) return { status: "error", errorMsg: "服务地址格式无效，需以 http(s):// 开头" };
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const text = await response.text();
    if (!response.ok) {
      return { status: "error", errorMsg: text || `模型服务返回 HTTP ${response.status}` };
    }
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    return { status: "error", errorMsg: error?.message || "模型服务不可达" };
  }
}

async function walkEngineDocs(current = defaultEngineRoot(), root = defaultEngineRoot(), records = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (["__pycache__"].includes(entry.name)) continue;
      await walkEngineDocs(fullPath, root, records);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (![".md", ".yaml", ".yml", ".json"].includes(ext)) continue;
    const relPath = toPosixPath(path.relative(root, fullPath));
    const text = await fs.readFile(fullPath, "utf8");
    records.push({ path: relPath, text, size: text.length });
  }
  return records;
}

async function walkFulltextDocs(current = defaultKnowledgeRoot(), root = defaultKnowledgeRoot(), records = []) {
  try {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walkFulltextDocs(fullPath, root, records);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (![".md", ".yaml", ".yml", ".json", ".txt"].includes(ext)) continue;
      const relPath = toPosixPath(path.relative(root, fullPath));
      const text = await fs.readFile(fullPath, "utf8");
      records.push({ path: relPath, text, size: text.length });
    }
  } catch {
    return records;
  }
  return records;
}

function scoreDoc(doc, terms) {
  const haystack = `${doc.path}\n${doc.text}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function excerptFor(doc, terms, limit = 1800) {
  const lower = doc.text.toLowerCase();
  const hit = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] || 0;
  const start = Math.max(0, hit - 360);
  return doc.text.slice(start, start + limit);
}

async function engineKnowledgeSearch(payload = {}) {
  const query = String(payload.query || "");
  const limit = Number(payload.limit || 6);
  const terms = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((item) => item.length >= 2))];
  const docs = [...await walkEngineDocs(), ...await walkFulltextDocs()];
  const ranked = docs
    .map((doc) => ({ ...doc, score: scoreDoc(doc, terms) }))
    .filter((doc) => doc.score > 0 || /world-tree-runtime\.json/.test(doc.path))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
  return ranked.map((doc) => ({
    path: doc.path,
    score: doc.score,
    excerpt: excerptFor(doc, terms)
  }));
}

async function engineManifest() {
  const docs = await walkEngineDocs();
  const fulltext = await walkFulltextDocs();
  return {
    root: defaultEngineRoot(),
    count: docs.length,
    files: docs.map((doc) => ({ path: doc.path, size: doc.size })),
    fulltextRoot: defaultKnowledgeRoot(),
    fulltextCount: fulltext.length
  };
}

async function getKnowledgeCard(moduleId) {
  const safeId = String(moduleId || "").replace(/[^\w.-]/g, "_");
  if (!safeId) throw new Error("No module id");
  return readJsonFile(path.join(defaultEngineRoot(), "modules", `${safeId}.json`), null);
}

// 🆕 v0.7.4.1 数据根固定为项目内 data/ 目录，不再从配置读取
async function configuredDataRoot() {
  return dataRoot();
}

function resolveDataChildPath(rootPath, name, label = "name") {
  const clean = String(name || "").trim();
  if (!clean) throw new Error(`${label} cannot be empty`);
  if (path.isAbsolute(clean) || clean.includes("/") || clean.includes("\\")) {
    throw new Error(`${label} must be a single folder name`);
  }
  if (clean === "." || clean === ".." || clean.split(/[\\/]+/).includes("..")) {
    throw new Error(`${label} cannot contain parent path segments`);
  }
  const resolvedRoot = path.resolve(rootPath);
  const target = path.resolve(resolvedRoot, clean);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes data root`);
  }
  return target;
}

// 🆕 v0.7.4.1 overlay 路径前缀改为 data/engine/
function resolveOverlayPath(rootPath, relPath) {
  const clean = String(relPath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean.startsWith("data/engine/")) throw new Error("Overlay writes must stay under data/engine/");
  const target = path.resolve(rootPath, clean.replace(/^data\//, ""));
  const resolvedRoot = path.resolve(rootPath);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Overlay path escapes data root");
  }
  return target;
}

async function overlayRead(relPath, fallback = null) {
  const rootPath = await configuredDataRoot();
  const target = resolveOverlayPath(rootPath, relPath);
  try {
    const text = await fs.readFile(target, "utf8");
    if (target.endsWith(".json")) return JSON.parse(text);
    return text;
  } catch {
    return fallback;
  }
}

async function backupFile(target) {
  try {
    await fs.access(target);
  } catch {
    return null;
  }
  const backupDir = path.join(path.dirname(target), "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${path.basename(target)}.${Date.now()}.bak`);
  await fs.copyFile(target, backupPath);
  return backupPath;
}

async function overlayWrite(operation = {}) {
  const rootPath = await configuredDataRoot();
  const target = resolveOverlayPath(rootPath, operation.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const backupPath = await backupFile(target);
  const mode = operation.mode || "write-json";

  // ---- 写入签名 ----
  const ENGINE_VERSION = "world-tree-v12.19-desktop-full";
  function signValue(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return { ...value, _writtenBy: "world-tree-desktop", _writtenAt: new Date().toISOString(), _engineVersion: ENGINE_VERSION };
  }

  // ---- 原子写入（先写 .tmp 再 rename）----
  async function atomicWrite(filePath, content) {
    const tmpPath = filePath + ".tmp";
    await fs.writeFile(tmpPath, content, "utf8");
    await fs.rename(tmpPath, filePath);
  }

  if (mode === "append-jsonl") {
    await fs.appendFile(target, `${JSON.stringify(operation.value || {})}\n`, "utf8");
  } else if (mode === "append-json-array") {
    const current = await readJsonFile(target, []);
    const next = [...(Array.isArray(current) ? current : []), ...(Array.isArray(operation.value) ? operation.value : [operation.value])].filter((item) => item !== undefined && item !== null && item !== "");
    await atomicWrite(target, JSON.stringify(signValue(next), null, 2));
  } else if (mode === "merge-json") {
    const current = await readJsonFile(target, {});
    const next = signValue({ ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}), ...(operation.value || {}) });
    await atomicWrite(target, JSON.stringify(next, null, 2));
  } else {
    await atomicWrite(target, typeof operation.value === "string" ? operation.value : JSON.stringify(signValue(operation.value || {}), null, 2));
  }
  return { path: operation.path, absolutePath: target, backupPath };
}

async function overlayWriteMany(operations = []) {
  const results = [];
  for (const operation of operations) results.push(await overlayWrite(operation));
  return results;
}

async function loadOverlayStore() {
  const overlayPath = path.join(__dirname, "core", "engine", "overlay-store.js");
  return import("file:///" + overlayPath.replace(/\\/g, "/"));
}

function moduleKeyFromOverlayPath(relPath = "") {
  const match = String(relPath || "").replaceAll("\\", "/").match(/\/modules\/([^/]+)/);
  return match?.[1] || "unloaded";
}

async function safeOverlayWriteMany(operations = [], options = {}) {
  const overlay = await loadOverlayStore();
  const normalized = Array.isArray(operations) ? operations.filter(Boolean) : [];
  const split = overlay.splitWriteSet(normalized);
  const written = await overlayWriteMany(split.auto);
  const moduleKey = options.moduleKey || moduleKeyFromOverlayPath(normalized[0]?.path);
  const round = Number(options.round ?? options.currentRound ?? 0);
  const pending = split.pending.map((op) => overlay.addToPending(moduleKeyFromOverlayPath(op.path) || moduleKey, op, { round }));
  return {
    ok: true,
    written,
    pending,
    manual: split.manual,
    counts: {
      written: written.length,
      pending: pending.length,
      manual: split.manual.length
    }
  };
}

async function safeOverlayWrite(operation = {}, options = {}) {
  return safeOverlayWriteMany([operation], { ...options, ...operation });
}

async function writeProposalPatch(proposalResult = {}, options = {}) {
  if (!proposalResult?.ok || !proposalResult.overlayPatch) return null;
  const overlay = await loadOverlayStore();
  const proposal = proposalResult.proposal || {};
  const patch = proposalResult.overlayPatch;
  let operations = [];
  if (Array.isArray(patch)) {
    operations = patch;
  } else if (Array.isArray(patch.operations)) {
    operations = patch.operations;
  } else if (Array.isArray(patch.writeSet)) {
    operations = patch.writeSet;
  } else if (patch.path) {
    operations = [patch];
  } else if (typeof patch === "object") {
    operations = overlay.buildOverlayWriteSet(
      proposal.moduleKey || options.moduleKey || "unknown",
      patch,
      options.dataMode || proposal.metadata?.dataMode || "worldbook"
    );
  }
  if (!operations.length) return null;
  return safeOverlayWriteMany(operations, {
    moduleKey: proposal.moduleKey || options.moduleKey || "unknown",
    round: proposal.round ?? options.round ?? 0
  });
}

async function overlayBackup(relPath) {
  const rootPath = await configuredDataRoot();
  const target = resolveOverlayPath(rootPath, relPath);
  const backupPath = await backupFile(target);
  return { path: relPath, backupPath };
}

function commandIntent(input = "") {
  const text = String(input || "").trim();
  const slash = text.match(/^\/(\S+)(?:\s+(\S+))?(?:\s+([\s\S]*))?$/);
  if (!slash) return { kind: "narrative", text };
  const [, root, action = "", rest = ""] = slash;
  const category =
    root.includes("引擎") ? "engine" :
    root.includes("模块") ? "modules" :
    root.includes("世界书集") ? "worldbookset" :
    root.includes("世界书") ? "worldbook" :
    root.includes("世界状态") ? "worldstate" :
    root.includes("角色") ? "characters" :
    root.includes("场景") ? "scene" :
    root.includes("预设") ? "preset" :
    root.includes("组织") ? "organization" :
    root.includes("存档") || root.includes("读档") ? "archive" :
    root.includes("分支") ? "branch" :
    root.includes("规则") ? "rules" :
    root.includes("审查") ? "quality" :
    root.includes("推进") ? "advance" :
    root.includes("处理") || root.includes("搜集") || root.includes("发现") || root.includes("补全") || root.includes("推理") ? "processing" :
    root.includes("时间") ? "time" :
    root.includes("随机") ? "random" :
    root.includes("预测") ? "prediction" :
    root.includes("认知") ? "cognition" :
    root.includes("追踪") ? "tracking" :
    root.includes("摘要") ? "summary" :
    root.includes("压缩") ? "compress" :
    root.includes("上下文") ? "compress" :
    root.includes("隔离") ? "isolation" :
    root.includes("素材") ? "material" :
    root.includes("插件") ? "plugin" :
    root.includes("创作") ? "creation" :
    root.includes("回滚") ? "rollback" : "slash";
  return { kind: "slash", root, action, rest, category, text };
}

async function overlayListAudit() {
  const rootPath = await configuredDataRoot();
  const auditRoot = resolveOverlayPath(rootPath, "data/engine");
  const records = [];
  async function walk(current) {
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.name.endsWith(".jsonl") || entry.name.includes(".bak")) {
          records.push({ path: toPosixPath(path.relative(rootPath, full)), size: (await fs.stat(full)).size });
        }
      }
    } catch {
      return;
    }
  }
  await walk(auditRoot);
  return records;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

async function walkDirectory(root, current = root, records = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    const relPath = toPosixPath(path.relative(root, fullPath));
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "__pycache__"].includes(entry.name)) continue;
      await walkDirectory(root, fullPath, records);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (![".json", ".jsonl", ".md", ".txt", ".yaml", ".yml", ".html", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".css"].includes(ext)) continue;
    const stat = await fs.stat(fullPath);
    let text = "";
    try {
      text = await fs.readFile(fullPath, "utf8");
    } catch {
      text = "";
    }
    records.push({
      path: relPath,
      name: entry.name,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      text
    });
  }
  return records;
}

async function readDataRoot(rootPath) {
  const stat = await fs.stat(rootPath);
  if (!stat.isDirectory()) throw new Error(`${rootPath} is not a directory`);
  return {
    rootPath,
    loadedAt: new Date().toISOString(),
    records: await walkDirectory(rootPath)
  };
}

async function readImportFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);
  if (ext === ".png") {
    const buffer = await fs.readFile(filePath);
    const latin = buffer.toString("latin1");
    const match = latin.match(/chara\0([A-Za-z0-9+/=]+)/) || latin.match(/ccv3\0([A-Za-z0-9+/=]+)/);
    if (!match) throw new Error("PNG card metadata not found");
    const text = Buffer.from(match[1], "base64").toString("utf8");
    return { filePath, name, kind: "character-card", format: "png", text };
  }
  const text = await fs.readFile(filePath, "utf8");
  return { filePath, name, kind: "text", format: ext.replace(".", "") || "text", text };
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function resolveStaticFile(root, urlPath) {
  const cleanPath = decodeURIComponent(String(urlPath || "/").split("?")[0]).replace(/^\/+/, "");
  const candidates = [];
  if (!cleanPath) {
    candidates.push(path.join(root, "index.html"));
  } else {
    const requested = path.join(root, cleanPath);
    candidates.push(requested);
    candidates.push(`${requested}.html`);
    candidates.push(path.join(requested, "index.html"));
  }
  candidates.push(path.join(root, "404.html"));
  for (const candidate of candidates) {
    const relative = path.relative(root, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    try {
      if (fsSync.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function startStaticUiServer() {
  const root = path.join(__dirname, "v0-out");
  if (!fsSync.existsSync(path.join(root, "index.html"))) return Promise.resolve(null);
  const server = http.createServer((req, res) => {
    const filePath = resolveStaticFile(root, req.url || "/");
    if (!filePath) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(path.basename(filePath) === "404.html" ? 404 : 200, {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
    });
    fsSync.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

async function ensureExternalConsoleFile() {
  const source = path.join(__dirname, "..", "world-tree-console.html");
  const target = path.join(portableRoot(), "world-tree-console.html");
  if (fsSync.existsSync(target)) return target;
  if (!fsSync.existsSync(source)) return null;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return target;
}

let staticUiServer = null;

async function createWindow() {
  // ── 菜单：工具 → 打开观测终端 ──
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "quit", label: "退出" }
      ]
    },
    {
      label: "工具",
      submenu: [
        {
          label: "🌳 观测终端 v2",
          click: async () => {
            const consolePath = await ensureExternalConsoleFile();
            if (consolePath) shell.openPath(consolePath);
          }
        },
        { type: "separator" },
        { label: "打开数据目录", click: () => shell.openPath(dataRoot()) },
        { label: "打开便携根目录", click: () => shell.openPath(portableRoot()) }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    title: "World Tree Desktop",
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (!staticUiServer) staticUiServer = await startStaticUiServer();
  if (staticUiServer?.url) {
    await win.loadURL(staticUiServer.url);
  } else {
    await win.loadFile(path.join(__dirname, "ui", "index.html"));
  }
}

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  staticUiServer?.server?.close();
});

ipcMain.handle("config:get", () => loadConfig());
ipcMain.handle("config:save", (_event, update) => saveConfig(update || {}));
ipcMain.handle("secrets:get", () => getSecretState());
ipcMain.handle("secrets:saveLlm", (_event, payload) => saveLlmSecret(payload));
ipcMain.handle("secrets:setActiveLlm", (_event, id) => setActiveLlmSecret(id));
ipcMain.handle("secrets:getActiveLlmValue", () => activeLlmSecret());
ipcMain.handle("worldbookState:get", () => loadWorldbookState());
ipcMain.handle("worldbookState:save", (_event, update) => saveWorldbookState(update || {}));
ipcMain.handle("powerUser:get", () => loadPowerUser());
ipcMain.handle("powerUser:save", (_event, update) => savePowerUser(update || {}));
ipcMain.handle("engine:getState", () => loadEngineState());
ipcMain.handle("engine:saveState", (_event, update) => saveEngineState(update || {}));
ipcMain.handle("v0State:get", () => loadV0UiState());
ipcMain.handle("v0State:save", (_event, update) => saveV0UiState(update || {}));
ipcMain.handle("llm:testConnection", (_event, payload) => testLlmConnection(payload || {}));
ipcMain.handle("engine:searchKnowledge", (_event, payload) => engineKnowledgeSearch(payload || {}));
ipcMain.handle("engine:manifest", () => engineManifest());
ipcMain.handle("engine:searchFulltext", (_event, payload) => engineKnowledgeSearch(payload || {}));
ipcMain.handle("engine:getKnowledgeCard", (_event, moduleId) => getKnowledgeCard(moduleId));
ipcMain.handle("engine:execCommand", (_event, payload) => ({ intent: commandIntent(payload?.input || ""), overlayOnly: true }));
ipcMain.handle("engine:runTurn", (_event, payload) => ({ accepted: true, overlayOnly: true, input: payload?.input || "" }));
ipcMain.handle("engine:loadModule", (_event, payload) => saveConfig({ lastModuleKey: payload?.moduleKey || "" }));
ipcMain.handle("engine:newModule", async (_event, payload) => {
  const moduleName = (payload?.moduleName || "未命名模组").trim();
  const moduleType = payload?.moduleType || "daily";
  const rootPath = await configuredDataRoot();
  const modulePath = resolveDataChildPath(rootPath, moduleName, "moduleName");

  // 创建模组目录结构
  const dirs = [
    modulePath,
    path.join(modulePath, "shared"),
    path.join(modulePath, "branches", "main", "archive"),
    path.join(modulePath, "branches", "main", "tracking"),
    path.join(modulePath, "context"),
    path.join(modulePath, "saves"),
    path.join(modulePath, "presets"),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 初始化 module.json
  const moduleJson = {
    name: moduleName,
    type: moduleType,
    version: "1.0",
    created: new Date().toISOString(),
    activeModules: [],
    branch: "main",
    _writtenBy: "world-tree-desktop",
    _writtenAt: new Date().toISOString(),
    _engineVersion: "world-tree-v12.19-desktop-full"
  };
  await fs.writeFile(path.join(modulePath, "module.json"), JSON.stringify(moduleJson, null, 2), "utf8");

  // 初始化 timeline-tree.json
  const timelineTree = {
    active_branch: "main",
    branches: { main: { created: new Date().toISOString(), parent: null } },
    _writtenBy: "world-tree-desktop"
  };
  await fs.writeFile(path.join(modulePath, "timeline-tree.json"), JSON.stringify(timelineTree, null, 2), "utf8");

  // 初始化 canon_state.json
  const canonState = {
    confirmed: [],
    implied: [],
    proposed: [],
    _writtenBy: "world-tree-desktop",
    _writtenAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(modulePath, "branches", "main", "canon_state.json"), JSON.stringify(canonState, null, 2), "utf8");

  // 初始化 runtime.json
  const runtimeJson = {
    scene: { title: "起始场景", location: "", time: "", summary: "" },
    characters: [],
    turnCount: 0,
    lastInput: "",
    _writtenBy: "world-tree-desktop",
    _writtenAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(modulePath, "branches", "main", "runtime.json"), JSON.stringify(runtimeJson, null, 2), "utf8");

  // 初始化空场景链
  await fs.writeFile(path.join(modulePath, "context", "scene_chain.json"), JSON.stringify({ scenes: [] }, null, 2), "utf8");

  return {
    overlayOnly: true,
    moduleName,
    modulePath,
    moduleType,
    created: true,
    files: ["module.json", "timeline-tree.json", "canon_state.json", "runtime.json", "scene_chain.json"]
  };
});
ipcMain.handle("engine:saveArchive", async (_event, payload) => {
  const dataMode = payload?.dataMode || "worldbook";
  const name = payload?.name || `auto-${Date.now()}`;
  const path = `data/engine/runs/${dataMode}/archives/${name}.json`;
  return overlayWrite({
    path,
    mode: "merge-json",
    value: { ...(payload?.value || {}), type: dataMode, name, savedAt: new Date().toISOString() }
  });
});
ipcMain.handle("engine:loadArchive", async (_event, payload) => {
  const dataMode = payload?.dataMode || "worldbook";
  const name = payload?.name || "";
  const path = `data/engine/runs/${dataMode}/archives/${name}.json`;
  const data = await overlayRead(path, null);
  // 跨模式读档阻断
  if (data && data.type && data.type !== dataMode) {
    return { blocked: true, error: `存档类型不匹配：该存档是【${data.type}】模式，当前是【${dataMode}】模式。`, archive: data };
  }
  return data;
});
ipcMain.handle("engine:rollback", async (_event, payload) => {
  const relPath = payload?.path || "";
  if (!relPath) return { planned: false, error: "未指定回滚目标路径。" };
  const rootPath = await configuredDataRoot();
  const target = resolveOverlayPath(rootPath, relPath);
  const backupDir = path.join(path.dirname(target), "backups");
  const listOnly = payload?.list || payload?.action === "list";

  // 列出备份
  if (listOnly || payload?.index === undefined) {
    try {
      const entries = await fs.readdir(backupDir);
      const backups = await Promise.all(
        entries
          .filter((f) => f.startsWith(path.basename(target) + ".") && f.endsWith(".bak"))
          .map(async (f) => {
            const stat = await fs.stat(path.join(backupDir, f));
            return { file: f, size: stat.size, mtime: stat.mtime.toISOString(), index: f };
          })
      );
      backups.sort((a, b) => b.mtime.localeCompare(a.mtime));
      return { planned: true, path: relPath, backups: backups.map((b, i) => ({ ...b, index: i })), count: backups.length };
    } catch {
      return { planned: true, path: relPath, backups: [], count: 0 };
    }
  }

  // 执行回滚
  const idx = Number(payload?.index);
  if (isNaN(idx) || idx < 0) return { planned: false, error: "请指定有效备份索引。" };
  try {
    const entries = await fs.readdir(backupDir);
    const backups = entries
      .filter((f) => f.startsWith(path.basename(target) + ".") && f.endsWith(".bak"))
      .sort((a, b) => {
        const aStat = require("fs").statSync(path.join(backupDir, a));
        const bStat = require("fs").statSync(path.join(backupDir, b));
        return bStat.mtimeMs - aStat.mtimeMs;
      });
    if (idx >= backups.length) return { planned: false, error: `备份索引 ${idx} 超出范围（共 ${backups.length} 个备份）。` };
    const selectedBackupPath = path.join(backupDir, backups[idx]);
    // 原子恢复：先备份当前文件，再复制备份文件
    await backupFile(target);
    await fs.copyFile(selectedBackupPath, target);
    return { planned: true, restored: true, path: relPath, restoredFrom: backups[idx], note: "已从备份恢复。当前版本已自动备份为 .bak 文件。" };
  } catch (err) {
    return { planned: false, error: `回滚失败：${err.message}` };
  }
});
ipcMain.handle("overlay:read", (_event, payload) => overlayRead(payload?.path, payload?.fallback));
ipcMain.handle("overlay:write", (_event, payload) => safeOverlayWrite(payload || {}));
ipcMain.handle("overlay:writeMany", (_event, payload) => safeOverlayWriteMany(payload?.operations || [], payload || {}));
ipcMain.handle("overlay:backup", (_event, payload) => overlayBackup(payload?.path || ""));
ipcMain.handle("overlay:listAudit", () => overlayListAudit());

// ═══════════════════════════════════════════════════════════════
//  世界系统 IPC（Minecraft 式世界管理）
// ═══════════════════════════════════════════════════════════════

// 🆕 v0.7.4.1 数据归家
const WORLDS_ROOT = "data/engine/worlds";

function worldsAbsRoot() {
  return path.join(dataRoot(), "engine", "worlds");
}

ipcMain.handle("world:list", async () => {
  const root = worldsAbsRoot();
  if (!fsSync.existsSync(root)) return [];
  const entries = fsSync.readdirSync(root, { withFileTypes: true });
  const worlds = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(root, entry.name, "world.json");
    if (!fsSync.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fsSync.readFileSync(metaPath, "utf-8"));
      // 读取实时状态
      const runtimePath = path.join(root, entry.name, "runtime.json");
      let turnCount = meta.turnCount || 0;
      let lastPlayed = meta.lastPlayedAt || meta.createdAt;
      if (fsSync.existsSync(runtimePath)) {
        try {
          const rt = JSON.parse(fsSync.readFileSync(runtimePath, "utf-8"));
          turnCount = rt.turnCount || rt.lastEventRound || turnCount;
          lastPlayed = rt.savedAt || lastPlayed;
        } catch {}
      }
      worlds.push({
        dir: entry.name,
        name: meta.name || entry.name,
        displayName: meta.displayName || meta.name || entry.name,
        mode: meta.mode || "worldbook",
        subType: meta.subType || "classic",  // 🆕 子类型
        turnCount,
        createdAt: meta.createdAt || "",
        lastPlayedAt: lastPlayed,
        copyOf: meta.copyOf || null,
        copyLabel: meta.copyLabel || "",
        sourceWorld: meta.sourceWorld || null,
        branchGeneration: meta.branchGeneration || 0
      });
    } catch {}
  }
  return worlds.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0));
});

ipcMain.handle("world:new", async (_event, payload) => {
  const name = (payload?.name || "").trim();
  if (!name) return { ok: false, error: "世界名不能为空" };
  const mode = payload?.mode || "worldbook";
  const root = worldsAbsRoot();
  const worldDir = path.join(root, encodeURIComponent(name));

  if (fsSync.existsSync(worldDir)) {
    return { ok: false, error: `世界「${name}」已存在` };
  }

  // 创建结构
  fsSync.mkdirSync(path.join(worldDir, "shared"), { recursive: true });
  fsSync.mkdirSync(path.join(worldDir, "branches", "main"), { recursive: true });
  fsSync.mkdirSync(path.join(worldDir, "memory"), { recursive: true });

  // world.json
  const meta = {
    name,
    mode,
    displayName: name,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    playCount: 0,
    turnCount: 0,
    description: "",
    tags: [],
    version: 1
  };
  fsSync.writeFileSync(path.join(worldDir, "world.json"), JSON.stringify(meta, null, 2));

  // runtime.json
  const runtime = {
    emotion: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
    lastEventRound: 0,
    turnCount: 0,
    currentScene: "",
    savedAt: new Date().toISOString()
  };
  fsSync.writeFileSync(path.join(worldDir, "runtime.json"), JSON.stringify(runtime, null, 2));

  return { ok: true, name, mode, path: worldDir };
});

ipcMain.handle("world:load", async (_event, payload) => {
  const name = (payload?.name || "").trim();
  if (!name) return { ok: false, error: "世界名不能为空" };
  const root = worldsAbsRoot();
  const worldDir = path.join(root, encodeURIComponent(name));

  if (!fsSync.existsSync(worldDir)) {
    return { ok: false, error: `世界「${name}」不存在` };
  }

  // 读取元数据
  const metaPath = path.join(worldDir, "world.json");
  const meta = fsSync.existsSync(metaPath) ? JSON.parse(fsSync.readFileSync(metaPath, "utf-8")) : {};

  // 读取运行时
  const runtimePath = path.join(worldDir, "runtime.json");
  const runtime = fsSync.existsSync(runtimePath) ? JSON.parse(fsSync.readFileSync(runtimePath, "utf-8")) : null;

  // 读取缓存
  const cachePath = path.join(worldDir, "cache.json");
  const cache = fsSync.existsSync(cachePath) ? JSON.parse(fsSync.readFileSync(cachePath, "utf-8")) : null;

  // 更新最后游玩时间
  meta.lastPlayedAt = new Date().toISOString();
  meta.playCount = (meta.playCount || 0) + 1;
  fsSync.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  return { ok: true, name, meta, runtime, cache };
});

ipcMain.handle("world:copy", async (_event, payload) => {
  const source = (payload?.source || "").trim();
  const target = (payload?.target || "").trim();
  const label = (payload?.label || "").trim();

  if (!source || !target) return { ok: false, error: "源世界名和目标世界名都不能为空" };

  const root = worldsAbsRoot();
  const srcDir = path.join(root, encodeURIComponent(source));
  const dstDir = path.join(root, encodeURIComponent(target));

  if (!fsSync.existsSync(srcDir)) return { ok: false, error: `源世界「${source}」不存在` };
  if (fsSync.existsSync(dstDir)) return { ok: false, error: `目标世界「${target}」已存在` };

  // 深拷贝整个文件夹
  fsSync.cpSync(srcDir, dstDir, { recursive: true, force: false });

  // 更新副本元数据
  const metaPath = path.join(dstDir, "world.json");
  if (fsSync.existsSync(metaPath)) {
    const meta = JSON.parse(fsSync.readFileSync(metaPath, "utf-8"));
    meta.name = target;
    meta.displayName = label || `${source} — ${new Date().toLocaleString("zh-CN")}`;
    meta.sourceWorld = source;
    meta.copyOf = source;
    meta.copyLabel = label;
    meta.createdAt = new Date().toISOString();
    meta.lastPlayedAt = new Date().toISOString();
    meta.playCount = 0;
    meta.branchGeneration = (meta.branchGeneration || 0) + 1;
    fsSync.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return { ok: true, source, target, label };
});

ipcMain.handle("world:delete", async (_event, payload) => {
  const name = (payload?.name || "").trim();
  if (!name) return { ok: false, error: "世界名不能为空" };
  const root = worldsAbsRoot();
  const worldDir = path.join(root, encodeURIComponent(name));
  if (!fsSync.existsSync(worldDir)) return { ok: false, error: `世界「${name}」不存在` };
  fsSync.rmSync(worldDir, { recursive: true, force: true });
  return { ok: true, name };
});

ipcMain.handle("world:branch", async (_event, payload) => {
  const name = (payload?.worldName || "").trim();
  const root = worldsAbsRoot();
  if (!fsSync.existsSync(root)) return [];

  // 找所有相关世界（源或副本）
  const entries = fsSync.readdirSync(root, { withFileTypes: true });
  const related = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(root, entry.name, "world.json");
    if (!fsSync.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fsSync.readFileSync(metaPath, "utf-8"));
      const chain = [meta.name, meta.copyOf, meta.sourceWorld].filter(Boolean);
      if (name && !chain.includes(name) && !chain.some(c => c && c.startsWith(name))) continue;
      related.push({
        dir: entry.name,
        name: meta.name,
        displayName: meta.displayName || meta.name,
        copyOf: meta.copyOf || null,
        copyLabel: meta.copyLabel || "",
        createdAt: meta.createdAt,
        branchGeneration: meta.branchGeneration || 0
      });
    } catch {}
  }
  return related.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
});

// ⚠️ tabletop/rpg/sim 三种模式的 status=hidden，未完成前禁止暴露到 UI。
//    只有用户明确要求完成时才可改 profile 的 status 为 "active"。
//    AI 代理不得擅自移除此过滤逻辑。
ipcMain.handle("world:profiles", async () => {
  const profilesPath = path.join(__dirname, "..", "defaults", "world-profiles");
  if (!fsSync.existsSync(profilesPath)) return [];
  const files = fsSync.readdirSync(profilesPath).filter((f) => f.endsWith(".json"));
  const profiles = [];
  for (const file of files) {
    try {
      const profile = JSON.parse(fsSync.readFileSync(path.join(profilesPath, file), "utf-8"));
      const status = profile.status || "active";
      if (status === "hidden") continue; // 🆕 隐藏未完成的模式
      profiles.push({
        id: profile.id,
        name: profile.name,
        description: profile.description?.split("\n")[0] || "",
        status,
        basedOn: profile.basedOn || "worldbook",
        plannedFeatures: profile.plannedFeatures || []
      });
    } catch {}
  }
  return profiles;
});

// 🆕 v0.7.4.1 dataRoot 固定为项目内 data/，chooseRoot 保留作为备份恢复入口
ipcMain.handle("data:chooseRoot", async () => {
  const result = await dialog.showOpenDialog({
    title: "选择世界树数据目录（用于迁移/恢复）",
    defaultPath: dataRoot(),
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return readDataRoot(result.filePaths[0]);
});

// 🆕 v0.7.4.1 默认使用项目内 data/，也接受外部路径用于迁移查看
ipcMain.handle("data:readRoot", async (_event, rootPath) => {
  const target = rootPath || dataRoot();
  return readDataRoot(target);
});

ipcMain.handle("export:saveText", async (_event, payload) => {
  const { defaultPath, text, filters } = payload || {};
  const result = await dialog.showSaveDialog({
    title: "导出 World Tree 文件",
    defaultPath,
    filters: filters || [{ name: "Text", extensions: ["txt"] }]
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, text || "", "utf8");
  return result.filePath;
});

ipcMain.handle("cards:import", async () => {
  const result = await dialog.showOpenDialog({
    title: "Import card",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Cards", extensions: ["json", "png", "md", "txt"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map((filePath) => readImportFile(filePath)));
});

ipcMain.handle("app:openConsole", async () => {
  const consolePath = await ensureExternalConsoleFile();
  if (consolePath) return shell.openPath(consolePath);
  return "控制台文件不存在: " + path.join(__dirname, "..", "world-tree-console.html");
});

ipcMain.handle("app:info", async () => ({
  version: app.getVersion(),
  userData: app.getPath("userData"),
  defaultConfig: DEFAULT_CONFIG
  ,
  paths: userDataPaths()
}));

ipcMain.handle("persona:read", async (_event, fileName) => {
  const safeName = String(fileName || "dm-manual.md").replace(/[\\\\/]/g, "");
  const filePath = path.join(__dirname, "..", "personas", safeName);
  return fs.readFile(filePath, "utf8");
});

// ---- M-创作 创作向导 IPC ----
ipcMain.handle("creation:getRequirements", async () => {
  // 动态加载 creation-wizard 模块
  const wizardPath = path.join(__dirname, "core", "data", "creation-wizard.js");
  try {
    const wizard = await import("file:///" + wizardPath.replace(/\\/g, "/"));
    return {
      phases: wizard.CREATION_PHASES,
      requirements: wizard.MODULE_CREATION_REQUIREMENTS,
      priorities: wizard.CREATION_PRIORITY
    };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("creation:generateQuestions", async (_event, payload) => {
  const wizardPath = path.join(__dirname, "core", "data", "creation-wizard.js");
  try {
    const wizard = await import("file:///" + wizardPath.replace(/\\/g, "/"));
    return wizard.generateCreationQuestions(payload?.phases || null, payload?.answers || {});
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("creation:getSummary", async (_event, payload) => {
  const wizardPath = path.join(__dirname, "core", "data", "creation-wizard.js");
  try {
    const wizard = await import("file:///" + wizardPath.replace(/\\/g, "/"));
    return {
      summary: wizard.generateCreationSummary(payload?.answers || {}),
      suggestions: wizard.getCrossModuleSuggestions(payload?.answers || {})
    };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("creation:getDefaults", async (_event, payload) => {
  const wizardPath = path.join(__dirname, "core", "data", "creation-wizard.js");
  try {
    const wizard = await import("file:///" + wizardPath.replace(/\\/g, "/"));
    return wizard.quickStartDefaults(payload?.worldType || "daily");
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("creation:saveModule", async (_event, payload) => {
  const answers = payload?.answers || {};
  const moduleName = String(answers["M1.moduleName"] || payload?.moduleName || "新模组").trim();
  const moduleType = answers["M1.moduleType"] || payload?.moduleType || "daily";
  const rootPath = await configuredDataRoot();
  const modulePath = resolveDataChildPath(rootPath, moduleName, "moduleName");

  // 创建基础目录结构
  const dirs = [
    modulePath,
    path.join(modulePath, "shared"),
    path.join(modulePath, "branches", "main", "archive"),
    path.join(modulePath, "branches", "main", "tracking"),
    path.join(modulePath, "context"),
    path.join(modulePath, "saves"),
    path.join(modulePath, "presets"),
  ];
  for (const dir of dirs) await fs.mkdir(dir, { recursive: true });

  // 写入 module.json（含完整创作信息）
  const moduleJson = {
    name: moduleName,
    type: moduleType,
    version: "1.0",
    created: new Date().toISOString(),
    creationAnswers: answers,
    _writtenBy: "world-tree-desktop",
    _writtenAt: new Date().toISOString(),
    _engineVersion: "world-tree-v12.19-desktop-full"
  };
  await fs.writeFile(path.join(modulePath, "module.json"), JSON.stringify(moduleJson, null, 2), "utf8");

  // 写入初始 canon_state
  await fs.writeFile(path.join(modulePath, "branches", "main", "canon_state.json"), JSON.stringify({
    confirmed: [], implied: [], proposed: [],
    _writtenBy: "world-tree-desktop", _writtenAt: new Date().toISOString()
  }, null, 2), "utf8");

  // 写入初始 runtime
  const opening = answers["M11.openingScene"];
  await fs.writeFile(path.join(modulePath, "branches", "main", "runtime.json"), JSON.stringify({
    scene: { title: opening || "起始场景", location: "", time: answers["M16.startingTime"] || "", summary: "" },
    characters: answers["M8.protagonist"] ? [answers["M8.protagonist"]] : [],
    turnCount: 0,
    _writtenBy: "world-tree-desktop", _writtenAt: new Date().toISOString()
  }, null, 2), "utf8");

  // 写入初始 timeline-tree
  await fs.writeFile(path.join(modulePath, "timeline-tree.json"), JSON.stringify({
    active_branch: "main",
    branches: { main: { created: new Date().toISOString(), parent: null } },
    _writtenBy: "world-tree-desktop"
  }, null, 2), "utf8");

  // 写入空场景链
  await fs.writeFile(path.join(modulePath, "context", "scene_chain.json"), JSON.stringify({ scenes: [] }, null, 2), "utf8");

  // 写入世界书（如有核心条目）
  if (answers["M2.coreEntries"]) {
    const entries = Array.isArray(answers["M2.coreEntries"]) ? answers["M2.coreEntries"] : 
      String(answers["M2.coreEntries"]).split("\n").filter(Boolean).map((e, i) => ({
        id: `entry-${i+1}`, keys: [e.split("：")[0] || e.split(":")[0] || `key-${i+1}`],
        content: e.split("：").slice(1).join("：") || e.split(":").slice(1).join(":") || e,
        priority: 100, mode: "trigger", matchMode: "exact+semantic", layer: "context"
      }));
    await fs.writeFile(path.join(modulePath, "shared", "worldbook.json"), JSON.stringify({ entries }, null, 2), "utf8");
  }

  // 写入预设（故事模板）
  const preset = {
    _meta: { name: moduleName, worldbook: moduleName, createdAt: new Date().toISOString(), active: true },
    style: { 
      storyType: answers["M12.storyType"] || "通用", length: answers["M12.length"] || "中篇",
      pace: answers["M12.stylePreset"] || "normal"
    },
    protagonist: answers["M8.protagonist"] || null,
    motivation: {
      goal: answers["M12.protagonistMotivation"] || "", 
      conflict: answers["M12.coreConflict"] || ""
    },
    openingScene: { location: opening || "", time: answers["M16.startingTime"] || "" }
  };
  await fs.writeFile(path.join(modulePath, "presets", "default.json"), JSON.stringify(preset, null, 2), "utf8");

  return {
    created: true,
    moduleName, modulePath, moduleType,
    filesCreated: ["module.json","timeline-tree.json","canon_state.json","runtime.json","scene_chain.json",
      answers["M2.coreEntries"] ? "worldbook.json" : null,
      "default.json"
    ].filter(Boolean)
  };
});

// ═══════════════════════════════════════════════════════════════
//  v0.8.0 健康检查 + 采纳机制 IPC
// ═══════════════════════════════════════════════════════════════

ipcMain.handle("health:check", async (_event, payload) => {
  const moduleKey = payload?.moduleKey || "";
  const moduleType = payload?.moduleType || "daily";
  try {
    const healthPath = path.join(__dirname, "core", "engine", "health-check.js");
    const health = await import("file:///" + healthPath.replace(/\\/g, "/"));
    // 构建最小 model 供健康检查使用
    const model = {
      moduleKey,
      moduleType,
      moduleData: {
        characters: payload?.characters || [],
        scenes: payload?.scenes || [],
        organizations: payload?.organizations || [],
        worldbook: payload?.worldbook || { entries: [] },
        tracking: payload?.tracking || [],
        timeline: payload?.timeline || [],
        canon: payload?.canon || {}
      }
    };
    const result = health.runHealthCheck(model);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("pending:list", async (_event, payload) => {
  const moduleKey = payload?.moduleKey || "";
  try {
    const overlay = await loadOverlayStore();
    if (payload && Object.prototype.hasOwnProperty.call(payload, "round")) {
      overlay.tickPending(moduleKey, payload.round);
    }
    const items = overlay.listPending(moduleKey);
    return { ok: true, items, count: items.length };
  } catch (e) {
    return { ok: false, error: e.message, items: [] };
  }
});

ipcMain.handle("pending:adopt", async (_event, payload) => {
  const moduleKey = payload?.moduleKey || "";
  const pendingId = payload?.pendingId || "";
  try {
    const overlay = await loadOverlayStore();
    const adopted = overlay.adoptPending(moduleKey, pendingId);
    if (!adopted) return { ok: false, error: "未找到待确认项或已过期" };
    // 实际写入 overlay
    if (adopted.path && adopted.value != null) {
      await overlayWrite({ path: adopted.path, mode: adopted.mode, value: adopted.value });
    }
    return { ok: true, adopted };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("pending:reject", async (_event, payload) => {
  const moduleKey = payload?.moduleKey || "";
  const pendingId = payload?.pendingId || "";
  try {
    const overlay = await loadOverlayStore();
    const rejected = overlay.rejectPending(moduleKey, pendingId);
    return { ok: rejected, rejected };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════
//  v2 内容系统升级 — 新模块 IPC 通道
// ═══════════════════════════════════════════════════════════════

// ── 内容注册表 ──
ipcMain.handle("contentRegistry:list", async () => {
  try {
    const regPath = path.join(__dirname, "core", "engine", "content-registry.js");
    const reg = await import("file:///" + regPath.replace(/\\/g, "/"));
    return {
      types: reg.CONTENT_TYPES,
      activeTypes: reg.activeTypes(),
      injectableTypes: reg.injectableTypes(),
      searchableFields: reg.searchableFields()
    };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("contentRegistry:findById", async (_event, typeId) => {
  try {
    const regPath = path.join(__dirname, "core", "engine", "content-registry.js");
    const reg = await import("file:///" + regPath.replace(/\\/g, "/"));
    return reg.findById(typeId);
  } catch (e) {
    return { error: e.message };
  }
});

// ── 提案系统 ──
ipcMain.handle("proposal:list", async (_event, payload) => {
  const status = payload?.status || "pending";
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    return { items: prop.getByStatus(status), stats: prop.getProposalStats() };
  } catch (e) {
    return { error: e.message, items: [] };
  }
});

ipcMain.handle("proposal:pendingConfirmations", async () => {
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    return { items: prop.getPendingUserConfirmations() };
  } catch (e) {
    return { error: e.message, items: [] };
  }
});

ipcMain.handle("proposal:adopt", async (_event, payload) => {
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    return prop.adoptProposal(payload?.proposalId);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("proposal:commit", async (_event, payload) => {
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    const result = prop.commitProposal(payload?.proposalId, payload?.by || "user");
    const writeResult = await writeProposalPatch(result, payload || {});
    return writeResult ? { ...result, writeResult } : result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("proposal:reject", async (_event, payload) => {
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    return prop.rejectProposal(payload?.proposalId, payload?.reason);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("proposal:reverse", async (_event, payload) => {
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    return prop.reverseProposal(payload?.proposalId, payload?.reason);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("proposal:tick", async (_event, payload) => {
  try {
    const propPath = path.join(__dirname, "core", "engine", "proposal-system.js");
    const prop = await import("file:///" + propPath.replace(/\\/g, "/"));
    return prop.tickProposals(payload?.round || 0);
  } catch (e) {
    return { error: e.message };
  }
});

// ── 角色关系 ──
ipcMain.handle("relations:getFor", async (_event, name) => {
  try {
    const relPath = path.join(__dirname, "core", "data", "relations.js");
    const rel = await import("file:///" + relPath.replace(/\\/g, "/"));
    return { graph: rel.getRelationGraph(name), raw: rel.getRelationsFor(name) };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("relations:set", async (_event, payload) => {
  try {
    const relPath = path.join(__dirname, "core", "data", "relations.js");
    const rel = await import("file:///" + relPath.replace(/\\/g, "/"));
    return rel.setRelation(payload || {});
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("relations:network", async () => {
  try {
    const relPath = path.join(__dirname, "core", "data", "relations.js");
    const rel = await import("file:///" + relPath.replace(/\\/g, "/"));
    return rel.networkSummary();
  } catch (e) {
    return { error: e.message };
  }
});

// ── 时间线因果链 ──
ipcMain.handle("timeline:traceImpact", async (_event, payload) => {
  try {
    const tlPath = path.join(__dirname, "core", "data", "timeline-causality.js");
    const tl = await import("file:///" + tlPath.replace(/\\/g, "/"));
    return tl.traceImpact(payload?.eventId, payload?.maxDepth || 5);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("timeline:traceCauses", async (_event, payload) => {
  try {
    const tlPath = path.join(__dirname, "core", "data", "timeline-causality.js");
    const tl = await import("file:///" + tlPath.replace(/\\/g, "/"));
    return tl.traceCauses(payload?.eventId, payload?.maxDepth || 5);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("timeline:whatWouldChange", async (_event, payload) => {
  try {
    const tlPath = path.join(__dirname, "core", "data", "timeline-causality.js");
    const tl = await import("file:///" + tlPath.replace(/\\/g, "/"));
    return tl.whatWouldChange(payload?.eventId, payload?.maxDepth || 5);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("timeline:echoes", async (_event, payload) => {
  try {
    const tlPath = path.join(__dirname, "core", "data", "timeline-causality.js");
    const tl = await import("file:///" + tlPath.replace(/\\/g, "/"));
    return { echoes: tl.checkEchoesForChapter(payload?.chapter || "") };
  } catch (e) {
    return { error: e.message };
  }
});

// ── 五层记忆 ──
ipcMain.handle("memory:search", async (_event, payload) => {
  try {
    const memPath = path.join(__dirname, "core", "engine", "memory-layers.js");
    const mem = await import("file:///" + memPath.replace(/\\/g, "/"));
    return { results: mem.crossLayerSearch(payload?.keyword, payload?.layers || "all") };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("memory:snapshot", async () => {
  try {
    const memPath = path.join(__dirname, "core", "engine", "memory-layers.js");
    const mem = await import("file:///" + memPath.replace(/\\/g, "/"));
    return mem.exportMemorySnapshot();
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("memory:sessionSummary", async () => {
  try {
    const memPath = path.join(__dirname, "core", "engine", "memory-layers.js");
    const mem = await import("file:///" + memPath.replace(/\\/g, "/"));
    return mem.sessionSummary();
  } catch (e) {
    return { error: e.message };
  }
});

// ── Guardian v2 综合检查 ──
ipcMain.handle("guardian:fullCheck", async (_event, payload) => {
  try {
    const guardPath = path.join(__dirname, "core", "engine", "guardian.js");
    const guard = await import("file:///" + guardPath.replace(/\\/g, "/"));
    return guard.runFullGuardian(payload || {});
  } catch (e) {
    return { error: e.message };
  }
});

// ── 枝干系统 ──
ipcMain.handle("branch:tree", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.getBranchTree(root, payload?.worldName || "");
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("branch:create", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.createBranch(root, payload?.worldName, payload?.sourceBranch || "main", payload);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("branch:merge", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.mergeBranch(root, payload?.worldName, payload?.sourceBranch, payload?.targetBranch || "main");
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("branch:executeMerge", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.executeMerge(root, payload?.worldName, payload?.sourceBranch, payload?.targetBranch, payload?.confirmedProposals || []);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("branch:abandon", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.abandonBranch(root, payload?.worldName, payload?.branchId, payload?.reason);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("branch:revive", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.reviveBranch(root, payload?.worldName, payload?.branchId);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("branch:compare", async (_event, payload) => {
  try {
    const bsPath = path.join(__dirname, "core", "engine", "branch-system.js");
    const bs = await import("file:///" + bsPath.replace(/\\/g, "/"));
    const root = worldsAbsRoot();
    return bs.compareBranches(root, payload?.worldName, payload?.branchA, payload?.branchB);
  } catch (e) {
    return { error: e.message };
  }
});

// ── 导演模式 ──
ipcMain.handle("director:modes", async () => {
  try {
    const dmPath = path.join(__dirname, "core", "engine", "director-modes.js");
    const dm = await import("file:///" + dmPath.replace(/\\/g, "/"));
    return { modes: dm.listDirectorModes() };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("director:getMode", async (_event, modeId) => {
  try {
    const dmPath = path.join(__dirname, "core", "engine", "director-modes.js");
    const dm = await import("file:///" + dmPath.replace(/\\/g, "/"));
    return dm.getDirectorMode(modeId);
  } catch (e) {
    return { error: e.message };
  }
});

// ── 世界脉象 ──
ipcMain.handle("telemetry:calculate", async (_event, payload) => {
  try {
    const wtPath = path.join(__dirname, "core", "engine", "world-telemetry.js");
    const wt = await import("file:///" + wtPath.replace(/\\/g, "/"));
    return wt.calculateTelemetry(
      payload?.worldName || "_default",
      payload?.round || 0,
      payload?.data || {},
      {}
    );
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("telemetry:profile", async (_event, payload) => {
  try {
    const wtPath = path.join(__dirname, "core", "engine", "world-telemetry.js");
    const wt = await import("file:///" + wtPath.replace(/\\/g, "/"));
    const worldName = typeof payload === "string" ? payload : payload?.worldName || "";
    return wt.getProfile(worldName);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("telemetry:register", async (_event, payload) => {
  try {
    const wtPath = path.join(__dirname, "core", "engine", "world-telemetry.js");
    const wt = await import("file:///" + wtPath.replace(/\\/g, "/"));
    const profile = wt.registerTelemetryProfile(payload?.worldName, payload?.config || {});
    return { ok: true, profile };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("telemetry:buildPrompt", async (_event, payload) => {
  try {
    const wtPath = path.join(__dirname, "core", "engine", "world-telemetry.js");
    const wt = await import("file:///" + wtPath.replace(/\\/g, "/"));
    return { prompt: wt.buildDimensionSelectionPrompt(payload || {}) };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("telemetry:userSummary", async (_event, payload) => {
  try {
    const wtPath = path.join(__dirname, "core", "engine", "world-telemetry.js");
    const wt = await import("file:///" + wtPath.replace(/\\/g, "/"));
    return { summary: wt.userSummary(payload) };
  } catch (e) {
    return { error: e.message };
  }
});
