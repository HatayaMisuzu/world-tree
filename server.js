// server.js — World Tree Web 服务器
// 替代原本的 Electron 主进程，以纯 HTTP 方式提供后端 API
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, createReadStream, rmSync } from "node:fs";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, dirname, extname, resolve, basename, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".");
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
const PORT = process.env.PORT || 3000;
const HOST = process.env.WORLD_TREE_HOST || "127.0.0.1";
const MAX_BODY_BYTES = Number(process.env.WORLD_TREE_MAX_BODY_BYTES || 20 * 1024 * 1024);

// ═══════════════════════════════════════════════════════════════
//  安全：仅允许本地访问（桌面应用）
// ═══════════════════════════════════════════════════════════════

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_STATIC = 300;
const RATE_MAX_API = 120;
const rateMap = new Map();

// 定期清理过期速率限制条目（每 120s，防止内存泄漏）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS * 2) rateMap.delete(key);
  }
}, 120_000).unref(); // unref 防止阻止进程退出

// ═══════════════════════════════════════════════════════════════
//  全局调试日志缓冲区（--debug 模式或 Ctrl+Shift+D 触发）
// ═══════════════════════════════════════════════════════════════

const DEBUG_MODE = process.argv.includes("--debug");
const DEBUG_LOG = [];
const DEBUG_MAX = 200;

// 异步检查 GitHub 最新版本（非阻塞）
let latestVersion = null;
(async () => {
  try {
    const resp = await fetch("https://api.github.com/repos/HatayaMisuzu/world-tree/releases/latest", {
      headers: { "User-Agent": "world-tree" },
      signal: AbortSignal.timeout(5000)
    });
    if (resp.ok) {
      const release = await resp.json();
      latestVersion = release.tag_name?.replace(/^v/, "") || null;
    }
  } catch { /* 网络不可达，静默忽略 */ }
})();

