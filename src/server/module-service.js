import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export function normalizeModuleKey(value = "") {
  return String(value || "").replace(/^world:/, "").replace(/^char:/, "").trim();
}

export function sanitizeWorldName(value = "", fallback = "") {
  const clean = String(value || "")
    .replace(/[^\w\u4e00-\u9fff\-_]/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return clean || fallback;
}

export function isInternalModuleKey(value = "") {
  return String(value || "").startsWith("__");
}

/**
 * Factory: create a module service bound to project helpers.
 *
 * deps: { dataRoot, profilesDir, worldsDir, charactersDir,
 *         readJsonSync, writeJson, ensureDir, pathWithinRoot, safeEntityId }
 *
 * Each dep that is a function will be called at invocation time,
 * so runtime overrides (e.g. WORLD_TREE_DATA_DIR) take effect.
 */
export function createModuleService(deps) {
  const {
    dataRoot,
    profilesDir,
    readJsonSync,
    writeJson,
    ensureDir,
    pathWithinRoot,
    safeEntityId
  } = deps;

  function worldsDir() {
    return deps.worldsDir ? deps.worldsDir() : join(dataRoot(), "engine", "worlds");
  }

  function charactersDir() {
    return deps.charactersDir ? deps.charactersDir() : join(dataRoot(), "engine", "characters");
  }

  function moduleWorldDir(moduleKey = "") {
    const worldName = safeEntityId(String(moduleKey || "").replace(/^world:/, ""), "");
    if (!worldName || worldName.startsWith("__") || worldName.startsWith("char:")) return null;
    return join(worldsDir(), worldName);
  }

  function listModules() {
    const modules = [];

    // 1. 已有世界（data/engine/worlds/）
    const wDir = worldsDir();
    if (existsSync(wDir)) {
      for (const entry of readdirSync(wDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const meta = readJsonSync(join(wDir, entry.name, "world.json"), {});
          const rt = readJsonSync(join(wDir, entry.name, "runtime", "state.json"), {}) || readJsonSync(join(wDir, entry.name, "runtime.json"), {});
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
    const pDir = profilesDir ? (typeof profilesDir === "function" ? profilesDir() : profilesDir) : "";
    if (pDir && existsSync(pDir)) {
      for (const entry of readdirSync(pDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          const profile = readJsonSync(join(pDir, entry.name), {});
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

    return modules.sort((a, b) => b.turnCount - a.turnCount || String(b.name || "").localeCompare(String(a.name || ""), "zh-CN"));
  }

  async function createModule(body = {}) {
    const { name, displayName, dataMode, subType, preset } = body || {};
    // 安全截断：使用 Array.from 确保多字节字符（emoji/生僻字）不被截断
    const rawName = String(name || displayName || "新世界");
    const cleaned = rawName.replace(/[^\w\u4e00-\u9fff\-_]/gu, "_").replace(/^_+|_+$/g, "");
    const safeChars = Array.from(cleaned);
    const worldName = safeChars.slice(0, 48).join("") || `world_${Date.now()}`;
    const wDir = worldsDir();
    ensureDir(wDir);
    const worldDir = join(wDir, worldName);
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

  async function deleteModule(moduleId) {
    const worldDir = moduleWorldDir(moduleId);
    if (!worldDir || !pathWithinRoot(worldsDir(), worldDir)) return { status: "error", errorMsg: "模组 ID 无效" };
    if (!existsSync(worldDir)) return { status: "error", errorMsg: "模组不存在" };
    rmSync(worldDir, { recursive: true, force: true });
    return { status: "ok" };
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

  async function buildModuleModel(moduleId) {
    const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, ""), "");
    const worldDir = moduleWorldDir(moduleId);
    const empty = { loaded: true, selected: { id: worldName, name: worldName, path: worldDir, branch: "main" }, moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, relations: {}, timeline: {}, worldState: {}, organizations: [], races: [], runtime: {}, tracking: [], canon: {} }, entities: [], turnCount: 0 };
    if (!worldDir || !pathWithinRoot(worldsDir(), worldDir) || !existsSync(worldDir)) return empty;

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

  return {
    worldsDir,
    charactersDir,
    moduleWorldDir,
    listModules,
    createModule,
    deleteModule,
    readOverlayData,
    buildModuleModel
  };
}
