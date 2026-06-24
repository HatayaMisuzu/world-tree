import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readJsonWithLegacy } from "./fs-utils.js";
import {
  QUICK_SETTING_MODE_ID,
  createQuickSettingInitialState,
  normalizeQuickSettingInput
} from "../core/modes/quick-setting.js";
import { createModeProjectDraft } from "../core/modes/mode-project-factory.js";
import { getModeCapsule } from "../core/modes/mode-capsule-registry.js";

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
  const modelCache = new Map();

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

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

  function clearModuleCache(moduleId = "") {
    if (!moduleId) {
      modelCache.clear();
      return;
    }
    const normalized = normalizeModuleKey(moduleId);
    modelCache.delete(normalized);
    modelCache.delete(`world:${normalized}`);
  }

  function listModules() {
    const modules = [];

    // 1. 已有世界（data/engine/worlds/）
    const wDir = worldsDir();
    if (existsSync(wDir)) {
      for (const entry of readdirSync(wDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const meta = readJsonSync(join(wDir, entry.name, "world.json"), {});
          const rt = readJsonWithLegacy(join(wDir, entry.name, "runtime", "state.json"), join(wDir, entry.name, "runtime.json"), {});
          modules.push({
            id: entry.name,
            name: meta.displayName || entry.name,
            displayName: meta.displayName || entry.name,
            type: "world",
            dataMode: meta.dataMode || "worldbook",
            subType: meta.subType || "classic",
            preset: meta.preset || "epic",
            mode: meta.mode || "",
            draft: !!meta.draft,
            sourceType: meta.sourceType || "",
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
    // creation-forge is a deferred producer / alchemy workflow — cannot be created as a normal persisted module
    if (body?.mode === "creation-forge") {
      return { status: "error", code: "MODE_PROJECT_CREATION_DISABLED", errorMsg: "creation-forge is a deferred producer / alchemy workflow and cannot be created as a normal persisted module via /api/modules/create." };
    }
    const { name, displayName, dataMode, subType, preset } = body || {};
    const isCharacter = body?.mode === "character";
    const isMultiMode = body?.mode === "world-rpg" || body?.mode === "mystery-puzzle" || body?.mode === "tabletop" || body?.mode === "strategy-sim" || body?.mode === "murder-mystery" || body?.mode === "creation-forge";
    const quickSetting = body?.mode === QUICK_SETTING_MODE_ID;
    const quickInput = quickSetting
      ? normalizeQuickSettingInput({ ...body, title: displayName || name })
      : null;
    const characterInput = isCharacter
      ? createModeProjectDraft("character", { title: displayName || name, sourceText: String(body?.sourceText || body?.cardText || ""), sourceType: "character_card" }).title
      : null;
    const quickProject = quickSetting || body?.quickProject === true || body?.sourceType === "pasted_text";
    const sourceText = isCharacter ? String(body?.sourceText || body?.cardText || body?.content || "") : (isMultiMode ? String(body?.sourceText || body?.content || body?.seedText || "") : (quickSetting ? quickInput.sourceText : String(body?.sourceText || "")));
    const sourceType = isCharacter ? "character_card" : (isMultiMode ? (body?.sourceType || "pasted_text") : (quickProject ? (quickSetting ? quickInput.sourceType : (body?.sourceType || "pasted_text")) : ""));
    const draft = (quickProject || isCharacter || isMultiMode) ? body?.draft !== false : false;
    const effectiveDataMode = isCharacter ? "character_card" : (isMultiMode ? "worldbook" : (quickSetting ? "preset" : (dataMode || "worldbook")));
    const effectiveSubType = isCharacter ? "classic" : (isMultiMode ? "classic" : (quickSetting ? "classic" : (subType || "classic")));
    const effectivePreset = isCharacter ? "character_card" : (isMultiMode ? "epic" : (quickSetting ? "preset" : (preset || "epic")));
    // 安全截断：使用 Array.from 确保多字节字符（emoji/生僻字）不被截断
    const rawName = String(name || displayName || (isCharacter ? `人物卡_${Date.now()}` : (isMultiMode ? `新模式_${Date.now()}` : (quickProject ? `快速项目_${Date.now()}` : "新世界"))));
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

    const now = new Date().toISOString();
    const multiModeDraft = isMultiMode
      ? createModeProjectDraft(body?.mode, {
          title: displayName || name || body?.title || body?.mode,
          sourceText,
          sourceType: body?.sourceType || sourceType
        }, { createdAt: now })
      : null;
    const characterDraft = isCharacter
      ? createModeProjectDraft("character", {
          title: displayName || name || "未命名人物卡",
          sourceText,
          sourceType: "character_card"
        }, { createdAt: now })
      : null;
    const quickSettingDraft = quickSetting
      ? createModeProjectDraft(QUICK_SETTING_MODE_ID, {
          title: quickInput.title,
          sourceText,
          sourceType
        }, { createdAt: now })
      : null;
    const worldData = {
      name: worldName,
      displayName: displayName || (isMultiMode ? (name || body?.mode || worldName) : (quickSetting ? quickInput.title : quickProject ? "快速项目" : worldName)),
      dataMode: effectiveDataMode,
      subType: effectiveSubType,
      preset: effectivePreset,
      ...(multiModeDraft ? {
        mode: multiModeDraft.mode,
        modeMetadata: multiModeDraft.worldJsonDraft.modeMetadata,
        moduleGraph: multiModeDraft.worldJsonDraft.moduleGraph,
        wrapperGraph: multiModeDraft.runtimeStateDraft.wrapperGraph
      } : characterDraft ? {
        mode: characterDraft.mode,
        modeMetadata: characterDraft.worldJsonDraft.modeMetadata,
        moduleGraph: characterDraft.worldJsonDraft.moduleGraph,
        wrapperGraph: characterDraft.runtimeStateDraft.wrapperGraph
      } : quickSettingDraft ? {
        mode: quickSettingDraft.mode,
        modeMetadata: quickSettingDraft.worldJsonDraft.modeMetadata,
        moduleGraph: quickSettingDraft.worldJsonDraft.moduleGraph,
        wrapperGraph: quickSettingDraft.runtimeStateDraft.wrapperGraph
      } : {}),
      draft,
      sourceType,
      sourceTextChars: sourceText.length,
      createdAt: now,
      updatedAt: now,
      turnCount: 0
    };
    await writeJson(join(worldDir, "world.json"), worldData);
    // state.json 包含完整引擎状态（含 modeStateEnvelope 兼容叠加）
    await writeJson(join(worldDir, "runtime", "state.json"), {
      turnCount: 0, activeBranch: "main", lastScene: "", lastInput: "",
      draft,
      sourceType,
      sourceTextChars: sourceText.length,
      ...(multiModeDraft ? {
        mode: multiModeDraft.mode,
        modeMetadata: multiModeDraft.runtimeStateDraft.modeMetadata,
        moduleGraph: multiModeDraft.runtimeStateDraft.moduleGraph,
        wrapperGraph: multiModeDraft.runtimeStateDraft.wrapperGraph,
        modeStateEnvelope: multiModeDraft.runtimeStateDraft.modeStateEnvelope
      } : characterDraft ? {
        mode: characterDraft.mode,
        modeMetadata: characterDraft.runtimeStateDraft.modeMetadata,
        moduleGraph: characterDraft.runtimeStateDraft.moduleGraph,
        wrapperGraph: characterDraft.runtimeStateDraft.wrapperGraph,
        modeStateEnvelope: characterDraft.runtimeStateDraft.modeStateEnvelope
      } : quickSettingDraft ? {
        mode: quickSettingDraft.mode,
        modeMetadata: quickSettingDraft.runtimeStateDraft.modeMetadata,
        moduleGraph: quickSettingDraft.runtimeStateDraft.moduleGraph,
        wrapperGraph: quickSettingDraft.runtimeStateDraft.wrapperGraph,
        modeStateEnvelope: quickSettingDraft.runtimeStateDraft.modeStateEnvelope
      } : {}),
      engineState: {
        dataMode: effectiveDataMode,
        worldSubType: effectiveSubType,
        directorMode: "hybrid",
        preset: effectivePreset,
        contextBudget: "balanced",
        emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
      },
      createdAt: now, updatedAt: now
    });
    if (sourceText) {
      await writeFile(join(worldDir, "runtime", "source.txt"), sourceText.slice(0, 200000), "utf-8");
    }
    // 初始化空日志
    await writeFile(join(worldDir, "runtime", "chat.jsonl"), "", "utf-8");
    await writeFile(join(worldDir, "runtime", "memory.jsonl"), "", "utf-8");
    // 初始化 shared — 引擎所有模块可能读的文件（character mode 的 characters.json 已由 factory 设置）
    for (const [file, dflt] of [["worldbook.json",{entries:[]}],["characters.json",[]],["scenes.json",[]],["relations.json",{}],["timeline.json",{}],["world_state.json",{}],["organizations.json",[]],["locations.json",[]],["races.json",[]],["rules.json",[]]]) {
      if (isCharacter && file === "characters.json") continue;
      await writeJson(join(worldDir, "shared", file), dflt);
    }
    // character mode: primary character record
    if (isCharacter) {
      const charName = displayName || name || "未命名角色";
      await writeJson(join(worldDir, "shared", "characters.json"), [{
        id: "primary",
        name: charName,
        sourceType: "character_card",
        rawTextRef: "runtime/source.txt",
        createdAt: now,
        updatedAt: now
      }]);
    }
    // Multi-mode closures: mode-specific shared state files
    if (body?.mode === "world-rpg") {
      await writeJson(join(worldDir, "shared", "world_rpg.json"), { schemaVersion: 1, mode: "world-rpg", status: "minimal", gmMode: true, currentSceneId: "opening", questSeed: null, playerState: { name: "玩家", role: "adventurer" }, notes: [], createdAt: now, updatedAt: now });
      await writeJson(join(worldDir, "shared", "world_threads.json"), { schemaVersion: 1, items: [], activeThreadIds: [], updatedAt: now });
      await writeFile(join(worldDir, "runtime", "world-proposals.jsonl"), "", "utf-8");
      const cacheDir = join(worldDir, "runtime", "cache", "worldbook");
      if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    }
    if (body?.mode === "tabletop") {
      await writeJson(join(worldDir, "shared", "tabletop.json"), { schemaVersion: 1, mode: "tabletop", status: "minimal", gmMode: true, ruleset: "freeform", currentSceneId: "opening", diceSystem: { enabled: false, reason: "Dice system deferred beyond P1." }, party: [], createdAt: now, updatedAt: now });
      await writeFile(join(worldDir, "runtime", "tabletop-proposals.jsonl"), "", "utf-8");
      const ttd = join(worldDir, "runtime", "cache", "tabletop"); if (!existsSync(ttd)) mkdirSync(ttd, { recursive: true });
    }
    if (body?.mode === "strategy-sim") {
      await writeJson(join(worldDir, "shared", "strategy.json"), { schemaVersion: 1, mode: "strategy-sim", status: "minimal", simulationStyle: "narrative", turn: 0, factions: [], resources: {}, numericModel: { enabled: false, reason: "Numeric simulation deferred beyond P1." }, createdAt: now, updatedAt: now });
      await writeFile(join(worldDir, "runtime", "strategy-sim-proposals.jsonl"), "", "utf-8");
      const ssd = join(worldDir, "runtime", "cache", "strategy-sim"); if (!existsSync(ssd)) mkdirSync(ssd, { recursive: true });
    }
    if (body?.mode === "murder-mystery") {
      await writeJson(join(worldDir, "shared", "murder_mystery.json"), { schemaVersion: 1, mode: "murder-mystery", status: "minimal", hostRole: "murder_mystery_host", caseId: "opening", suspects: [], clues: [], truthLock: { enabled: false, reason: "Truth lock deferred beyond P1." }, createdAt: now, updatedAt: now });
      await writeFile(join(worldDir, "runtime", "murder-mystery-proposals.jsonl"), "", "utf-8");
      const mmd = join(worldDir, "runtime", "cache", "murder-mystery"); if (!existsSync(mmd)) mkdirSync(mmd, { recursive: true });
    }
    if (body?.mode === "mystery-puzzle") {
      await writeJson(join(worldDir, "shared", "mystery.json"), { schemaVersion: 1, mode: "mystery-puzzle", status: "minimal", hostRole: "puzzle_host", currentPuzzleId: "opening", clues: [], knownFacts: [], solutionLock: { enabled: false, reason: "Truth lock deferred beyond P1." }, createdAt: now, updatedAt: now });
      await writeFile(join(worldDir, "runtime", "mystery-puzzle-proposals.jsonl"), "", "utf-8");
      const mpd = join(worldDir, "runtime", "cache", "mystery-puzzle"); if (!existsSync(mpd)) mkdirSync(mpd, { recursive: true });
    }
    if (body?.mode === "creation-forge") {
      await writeJson(join(worldDir, "shared", "creation_forge.json"), { schemaVersion: 1, mode: "creation-forge", status: "minimal", forgeType: "production", activeBlueprints: [], createdAt: now, updatedAt: now });
      await writeJson(join(worldDir, "shared", "forge_blueprints.json"), { schemaVersion: 1, blueprints: [], updatedAt: now });
      await writeFile(join(worldDir, "runtime", "creation-forge-proposals.jsonl"), "", "utf-8");
      const cfd = join(worldDir, "runtime", "cache", "creation-forge"); if (!existsSync(cfd)) mkdirSync(cfd, { recursive: true });
    }

    clearModuleCache(worldName);
    return { status: "ok", module: { id: worldName, name: worldName, displayName: worldData.displayName, type: "world", mode: worldData.mode || "", dataMode: worldData.dataMode, subType: worldData.subType, preset: worldData.preset, draft, sourceType, turnCount: 0 } };
  }

  async function finalizeDraft(moduleId, patch = {}) {
    const worldDir = moduleWorldDir(moduleId);
    if (!worldDir || !pathWithinRoot(worldsDir(), worldDir)) return { status: "error", errorMsg: "模组 ID 无效" };
    if (!existsSync(worldDir)) return { status: "error", errorMsg: "模组不存在" };
    const now = new Date().toISOString();
    const worldPath = join(worldDir, "world.json");
    const statePath = join(worldDir, "runtime", "state.json");
    const world = readJsonSync(worldPath, {});
    const state = readJsonSync(statePath, {});
    const displayName = String(patch.displayName || patch.name || world.displayName || world.name || "").trim();
    const nextWorld = { ...world, draft: false, updatedAt: now };
    if (displayName) nextWorld.displayName = displayName;
    await writeJson(worldPath, nextWorld);
    await writeJson(statePath, { ...state, draft: false, updatedAt: now });
    clearModuleCache(moduleId);
    return { status: "ok", module: { id: nextWorld.name || normalizeModuleKey(moduleId), name: nextWorld.name || normalizeModuleKey(moduleId), displayName: nextWorld.displayName, type: "world", mode: nextWorld.mode || "", dataMode: nextWorld.dataMode, subType: nextWorld.subType, preset: nextWorld.preset, draft: false, turnCount: nextWorld.turnCount || 0 } };
  }

  async function deleteModule(moduleId) {
    const worldDir = moduleWorldDir(moduleId);
    if (!worldDir || !pathWithinRoot(worldsDir(), worldDir)) return { status: "error", errorMsg: "模组 ID 无效" };
    if (!existsSync(worldDir)) return { status: "error", errorMsg: "模组不存在" };
    rmSync(worldDir, { recursive: true, force: true });
    clearModuleCache(moduleId);
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

  function fileFingerprint(filePath) {
    try {
      const st = statSync(filePath);
      return `${filePath}:${st.mtimeMs}:${st.size}`;
    } catch {
      return `${filePath}:missing`;
    }
  }

  function getModuleFingerprint(worldDir) {
    const paths = [
      join(worldDir, "world.json"),
      join(worldDir, "runtime", "state.json"),
      join(worldDir, "runtime.json")
    ];

    const sharedDir = join(worldDir, "shared");
    if (existsSync(sharedDir)) {
      for (const entry of readdirSync(sharedDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".json")) paths.push(join(sharedDir, entry.name));
      }
    }

    const overlayDir = join(worldDir, "runtime", "overlay");
    if (existsSync(overlayDir)) {
      for (const entry of readdirSync(overlayDir, { withFileTypes: true })) {
        if (entry.isFile() && /\.(json|jsonl)$/i.test(entry.name)) paths.push(join(overlayDir, entry.name));
      }
    }

    return paths.sort().map(fileFingerprint).join("|");
  }

  // Stage 5H: mode-specific shared seed file readback
  function stripSharedPrefix(value = "") {
    return String(value || "").replace(/^shared\//, "");
  }

  function modeSpecificSharedFilesForWorld(world = {}) {
    const modeId = world.mode || (world.modeMetadata && world.modeMetadata.modeId) || "";
    const capsule = modeId ? getModeCapsule(modeId) : null;
    const files = new Set();

    const modeSpecificFile = stripSharedPrefix(capsule?.saveSchema?.modeSpecificFile || "");
    if (modeSpecificFile) files.add(modeSpecificFile);

    // Additional seed files written by createModule that are not the primary modeSpecificFile
    if (modeId === "world-rpg") files.add("world_threads.json");
    if (modeId === "creation-forge") files.add("forge_blueprints.json");

    return [...files];
  }

  function readModeSpecificShared(sharedDir, files = []) {
    const result = {};
    for (const file of files) {
      result[file] = readJsonSync(join(sharedDir, file), null);
    }
    return result;
  }

  async function buildModuleModel(moduleId) {
    const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, ""), "");
    const worldDir = moduleWorldDir(moduleId);
    const empty = { loaded: true, selected: { id: worldName, name: worldName, path: worldDir, branch: "main" }, moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, relations: {}, timeline: {}, worldState: {}, organizations: [], races: [], runtime: {}, tracking: [], canon: {} }, entities: [], turnCount: 0 };
    if (!worldDir || !pathWithinRoot(worldsDir(), worldDir) || !existsSync(worldDir)) return empty;
    const cacheKey = normalizeModuleKey(moduleId);
    const fingerprint = getModuleFingerprint(worldDir);
    const cached = modelCache.get(cacheKey);
    if (cached?.fingerprint === fingerprint) return clone(cached.model);

    const world = readJsonSync(join(worldDir, "world.json"), {});
    const state = readJsonWithLegacy(join(worldDir, "runtime", "state.json"), join(worldDir, "runtime.json"), {}); // 兼容旧格式
    const shared = join(worldDir, "shared");

    const modeSpecificSharedFiles = modeSpecificSharedFilesForWorld(world);
    const modeSpecificShared = readModeSpecificShared(shared, modeSpecificSharedFiles);

    const model = {
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
        tracking: [], canon: {},
        modeSpecific: {
          modeId: world.mode || (world.modeMetadata && world.modeMetadata.modeId) || "",
          files: modeSpecificShared,
          sourceFiles: modeSpecificSharedFiles
        }
      },
      entities: [],
      turnCount: state.turnCount || world.turnCount || 0,
      // 读取上轮 overlay 数据（runtime/overlay/ 下的增量文件）
      _overlay: readOverlayData(worldDir)
    };
    modelCache.set(cacheKey, { fingerprint, model: clone(model) });
    return model;
  }

  return {
    worldsDir,
    charactersDir,
    moduleWorldDir,
    listModules,
    createModule,
    finalizeDraft,
    deleteModule,
    readOverlayData,
    buildModuleModel,
    clearModuleCache
  };
}