function debugLog(category, message, data = null) {
  if (!DEBUG_MODE) return;
  const entry = {
    ts: new Date().toISOString(),
    category,
    message,
    ...(data ? { data: typeof data === "object" ? JSON.stringify(data).slice(0, 500) : String(data).slice(0, 500) } : {})
  };
  DEBUG_LOG.push(entry);
  if (DEBUG_LOG.length > DEBUG_MAX) DEBUG_LOG.shift();
  console.log(`[${category}] ${message}`);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopbackAddress(addr = "") {
  addr = String(addr || "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function parseOriginHost(value = "") {
  try { return value ? new URL(value).hostname : ""; }
  catch { return ""; }
}

function isLocalRequest(req) {
  const remote = req.socket?.remoteAddress || "";
  if (!isLoopbackAddress(remote)) return false;
  const host = String(req.headers.host || "").split(":")[0];
  if (host && !LOCAL_HOSTS.has(host)) return false;
  const originHost = parseOriginHost(req.headers.origin || "");
  if (originHost && !LOCAL_HOSTS.has(originHost)) return false;
  const refererHost = parseOriginHost(req.headers.referer || "");
  if (refererHost && !LOCAL_HOSTS.has(refererHost)) return false;
  return true;
}

function isLocalAddress(value = "") {
  const addr = String(value || "").replace(/^::ffff:/, "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "localhost";
}

function isLocalUrl(value = "") {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

function checkRateLimit(remoteAddr, limit) {
  const now = Date.now();
  const key = remoteAddr || "127.0.0.1";
  let entry = rateMap.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateMap.set(key, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

// ═══════════════════════════════════════════════════════════════
//  JSONL 工具函数
// ═══════════════════════════════════════════════════════════════

/** 追加一行 JSON 到 JSONL 文件（异步写入，非阻塞） */
async function appendJsonl(filePath, record) {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, JSON.stringify(record) + "\n", "utf-8");
}

/** 读取 JSONL 文件末尾 N 行（流式反向读取，避免大文件 OOM） */
async function readJsonlTail(filePath, N = 50) {
  if (!existsSync(filePath)) return [];
  try {
    // 对于小文件（< 10MB）直接读取；大文件用流式反向读
    const stat = statSync(filePath);
    if (stat.size < 10 * 1024 * 1024) {
      const text = await readFile(filePath, "utf-8");
      const lines = text.trim().split("\n").filter(Boolean);
      const tail = lines.slice(-N);
      return tail.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean);
    }
    // 大文件：从末尾反向读取 chunk 直到拿到足够的行
    const CHUNK = 64 * 1024; // 64KB chunks
    const chunks = [];
    let offset = stat.size;
    let lines = [];
    const fd = await (await import("node:fs/promises")).open(filePath, "r");
    try {
      while (offset > 0 && lines.length < N + 5) {
        const readSize = Math.min(CHUNK, offset);
        offset -= readSize;
        const buf = Buffer.alloc(readSize);
        await fd.read(buf, 0, readSize, offset);
        chunks.unshift(buf.toString("utf-8"));
        lines = chunks.join("").split("\n").filter(Boolean);
      }
    } finally {
      await fd.close();
    }
    const tail = lines.slice(-N);
    return tail.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean);
  } catch (err) {
    console.warn("[readJsonlTail] 读取失败:", filePath, err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
//  路径与默认配置
// ═══════════════════════════════════════════════════════════════

function dataRoot() {
  return join(ROOT, "data");
}

function configPath() {
  return join(ROOT, "userData", "config.json");
}

function secretsPath() {
  return join(ROOT, "userData", "secrets.json");
}

const DEFAULT_CONFIG = {
  hermesBaseUrl: "http://127.0.0.1:8642",
  llmBaseUrl: "https://api.deepseek.com/v1",
  llmModel: "deepseek-v4-flash",
  llmTimeoutMs: 60000,
  connectionProfileId: "deepseek",
  lastModuleKey: "",
  moduleHistory: [],
  theme: "dark",
  language: "zh-CN",
  firstRun: true
};

// ═══════════════════════════════════════════════════════════════
//  配置管理
// ═══════════════════════════════════════════════════════════════

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readJsonSync(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadConfig() {
  return { ...DEFAULT_CONFIG, ...readJson(configPath(), {}) };
}

async function saveConfig(update) {
  const current = await loadConfig();
  const next = { ...current, ...update };
  delete next.llmApiKey;
  await writeJson(configPath(), next);
  return next;
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 4) return "****";
  // 短密钥仅保留最后1位
  if (value.length <= 8) return `${"*".repeat(value.length - 1)}${value.slice(-1)}`;
  return `${"*".repeat(6)}${value.slice(-4)}`;
}

async function loadSecrets() {
  const s = readJson(secretsPath(), {});
  const llm = s.llm || {};
  return { llm: { active: llm.active || "default", items: Array.isArray(llm.items) ? llm.items : [] } };
}

async function saveSecrets(secrets) {
  await writeJson(secretsPath(), secrets);
  return getSecretState();
}

async function getSecretState() {
  const secrets = await loadSecrets();
  const active = secrets.llm.items.find(i => i.id === secrets.llm.active) || secrets.llm.items[0] || null;
  return {
    llm: {
      active: active?.id || "",
      items: secrets.llm.items.map(i => ({ id: i.id, label: i.label || i.id, masked: maskSecret(i.value || ""), active: i.id === (active?.id || "") }))
    }
  };
}

async function getActiveLlmValue() {
  const secrets = await loadSecrets();
  const active = secrets.llm.items.find(i => i.id === secrets.llm.active) || secrets.llm.items[0] || null;
  return active?.value || "";
}

async function saveLlmSecret(payload) {
  const label = String(payload?.label || "Default").trim() || "Default";
  const value = String(payload?.value || "").trim();
  // 拒绝保存掩码格式的 key（防止旧掩码被写回）
  // 检测4个及以上连续 * 号，或全 * 号字符串
  if (/\*{4,}/.test(value) || /^\*+$/.test(value)) {
    return await getSecretState();
  }
  const id = String(payload?.id || "default").replace(/[^\w.-]/g, "-") || "default";
  const secrets = await loadSecrets();
  const nextItem = { id, label, value };
  const items = [nextItem, ...secrets.llm.items.filter(i => i.id !== id)];
  return saveSecrets({ ...secrets, llm: { active: id, items } });
}

// ═══════════════════════════════════════════════════════════════
//  LLM 测试连接
// ═══════════════════════════════════════════════════════════════

async function testLlmConnection(payload) {
  const started = Date.now();
  const config = { ...DEFAULT_CONFIG, ...(payload?.config || {}) };
  // 从本地 secrets.json 读取密钥（不信任前端传递的明文 key）
  const apiKey = await getActiveLlmValue();
  const baseUrl = String(config.llmBaseUrl || payload?.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return errorPayload("LLM_BASE_URL_MISSING", "还没有填写 AI 服务地址。请在设置中填写 OpenAI 兼容接口地址。", "llmBaseUrl is empty");
  if (!apiKey) return errorPayload("LLM_API_KEY_MISSING", "还没有填写 API Key。请先在设置中保存你的 LLM 访问密钥。", "active LLM secret is empty");
  if (!/^https?:\/\//.test(baseUrl)) return errorPayload("LLM_BASE_URL_INVALID", "AI 服务地址格式不正确。地址应以 http:// 或 https:// 开头。", `Invalid base URL: ${baseUrl}`);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const text = await response.text();
    if (!response.ok) return llmHttpError(response.status, text);
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    return errorPayload("LLM_NETWORK_ERROR", "无法连接到 AI 服务。请检查网络、API 地址，或确认本地模型服务已经启动。", error?.message || "fetch failed");
  }
}

// ═══════════════════════════════════════════════════════════════
//  引擎模块管理
// ═══════════════════════════════════════════════════════════════

const WORLDS_DIR = () => join(dataRoot(), "engine", "worlds");
const CHARACTERS_DIR = () => join(dataRoot(), "engine", "characters");
const PROFILES_DIR = () => join(ROOT, "defaults", "world-profiles");
const EXAMPLES_DIR = () => join(ROOT, "defaults", "examples");
const EXAMPLE_MANIFEST = () => join(EXAMPLES_DIR(), "manifest.json");
const CONNECTIONS_PATH = () => join(ROOT, "userData", "connections.json");
const REVIEW_QUEUE_PATH = () => join(ROOT, "userData", "alchemy-review.json");
const PLUGINS_DIR = () => join(ROOT, "userData", "plugins");
const TURN_DEBUG_DIR = (moduleId = "global") => join(ROOT, "userData", "turn-debug", slugName(moduleId, "global"));

function slugName(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/[^\w\u4e00-\u9fff\-_]/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || fallback;
}

function uniqueDirName(parentDir, rawName) {
  const base = slugName(rawName, "example");
  let candidate = base;
  let i = 2;
  while (existsSync(join(parentDir, candidate))) {
    candidate = `${base}_${i++}`;
  }
  return candidate;
}

function copyDirSync(sourceDir, targetDir) {
  ensureDir(targetDir);
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(targetDir, entry.name);
    if (entry.isDirectory()) copyDirSync(source, target);
    else writeFileSync(target, readFileSync(source));
  }
}

function resolveExamplePath(relativePath = "") {
  const root = resolve(EXAMPLES_DIR());
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
    throw new Error("Example path is outside defaults/examples");
  }
  return target;
}

function loadExampleManifest() {
  const manifest = readJsonSync(EXAMPLE_MANIFEST(), { version: 1, examples: [] });
  return {
    version: manifest.version || 1,
    examples: Array.isArray(manifest.examples) ? manifest.examples : []
  };
}

function publicExample(item) {
  return {
    id: item.id,
    type: item.type,
    name: item.name || item.id,
    description: item.description || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    dataMode: item.dataMode || (item.type === "character" ? "character_card" : "worldbook"),
    subType: item.subType || "classic"
  };
}

function listExamples() {
  return loadExampleManifest().examples
    .filter((item) => item?.id && item?.type && item?.path)
    .map(publicExample);
}

async function installExample(body = {}) {
  const id = String(body.id || "").trim();
  if (!id) return { status: "error", code: "EXAMPLE_ID_MISSING", errorMsg: "缺少示例 ID。" };

  const item = loadExampleManifest().examples.find((candidate) => candidate.id === id);
  if (!item) return { status: "error", code: "EXAMPLE_NOT_FOUND", errorMsg: "没有找到这个内置示例。" };

  const sourceDir = resolveExamplePath(item.path);
  if (!existsSync(sourceDir)) return { status: "error", code: "EXAMPLE_SOURCE_MISSING", errorMsg: "示例文件缺失，无法安装。" };

  const now = new Date().toISOString();
  if (item.type === "world") {
    const worldsDir = WORLDS_DIR();
    ensureDir(worldsDir);
    const worldName = uniqueDirName(worldsDir, item.targetName || item.id);
    const worldDir = join(worldsDir, worldName);
    copyDirSync(sourceDir, worldDir);
    ensureDir(join(worldDir, "shared"));
    ensureDir(join(worldDir, "runtime"));

    const world = {
      ...readJsonSync(join(worldDir, "world.json"), {}),
      name: worldName,
      displayName: item.name || worldName,
      dataMode: item.dataMode || "worldbook",
      subType: item.subType || "classic",
      preset: item.preset || "epic",
      sourceExample: item.id,
      createdAt: now,
      updatedAt: now,
      turnCount: 0
    };
    await writeJson(join(worldDir, "world.json"), world);

    const sharedDefaults = [
      ["worldbook.json", { entries: [] }],
      ["characters.json", []],
      ["scenes.json", []],
      ["relations.json", {}],
      ["timeline.json", {}],
      ["world_state.json", {}],
      ["organizations.json", []],
      ["locations.json", []],
      ["races.json", []],
      ["rules.json", []]
    ];
    for (const [file, fallback] of sharedDefaults) {
      const target = join(worldDir, "shared", file);
      if (!existsSync(target)) await writeJson(target, fallback);
    }

    const statePath = join(worldDir, "runtime", "state.json");
    const state = {
      turnCount: 0,
      activeBranch: "main",
      lastScene: "",
      lastInput: "",
      engineState: {
        dataMode: world.dataMode,
        directorMode: "hybrid",
        preset: world.preset,
        contextBudget: "balanced",
        emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
      },
      createdAt: now,
      updatedAt: now,
      ...readJsonSync(statePath, {})
    };
    await writeJson(statePath, state);
    if (!existsSync(join(worldDir, "runtime", "chat.jsonl"))) writeFileSync(join(worldDir, "runtime", "chat.jsonl"), "", "utf-8");
    if (!existsSync(join(worldDir, "runtime", "memory.jsonl"))) writeFileSync(join(worldDir, "runtime", "memory.jsonl"), "", "utf-8");

    return {
      status: "ok",
      example: publicExample(item),
      module: { id: worldName, name: worldName, displayName: world.displayName, type: "world", dataMode: world.dataMode, subType: world.subType, preset: world.preset, turnCount: 0 }
    };
  }

  if (item.type === "character") {
    const charsDir = join(dataRoot(), "engine", "characters");
    ensureDir(charsDir);
    const card = readJsonSync(join(sourceDir, "card.json"), null);
    const charName = uniqueDirName(charsDir, item.targetName || card?.名称 || card?.name || item.id);
    const charDir = join(charsDir, charName);
    copyDirSync(sourceDir, charDir);
    ensureDir(join(charDir, "runtime"));
    if (!existsSync(join(charDir, "runtime", "chat.jsonl"))) writeFileSync(join(charDir, "runtime", "chat.jsonl"), "", "utf-8");
    await writeJson(join(charDir, "runtime", "state.json"), {
      turnCount: 0,
      sourceExample: item.id,
      createdAt: now,
      updatedAt: now,
      engineState: { dataMode: "character_card", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } }
    });
    const displayName = card?.名称 || card?.name || item.name || charName;
    return {
      status: "ok",
      example: publicExample(item),
      module: { id: `char:${charName}`, name: charName, displayName, type: "character_card", dataMode: "character_card", subType: "default", preset: "minimal", turnCount: 0 }
    };
  }

  return { status: "error", code: "EXAMPLE_TYPE_UNSUPPORTED", errorMsg: "这个示例类型暂不支持安装。" };
}

/** 列出所有可用模组（世界 + 配置模板） */
function listModules() {
  const modules = [];

  // 1. 已有世界（data/engine/worlds/）
  const worldsDir = WORLDS_DIR();
  if (existsSync(worldsDir)) {
    for (const entry of readdirSync(worldsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const meta = readJsonSync(join(worldsDir, entry.name, "world.json"), {});
        const rt = readJsonSync(join(worldsDir, entry.name, "runtime", "state.json"), {}) || readJsonSync(join(worldsDir, entry.name, "runtime.json"), {});
        modules.push({
          id: entry.name,
          name: meta.displayName || entry.name,
          displayName: meta.displayName || entry.name,
          type: "world",
          dataMode: meta.dataMode || "worldbook",
          subType: meta.subType || "classic",
          preset: meta.preset || "epic",
          turnCount: rt.turnCount || 0,
          lastPlayed: rt.updatedAt || "",
          createdAt: meta.createdAt || "",
          source: "data/engine/worlds"
        });
      }
    }
  }

  // 2. 世界配置模板（defaults/world-profiles/）
  const profilesDir = PROFILES_DIR();
  if (existsSync(profilesDir)) {
    for (const entry of readdirSync(profilesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const profile = readJsonSync(join(profilesDir, entry.name), {});
        if (profile.status === "active") {
          modules.push({
            id: `profile:${profile.id}`,
            name: profile.name || profile.id,
            displayName: profile.name || profile.id,
            type: "profile",
            dataMode: profile.basedOn || "worldbook",
            subType: profile.id,
            preset: profile.defaultPreset || "epic",
            turnCount: 0,
            description: profile.description || "",
            isPlaceholder: false,
            source: "defaults/world-profiles"
          });
        }
      }
    }
  }

  return modules.sort((a, b) => b.turnCount - a.turnCount || b.name?.localeCompare?.(a.name, "zh-CN") || 0);
}

/** 从配置模板创建新世界（新目录结构 shared/ + runtime/） */
async function createModule(body) {
  const { name, displayName, dataMode, subType, preset } = body || {};
  // 安全截断：使用 Array.from 确保多字节字符（emoji/生僻字）不被截断
  const rawName = String(name || displayName || "新世界");
  const cleaned = rawName.replace(/[^\w\u4e00-\u9fff\-_]/gu, "_").replace(/^_+|_+$/g, "");
  const safeChars = Array.from(cleaned);
  const worldName = safeChars.slice(0, 48).join("") || `world_${Date.now()}`;
  const worldsDir = WORLDS_DIR();
  ensureDir(worldsDir);
  const worldDir = join(worldsDir, worldName);
  if (existsSync(worldDir)) return { status: "error", errorMsg: `模组「${worldName}」已存在` };
  mkdirSync(worldDir, { recursive: true });
  mkdirSync(join(worldDir, "shared"), { recursive: true });
  mkdirSync(join(worldDir, "runtime"), { recursive: true });

  const worldData = { name: worldName, displayName: displayName || worldName, dataMode: dataMode || "worldbook", subType: subType || "classic", preset: preset || "epic", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), turnCount: 0 };
  await writeJson(join(worldDir, "world.json"), worldData);
  // state.json 包含完整引擎状态
  await writeJson(join(worldDir, "runtime", "state.json"), {
    turnCount: 0, activeBranch: "main", lastScene: "", lastInput: "",
    engineState: { dataMode: dataMode || "worldbook", directorMode: "hybrid", preset: preset || "epic", contextBudget: "balanced", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  // 初始化空日志
  await writeFile(join(worldDir, "runtime", "chat.jsonl"), "", "utf-8");
  await writeFile(join(worldDir, "runtime", "memory.jsonl"), "", "utf-8");
  // 初始化 shared — 引擎所有模块可能读的文件
  for (const [file, dflt] of [["worldbook.json",{entries:[]}],["characters.json",[]],["scenes.json",[]],["relations.json",{}],["timeline.json",{}],["world_state.json",{}],["organizations.json",[]],["locations.json",[]],["races.json",[]],["rules.json",[]]]) {
    await writeJson(join(worldDir, "shared", file), dflt);
  }

  return { status: "ok", module: { id: worldName, name: worldName, displayName: displayName || worldName, type: "world", dataMode, subType, preset, turnCount: 0 } };
}

/** 删除世界模组 */
async function deleteModule(moduleId) {
  const worldDir = moduleWorldDir(moduleId);
  if (!worldDir || !pathWithinRoot(WORLDS_DIR(), worldDir)) return { status: "error", errorMsg: "模组 ID 无效" };
  if (!existsSync(worldDir)) return { status: "error", errorMsg: "模组不存在" };
  rmSync(worldDir, { recursive: true, force: true });
  return { status: "ok" };
}

/** 构建引擎 model 对象（从新目录结构加载，含 chat 历史） */
async function buildModuleModel(moduleId) {
  const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, ""), "");
  const worldDir = moduleWorldDir(moduleId);
  const empty = { loaded: true, selected: { id: worldName, name: worldName, path: worldDir, branch: "main" }, moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, relations: {}, timeline: {}, worldState: {}, organizations: [], races: [], runtime: {}, tracking: [], canon: {} }, entities: [], turnCount: 0 };
  if (!worldDir || !pathWithinRoot(WORLDS_DIR(), worldDir) || !existsSync(worldDir)) return empty;

  const world = readJsonSync(join(worldDir, "world.json"), {});
  const state = readJsonSync(join(worldDir, "runtime", "state.json"), {}) || readJsonSync(join(worldDir, "runtime.json"), {}); // 兼容旧格式
  const shared = join(worldDir, "shared");

  return {
    loaded: true,
    selected: { id: worldName, name: worldName, path: worldDir, branch: state.activeBranch || "main" },
    moduleData: {
      characters: readJsonSync(join(shared, "characters.json"), []) || readJsonSync(join(shared, "characters_base.json"), []),
      scenes: readJsonSync(join(shared, "scenes.json"), []),
      worldbook: readJsonSync(join(shared, "worldbook.json"), { entries: [] }),
      relations: readJsonSync(join(shared, "relations.json"), {}),
      timeline: readJsonSync(join(shared, "timeline.json"), {}),
      worldState: readJsonSync(join(shared, "world_state.json"), {}),
      organizations: readJsonSync(join(shared, "organizations.json"), []),
      locations: readJsonSync(join(shared, "locations.json"), []),
      races: readJsonSync(join(shared, "races.json"), []),
      rules: readJsonSync(join(shared, "rules.json"), []),
      runtime: state || {},
      tracking: [], canon: {}
    },
    entities: [],
    turnCount: state.turnCount || world.turnCount || 0,
    // 读取上轮 overlay 数据（runtime/overlay/ 下的增量文件）
    _overlay: readOverlayData(worldDir)
  };
}

function readOverlayData(worldDir) {
  const overlayDir = join(worldDir, "runtime", "overlay");
  if (!existsSync(overlayDir)) return null;
  return {
    runtime: readJsonSync(join(overlayDir, "runtime-overlay.json"), null),
    canon: readJsonSync(join(overlayDir, "canon-overlay.json"), null),
    characters: readJsonSync(join(overlayDir, "characters-overlay.json"), null),
    worldbook: readJsonSync(join(overlayDir, "worldbook-overlay.json"), null),
    sceneChain: readJsonSync(join(overlayDir, "scene-chain.json"), null),
  };
}

/** 完整持久化：保存引擎状态 + 对话记录 + 记忆快照 + overlay writeSet */
async function persistTurn(moduleId, input, result, engineState) {
  const isCharacter = String(moduleId || "").startsWith("char:");
  const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, "").replace(/^char:/, ""), "");
  const baseDir = isCharacter ? join(CHARACTERS_DIR(), worldName) : moduleWorldDir(moduleId);
  if (!worldName || !baseDir || !pathWithinRoot(isCharacter ? CHARACTERS_DIR() : WORLDS_DIR(), baseDir)) return null;
  if (!existsSync(baseDir)) return null;
  const rtDir = join(baseDir, "runtime");
  ensureDir(rtDir);

  const metaFile = isCharacter ? join(rtDir, "state.json") : join(baseDir, "world.json");
  const turnCount = (readJsonSync(metaFile, {}).turnCount || 0) + 1;
  const now = new Date().toISOString();
  const userId = `turn-${turnCount}-user`;
  const assistantId = `turn-${turnCount}-assistant`;

  // 🔄 自动备份 chat.jsonl（保留最近 5 个备份）
  const chatPath = join(rtDir, "chat.jsonl");
  if (existsSync(chatPath)) {
    const backupDir = join(rtDir, "backups");
    ensureDir(backupDir);
    try {
      const backupName = `chat-${now.replace(/[:.]/g, "-")}.jsonl`;
      await (await import("node:fs/promises")).copyFile(chatPath, join(backupDir, backupName));
      // 轮转：保留最近 5 个
      const backups = readdirSync(backupDir).filter(f => f.startsWith("chat-")).sort().reverse();
      for (const old of backups.slice(5)) {
        try { rmSync(join(backupDir, old), { force: true }); } catch {}
      }
    } catch { /* 备份失败不影响主流程 */ }
  }

  // state.json — 完整覆盖
  await writeJson(join(rtDir, "state.json"), { turnCount, activeBranch: "main", lastScene: result.parsedSections?.["状态"]?.scene || "", lastInput: input, engineState: engineState || {}, updatedAt: now });

  // chat.jsonl — 追加用户+助手消息（截断阈值放宽：上下文窗口充足无需过度紧缩）
  await appendJsonl(join(rtDir, "chat.jsonl"), { id: userId, role: "user", content: input.slice(0, 8000), round: turnCount, ts: now, favorite: false });
  await appendJsonl(join(rtDir, "chat.jsonl"), { id: assistantId, role: "assistant", content: (result.narrative || "").slice(0, 10000), round: turnCount, ts: new Date().toISOString(), sections: result.parsedSections || {}, favorite: false, candidates: [{ id: `${assistantId}-c0`, content: (result.narrative || "").slice(0, 10000), selected: true, createdAt: now }] });

  // memory.jsonl — 追加记忆快照
  if (result.overlayPatch?.memorySnapshot) {
    await appendJsonl(join(rtDir, "memory.jsonl"), result.overlayPatch.memorySnapshot);
  }

  // execute overlay writeSet — 引擎产的增量数据写进 runtime/overlay/
  if (result.writeSet?.length) {
    const overlayDir = join(rtDir, "overlay");
    ensureDir(overlayDir);
    for (const op of result.writeSet) {
      try {
        const opPath = join(overlayDir, basename(op.path));
        if (op.mode === "append-json-array" && Array.isArray(op.value)) {
          const existing = readJsonSync(opPath, []);
          if (!Array.isArray(existing)) {  await writeJson(opPath, op.value); continue; }
          existing.push(...op.value);
          await writeJson(opPath, existing.slice(-200));
        } else if (op.mode === "merge-json") {
          const existing = readJsonSync(opPath, {});
          await writeJson(opPath, { ...existing, ...(op.value || {}) });
        } else if (op.mode === "write-json") {
          await writeJson(opPath, op.value || {});
        } else if (op.mode === "append-jsonl") {
          await appendJsonl(opPath + ".jsonl", op.value || {});
        } else {
          console.warn("[persistTurn] 未知 writeSet 模式:", op.mode, op.path);
        }
      } catch (e) { console.warn("[persistTurn] writeSet 执行失败:", op.path, e.message); }
    }
  }

  // world.json — 更新轮次
  if (isCharacter) {
    const st = readJsonSync(join(rtDir, "state.json"), {});
    await writeJson(join(rtDir, "state.json"), { ...st, turnCount, lastInput: input, engineState: engineState || {}, updatedAt: now });
  } else {
    const wj = readJsonSync(join(baseDir, "world.json"), {});
    wj.turnCount = turnCount; wj.updatedAt = now;
    await writeJson(join(baseDir, "world.json"), wj);
  }
  return { userId, assistantId, turnCount };
}

// ═══════════════════════════════════════════════════════════════
//  LLM 对话
// ═══════════════════════════════════════════════════════════════

async function handleLlmChat(body) {
  const { input, moduleKey, dataMode, engineState, messages } = body || {};
  if (!input) return { status: "error", errorMsg: "请输入内容后再发送" };

  const config = await loadConfig();
  const apiKey = await getActiveLlmValue();
  if (!apiKey) return { status: "error", errorMsg: "未配置 API Key → 请在首页「LLM 配置」中设置密钥" };
  if (!config.llmBaseUrl || !config.llmModel) return { status: "error", errorMsg: "未配置 LLM 地址和模型 → 请在首页「LLM 配置」中填写" };

  // 懒加载引擎模块
  const { sendDualStageTurn, canUseDirectLlm } = await import("./src/adapters/llm.js");
  const { normalizeEngineState, DEFAULT_ENGINE_STATE } = await import("./src/core/engine/modules.js");

  if (!canUseDirectLlm(config, Boolean(apiKey))) {
    return { status: "error", errorMsg: "LLM 配置不完整，请检查地址、模型和 API Key" };
  }

  // 构建 model 对象
  const model = moduleKey ? await buildModuleModel(moduleKey) : {
    loaded: true, selected: { id: "default", name: "默认" },
    moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, relations: {}, timeline: {}, worldState: {}, organizations: [], races: [], runtime: {}, tracking: [], canon: {} },
    entities: [], turnCount: 0
  };

  // 标准化引擎状态
  const normState = normalizeEngineState(engineState || DEFAULT_ENGINE_STATE);

  // 计算世界书注入条目（使用统一 matchEntries 引擎）
  const { worldbookEntriesFromModel } = await import("./src/core/cards.js");
  const { matchEntries, buildVectorIndex } = await import("./src/core/data/worldbook.js");
  const { budgetFor } = await import("./src/core/engine/context-budget.js");
  const budget = budgetFor(normState.contextBudget || "balanced");
  const entries = worldbookEntriesFromModel(model, {});
  const vectors = buildVectorIndex(entries);
  const injectedWorldbook = matchEntries({ entries }, input || "", {
    limit: budget.worldbookEntries || 10,
    mode: "both",
    scanMessages: (messages || []).slice(-10).map(m => m.content || ""),
    sceneName: normState?.sceneName || "",
    previousScene: normState?.previousSceneName || "",
    vectors,
    vectorThreshold: normState?.vectorThreshold || 0.5
  });

  debugLog("engine", `世界书匹配: ${injectedWorldbook.length} 条注入`, { dataMode: dataMode || "worldbook", moduleKey });

  try {
    // 按 dataMode 构建模式专属 writer 包（仅角色卡模式走 buildCharacterCardPacket）
    let writerPacket = null;
    let effectiveState = normState;
    if (dataMode === "character_card") {
      const { buildEnginePacket } = await import("./src/core/world-engine.js");
      const { characterCardMode } = await import("./src/core/data/character-card.js");

      // 从 data/engine/characters/{charId}/card.json 加载角色卡数据
      let cardData = null;
      const charId = safeEntityId(String(moduleKey || "").replace(/^world:/, "").replace(/^char:/, ""), "");
      if (charId) {
        const charDir = join(CHARACTERS_DIR(), charId);
        const cardJsonPath = pathWithinRoot(CHARACTERS_DIR(), charDir) ? join(charDir, "card.json") : "";
        if (existsSync(cardJsonPath)) {
          cardData = readJsonSync(cardJsonPath, null);
        }
      }

      const ccState = { ...normState, dataMode: "character_card" };
      effectiveState = ccState;
      const cardContext = cardData ? [{ kind: "character-card", ...cardData }] : [];
      writerPacket = buildEnginePacket({
        model, input,
        engineState: ccState,
        injectedWorldbook,
        knowledgeCards: [],
        cardContext,
        turnPrep: null,
        proximityData: null
      });
    }

    // 记录各阶段耗时
    const startedAt = Date.now();
    const progress = { startedAt, stages: [] };

    const result = await sendDualStageTurn({ model, config: { ...config, llmBaseUrl: config.llmBaseUrl, llmModel: config.llmModel }, apiKey, messages: messages || [], input, injectedWorldbook, engineState: effectiveState, moduleKey: moduleKey || "unloaded", dataMode: dataMode || "worldbook", skipDirector: true, skipGuardian: false, useLlmAnalysis: true, writerPacket });

    // 构建阶段耗时
    const elapsed = Date.now() - startedAt;
    if (result._dualStage) {
      const ds = result._dualStage;
      progress.stages.push({ name: "分析", description: "LLM 分析输入语义", active: ds.usedDirectorLLM });
      progress.stages.push({ name: "导演", description: "生成叙事方向包", active: true });
      progress.stages.push({ name: "写作", description: "LLM 生成叙事正文", active: true });
      progress.stages.push({ name: "校验", description: "Guardian 质量审查", active: result.guardianResult != null, score: result.guardianResult?.score });
    }
    progress.totalMs = elapsed;
    debugLog("llm", `对话完成 (${elapsed}ms)`, { turnCount: model.turnCount, guardianScore: result.guardianResult?.score });

    // 优先从【叙事】段提取纯正文，避免标记段（【状态建议】【情绪反馈】等）污染故事文本
    // LLM 输出以【叙事】开头时，parseMarkedOutput→completeTurn 回退到 rawText（含标记段）
    const sections = result.parsedSections || {};
    const narrativeFromSection = sections["叙事"]?._raw || "";
    const cleanNarrative = narrativeFromSection || result.narrative || "";

    // 完整持久化（用清理后的纯叙事文本，而非带标记段的 rawText）
    let persistedIds = null;
    if (moduleKey && !moduleKey.startsWith("__")) {
      const persistResult = { ...result, narrative: cleanNarrative };
      persistedIds = await persistTurn(moduleKey, input, persistResult, result.engineState || normState);
      await saveTurnDebug(moduleKey, {
        moduleKey,
        input,
        summary: `${injectedWorldbook.length} 条世界书命中，Guardian ${result.guardianResult?.score ?? "未评分"}`,
        worldbookHits: injectedWorldbook,
        characterState: dataMode === "character_card" ? { moduleKey, mode: "character_card" } : { characters: model.moduleData?.characters || [] },
        memorySnapshot: result.overlayPatch?.memorySnapshot || {},
        directionPacket: result.directorResult?.packet || result.directionPacket || result._dualStage?.directionPacket || {},
        guardian: result.guardianResult || {},
        parsedSections: sections,
        engineState: result.engineState || normState
      });
    }

    return { status: "ok", narrative: cleanNarrative, parsedSections: sections, engineState: result.engineState || normState, turnCount: persistedIds?.turnCount || (model.turnCount || 0) + 1, persistedIds, _dualStage: result._dualStage || null, _progress: progress };
  } catch (err) { return { status: "error", errorMsg: err?.message || "LLM 调用失败" }; }
}

