// server.js — World Tree Web 服务器
// 替代原本的 Electron 主进程，以纯 HTTP 方式提供后端 API
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, createReadStream, rmSync } from "node:fs";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, dirname, extname, resolve, basename } from "node:path";

const ROOT = resolve(import.meta.dirname, ".");
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
const PORT = process.env.PORT || 3000;

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
    const resp = await fetch("https://api.github.com/repos/WorldTreeDAO/world-tree/releases/latest", {
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

function isLocalRequest(req) {
  // 桌面应用 — 本地服务器，速率限制已足够，不检查来源
  return true;
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
const PROFILES_DIR = () => join(ROOT, "defaults", "world-profiles");
const EXAMPLES_DIR = () => join(ROOT, "defaults", "examples");
const EXAMPLE_MANIFEST = () => join(EXAMPLES_DIR(), "manifest.json");

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
  const worldName = moduleId.replace(/^world:/, "");
  const worldDir = join(WORLDS_DIR(), worldName);
  if (!existsSync(worldDir)) return { status: "error", errorMsg: "模组不存在" };
  rmSync(worldDir, { recursive: true, force: true });
  return { status: "ok" };
}

/** 构建引擎 model 对象（从新目录结构加载，含 chat 历史） */
async function buildModuleModel(moduleId) {
  const worldName = moduleId.replace(/^world:/, "");
  const worldDir = join(WORLDS_DIR(), worldName);
  const empty = { loaded: true, selected: { id: worldName, name: worldName, path: worldDir, branch: "main" }, moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, relations: {}, timeline: {}, worldState: {}, organizations: [], races: [], runtime: {}, tracking: [], canon: {} }, entities: [], turnCount: 0 };
  if (!existsSync(worldDir)) return empty;

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
  const worldName = moduleId.replace(/^world:/, "");
  const worldDir = join(WORLDS_DIR(), worldName);
  if (!existsSync(worldDir)) return;
  const rtDir = join(worldDir, "runtime");
  ensureDir(rtDir);

  const turnCount = (readJsonSync(join(worldDir, "world.json"), {}).turnCount || 0) + 1;
  const now = new Date().toISOString();

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
  await appendJsonl(join(rtDir, "chat.jsonl"), { role: "user", content: input.slice(0, 8000), round: turnCount, ts: now });
  await appendJsonl(join(rtDir, "chat.jsonl"), { role: "assistant", content: (result.narrative || "").slice(0, 10000), round: turnCount, ts: new Date().toISOString(), sections: result.parsedSections || {} });

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
  const wj = readJsonSync(join(worldDir, "world.json"), {});
  wj.turnCount = turnCount; wj.updatedAt = now;
  await writeJson(join(worldDir, "world.json"), wj);
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

  // 计算世界书注入条目（引擎根据输入匹配世界书）
  const { worldbookEntriesFromModel, injectionPreview } = await import("./src/core/cards.js");
  const { budgetFor } = await import("./src/core/engine/context-budget.js");
  const budget = budgetFor(normState.contextBudget || "balanced");
  const injectedWorldbook = injectionPreview(
    worldbookEntriesFromModel(model, {}),
    input || ""
  ).slice(0, budget.worldbookEntries || 10);

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
      const charId = (moduleKey || "").replace(/^world:/, "").replace(/^char:/, "");
      if (charId) {
        const cardJsonPath = join(dataRoot(), "engine", "characters", charId, "card.json");
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
    if (moduleKey && !moduleKey.startsWith("__")) {
      const persistResult = { ...result, narrative: cleanNarrative };
      await persistTurn(moduleKey, input, persistResult, result.engineState || normState);
    }

    return { status: "ok", narrative: cleanNarrative, parsedSections: sections, engineState: result.engineState || normState, turnCount: (model.turnCount || 0) + 1, _dualStage: result._dualStage || null, _progress: progress };
  } catch (err) { return { status: "error", errorMsg: err?.message || "LLM 调用失败" }; }
}

// ═══════════════════════════════════════════════════════════════
//  内容炼金台
// ═══════════════════════════════════════════════════════════════

async function handleAlchemyImport(body) {
  const { text } = body || {};
  if (!text) return { status: "error", errorMsg: "导入内容为空" };
  try {
    const { importFile } = await import("./src/core/data/alchemy/alchemy-engine.js");
    const result = await importFile(text, { llmCall: async () => ({ parsed: null }), options: { autoRelations: true } });
    return { status: "ok", format: result?.format, items: result?.items || [], stats: result?.stats || {}, phases: result?.phases || [] };
  } catch (err) { return { status: "error", errorMsg: err?.message || "炼金台导入失败" }; }
}

/** 炼金台 → 模组创建：解析内容 → 生成世界书条目 或 角色卡引擎数据 */
async function handleAlchemyDigest(body) {
  const { text, worldName, dataMode = "worldbook", subType = "classic", preset = "epic" } = body || {};
  if (!text) return { status: "error", errorMsg: "内容为空" };
  try {
    // 1. 调用炼金台引擎解析
    const { importFile } = await import("./src/core/data/alchemy/alchemy-engine.js");
    const result = await importFile(text, { llmCall: async () => ({ parsed: null }), options: { autoRelations: true } });
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
        body: JSON.stringify({ model: config.llmModel, messages, temperature: 0.3, max_tokens: 4096 })
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
        characterCard: true
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
    const worldDir = join(WORLDS_DIR(), module.module.id);
    await writeJson(join(worldDir, "shared", "worldbook.json"), { entries });
    await writeJson(join(worldDir, "shared", "characters.json"), characters);
    if (locations.length) await writeJson(join(worldDir, "shared", "locations.json"), locations);
    if (orgs.length) await writeJson(join(worldDir, "shared", "organizations.json"), orgs);
    if (rules.length) await writeJson(join(worldDir, "shared", "rules.json"), rules);

    return { status: "ok", module: module.module, entries: entries.length, characters: characters.length, locations: locations.length, organizations: orgs.length, rules: rules.length };
  } catch (err) { return { status: "error", errorMsg: err?.message || "炼金台消化失败" }; }
}

function objToText(data, fields) {
  return fields.map(f => data?.[f] ? `${f}: ${typeof data[f]==="object"?JSON.stringify(data[f]):data[f]}` : "").filter(Boolean).join("\n") || "";
}

/** 加载模组对话历史 */
async function handleModuleHistory(moduleId, limit = 50) {
  const worldName = moduleId.replace(/^world:/, "");
  const chatPath = join(WORLDS_DIR(), worldName, "runtime", "chat.jsonl");
  const state = readJsonSync(join(WORLDS_DIR(), worldName, "runtime", "state.json"), {});
  const messages = await readJsonlTail(chatPath, limit);
  return { status: "ok", messages, turnCount: state.turnCount || 0, engineState: state.engineState || {}, lastScene: state.lastScene || "" };
}

// ═══════════════════════════════════════════════════════════════
//  Dashboard 数据端点
// ═══════════════════════════════════════════════════════════════

async function handleDashboardTelemetry(moduleId) {
  const model = await buildModuleModel(moduleId);
  const state = readJsonSync(join(WORLDS_DIR(), moduleId.replace(/^world:/, ""), "runtime", "state.json"), {});
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
  const worldName = moduleId.replace(/^world:/, "");
  const worldDir = join(WORLDS_DIR(), worldName);

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

async function serveStatic(req, res) {
  // 速率限制
  if (!checkRateLimit(req.socket?.remoteAddress || "127.0.0.1", RATE_MAX_STATIC)) {
    res.writeHead(429, { "Content-Type": "text/plain" });
    return res.end("Too Many Requests");
  }
  let filePath = join(ROOT, req.url === "/" ? "world-tree-console.html" : req.url);
  // 路径遍历防护：使用 normalize + realpath 语义确保路径在 ROOT 内
  const normalized = resolve(filePath);
  if (!normalized.toLowerCase().startsWith(ROOT.toLowerCase())) {
    filePath = join(ROOT, "world-tree-console.html");
  } else {
    filePath = normalized;
  }
  if (!existsSync(filePath)) {
    filePath = join(ROOT, "world-tree-console.html");
  }
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
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

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf-8");
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
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

  // CORS — 仅允许本地来源
  const origin = req.headers.origin || "";
  const allowedOrigin = isLocalRequest(req) ? (origin || "http://localhost:3000") : "";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") return res.writeHead(204).end();
  if (!isLocalRequest(req)) {
    return jsonError(res, 403, "LOCAL_ONLY", "World Tree 只允许本机浏览器访问。请不要从公网或其他设备调用此服务。", "Forbidden: non-local Origin/Referer");
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

    // ── 模组管理 ──
    if (path === "/api/modules" && method === "GET") return jsonResponse(res, listModules());
    if (path === "/api/modules/create" && method === "POST") return jsonResponse(res, await createModule(await readBody(req)));
    if (path === "/api/modules/delete" && method === "POST") return jsonResponse(res, await deleteModule((await readBody(req)).id));
    if (path === "/api/modules/load" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonError(res, 400, "MODULE_ID_MISSING", "缺少模组 ID。请重新选择模组后再试。");
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

    // ── 模组历史 ──
    if (path.startsWith("/api/modules/") && path.endsWith("/history") && method === "GET") {
      const moduleId = path.replace("/api/modules/", "").replace("/history", "");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      return jsonResponse(res, await handleModuleHistory(moduleId, limit));
    }

    // ── 角色卡 ──
    if (path === "/api/characters" && method === "GET") {
      const result = [];

      // 唯一来源: data/engine/characters/ 目录（炼金台产出 + 手动放入）
      const charsDir = join(dataRoot(), "engine", "characters");
      if (existsSync(charsDir)) {
        for (const entry of readdirSync(charsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const cardJson = readJsonSync(join(charsDir, entry.name, "card.json"), null);
            if (cardJson && cardJson.名称) {
              result.push({ id: entry.name, name: cardJson.名称 || entry.name, displayName: cardJson.名称 || entry.name, description: cardJson.描述 || "", sceneCount: cardJson.初次见面 ? 1 : 0, hasData: true, source: "local" });
            }
          }
        }
      }

      return jsonResponse(res, result);
    }
    if (path === "/api/characters/load" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
      const { parseCharacterCard } = await import("./src/core/data/character-card.js");
      const cardJsonPath = join(dataRoot(), "engine", "characters", id, "card.json");
      const card = existsSync(cardJsonPath) ? readJsonSync(cardJsonPath, null) : null;
      if (!card) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "没有找到这张角色卡。它可能已被删除或移动。");
      const parsed = parseCharacterCard(card);
      return jsonResponse(res, { status: "ok", card: parsed });
    }
    if (path === "/api/characters/delete" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
      const targetDir = join(dataRoot(), "engine", "characters", id);
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
      const { id } = await readBody(req);
      if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
      const srcDir = join(dataRoot(), "engine", "characters", id);
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
      const worldName = moduleKey.replace(/^world:/, "");
      const worldDir = join(WORLDS_DIR(), worldName);
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
        const worldName = String(body.worldName).replace(/[^\w\u4e00-\u9fff\-_]/gu, "_").replace(/^_+|_+$/g, "").slice(0, 48);
        const worldDir = join(WORLDS_DIR(), worldName);
        if (existsSync(worldDir)) return jsonError(res, 409, "IMPORT_NAME_CONFLICT", "目标模组名称已存在。请先重命名导入内容或删除旧模组。");
        mkdirSync(worldDir, { recursive: true });
        for (const [key, content] of Object.entries(body.files)) {
          const targetPath = join(worldDir, key);
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
ensureDir(join(dataRoot(), "engine", "characters"));

// 检测端口占用
function tryListen(server, port) {
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
    server.listen(port, () => resolve(port));
  });
}

tryListen(server, PORT).then((p) => {
  console.log(`🌳 World Tree Web 服务启动`);
  console.log(`   URL: http://localhost:${p}`);
  console.log(`   配置: ${configPath()}`);
  console.log(`   数据: ${dataRoot()}`);
}).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
