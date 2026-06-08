// server.js — World Tree Desktop Web 服务器
// 替代原本的 Electron 主进程，以纯 HTTP 方式提供后端 API
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, createReadStream, appendFileSync, rmSync } from "node:fs";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, dirname, extname, resolve, basename } from "node:path";
import { createWriteStream } from "node:fs";

const ROOT = resolve(import.meta.dirname, ".");
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════
//  JSONL 工具函数
// ═══════════════════════════════════════════════════════════════

/** 追加一行 JSON 到 JSONL 文件 */
function appendJsonl(filePath, record) {
  ensureDir(dirname(filePath));
  appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
}

/** 读取 JSONL 文件末尾 N 行 */
function readJsonlTail(filePath, N = 50) {
  if (!existsSync(filePath)) return [];
  try {
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    const tail = lines.slice(-N);
    return tail.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean);
  } catch { return []; }
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
  llmModel: "deepseek-chat",
  lastModuleKey: "",
  moduleHistory: [],
  theme: "dark",
  language: "zh-CN"
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
  if (value.length <= 8) return "********";
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
  if (/^\*{6,}/.test(value)) {
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
  const apiKey = String(payload?.apiKey || "").trim();
  const baseUrl = String(config.llmBaseUrl || payload?.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return { status: "error", errorMsg: "请先填写服务地址" };
  if (!apiKey) return { status: "error", errorMsg: "访问密钥为空" };
  if (!/^https?:\/\//.test(baseUrl)) return { status: "error", errorMsg: "服务地址格式无效" };
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const text = await response.text();
    if (!response.ok) return { status: "error", errorMsg: text || `HTTP ${response.status}` };
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    return { status: "error", errorMsg: error?.message || "模型服务不可达" };
  }
}

// ═══════════════════════════════════════════════════════════════
//  引擎模块管理
// ═══════════════════════════════════════════════════════════════

const WORLDS_DIR = () => join(dataRoot(), "engine", "worlds");
const PROFILES_DIR = () => join(ROOT, "defaults", "world-profiles");
const CASES_DIR = () => join(ROOT, "defaults", "cases");

/** 列出所有可用模组（世界 + 配置模板 + 案例） */
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

  // 3. 案例（defaults/cases/）
  const casesDir = CASES_DIR();
  if (existsSync(casesDir)) {
    for (const entry of readdirSync(casesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const caseData = readJsonSync(join(casesDir, entry.name), {});
        const meta = caseData.meta || {};
        modules.push({
          id: `case:${entry.name.replace(/\.json$/, "")}`,
          name: meta.title || entry.name.replace(/\.json$/, ""),
          displayName: meta.title || entry.name.replace(/\.json$/, ""),
          type: "case",
          dataMode: "worldbook",
          subType: "murder-mystery",
          preset: "minimal",
          turnCount: 0,
          difficulty: meta.difficulty || "",
          description: meta.description || "",
          source: "defaults/cases"
        });
      }
    }
  }

  return modules.sort((a, b) => b.turnCount - a.turnCount || b.name?.localeCompare?.(a.name, "zh-CN") || 0);
}

/** 从配置模板创建新世界（新目录结构 shared/ + runtime/） */
async function createModule(body) {
  const { name, displayName, dataMode, subType, preset } = body || {};
  const worldName = String(name || displayName || "新世界").replace(/[^\w\u4e00-\u9fff\-_]/gu, "_").replace(/^_+|_+$/g, "").slice(0, 48) || `world_${Date.now()}`;
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
  writeFileSync(join(worldDir, "runtime", "chat.jsonl"), "", "utf-8");
  writeFileSync(join(worldDir, "runtime", "memory.jsonl"), "", "utf-8");
  // 初始化 shared — 引擎所有模块可能读的文件
  for (const [file, dflt] of [["worldbook.json",{entries:[]}],["characters.json",[]],["scenes.json",[]],["relations.json",{}],["timeline.json",{}],["world_state.json",{}],["organizations.json",[]],["locations.json",[]],["races.json",[]],["rules.json",[]]]) {
    await writeJson(join(worldDir, "shared", file), dflt);
  }

  return { status: "ok", module: { id: worldName, name: worldName, displayName: displayName || worldName, type: "world", dataMode, subType, preset, turnCount: 0 } };
}