// ═══════════════════════════════════════════════════════════════
//  内容炼金台
// ═══════════════════════════════════════════════════════════════

/** 构建炼金台 LLM 调用适配器 */
function buildAlchemyLlmCall(config, apiKey) {
  if (!apiKey || !config.llmBaseUrl || !config.llmModel) return null;
  const baseUrl = String(config.llmBaseUrl).replace(/\/$/, "");
  const timeoutMs = Number(config.llmTimeoutMs || 60000);
  return async (system, user) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.3,
        max_tokens: 2048
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    try {
      return { parsed: JSON.parse(content), raw: content };
    } catch {
      return { parsed: null, raw: content, parseError: true };
    }
  };
}

async function handleAlchemyImport(body) {
  const { text } = body || {};
  if (!text) return { status: "error", errorMsg: "导入内容为空" };
  try {
    const config = await loadConfig();
    const apiKey = await getActiveLlmValue();
    const llmCall = buildAlchemyLlmCall(config, apiKey);
    const { importFile } = await import("./src/core/data/alchemy/alchemy-engine.js");
    const result = await importFile(text, { llmCall, options: { autoRelations: true } });
    const reviewItems = await enqueueReviewItems(result?.items || [], { source: "alchemy-import", snippet: String(text).slice(0, 240) });
    return {
      status: "ok",
      format: result?.format,
      items: result?.items || [],
      reviewItems,
      stats: { ...(result?.stats || {}), mode: llmCall ? "llm" : "js-only" },
      phases: result?.phases || []
    };
  } catch (err) { return { status: "error", errorMsg: err?.message || "炼金台导入失败" }; }
}

/** 炼金台 → 模组创建：解析内容 → 生成世界书条目 或 角色卡引擎数据 */
async function handleAlchemyDigest(body) {
  const { text, worldName, dataMode = "worldbook", subType = "classic", preset = "epic" } = body || {};
  if (!text) return { status: "error", errorMsg: "内容为空" };
  try {
    const config = await loadConfig();
    const apiKey = await getActiveLlmValue();
    const llmCall = buildAlchemyLlmCall(config, apiKey);
    // 1. 调用炼金台引擎解析
    const { importFile } = await import("./src/core/data/alchemy/alchemy-engine.js");
    const result = await importFile(text, { llmCall, options: { autoRelations: true } });
    const items = result?.items || [];
    if (!items.length) return { status: "error", errorMsg: "未提取到有效内容" };

    // ── 角色卡模式：VC-3 人格提炼 + 输出 card.json ──
    if (dataMode === "character_card") {
      const { buildCharacterRefineryPrompt, parseRefineryResponse, flattenToCardJson } = await import("./src/core/data/skill-generator.js");
      const config = await loadConfig();
      const apiKey = await getActiveLlmValue();
      if (!apiKey) return { status: "error", errorMsg: "未配置 API Key，无法调用 LLM 进行人格提炼" };
      if (!config.llmBaseUrl || !config.llmModel) return { status: "error", errorMsg: "未配置 LLM" };

      // 调用 LLM 做人格提炼
      const messages = buildCharacterRefineryPrompt(text, items);
      const refineUrl = `${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`;
      const refineRes = await fetch(refineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: config.llmModel, messages, temperature: 0.3, max_tokens: 4096 }),
        signal: AbortSignal.timeout(config.llmTimeoutMs || 60000)
      });
      if (!refineRes.ok) return { status: "error", errorMsg: `LLM 调用失败: HTTP ${refineRes.status}` };
      const refineData = await refineRes.json();
      const rawContent = refineData?.choices?.[0]?.message?.content || "";
      const refined = parseRefineryResponse(rawContent);
      if (!refined) return { status: "error", errorMsg: "人格提炼结果解析失败，请重试" };

      // 转换为扁平的 card.json 格式
      const cardJson = flattenToCardJson(refined);
      if (!cardJson) return { status: "error", errorMsg: "人格数据转换失败" };

      // 创建角色卡目录 data/engine/characters/{name}/
      const charName = String(cardJson.名称 || worldName || "未命名角色").replace(/[^\w\u4e00-\u9fff\-_]/gu, "_").replace(/^_+|_+$/g, "").slice(0, 48) || `char_${Date.now()}`;
      const charsDir = join(dataRoot(), "engine", "characters");
      ensureDir(charsDir);
      const charDir = join(charsDir, charName);
      if (existsSync(charDir)) return { status: "error", errorMsg: `角色卡「${charName}」已存在` };
      mkdirSync(charDir, { recursive: true });
      mkdirSync(join(charDir, "runtime"), { recursive: true });

      // 写入 card.json
      await writeJson(join(charDir, "card.json"), cardJson);
      // 初始化空对话记录（writeFileSync 保持空文件）
      writeFileSync(join(charDir, "runtime", "chat.jsonl"), "", "utf-8");
      await writeJson(join(charDir, "runtime", "state.json"), { turnCount: 0, engineState: { dataMode: "character_card", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } } });

      return {
        status: "ok",
        module: { id: `char:${charName}`, name: charName, displayName: cardJson.名称 || charName, type: "character_card", dataMode: "character_card", subType: "default", preset: "minimal", turnCount: 0 },
        entries: 0, characters: 1, locations: 0, organizations: 0, rules: 0,
        characterCard: true,
        alchemyMode: "llm"
      };
    }

    // ── 世界书模式：原有流程 ──
    // 2. items → worldbook entries
    const entries = [];
    const characters = [], locations = [], orgs = [], rules = [];
    for (const item of items) {
      const e = { keys: [], content: "", type: item.typeId };
      switch (item.typeId) {
        case "character":
          e.keys = [item.entity, ...(item.data?.aliases || [])];
          e.content = objToText(item.data, ["name","role","traits","background","motivation"]);
          characters.push({ id: item.entity, name: item.entity, role: item.data?.role || "", traits: item.data?.traits || [], background: item.data?.background || "", confidence: item.confidence });
          break;
        case "location":
          e.keys = [item.entity];
          e.content = objToText(item.data, ["name","type","description","region","features"]);
          locations.push({ id: item.entity, name: item.entity, type: item.data?.type || "", description: item.data?.description || "" });
          break;
        case "organization": case "faction":
          e.keys = [item.entity];
          e.content = objToText(item.data, ["name","type","description","goals","members"]);
          orgs.push({ id: item.entity, name: item.entity, type: item.data?.type || "", description: item.data?.description || "" });
          break;
        case "rule": e.keys = [item.entity]; e.content = objToText(item.data, ["name","category","description","constraints"]); rules.push(item.data); break;
        case "event": e.keys = [item.entity]; e.content = objToText(item.data, ["title","time","description","involved_entities"]); break;
        case "item": e.keys = [item.entity]; e.content = objToText(item.data, ["name","type","description","owner"]); break;
        default: e.keys = [item.entity]; e.content = item.data?.description || item.entity; break;
      }
      if (e.keys.length && e.content) entries.push(e);
    }

    // 3. 创建模组
    const module = await createModule({ name: worldName || "解析世界", displayName: worldName || "炼金台解析", dataMode, subType, preset });
    if (module.status !== "ok") return module;

    // 4. 写入 shared 数据
    const worldDir = moduleWorldDir(module.module.id);
    if (!worldDir || !pathWithinRoot(WORLDS_DIR(), worldDir)) {
      return { status: "error", errorMsg: "新世界目录无效，已阻止写入。" };
    }
    await writeJson(join(worldDir, "shared", "worldbook.json"), { entries });
    await writeJson(join(worldDir, "shared", "characters.json"), characters);
    if (locations.length) await writeJson(join(worldDir, "shared", "locations.json"), locations);
    if (orgs.length) await writeJson(join(worldDir, "shared", "organizations.json"), orgs);
    if (rules.length) await writeJson(join(worldDir, "shared", "rules.json"), rules);

    return { status: "ok", module: module.module, entries: entries.length, characters: characters.length, locations: locations.length, organizations: orgs.length, rules: rules.length, alchemyMode: llmCall ? "llm" : "js-only" };
  } catch (err) { return { status: "error", errorMsg: err?.message || "炼金台消化失败" }; }
}

function objToText(data, fields) {
  return fields.map(f => data?.[f] ? `${f}: ${typeof data[f]==="object"?JSON.stringify(data[f]):data[f]}` : "").filter(Boolean).join("\n") || "";
}

function sanitizeFileKey(key = "") {
  const clean = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
  if (!clean || clean.includes("\0")) return "";
  const parts = clean.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) return "";
  if (isAbsolute(clean)) return "";
  return clean;
}

function pathWithinRoot(rootPath, targetPath) {
  const root = resolve(rootPath);
  const target = resolve(targetPath);
  const rel = relative(root, target);
  return rel === "" || (rel && !rel.startsWith("..") && !isAbsolute(rel));
}

function resolveInside(rootPath, unsafePath = "") {
  const clean = String(unsafePath || "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || isAbsolute(clean)) return null;
  const target = resolve(rootPath, clean);
  return pathWithinRoot(rootPath, target) ? target : null;
}

function safeEntityId(value = "", fallback = "item") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return /^[\w\u4e00-\u9fff-]+$/u.test(raw) ? raw.slice(0, 48) : fallback;
}

function moduleWorldDir(moduleKey = "") {
  const worldName = safeEntityId(String(moduleKey || "").replace(/^world:/, ""), "");
  if (!worldName || worldName.startsWith("__") || worldName.startsWith("char:")) return null;
  return join(WORLDS_DIR(), worldName);
}

function moduleRuntimeDir(moduleKey = "") {
  const key = String(moduleKey || "");
  if (!key || key.startsWith("__")) return null;
  if (key.startsWith("char:")) {
    const charId = safeEntityId(key.replace(/^char:/, ""), "");
    return charId ? join(CHARACTERS_DIR(), charId, "runtime") : null;
  }
  const worldDir = moduleWorldDir(key);
  return worldDir ? join(worldDir, "runtime") : null;
}

function moduleMetaPath(moduleKey = "") {
  const key = String(moduleKey || "");
  if (key.startsWith("char:")) {
    const charId = safeEntityId(key.replace(/^char:/, ""), "");
    return charId ? join(CHARACTERS_DIR(), charId, "runtime", "state.json") : null;
  }
  const worldDir = moduleWorldDir(key);
  return worldDir ? join(worldDir, "runtime", "state.json") : null;
}

function readWorldShared(moduleKey = "") {
  const worldDir = moduleWorldDir(moduleKey);
  if (!worldDir || !existsSync(worldDir)) return null;
  return {
    worldDir,
    sharedDir: join(worldDir, "shared"),
    world: readJsonSync(join(worldDir, "world.json"), {})
  };
}

function normalizeSTCardToNative(card = {}) {
  const now = new Date().toISOString();
  return {
    name: card.name || card.raw?.data?.name || "未命名角色",
    名称: card.name || card.raw?.data?.name || "未命名角色",
    description: card.description || "",
    描述: card.description || "",
    personality: card.personality || "",
    性格: card.personality || "",
    scenario: card.scenario || "",
    背景: card.scenario || "",
    first_mes: card.firstMessage || "",
    首次对话: card.firstMessage || "",
    mes_example: card.messageExamples || "",
    对话示例: card.messageExamples || "",
    creatorNotes: card.creatorNotes || "",
    systemPrompt: card.systemPrompt || "",
    postHistoryInstructions: card.postHistoryInstructions || "",
    alternateGreetings: card.alternateGreetings || [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    creator: card.creator || "",
    source: "sillytavern",
    format: card.format || "native",
    importedAt: now,
    raw: card.raw || null
  };
}

function publicCharacterFromDir(entryName) {
  const cardJson = readJsonSync(join(CHARACTERS_DIR(), entryName, "card.json"), null);
  if (!cardJson) return null;
  const name = cardJson.名称 || cardJson.name || entryName;
  const tags = Array.isArray(cardJson.tags) ? cardJson.tags : Array.isArray(cardJson.标签) ? cardJson.标签 : [];
  const stat = (() => {
    try { return statSync(join(CHARACTERS_DIR(), entryName, "card.json")); } catch { return null; }
  })();
  return {
    id: entryName,
    name,
    displayName: name,
    description: cardJson.描述 || cardJson.description || "",
    tags,
    format: cardJson.format || "native",
    creator: cardJson.creator || "",
    sceneCount: cardJson.初次见面 || cardJson.first_mes ? 1 : 0,
    hasData: true,
    source: "local",
    updatedAt: stat ? stat.mtime.toISOString() : ""
  };
}

function listCharacters() {
  const result = [];
  const charsDir = CHARACTERS_DIR();
  if (!existsSync(charsDir)) return result;
  for (const entry of readdirSync(charsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const item = publicCharacterFromDir(entry.name);
    if (item) result.push(item);
  }
  return result.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") || a.name.localeCompare(b.name, "zh-CN"));
}

async function handleCharacterImport(body = {}) {
  const filename = String(body.filename || body.name || "character.json");
  let input = body.card || body.json || body.data || body.content || null;
  try {
    if (typeof input === "string") {
      const text = input.trim();
      if (text.startsWith("data:image/png;base64,")) {
        input = Buffer.from(text.replace(/^data:image\/png;base64,/, ""), "base64");
      } else if (body.encoding === "base64" || filename.toLowerCase().endsWith(".png")) {
        input = Buffer.from(text.replace(/^data:[^,]+,/, ""), "base64");
      } else {
        input = JSON.parse(text);
      }
    }
  } catch (err) {
    return { status: "error", code: "CHARACTER_IMPORT_PARSE_FAILED", errorMsg: "角色卡内容不是有效 JSON，或 PNG 元数据无法解析。", detail: err.message };
  }

  const { parseSTCard } = await import("./src/core/data/alchemy/parsers/st-card.js");
  const parsed = parseSTCard(input);
  if (!parsed) {
    return { status: "error", code: "CHARACTER_IMPORT_UNSUPPORTED", errorMsg: "未识别到 SillyTavern v2/v3 或 World Tree 角色卡数据。PNG 需要包含 chara 元数据。" };
  }

  const cardJson = normalizeSTCardToNative(parsed);
  const charsDir = CHARACTERS_DIR();
  ensureDir(charsDir);
  const charName = uniqueDirName(charsDir, cardJson.名称 || filename.replace(/\.[^.]+$/, "") || "character");
  const charDir = join(charsDir, charName);
  mkdirSync(charDir, { recursive: true });
  ensureDir(join(charDir, "runtime"));
  await writeJson(join(charDir, "card.json"), cardJson);
  await writeJson(join(charDir, "import-meta.json"), {
    filename,
    format: parsed.format,
    importedAt: cardJson.importedAt,
    source: "sillytavern"
  });
  if (parsed.characterBook?.entries?.length) {
    const entries = parsed.characterBook.entries.map((entry, index) => ({
      id: entry.uid || `charbook-${index + 1}`,
      keys: entry.keys || [],
      content: entry.content || "",
      enabled: entry.enabled !== false,
      priority: entry.insertion_order ?? entry.priority ?? 100,
      mode: entry.constant ? "persistent" : "trigger",
      source: "character_book"
    })).filter(entry => entry.keys.length && entry.content);
    if (entries.length) await writeJson(join(charDir, "worldbook.json"), { entries });
  }
  if (!existsSync(join(charDir, "runtime", "chat.jsonl"))) writeFileSync(join(charDir, "runtime", "chat.jsonl"), "", "utf-8");
  await writeJson(join(charDir, "runtime", "state.json"), {
    turnCount: 0,
    createdAt: cardJson.importedAt,
    updatedAt: cardJson.importedAt,
    engineState: { dataMode: "character_card", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } }
  });

  return {
    status: "ok",
    character: publicCharacterFromDir(charName),
    module: { id: `char:${charName}`, name: charName, displayName: cardJson.名称 || charName, type: "character_card", dataMode: "character_card", subType: "default", preset: "minimal", turnCount: 0 }
  };
}

async function handleCharacterUpdate(body = {}) {
  const id = safeEntityId(body.id || "", "");
  if (!id) return { status: "error", errorMsg: "缺少角色卡 ID。" };
  const charDir = join(CHARACTERS_DIR(), id);
  const cardPath = join(charDir, "card.json");
  if (!existsSync(cardPath)) return { status: "error", errorMsg: "角色卡不存在。" };
  const card = readJsonSync(cardPath, {});
  const tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || "").split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
  const next = {
    ...card,
    name: String(body.name || card.name || card.名称 || id).trim(),
    名称: String(body.name || card.名称 || card.name || id).trim(),
    description: body.description !== undefined ? String(body.description || "") : card.description,
    描述: body.description !== undefined ? String(body.description || "") : card.描述,
    tags,
    标签: tags,
    notes: body.notes !== undefined ? String(body.notes || "") : card.notes,
    updatedAt: new Date().toISOString()
  };
  await writeJson(cardPath, next);
  return { status: "ok", character: publicCharacterFromDir(id), card: next };
}