/** 删除模组 */
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

  // state.json — 完整覆盖
  await writeJson(join(rtDir, "state.json"), { turnCount, activeBranch: "main", lastScene: result.parsedSections?.["状态"]?.scene || "", lastInput: input, engineState: engineState || {}, updatedAt: now });

  // chat.jsonl — 追加用户+助手消息
  appendJsonl(join(rtDir, "chat.jsonl"), { role: "user", content: input.slice(0, 2000), round: turnCount, ts: now });
  appendJsonl(join(rtDir, "chat.jsonl"), { role: "assistant", content: (result.narrative || "").slice(0, 3000), round: turnCount, ts: new Date().toISOString(), sections: result.parsedSections || {} });

  // memory.jsonl — 追加记忆快照
  if (result.overlayPatch?.memorySnapshot) {
    appendJsonl(join(rtDir, "memory.jsonl"), result.overlayPatch.memorySnapshot);
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
        } else if (op.mode === "merge-json" || op.mode === "merge-json") {
          const existing = readJsonSync(opPath, {});
          await writeJson(opPath, { ...existing, ...(op.value || {}) });
        } else if (op.mode === "append-jsonl" || op.mode === "append-jsonl") {
          appendJsonl(opPath + ".jsonl", op.value || {});
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
  if (!input) return { status: "error", errorMsg: "输入为空" };

  const config = await loadConfig();
  const apiKey = await getActiveLlmValue();
  if (!apiKey) return { status: "error", errorMsg: "未配置 API Key" };
  if (!config.llmBaseUrl || !config.llmModel) return { status: "error", errorMsg: "未配置 LLM 地址和模型" };

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

  try {
    // 按 dataMode 构建模式专属 writer 包（仅角色卡模式走 buildCharacterCardPacket）
    let writerPacket = null;
    if (dataMode === "character_card") {
      const { buildEnginePacket } = await import("./src/core/world-engine.js");
      const { parseSkillFile } = await import("./src/core/data/skill-parser.js");
      const { characterCardMode } = await import("./src/core/data/character-card.js");

      // 从模组 ID 或模块名加载角色卡数据（优先 SKILL.md，回退 card.json）
      let cardData = null;
      const charId = (moduleKey || "").replace(/^world:/, "").replace(/^char:/, "");
      if (charId) {
        const hermesHome = process.env.HERMES_HOME || join(process.env.USERPROFILE || "C:\\Users\\Lenovo", "AppData", "Local", "hermes");
        const skillPath = join(hermesHome, "skills", "creative", charId, "SKILL.md");
        if (existsSync(skillPath)) {
          cardData = parseSkillFile(skillPath);
        } else {
          // 回退：从 data/engine/characters/{charId}/card.json 加载（炼金台产出）
          const cardJsonPath = join(dataRoot(), "engine", "characters", charId, "card.json");
          if (existsSync(cardJsonPath)) {
            cardData = readJsonSync(cardJsonPath, null);
          }
        }
      }

      const ccState = { ...normState, dataMode: "character_card" };
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

    const result = await sendDualStageTurn({ model, config: { ...config, llmBaseUrl: config.llmBaseUrl, llmModel: config.llmModel }, apiKey, messages: messages || [], input, injectedWorldbook, engineState: normState, moduleKey: moduleKey || "unloaded", dataMode: dataMode || "worldbook", skipDirector: true, skipGuardian: true, useLlmAnalysis: false, writerPacket });

    // 完整持久化
    if (moduleKey && !moduleKey.startsWith("__")) {
      await persistTurn(moduleKey, input, result, result.engineState || normState);
    }

    // 清理 narrative：LLM 输出含【叙事】标记段时，parseMarkedOutput 把它当段切了，
    // 导致 result.narrative 变成 rawText（含状态段）。优先从【叙事】段取正文。
    const sections = result.parsedSections || {};
    const narrativeFromSection = sections["叙事"]?._raw || "";
    const cleanNarrative = narrativeFromSection || result.narrative || "";
    return { status: "ok", narrative: cleanNarrative, parsedSections: sections, engineState: result.engineState || normState, _dualStage: result._dualStage || null };
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
      // 初始化空对话记录
      writeFileSync(join(charDir, "runtime", "chat.jsonl"), "", "utf-8");
      writeFileSync(join(charDir, "runtime", "state.json"), JSON.stringify({ turnCount: 0, engineState: { dataMode: "character_card" } }, null, 2), "utf-8");

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
  return { status: "ok", messages: readJsonlTail(chatPath, limit), turnCount: state.turnCount || 0, engineState: state.engineState || {}, lastScene: state.lastScene || "" };
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
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

async function serveStatic(req, res) {
  let filePath = join(ROOT, req.url === "/" ? "world-tree-console.html" : req.url);
  // 路径遍历防护：确保解析后的路径仍在 ROOT 内
  if (!filePath.startsWith(ROOT)) {
    filePath = join(ROOT, "world-tree-console.html");
  }
  if (!existsSync(filePath)) {
    filePath = join(ROOT, "world-tree-console.html");
  }
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
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

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") return res.writeHead(204).end();

  try {
    // ── 配置 ──
    if (path === "/api/config" && method === "GET") return jsonResponse(res, await loadConfig());
    if (path === "/api/config" && method === "POST") return jsonResponse(res, await saveConfig(await readBody(req)));

    // ── 密钥 ──
    if (path === "/api/secrets" && method === "GET") return jsonResponse(res, await getSecretState());
    if (path === "/api/secrets/llm" && method === "POST") return jsonResponse(res, await saveLlmSecret(await readBody(req)));
    if (path === "/api/secrets/llm-value" && method === "GET") return jsonResponse(res, { value: await getActiveLlmValue() });

    // ── LLM ──
    if (path === "/api/llm/test" && method === "POST") return jsonResponse(res, await testLlmConnection(await readBody(req)));
    if (path === "/api/llm/chat" && method === "POST") return jsonResponse(res, await handleLlmChat(await readBody(req)));

    // ── 模组管理 ──
    if (path === "/api/modules" && method === "GET") return jsonResponse(res, listModules());
    if (path === "/api/modules/create" && method === "POST") return jsonResponse(res, await createModule(await readBody(req)));
    if (path === "/api/modules/delete" && method === "POST") return jsonResponse(res, await deleteModule((await readBody(req)).id));
    if (path === "/api/modules/load" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonResponse(res, { status: "error", errorMsg: "缺少模组 ID" }, 400);
      const model = await buildModuleModel(id);
      return jsonResponse(res, { status: "ok", model });
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
      const { parseSkillFile, listSkillFiles } = await import("./src/core/data/skill-parser.js");
      const result = [];

      // 来源1: Hermes skills/creative/ 目录（创生skill 产出）
      for (const s of listSkillFiles()) {
        const card = parseSkillFile(s.path);
        if (card && card.欲望) {
          result.push({ id: s.id, name: card.name || s.id, displayName: card.name || s.id, description: card.description || "", sceneCount: card.初次见面 ? 1 : 0, hasData: true, source: "hermes" });
        }
      }

      // 来源2: data/engine/characters/ 目录（炼金台产出）
      const charsDir = join(dataRoot(), "engine", "characters");
      if (existsSync(charsDir)) {
        for (const entry of readdirSync(charsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const cardJson = readJsonSync(join(charsDir, entry.name, "card.json"), null);
            if (cardJson && cardJson.名称) {
              if (!result.find(r => r.id === entry.name)) {
                result.push({ id: entry.name, name: cardJson.名称 || entry.name, displayName: cardJson.名称 || entry.name, description: cardJson.描述 || "", sceneCount: cardJson.初次见面 ? 1 : 0, hasData: true, source: "alchemy" });
              }
            }
          }
        }
      }

      return jsonResponse(res, result);
    }
    if (path === "/api/characters/load" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonResponse(res, { status: "error", errorMsg: "缺少角色卡 ID" }, 400);
      const { parseSkillFile } = await import("./src/core/data/skill-parser.js");
      const { parseCharacterCard } = await import("./src/core/data/character-card.js");
      const hermesHome = process.env.HERMES_HOME || join(process.env.USERPROFILE || "C:\\Users\\Lenovo", "AppData", "Local", "hermes");
      const skillPath = join(hermesHome, "skills", "creative", id, "SKILL.md");
      let card = parseSkillFile(skillPath);
      // 回退：尝试 data/engine/characters/{id}/card.json
      if (!card) {
        const cardJsonPath = join(dataRoot(), "engine", "characters", id, "card.json");
        if (existsSync(cardJsonPath)) {
          card = readJsonSync(cardJsonPath, null);
        }
      }
      if (!card) return jsonResponse(res, { status: "error", errorMsg: "角色卡未找到" }, 404);
      const parsed = parseCharacterCard(card);
      return jsonResponse(res, { status: "ok", card: parsed });
    }
    if (path === "/api/characters/delete" && method === "POST") {
      const { id } = await readBody(req);
      if (!id) return jsonResponse(res, { status: "error", errorMsg: "缺少角色卡 ID" }, 400);
      const hermesHome = process.env.HERMES_HOME || join(process.env.USERPROFILE || "C:\\Users\\Lenovo", "AppData", "Local", "hermes");
      // 尝试 Hermes skill 目录
      let targetDir = join(hermesHome, "skills", "creative", id);
      if (!existsSync(targetDir)) {
        // 回退：data/engine/characters/ 目录（炼金台产出）
        targetDir = join(dataRoot(), "engine", "characters", id);
      }
      if (!existsSync(targetDir)) return jsonResponse(res, { status: "error", errorMsg: "角色卡不存在" }, 404);
      try {
        rmSync(targetDir, { recursive: true, force: true });
        return jsonResponse(res, { status: "ok" });
      } catch (err) {
        return jsonResponse(res, { status: "error", errorMsg: err.message }, 500);
      }
    }
    if (path === "/api/characters/backup" && method === "POST") {
      // 角色卡备份：复制到 data/characters-archive/
      const { id } = await readBody(req);
      if (!id) return jsonResponse(res, { status: "error", errorMsg: "缺少角色卡 ID" }, 400);
      const hermesHome = process.env.HERMES_HOME || join(process.env.USERPROFILE || "C:\\Users\\Lenovo", "AppData", "Local", "hermes");
      const srcDir = join(hermesHome, "skills", "creative", id);
      if (!existsSync(srcDir)) return jsonResponse(res, { status: "error", errorMsg: "角色卡不存在" }, 404);
      try {
        const archiveDir = join(ROOT, "data", "characters-archive");
        ensureDir(archiveDir);
        const destDir = join(archiveDir, `${id}_${Date.now()}`);
        mkdirSync(destDir, { recursive: true });
        const srcSkill = join(srcDir, "SKILL.md");
        if (existsSync(srcSkill)) {
          const content = readFileSync(srcSkill, "utf-8");
          writeFileSync(join(destDir, "SKILL.md"), content, "utf-8");
        }
        return jsonResponse(res, { status: "ok", path: destDir });
      } catch (err) {
        return jsonResponse(res, { status: "error", errorMsg: err.message }, 500);
      }
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

    // ── 未知路由 ──
    jsonResponse(res, { error: "Not Found" }, 404);

  } catch (err) {
    console.error("[API]", path, err);
    jsonResponse(res, { error: err.message }, 500);
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
ensureDir(dataRoot());
ensureDir(join(dataRoot(), "engine", "worlds"));
ensureDir(join(dataRoot(), "engine", "runs"));
ensureDir(join(dataRoot(), "engine", "global-memory"));
ensureDir(join(dataRoot(), "engine", "characters"));

server.listen(PORT, () => {
  console.log(`🌳 World Tree Desktop Web 服务启动`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   配置: ${configPath()}`);
  console.log(`   数据: ${dataRoot()}`);
});