function connectionTemplates() {
  return [
    { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", provider: "deepseek" },
    { id: "openai-compatible", label: "OpenAI-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", provider: "openai-compatible" },
    { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto", provider: "openrouter" },
    { id: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.1", provider: "ollama" },
    { id: "claude-compatible", label: "Claude-compatible", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514", provider: "claude-compatible" }
  ];
}

function loadConnectionsRaw() {
  const fallback = {
    active: "deepseek",
    items: [
      { id: "deepseek", label: "DeepSeek", provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", apiKeySecretId: "deepseek", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]
  };
  const raw = readJsonSync(CONNECTIONS_PATH(), fallback);
  return { active: raw.active || raw.items?.[0]?.id || "deepseek", items: Array.isArray(raw.items) ? raw.items : fallback.items };
}

async function saveConnectionsRaw(next) {
  await writeJson(CONNECTIONS_PATH(), next);
  return publicConnections(next);
}

async function secretValueById(secretId = "") {
  const secrets = await loadSecrets();
  return secrets.llm.items.find(i => i.id === secretId)?.value || "";
}

function publicConnections(raw = loadConnectionsRaw()) {
  const secrets = readJsonSync(secretsPath(), { llm: { items: [] } });
  const items = raw.items.map((item) => {
    const secret = (secrets.llm?.items || []).find(i => i.id === (item.apiKeySecretId || item.id));
    return { ...item, hasApiKey: Boolean(secret?.value), maskedKey: maskSecret(secret?.value || ""), active: item.id === raw.active };
  });
  return { status: "ok", active: raw.active, templates: connectionTemplates(), items };
}

async function testConnectionProfile(profile) {
  const started = Date.now();
  const baseUrl = String(profile.baseUrl || "").replace(/\/$/, "");
  const apiKey = await secretValueById(profile.apiKeySecretId || profile.id);
  if (!baseUrl) return errorPayload("CONNECTION_BASE_URL_MISSING", "连接地址为空。", "baseUrl is empty");
  if (!/^https?:\/\//.test(baseUrl)) return errorPayload("CONNECTION_BASE_URL_INVALID", "连接地址必须以 http:// 或 https:// 开头。", baseUrl);
  if (!apiKey && !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost")) return errorPayload("CONNECTION_API_KEY_MISSING", "这个连接还没有保存 API Key。", "secret missing");
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(5000)
    });
    const text = await response.text();
    if (!response.ok) return llmHttpError(response.status, text);
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    return errorPayload("CONNECTION_NETWORK_ERROR", "无法连接到这个模型服务。请检查地址、网络或本地模型是否已启动。", error?.message || "fetch failed");
  }
}

async function handleConnections(body = {}, method = "GET") {
  if (method === "GET") return publicConnections();
  const action = body.action || "upsert";
  const raw = loadConnectionsRaw();
  const now = new Date().toISOString();
  if (action === "delete") {
    const id = String(body.id || "");
    const items = raw.items.filter(i => i.id !== id);
    return saveConnectionsRaw({ active: raw.active === id ? (items[0]?.id || "") : raw.active, items });
  }
  if (action === "duplicate") {
    const source = raw.items.find(i => i.id === body.id);
    if (!source) return { status: "error", errorMsg: "连接档案不存在。" };
    const existing = new Set(raw.items.map(i => i.id));
    let id = slugName(`${source.id}-copy`, "connection-copy");
    let n = 2;
    while (existing.has(id)) id = slugName(`${source.id}-copy-${n++}`, "connection-copy");
    const copy = { ...source, id, label: `${source.label || source.id} Copy`, apiKeySecretId: id, createdAt: now, updatedAt: now };
    return saveConnectionsRaw({ ...raw, items: [copy, ...raw.items] });
  }
  if (action === "setDefault") {
    const id = String(body.id || "");
    const item = raw.items.find(i => i.id === id);
    if (!item) return { status: "error", errorMsg: "连接档案不存在。" };
    await saveConfig({ connectionProfileId: id, llmBaseUrl: item.baseUrl, llmModel: item.model });
    const secrets = await loadSecrets();
    await saveSecrets({ ...secrets, llm: { ...secrets.llm, active: item.apiKeySecretId || item.id } });
    return saveConnectionsRaw({ ...raw, active: id });
  }
  if (action === "test") {
    const item = raw.items.find(i => i.id === body.id) || body.profile;
    if (!item) return { status: "error", errorMsg: "连接档案不存在。" };
    return testConnectionProfile(item);
  }

  const profile = body.profile || body;
  const id = slugName(profile.id || profile.label || profile.provider || "connection", "connection");
  const item = {
    id,
    label: String(profile.label || id).trim() || id,
    provider: profile.provider || "openai-compatible",
    baseUrl: String(profile.baseUrl || "").trim(),
    model: String(profile.model || "").trim(),
    temperature: profile.temperature === "" || profile.temperature === undefined ? undefined : Number(profile.temperature),
    maxTokens: profile.maxTokens === "" || profile.maxTokens === undefined ? undefined : Number(profile.maxTokens),
    topP: profile.topP === "" || profile.topP === undefined ? undefined : Number(profile.topP),
    apiKeySecretId: profile.apiKeySecretId || id,
    notes: String(profile.notes || "").trim(),
    createdAt: raw.items.find(i => i.id === id)?.createdAt || now,
    updatedAt: now
  };
  const key = String(profile.apiKey || "").trim();
  if (key && !/\*{4,}/.test(key)) await saveLlmSecret({ id: item.apiKeySecretId, label: item.label, value: key });
  const items = [item, ...raw.items.filter(i => i.id !== id)];
  const active = body.setDefault ? id : raw.active;
  if (body.setDefault) await saveConfig({ connectionProfileId: id, llmBaseUrl: item.baseUrl, llmModel: item.model });
  return saveConnectionsRaw({ active, items });
}

async function handleWorldbook(body = {}, method = "GET", url = null) {
  const moduleKey = body.moduleKey || url?.searchParams?.get("moduleKey") || "";
  const ctx = readWorldShared(moduleKey);
  if (!ctx) return { status: "error", errorMsg: "请先选择一个世界模组。" };
  const wbPath = join(ctx.sharedDir, "worldbook.json");
  const worldbook = readJsonSync(wbPath, { entries: [] });
  const entries = Array.isArray(worldbook.entries) ? worldbook.entries : [];
  if (method === "GET") return { status: "ok", moduleKey, entries };

  const now = new Date().toISOString();
  let next = entries.map((entry, index) => ({ id: entry.id || `entry-${index + 1}`, enabled: entry.enabled !== false, ...entry }));
  const action = body.action || "replace";
  if (action === "replace") {
    next = Array.isArray(body.entries) ? body.entries : next;
  } else if (action === "upsert") {
    const entry = body.entry || {};
    const id = entry.id || `wb-${Date.now()}`;
    const normalized = {
      id,
      title: entry.title || entry.name || entry.keys?.[0] || id,
      keys: Array.isArray(entry.keys) ? entry.keys : String(entry.keys || "").split(/[,，\n]/).map(s => s.trim()).filter(Boolean),
      content: String(entry.content || ""),
      priority: Number(entry.priority ?? 100),
      enabled: entry.enabled !== false,
      mode: entry.mode || "trigger",
      group: String(entry.group || entry.category || "默认").trim() || "默认",
      notes: String(entry.notes || "").trim(),
      source: entry.source || "manual",
      updatedAt: now,
      createdAt: entry.createdAt || now
    };
    next = [normalized, ...next.filter(e => e.id !== id)];
  } else if (action === "append") {
    const additions = (Array.isArray(body.entries) ? body.entries : []).map((entry, index) => ({
      id: entry.id || `wb-import-${Date.now()}-${index}`,
      title: entry.title || entry.name || entry.keys?.[0] || `导入条目 ${index + 1}`,
      keys: Array.isArray(entry.keys) ? entry.keys : String(entry.keys || entry.keywords || "").split(/[,，\n]/).map(s => s.trim()).filter(Boolean),
      content: String(entry.content || entry.text || entry.description || ""),
      priority: Number(entry.priority ?? 100),
      enabled: entry.enabled !== false,
      mode: entry.mode || "trigger",
      group: String(entry.group || entry.category || "导入").trim() || "导入",
      source: entry.source || "bulk-import",
      createdAt: now,
      updatedAt: now
    })).filter(e => e.content || e.keys.length);
    const ids = new Set(additions.map(e => e.id));
    next = [...additions, ...next.filter(e => !ids.has(e.id))];
  } else if (action === "delete") {
    next = next.filter(e => e.id !== body.id);
  } else if (action === "toggle") {
    next = next.map(e => e.id === body.id ? { ...e, enabled: body.enabled !== false, updatedAt: now } : e);
  }
  await writeJson(wbPath, { ...worldbook, entries: next });
  return { status: "ok", moduleKey, entries: next };
}

async function handleWorldbookTest(body = {}) {
  const ctx = readWorldShared(body.moduleKey || "");
  if (!ctx) return { status: "error", errorMsg: "请先选择一个世界模组。" };
  const worldbook = readJsonSync(join(ctx.sharedDir, "worldbook.json"), { entries: [] });
  const { matchEntries } = await import("./src/core/data/worldbook.js");
  const hits = matchEntries(worldbook, body.input || "", { limit: body.limit || 10 }).map((entry, index) => ({
    id: entry.id || entry.keys?.[0] || `hit-${index + 1}`,
    title: entry.title || entry.name || entry.keys?.[0] || "未命名条目",
    keys: entry.keys || [],
    priority: entry.priority ?? 100,
    matchType: entry.matchType || "unknown",
    reason: entry.matchType === "persistent" ? "常驻条目" : entry.matchType === "exact" ? "关键词精确命中" : entry.matchType === "semantic" ? "语义近似命中" : entry.matchType === "scene" ? "场景变化命中" : "排序命中",
    content: entry.content || ""
  }));
  return { status: "ok", input: body.input || "", hits };
}

function readChatRecords(moduleKey = "") {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir) return [];
  const chatPath = join(rtDir, "chat.jsonl");
  if (!existsSync(chatPath)) return [];
  const text = readFileSync(chatPath, "utf-8").trim();
  return text ? text.split("\n").map((line, index) => {
    try {
      const record = JSON.parse(line);
      return { id: record.id || `line-${index + 1}`, ...record };
    } catch {
      return null;
    }
  }).filter(Boolean) : [];
}

async function writeChatRecords(moduleKey = "", records = []) {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir) return;
  ensureDir(rtDir);
  const chatPath = join(rtDir, "chat.jsonl");
  await writeFile(chatPath, records.map(record => JSON.stringify(record)).join("\n") + (records.length ? "\n" : ""), "utf-8");
}

async function handleChatMessage(body = {}) {
  const moduleKey = body.moduleKey || "";
  const records = readChatRecords(moduleKey);
  const idx = records.findIndex(r => r.id === body.messageId || r.id === body.id);
  if (idx < 0) return { status: "error", errorMsg: "没有找到这条已持久化的消息。旧消息可能需要重新加载后再编辑。" };
  const action = body.action || "edit";
  const now = new Date().toISOString();
  if (action === "edit") records[idx] = { ...records[idx], content: String(body.content || ""), editedAt: now };
  if (action === "delete") records.splice(idx, 1);
  if (action === "favorite") records[idx] = { ...records[idx], favorite: body.favorite !== false, updatedAt: now };
  if (action === "add-candidate") {
    const candidates = Array.isArray(records[idx].candidates) ? records[idx].candidates : [{ id: `${records[idx].id}-c0`, content: records[idx].content, selected: true, createdAt: records[idx].ts || now }];
    candidates.push({ id: `${records[idx].id}-c${candidates.length}`, content: String(body.content || ""), selected: false, createdAt: now });
    records[idx] = { ...records[idx], candidates, updatedAt: now };
  }
  if (action === "select-candidate") {
    const candidates = (records[idx].candidates || []).map(c => ({ ...c, selected: c.id === body.candidateId }));
    const selected = candidates.find(c => c.selected);
    records[idx] = { ...records[idx], candidates, content: selected?.content || records[idx].content, updatedAt: now };
  }
  await writeChatRecords(moduleKey, records);
  return { status: "ok", message: records[idx] || null, messages: records };
}

function loadReviewQueue() {
  const raw = readJsonSync(REVIEW_QUEUE_PATH(), { version: 1, items: [] });
  return { version: 1, items: Array.isArray(raw.items) ? raw.items : [] };
}

async function saveReviewQueue(queue) {
  await writeJson(REVIEW_QUEUE_PATH(), { version: 1, items: queue.items || [] });
  return { status: "ok", items: queue.items || [] };
}

async function enqueueReviewItems(items = [], source = {}) {
  const queue = loadReviewQueue();
  const now = new Date().toISOString();
  const additions = items.map((item, index) => ({
    id: `review-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    typeId: item.typeId || "unknown",
    typeName: item.typeName || item.typeId || "未知",
    entity: item.entity || item.data?.name || item.data?.title || "未命名",
    confidence: item.confidence ?? 0.5,
    source: item.source || source.source || "alchemy",
    sourceSnippet: item.sourceSnippet || source.snippet || "",
    data: item.data || {},
    createdAt: now
  }));
  queue.items = [...additions, ...queue.items].slice(0, 500);
  await saveReviewQueue(queue);
  return additions;
}

async function applyReviewItemToWorld(item, moduleKey = "") {
  const ctx = readWorldShared(moduleKey);
  if (!ctx) return { applied: false, reason: "未选择目标世界" };
  if (item.typeId === "character") {
    const path = join(ctx.sharedDir, "characters.json");
    const current = readJsonSync(path, []);
    const next = [{ id: slugName(item.entity, "character"), name: item.entity, ...(item.data || {}), confirmedAt: new Date().toISOString() }, ...current.filter(c => c.name !== item.entity && c.id !== slugName(item.entity, "character"))];
    await writeJson(path, next);
    return { applied: true, target: "shared/characters.json" };
  }
  const path = join(ctx.sharedDir, "worldbook.json");
  const wb = readJsonSync(path, { entries: [] });
  const entry = {
    id: `review-${slugName(item.entity, "entry")}-${Date.now()}`,
    title: item.data?.title || item.entity,
    keys: item.data?.keywords || item.data?.keys || [item.entity],
    content: item.data?.content || item.data?.description || objToText(item.data || {}, Object.keys(item.data || {})),
    enabled: true,
    priority: 100,
    source: item.source,
    confirmedAt: new Date().toISOString()
  };
  await writeJson(path, { ...wb, entries: [entry, ...(wb.entries || [])] });
  return { applied: true, target: "shared/worldbook.json" };
}

async function handleAlchemyReview(body = {}, method = "GET") {
  const queue = loadReviewQueue();
  if (method === "GET") return { status: "ok", items: queue.items };
  const action = body.action || "list";
  if (action === "clear") return saveReviewQueue({ items: [] });
  const idx = queue.items.findIndex(i => i.id === body.id);
  if (idx < 0) return { status: "error", errorMsg: "审核项不存在。" };
  const item = queue.items[idx];
  if (action === "ignore") queue.items[idx] = { ...item, status: "ignored", reviewedAt: new Date().toISOString() };
  if (action === "confirm") {
    const apply = await applyReviewItemToWorld(item, body.moduleKey || "");
    queue.items[idx] = { ...item, status: apply.applied ? "confirmed" : "approved", apply, reviewedAt: new Date().toISOString() };
  }
  if (action === "merge") {
    const merged = { ...item, data: { ...(item.data || {}), ...(body.data || {}) }, entity: body.entity || item.entity, reviewedAt: new Date().toISOString() };
    queue.items[idx] = merged;
  }
  return saveReviewQueue(queue);
}

async function handleWorldPackExport(body = {}, url = null) {
  const moduleKey = body.moduleKey || url?.searchParams?.get("moduleKey") || "";
  const ctx = readWorldShared(moduleKey);
  if (!ctx) return { status: "error", errorMsg: "请先选择要导出的世界。" };
  const include = {
    world: body.includeWorld !== false,
    worldbook: body.includeWorldbook !== false,
    characters: body.includeCharacters !== false,
    sharedData: body.includeSharedData !== false,
    runtimeState: body.includeRuntimeState === true,
    reviewQueue: body.includeReviewQueue === true
  };
  const sharedFiles = {};
  for (const entry of readdirSync(ctx.sharedDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      if (!include.worldbook && entry.name === "worldbook.json") continue;
      if (!include.characters && entry.name === "characters.json") continue;
      if (!include.sharedData && !["worldbook.json", "characters.json"].includes(entry.name)) continue;
      sharedFiles[`shared/${entry.name}`] = readJsonSync(join(ctx.sharedDir, entry.name), null);
    }
  }
  const optionalFiles = {};
  if (include.runtimeState) {
    const statePath = join(ctx.worldDir, "runtime", "state.json");
    if (existsSync(statePath)) optionalFiles["runtime/state.json"] = readJsonSync(statePath, {});
  }
  if (include.reviewQueue) optionalFiles["userData/alchemy-review.json"] = loadReviewQueue();
  const pack = {
    spec: "worldtree-pack",
    version: 1,
    appVersion: PKG_VERSION,
    exportedAt: new Date().toISOString(),
    summary: {
      name: ctx.world.displayName || ctx.world.name,
      worldName: ctx.world.name,
      dataMode: ctx.world.dataMode || "worldbook",
      includes: [...(include.world ? ["world.json"] : ["world.json:minimal"]), ...Object.keys(sharedFiles), ...Object.keys(optionalFiles)],
      excludes: [
        "userData/secrets.json",
        "runtime/chat.jsonl",
        "runtime/memory.jsonl",
        ...(include.runtimeState ? [] : ["runtime/state.json"]),
        ...(include.reviewQueue ? [] : ["unconfirmed alchemy review items"])
      ]
    },
    include,
    world: include.world ? ctx.world : { name: ctx.world.name, displayName: ctx.world.displayName, dataMode: ctx.world.dataMode, subType: ctx.world.subType },
    files: {
      ...(include.world ? { "world.json": ctx.world } : {}),
      ...sharedFiles,
      ...optionalFiles
    },
    provenance: body.provenance || "User exported local World Tree data."
  };
  return { status: "ok", filename: `${slugName(ctx.world.name || "world", "world")}.worldtree`, pack };
}

async function handleWorldPackImport(body = {}) {
  const pack = body.pack || body;
  if (!pack || pack.spec !== "worldtree-pack" || !pack.files) return { status: "error", errorMsg: "这不是有效的 .worldtree 世界包。" };
  const files = Object.keys(pack.files || {}).filter(sanitizeFileKey);
  const conflictName = safeEntityId(pack.world?.name || pack.summary?.worldName || pack.summary?.name || "", "");
  const conflictDir = conflictName ? moduleWorldDir(`world:${conflictName}`) : null;
  const summary = {
    name: pack.summary?.name || pack.world?.displayName || pack.world?.name || "未命名世界",
    fileCount: files.length,
    sharedFiles: files.filter(f => f.startsWith("shared/")),
    runtimeFiles: files.filter(f => f.startsWith("runtime/")),
    hasConflict: Boolean(conflictDir) && existsSync(conflictDir),
    excludes: pack.summary?.excludes || [],
    exportedAt: pack.exportedAt || ""
  };
  if (body.preview !== false && !body.confirm) return { status: "ok", preview: true, summary };

  const worldName = uniqueDirName(WORLDS_DIR(), body.name || pack.world?.name || summary.name);
  const worldDir = join(WORLDS_DIR(), worldName);
  if (!pathWithinRoot(WORLDS_DIR(), worldDir)) return { status: "error", errorMsg: "世界包目标目录无效。" };
  mkdirSync(worldDir, { recursive: true });
  ensureDir(join(worldDir, "shared"));
  ensureDir(join(worldDir, "runtime"));
  for (const [key, value] of Object.entries(pack.files)) {
    const clean = sanitizeFileKey(key);
    if (!clean || clean.startsWith("runtime/") || clean.includes("secret") || clean.includes("config")) continue;
    const target = clean === "world.json" ? join(worldDir, "world.json") : resolveInside(worldDir, clean);
    if (!target) continue;
    ensureDir(dirname(target));
    await writeJson(target, clean === "world.json" ? { ...(value || {}), name: worldName, displayName: body.displayName || value.displayName || summary.name, importedAt: new Date().toISOString() } : value);
  }
  const worldPath = join(worldDir, "world.json");
  if (!existsSync(worldPath)) {
    await writeJson(worldPath, {
      name: worldName,
      displayName: body.displayName || summary.name,
      dataMode: pack.world?.dataMode || "worldbook",
      subType: pack.world?.subType || "classic",
      importedAt: new Date().toISOString()
    });
  }
  if (!existsSync(join(worldDir, "runtime", "chat.jsonl"))) writeFileSync(join(worldDir, "runtime", "chat.jsonl"), "", "utf-8");
  if (!existsSync(join(worldDir, "runtime", "memory.jsonl"))) writeFileSync(join(worldDir, "runtime", "memory.jsonl"), "", "utf-8");
  await writeJson(join(worldDir, "runtime", "state.json"), { turnCount: 0, activeBranch: "main", importedAt: new Date().toISOString(), engineState: { dataMode: pack.world?.dataMode || "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } } });
  return { status: "ok", module: { id: worldName, name: worldName, displayName: body.displayName || summary.name, type: "world", dataMode: pack.world?.dataMode || "worldbook", subType: pack.world?.subType || "classic", turnCount: 0 } };
}

async function handlePlugins(body = {}, method = "GET") {
  ensureDir(PLUGINS_DIR());
  const statePath = join(ROOT, "userData", "plugins-state.json");
  const state = readJsonSync(statePath, { enabled: {}, errors: {} });
  const plugins = [];
  for (const entry of readdirSync(PLUGINS_DIR(), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(PLUGINS_DIR(), entry.name, "plugin.json");
    const manifest = readJsonSync(manifestPath, null);
    if (!manifest) {
      plugins.push({ id: entry.name, name: entry.name, enabled: false, errors: ["缺少 plugin.json"], capabilities: [], permissions: [] });
      continue;
    }
    const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
    const errors = [];
    if (!manifest.name) errors.push("manifest.name 缺失");
    if (!manifest.version) errors.push("manifest.version 缺失");
    if (!capabilities.every(c => ["importer", "reviewer"].includes(c))) errors.push("v0 只允许 importer / reviewer 能力");
    if (String(manifest.entry || "").startsWith("http")) errors.push("不允许远程脚本入口");
    plugins.push({ id: entry.name, name: manifest.name || entry.name, version: manifest.version || "", capabilities, entry: manifest.entry || "", permissions: manifest.permissions || [], enabled: Boolean(state.enabled[entry.name]) && !errors.length, errors: [...errors, ...(state.errors[entry.name] || [])] });
  }
  if (method === "GET") return { status: "ok", plugins };
  const id = safeEntityId(body.id || "", "");
  if (!id) return { status: "error", errorMsg: "插件 ID 无效。" };
  if (body.action === "enable") state.enabled[id] = true;
  if (body.action === "disable") state.enabled[id] = false;
  if (body.action === "run") {
    const pluginDir = join(PLUGINS_DIR(), id);
    if (!pathWithinRoot(PLUGINS_DIR(), pluginDir)) return { status: "error", errorMsg: "插件目录无效。" };
    const manifest = readJsonSync(join(pluginDir, "plugin.json"), null);
    if (!manifest) return { status: "error", errorMsg: "插件 manifest 不存在。" };
    const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
    if (!capabilities.every(c => ["importer", "reviewer"].includes(c))) return { status: "error", errorMsg: "v0 只允许 importer / reviewer 插件。" };
    if (!state.enabled[id]) return { status: "error", errorMsg: "插件未启用。" };
    const entry = String(manifest.entry || "");
    if (!entry || entry.startsWith("http") || entry.includes("..")) return { status: "error", errorMsg: "插件入口无效或不安全。" };
    const entryPath = join(pluginDir, entry);
    if (!pathWithinRoot(pluginDir, entryPath)) return { status: "error", errorMsg: "插件入口越界。" };
    if (!entry.endsWith(".json")) return { status: "error", errorMsg: "v0 只执行本地 JSON 插件入口，不执行脚本。" };
    const result = readJsonSync(entryPath, null);
    if (!result) return { status: "error", errorMsg: "插件 JSON 入口无法读取。" };
    return { status: "ok", plugin: id, capability: body.capability || capabilities[0], result };
  }
  await writeJson(statePath, state);
  return handlePlugins({}, "GET");
}

async function saveTurnDebug(moduleKey, debug) {
  const dir = TURN_DEBUG_DIR(moduleKey || "global");
  ensureDir(dir);
  await writeJson(join(dir, "latest.json"), { ...debug, updatedAt: new Date().toISOString() });
}

async function handleTurnDebug(url = null) {
  const moduleKey = url?.searchParams?.get("moduleKey") || "global";
  const file = join(TURN_DEBUG_DIR(moduleKey), "latest.json");
  const data = readJsonSync(file, null);
  return { status: "ok", debug: data || { summary: "暂无叙事黑盒数据。发送一轮对话后会生成。", worldbookHits: [], characterState: {}, memorySnapshot: {}, directionPacket: {}, guardian: {} } };
}

/** 加载模组对话历史 */
async function handleModuleHistory(moduleId, limit = 50) {
  const rtDir = moduleRuntimeDir(moduleId);
  if (!rtDir) return { status: "ok", messages: [], turnCount: 0, engineState: {}, lastScene: "" };
  const chatPath = join(rtDir, "chat.jsonl");
  const state = readJsonSync(join(rtDir, "state.json"), {});
  const messages = await readJsonlTail(chatPath, limit);
  return { status: "ok", messages, turnCount: state.turnCount || 0, engineState: state.engineState || {}, lastScene: state.lastScene || "" };
}

// ═══════════════════════════════════════════════════════════════
//  Dashboard 数据端点
// ═══════════════════════════════════════════════════════════════

async function handleDashboardTelemetry(moduleId) {
  const model = await buildModuleModel(moduleId);
  const statePath = moduleStatePath(moduleId);
  const state = statePath ? readJsonSync(statePath, {}) : {};
  const engineState = state.engineState || {};
  let telemetry = null;
  try {
    const { calculateWorldTelemetry } = await import("./src/core/engine/world-telemetry.js");
    const result = calculateWorldTelemetry({ model, engineState, round: state.turnCount || 0 });
    telemetry = result.snapshot || null;
  } catch (e) { telemetry = { error: e.message }; }

  const worldState = model.moduleData?.worldState || {};
  const tracking = model.moduleData?.runtime?.tracking || model.moduleData?.tracking || [];
  const runtime = model.moduleData?.runtime || {};

  return {
    status: "ok",
    telemetry,
    worldState: typeof worldState === "object" ? worldState : {},
    tracking: tracking.map(t => ({ name: t.name || t.id || "", count: t.count || 0 })),
    turnCount: state.turnCount || 0,
    lastScene: state.lastScene || "",
    activeBranch: state.activeBranch || "main"
  };
}

async function handleDashboardEntities(moduleId) {
  const model = await buildModuleModel(moduleId);
  const md = model.moduleData || {};
  let contentStats = { types: 0, totalEntries: 0 };
  try {
    const { CONTENT_TYPES } = await import("./src/core/engine/content-registry.js");
    contentStats = { types: CONTENT_TYPES.length, totalEntries: CONTENT_TYPES.length };
  } catch (e) {}

  return {
    status: "ok",
    characters: (md.characters || []).map(c => ({
      name: c.name || "", role: c.role || "", traits: c.traits || [],
      background: (c.background || "").slice(0, 200), status: c.status || "",
      location: c.location || "", confidence: c.confidence || ""
    })),
    scenes: (md.scenes || []).map(s => ({
      title: s.title || "", location: s.location || "", description: (s.description || "").slice(0, 200),
      characters: s.characters || [], time: s.time || ""
    })),
    organizations: (md.organizations || []).map(o => ({
      name: o.name || "", type: o.type || "", description: (o.description || "").slice(0, 200),
      goals: o.goals || "", members: o.members || []
    })),
    locations: (md.locations || []).map(l => ({
      name: l.name || "", type: l.type || "", description: (l.description || "").slice(0, 200),
      region: l.region || "", features: l.features || []
    })),
    worldbookCount: (md.worldbook?.entries || []).length,
    turnCount: model.turnCount || 0,
    contentStats
  };
}

async function handleDashboardNarrative(moduleId) {
  const model = await buildModuleModel(moduleId);
  const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, ""), "");
  const worldDir = moduleWorldDir(moduleId);
  if (!worldName || !worldDir || !pathWithinRoot(WORLDS_DIR(), worldDir)) {
    return { status: "error", errorMsg: "模组 ID 无效。" };
  }

  // 记忆层
  let memoryStats = { snapshots: 0, recentCount: 0 };
  try {
    const { loadGlobalMemory } = await import("./src/core/engine/global-memory.js");
    const memPath = join(worldDir, "runtime", "memory.jsonl");
    if (existsSync(memPath)) {
      const lines = await readJsonlTail(memPath, 50);
      memoryStats = { snapshots: lines.length, recentCount: lines.length, recentEntries: lines.slice(-5).map(l => ({ summary: (l.summary || l.content || "").slice(0, 120), ts: l.ts || l.createdAt || "" })) };
    }
  } catch (e) { memoryStats = { error: e.message }; }

  // 分支
  let branches = [];
  try {
    const { getBranchTree } = await import("./src/core/engine/branch-system.js");
    const tree = await getBranchTree(worldDir, worldName);
    if (tree && !tree.error) {
      branches = (tree.branches || []).map(b => ({ name: b.name || b.id || "", status: b.status || "active", isActive: b.isActive || false }));
    }
  } catch (e) { branches = [{ name: "main", status: "active" }]; }

  // 因果链
  let causality = { events: [], totalEvents: 0 };
  try {
    const { traceCauses, traceImpact } = await import("./src/core/data/timeline-causality.js");
    const timeline = model.moduleData?.timeline || {};
    const events = Array.isArray(timeline.events) ? timeline.events : Object.values(timeline).filter(e => e && typeof e === "object");
    causality = { events: events.slice(-10).map(e => ({ title: e.title || e.name || "", type: e.type || "", time: e.time || "", dependsOn: e.dependsOn || [] })), totalEvents: events.length };
  } catch (e) { causality = { error: e.message }; }

  // 关系网络
  const relations = model.moduleData?.relations || {};
  const relSummary = typeof relations === "object" ? Object.entries(relations).slice(0, 20).map(([k, v]) => ({ key: k, type: v?.type || "", attitude: v?.attitude || 0 })) : [];

  return {
    status: "ok",
    memory: memoryStats,
    branches,
    causality,
    relations: relSummary,
    turnCount: model.turnCount || 0,
    canonCount: (model.moduleData?.canon?.confirmed || []).length || 0
  };
}

// ═══════════════════════════════════════════════════════════════
//  HTTP 路由
// ═══════════════════════════════════════════════════════════════

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf"
};

const PUBLIC_STATIC_FILES = new Map([
  ["/", "world-tree-console.html"],
  ["/world-tree-console.html", "world-tree-console.html"],
  ["/world-tree-console.css", "world-tree-console.css"],
  ["/world-tree-console.js", "world-tree-console.js"]
]);

async function serveStatic(req, res) {
  // 速率限制
  if (!checkRateLimit(req.socket?.remoteAddress || "127.0.0.1", RATE_MAX_STATIC)) {
    res.writeHead(429, { "Content-Type": "text/plain" });
    return res.end("Too Many Requests");
  }
  const pathname = (() => {
    try { return decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
    catch { return "/"; }
  })();
  const publicFile = PUBLIC_STATIC_FILES.get(pathname);
  if (!publicFile) {
    if (extname(pathname)) return jsonError(res, 404, "STATIC_NOT_FOUND", "静态资源不存在。");
    return serveConsoleShell(res);
  }
  const filePath = join(ROOT, publicFile);
  if (!existsSync(filePath)) return serveConsoleShell(res);
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

function serveConsoleShell(res) {
  const filePath = join(ROOT, "world-tree-console.html");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  createReadStream(filePath).pipe(res);
}

function errorPayload(code, userMsg, detail = "") {
  return { status: "error", code, userMsg, errorMsg: userMsg, detail: String(detail || "") };
}

function llmHttpError(status, detail = "") {
  if (status === 401 || status === 403) return errorPayload("LLM_AUTH_FAILED", "API Key 无效或没有权限。请检查密钥是否复制完整，或确认服务商账号状态。", detail || `HTTP ${status}`);
  if (status === 402) return errorPayload("LLM_QUOTA_EXHAUSTED", "AI 服务额度不足或账号欠费。请检查服务商控制台的余额和配额。", detail || "HTTP 402");
  if (status === 429) return errorPayload("LLM_RATE_LIMITED", "AI 服务请求过于频繁。请稍等片刻再试，或降低连续发送速度。", detail || "HTTP 429");
  if (status >= 500) return errorPayload("LLM_UPSTREAM_ERROR", "AI 服务暂时没有正常响应。请稍后重试。", detail || `HTTP ${status}`);
  return errorPayload("LLM_HTTP_ERROR", "AI 服务返回了无法处理的错误。请查看技术细节并检查配置。", detail || `HTTP ${status}`);
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function jsonError(res, status, code, userMsg, detail = "") {
  return jsonResponse(res, errorPayload(code, userMsg, detail), status);
}

// ═══════════════════════════════════════════════════════════════
//  HTTP 错误类与请求体解析
// ═══════════════════════════════════════════════════════════════

class HttpError extends Error {
  constructor(status, code, userMsg, detail = "") {
    super(userMsg);
    Object.assign(this, { status, code, userMsg, detail });
  }
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers["content-length"] || 0);
    if (len > limit) {
      reject(new HttpError(413, "BODY_TOO_LARGE", "导入内容过大，请缩小文件后重试。", `content-length=${len}`));
      return;
    }
    const chunks = [];
    let total = 0;
    req.on("data", chunk => {
      total += chunk.length;
      if (total > limit) {
        req.destroy(new Error("BODY_TOO_LARGE"));
        reject(new HttpError(413, "BODY_TOO_LARGE", "请求内容过大。", `received=${total}`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", err => {
      reject(err);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf-8").trim();
      if (!text) { resolve({}); return; }
      let data;
      try { data = JSON.parse(text); }
      catch (err) {
        reject(new HttpError(400, "INVALID_JSON", "请求内容不是有效 JSON。", err.message));
        return;
      }
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        reject(new HttpError(400, "INVALID_JSON_BODY", "请求内容必须是 JSON 对象。", `type=${typeof data}`));
        return;
      }
      resolve(data);
    });
  });
}

async function handleAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // 速率限制（API 路由）
  if (!checkRateLimit(req.socket?.remoteAddress || "127.0.0.1", RATE_MAX_API)) {
    return jsonError(res, 429, "RATE_LIMITED", "请求太频繁了。请稍等一分钟再试。", "API rate limit exceeded");
  }

  // CORS — 仅允许本地来源，不反射攻击者 Origin
  const origin = req.headers.origin || "";
  const originHost = parseOriginHost(origin);
  // OPTIONS 预检也必须走本地来源判断
  if (method === "OPTIONS") {
    if (!isLocalRequest(req)) {
      return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。", "Forbidden: non-local preflight");
    }
    res.setHeader("Access-Control-Allow-Origin", origin || "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.writeHead(204).end();
  }
  // 非法 Origin → 403，不设置 ACAO
  if (originHost && !LOCAL_HOSTS.has(originHost)) {
    return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。请不要从公网或其他设备调用此服务。", `Forbidden: non-local Origin ${originHost}`);
  }
  // 本地 Origin 或无 Origin（CLI 请求）→ 设置正确的 CORS 头
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (!isLocalRequest(req)) {
    return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。请不要从公网或其他设备调用此服务。", "Forbidden: non-local request");
  }

  try {
    // ── 配置 ──
    if (path === "/api/config" && method === "GET") return jsonResponse(res, await loadConfig());
    if (path === "/api/config" && method === "POST") return jsonResponse(res, await saveConfig(await readBody(req)));

    // ── 密钥 ──
    if (path === "/api/secrets" && method === "GET") return jsonResponse(res, await getSecretState());
    if (path === "/api/secrets/llm" && method === "POST") return jsonResponse(res, await saveLlmSecret(await readBody(req)));
    // 密钥值端点 — 仅供内部 LLM 调用使用，不返回明文
    if (path === "/api/secrets/llm-value" && method === "GET") {
      return jsonResponse(res, { value: maskSecret(await getActiveLlmValue()), masked: true });
    }

    // ── LLM ──
    if (path === "/api/llm/test" && method === "POST") return jsonResponse(res, await testLlmConnection(await readBody(req)));
    if (path === "/api/llm/chat" && method === "POST") return jsonResponse(res, await handleLlmChat(await readBody(req)));

    // ── 连接档案 ──
    if (path === "/api/connections" && method === "GET") return jsonResponse(res, await handleConnections({}, "GET"));
    if (path === "/api/connections" && method === "POST") return jsonResponse(res, await handleConnections(await readBody(req), "POST"));

    // ── 模组管理 ──
    if (path === "/api/modules" && method === "GET") return jsonResponse(res, listModules());
    if (path === "/api/modules/create" && method === "POST") return jsonResponse(res, await createModule(await readBody(req)));
    if (path === "/api/modules/delete" && method === "POST") return jsonResponse(res, await deleteModule((await readBody(req)).id));
    if (path === "/api/modules/load" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonError(res, 400, "MODULE_ID_MISSING", "缺少模组 ID。请重新选择模组后再试。");
      if (!moduleWorldDir(id)) return jsonError(res, 400, "MODULE_ID_INVALID", "模组 ID 无效。");
      const model = await buildModuleModel(id);
      return jsonResponse(res, { status: "ok", model });
    }

    // ── 内置示例 ──
    if (path === "/api/examples" && method === "GET") return jsonResponse(res, { status: "ok", examples: listExamples() });
    if (path === "/api/examples/install" && method === "POST") {
      const result = await installExample(await readBody(req));
      if (result.status === "error") {
        const status = result.code === "EXAMPLE_NOT_FOUND" || result.code === "EXAMPLE_SOURCE_MISSING" ? 404 : 400;
        return jsonError(res, status, result.code || "EXAMPLE_INSTALL_FAILED", result.errorMsg || "安装示例失败。");
      }
      return jsonResponse(res, result);
    }

    // ── 炼金台 ──
    if (path === "/api/alchemy/import" && method === "POST") return jsonResponse(res, await handleAlchemyImport(await readBody(req)));
    if (path === "/api/alchemy/digest" && method === "POST") return jsonResponse(res, await handleAlchemyDigest(await readBody(req)));
    if (path === "/api/alchemy/review" && method === "GET") return jsonResponse(res, await handleAlchemyReview({}, "GET"));
    if (path === "/api/alchemy/review" && method === "POST") return jsonResponse(res, await handleAlchemyReview(await readBody(req), "POST"));

    // ── 模组历史 ──
    if (path.startsWith("/api/modules/") && path.endsWith("/history") && method === "GET") {
      const moduleId = decodeURIComponent(path.replace("/api/modules/", "").replace("/history", ""));
      const limit = parseInt(url.searchParams.get("limit") || "50");
      return jsonResponse(res, await handleModuleHistory(moduleId, limit));
    }

    // ── 角色卡 ──
    if (path === "/api/characters" && method === "GET") return jsonResponse(res, listCharacters());
    if (path === "/api/characters/import" && method === "POST") return jsonResponse(res, await handleCharacterImport(await readBody(req)));
    if (path === "/api/characters/update" && method === "POST") return jsonResponse(res, await handleCharacterUpdate(await readBody(req)));
    if (path === "/api/characters/load" && method === "POST") {
      const body = await readBody(req);
      const id = safeEntityId(body.id || "", "");
      if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
      const { parseCharacterCard } = await import("./src/core/data/character-card.js");
      const cardJsonPath = join(dataRoot(), "engine", "characters", id, "card.json");
      const card = existsSync(cardJsonPath) ? readJsonSync(cardJsonPath, null) : null;
      if (!card) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "没有找到这张角色卡。它可能已被删除或移动。");
      const parsed = parseCharacterCard(card);
      return jsonResponse(res, { status: "ok", card: parsed });
    }
    if (path === "/api/characters/delete" && method === "POST") {
      const body = await readBody(req);
      const id = safeEntityId(body.id || "", "");
      if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
      const targetDir = join(dataRoot(), "engine", "characters", id);
      if (!pathWithinRoot(CHARACTERS_DIR(), targetDir)) return jsonError(res, 400, "CHARACTER_ID_INVALID", "角色卡 ID 无效。");
      if (!existsSync(targetDir)) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "角色卡不存在，可能已经被删除。");
      try {
        rmSync(targetDir, { recursive: true, force: true });
        return jsonResponse(res, { status: "ok" });
      } catch (err) {
        return jsonError(res, 500, "CHARACTER_DELETE_FAILED", "删除角色卡失败。请检查文件是否被其他程序占用。", err.message);
      }
    }
    if (path === "/api/characters/backup" && method === "POST") {
      // 角色卡备份：复制 data/engine/characters/ 到 data/characters-archive/
      const body = await readBody(req);
      const id = safeEntityId(body.id || "", "");
      if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
      const srcDir = join(dataRoot(), "engine", "characters", id);
      if (!pathWithinRoot(CHARACTERS_DIR(), srcDir)) return jsonError(res, 400, "CHARACTER_ID_INVALID", "角色卡 ID 无效。");
      if (!existsSync(srcDir)) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "角色卡不存在，无法备份。");
      try {
        const archiveDir = join(ROOT, "data", "characters-archive");
        ensureDir(archiveDir);
        const destDir = join(archiveDir, `${id}_${Date.now()}`);
        mkdirSync(destDir, { recursive: true });
        const srcCard = join(srcDir, "card.json");
        if (existsSync(srcCard)) {
          const content = readFileSync(srcCard, "utf-8");
          writeFileSync(join(destDir, "card.json"), content, "utf-8");
        }
        return jsonResponse(res, { status: "ok", path: destDir });
      } catch (err) {
        return jsonError(res, 500, "CHARACTER_BACKUP_FAILED", "备份角色卡失败。请检查数据目录是否可写。", err.message);
      }
    }

    // ── 世界书编辑与测试 ──
    if (path === "/api/worldbook" && method === "GET") return jsonResponse(res, await handleWorldbook({}, "GET", url));
    if (path === "/api/worldbook" && method === "POST") return jsonResponse(res, await handleWorldbook(await readBody(req), "POST", url));
    if (path === "/api/worldbook/test" && method === "POST") return jsonResponse(res, await handleWorldbookTest(await readBody(req)));

    // ── 聊天消息操作 ──
    if (path === "/api/chat/message" && method === "POST") return jsonResponse(res, await handleChatMessage(await readBody(req)));

    // ── 叙事黑盒 ──
    if (path === "/api/turn/debug" && method === "GET") return jsonResponse(res, await handleTurnDebug(url));

    // ── 世界包 ──
    if (path === "/api/world-pack/export" && method === "GET") return jsonResponse(res, await handleWorldPackExport({}, url));
    if (path === "/api/world-pack/export" && method === "POST") return jsonResponse(res, await handleWorldPackExport(await readBody(req), url));
    if (path === "/api/world-pack/import" && method === "POST") return jsonResponse(res, await handleWorldPackImport(await readBody(req)));

    // ── 本地插件 ──
    if (path === "/api/plugins" && method === "GET") return jsonResponse(res, await handlePlugins({}, "GET"));
    if (path === "/api/plugins" && method === "POST") return jsonResponse(res, await handlePlugins(await readBody(req), "POST"));

    // ── Dashboard ──
    if (path === "/api/dashboard/telemetry" && method === "GET") {
      const moduleKey = url.searchParams.get("moduleKey") || "";
      if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
      return jsonResponse(res, await handleDashboardTelemetry(moduleKey));
    }
    if (path === "/api/dashboard/entities" && method === "GET") {
      const moduleKey = url.searchParams.get("moduleKey") || "";
      if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
      return jsonResponse(res, await handleDashboardEntities(moduleKey));
    }
    if (path === "/api/dashboard/narrative" && method === "GET") {
      const moduleKey = url.searchParams.get("moduleKey") || "";
      if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
      return jsonResponse(res, await handleDashboardNarrative(moduleKey));
    }

    // ── 引擎 ──
    if (path === "/api/engine/manifest" && method === "GET") {
      const { ENGINE_VERSION, MODULES } = await import("./src/core/engine/modules.js");
      return jsonResponse(res, { engineVersion: ENGINE_VERSION, modules: MODULES.map(m => ({ id: m.id, name: m.name })) });
    }

    // ── 世界列表（兼容旧版） ──
    if (path === "/api/worlds" && method === "GET") {
      const worlds = [];
      const worldsDir = WORLDS_DIR();
      if (existsSync(worldsDir)) {
        for (const entry of readdirSync(worldsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const meta = readJsonSync(join(worldsDir, entry.name, "world.json"), {});
            worlds.push({ name: entry.name, displayName: meta.displayName || entry.name, subType: meta.subType || "classic", turnCount: meta.turnCount || 0 });
          }
        }
      }
      return jsonResponse(res, worlds);
    }

    // ── 运行状态 ──
    if (path === "/api/status" && method === "GET") {
      return jsonResponse(res, {
        version: PKG_VERSION,
        uptime: process.uptime(),
        memory: process.memoryUsage().rss,
        dataRoot: dataRoot(),
        profiles: listModules().length
      });
    }

    // ── 健康检查 ──
    if (path === "/api/health" && method === "GET") {
      const config = await loadConfig();
      const apiKey = await getActiveLlmValue();
      const llmConfigured = Boolean(config.llmBaseUrl && config.llmModel && apiKey);
      let llmStatus = llmConfigured ? "unknown" : "not_configured";
      let llmDetail = "";
      if (llmConfigured) {
        try {
          const resp = await fetch(`${config.llmBaseUrl.replace(/\/$/, "")}/models`, {
            method: "GET", headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(1200)
          });
          llmStatus = resp.ok ? "connected" : "error";
          if (!resp.ok) llmDetail = `HTTP ${resp.status}`;
        } catch (err) {
          llmStatus = "disconnected";
          llmDetail = err?.message || "fetch failed";
        }
      }

      let writable = false;
      let writableDetail = "";
      try {
        const probe = join(ROOT, "userData", `.write-probe-${Date.now()}.tmp`);
        writeFileSync(probe, "ok", "utf8");
        rmSync(probe, { force: true });
        writable = true;
      } catch (err) {
        writableDetail = err?.message || "write probe failed";
      }

      // 计算数据目录大小
      let dataSizeBytes = 0;
      try {
        const calcSize = (dir) => {
          if (!existsSync(dir)) return 0;
          let size = 0;
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) size += calcSize(p);
            else size += statSync(p).size;
          }
          return size;
        };
        dataSizeBytes = calcSize(dataRoot());
      } catch {}

      const worlds = listModules().filter(m => m.type === "world");
      const totalTurns = worlds.reduce((s, w) => s + (w.turnCount || 0), 0);

      const hasUpdate = latestVersion && latestVersion !== PKG_VERSION;
      return jsonResponse(res, {
        status: "ok",
        version: PKG_VERSION,
        latestVersion: hasUpdate ? latestVersion : null,
        uptime: Math.round(process.uptime()),
        llm: {
          status: llmStatus,
          configured: llmConfigured,
          hasApiKey: Boolean(apiKey),
          model: config.llmModel,
          baseUrl: config.llmBaseUrl,
          detail: llmDetail
        },
        data: { root: dataRoot(), writable, writableDetail, sizeBytes: dataSizeBytes, worldsCount: worlds.length, totalTurns },
        debugMode: DEBUG_MODE
      });
    }

    // ── 数据导出 ──
    if (path === "/api/data/export" && method === "GET") {
      const moduleKey = url.searchParams.get("moduleKey") || "";
      if (!moduleKey) return jsonError(res, 400, "MODULE_KEY_MISSING", "缺少模组标识。请先选择一个模组。");
      const worldName = safeEntityId(moduleKey.replace(/^world:/, ""), "");
      const worldDir = moduleWorldDir(moduleKey);
      if (!worldDir || !pathWithinRoot(WORLDS_DIR(), worldDir)) return jsonError(res, 400, "MODULE_KEY_INVALID", "模组标识无效。");
      if (!existsSync(worldDir)) return jsonError(res, 404, "MODULE_NOT_FOUND", "模组不存在，可能已经被删除或移动。");
      try {
        // 收集所有数据文件
        const bundle = { exportedAt: new Date().toISOString(), worldName, files: {} };
        const collectDir = (dir, prefix = "") => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            const key = prefix + entry.name;
            if (entry.isDirectory()) { collectDir(full, key + "/"); }
            else if (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl")) {
              try { bundle.files[key] = readFileSync(full, "utf-8"); } catch {}
            }
          }
        };
        collectDir(worldDir);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${worldName}-export.json"`
        });
        res.end(JSON.stringify(bundle, null, 2));
      } catch (err) {
        return jsonError(res, 500, "EXPORT_FAILED", "导出失败。请检查模组文件是否完整。", err.message);
      }
      return;
    }

    // ── 数据导入 ──
    if (path === "/api/data/import" && method === "POST") {
      try {
        const body = await readBody(req);
        if (!body.worldName || !body.files) return jsonError(res, 400, "IMPORT_PAYLOAD_INVALID", "导入包缺少必要字段，无法导入。");
        const worldName = safeEntityId(String(body.worldName).replace(/[^\w\u4e00-\u9fff\-_]/gu, "_").replace(/^_+|_+$/g, "").slice(0, 48), "");
        if (!worldName) return jsonError(res, 400, "IMPORT_WORLD_NAME_INVALID", "导入世界名无效。");
        const worldDir = join(WORLDS_DIR(), worldName);
        if (!pathWithinRoot(WORLDS_DIR(), worldDir)) return jsonError(res, 400, "IMPORT_WORLD_NAME_INVALID", "导入世界名无效。");
        if (existsSync(worldDir)) return jsonError(res, 409, "IMPORT_NAME_CONFLICT", "目标模组名称已存在。请先重命名导入内容或删除旧模组。");
        const filesToWrite = [];
        for (const [key, content] of Object.entries(body.files)) {
          const clean = sanitizeFileKey(key);
          if (!clean || !/\.(json|jsonl)$/i.test(clean)) return jsonError(res, 400, "IMPORT_FILE_KEY_INVALID", `导入文件路径无效：${key}`);
          const targetPath = resolveInside(worldDir, clean);
          if (!targetPath) return jsonError(res, 400, "IMPORT_FILE_KEY_INVALID", `导入文件路径越界：${key}`);
          filesToWrite.push([targetPath, content]);
        }
        mkdirSync(worldDir, { recursive: true });
        for (const [targetPath, content] of filesToWrite) {
          ensureDir(dirname(targetPath));
          writeFileSync(targetPath, String(content), "utf-8");
        }
        return jsonResponse(res, { status: "ok", worldName });
      } catch (err) {
        return jsonError(res, 500, "IMPORT_FAILED", "导入失败。请确认文件结构完整且内容合法。", err.message);
      }
    }

    // ── 调试日志 ──
    if (path === "/api/debug/logs" && method === "GET") {
      if (!DEBUG_MODE) return jsonError(res, 403, "DEBUG_DISABLED", "调试模式未启用。请用 node server.js --debug 启动。");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      return jsonResponse(res, { logs: DEBUG_LOG.slice(-limit), totalLogs: DEBUG_LOG.length });
    }

    // ── 未知路由 ──
    jsonError(res, 404, "NOT_FOUND", "没有找到这个接口。请检查请求路径。", path);

  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(res, err.status, err.code, err.userMsg, err.detail);
    }
    if (err?.code === "BODY_TOO_LARGE") {
      return jsonError(res, 413, "BODY_TOO_LARGE", "请求内容太大。请拆分素材或减少导入包体积。", err.message);
    }
    console.error("[API]", path, err);
    jsonError(res, 500, "INTERNAL_ERROR", "服务端处理失败。请查看控制台日志获取技术细节。", err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  启动服务器
// ═══════════════════════════════════════════════════════════════

const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

ensureDir(join(ROOT, "userData"));
ensureDir(join(dataRoot(), "engine", "worlds"));
ensureDir(join(dataRoot(), "engine", "runs"));
ensureDir(join(dataRoot(), "engine", "global-memory"));
ensureDir(CHARACTERS_DIR());
ensureDir(PLUGINS_DIR());

// 检测端口占用
function tryListen(server, port, host = HOST) {
  return new Promise((resolve, reject) => {
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`端口 ${port} 已被占用。请先终止旧进程：\n  netstat -ano | findstr :${port}\n  taskkill //F //PID <pid>`));
      } else if (err.code === "EACCES") {
        reject(new Error(`端口 ${port} 需要管理员权限。请使用 1024 以上的端口号。`));
      } else {
        console.error(`[server] 端口 ${port} 启动失败: ${err.message} (code: ${err.code || "unknown"})`);
        reject(err);
      }
    });
    server.listen(port, host, () => resolve(port));
  });
}

tryListen(server, PORT).then((p) => {
  console.log(`🌳 World Tree Web 服务启动`);
  console.log(`   URL: http://${HOST}:${p}`);
  console.log(`   配置: ${configPath()}`);
  console.log(`   数据: ${dataRoot()}`);
}).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
