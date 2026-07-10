// server.js — World Tree Web 服务器
// 替代原本的 Electron 主进程，以纯 HTTP 方式提供后端 API
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, createReadStream, rmSync } from "node:fs";
import { chmod, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { join, dirname, extname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOverlayOperation, applyOverlayWriteSet } from "./src/server/persistence-service.js";
import { prepareImportFiles, validateImportFileKey } from "./src/server/data-import-service.js";
import { sanitizeWorldName, createModuleService } from "./src/server/module-service.js";
import { pathWithinRoot, resolveInsideRoot } from "./src/server/path-security.js";
import { appendJsonl, calcDirectorySizeLimited, ensureDir, readJson, readJsonSync, readJsonlTail, writeJson } from "./src/server/fs-utils.js";
import { getUserDataRoot, userDataPath } from "./src/server/user-data-root.js";
import { OVERLAY_FILES, resetPendingStore } from "./src/core/engine/overlay-store.js";
import { clearPredictionStore } from "./src/core/engine/director.js";
import { importEngineState } from "./src/core/engine/state-persistence.js";
import { getWorldSessionRegistry } from "./src/core/engine/world-session.js";
import { buildEngineGraphSidecar, splitWorldForSave, stripRegenerableWorldFields } from "./src/core/system/world-save-hygiene.js";
import { loadPipelineProfiles, resolvePipelineProfile } from "./src/core/llm/pipeline-profiles.js";
import { buildRealPlayTurnContext } from "./src/core/real-play/turn-context.js";
import { createWtpack, validateWtpack } from "./src/server/wtpack-service.js";
import {
  errorPayload,
  HttpError,
  jsonError,
  jsonResponse,
  llmHttpError
} from "./src/server/http-response.js";
import { createReadBody } from "./src/server/http-request.js";
import {
  LOCAL_HOSTS,
  createRateLimiter,
  isLocalAddress,
  isLocalRequest,
  isLocalUrl,
  parseOriginHost
} from "./src/server/local-access.js";
import { guessTypeFromKeywords } from "./src/core/data/alchemy/types.js";
import { AlchemyPreviewError, createAlchemyPreviewService } from "./src/server/alchemy-preview-service.js";
import { getAlchemyCapabilities } from "./src/server/alchemy-capabilities.js";
import { createAlchemyPlannerService } from "./src/server/alchemy-planner-service.js";
import { createAlchemyLocalizerService } from "./src/server/alchemy-localizer-service.js";
import { createAlchemyDeliveryService } from "./src/server/alchemy-delivery-service.js";
import { createAlchemyGenerationService } from "./src/server/alchemy-generation-service.js";
import {
  commitMechanismDrafts,
  extractMechanismDrafts,
  listMechanismLibrary,
  MechanismValidationError,
  normalizeMechanismDraft,
  scrubMechanismValue
} from "./src/server/mechanism-service.js";
import {
  createTurnStateFrame,
  buildConfirmedAfterState,
  emptyConfirmedState,
  scrubStateValue
} from "./src/server/turn-state-frame-service.js";
import { createKernelTurnContext, summarizeKernelTurnContext } from "./src/core/kernel/kernel-turn-context.js";
import { transitionScene } from "./src/core/scene/scene-summary-chain.js";
import { collectWorldTelemetry } from "./src/core/telemetry/world-telemetry.js";
import { detectWorldbookCandidates } from "./src/core/worldbook/worldbook-candidate-detector.js";
import { recordWorldbookCandidate } from "./src/core/worldbook/worldbook-growth-tree.js";
import { updateCharacterInertia } from "./src/core/character/emotional-inertia.js";
import {
  getKernelSummary, handleBranchOperation, getLatestKernelTelemetry, refreshKernelTelemetry,
  previewAutoLight, approveKernelProposal, rejectKernelProposal, getKernelStopLoss, reverseKernelProposal,
  ingestProcessingMaterial, listProcessingCandidates, deliverProcessingById
} from "./src/server/kernel-service.js";
import { handleWorkflowApiRequest, getWorkflowTypesResponse, getWorkflowStatus } from "./src/core/workflows/adapters/server-workflow-adapter.js";
import { normalizeStrategySimSpec, validateStrategySimSpec, sealStrategySimSpec } from "./src/core/strategy-sim/strategy-sim-spec.js";
import { handleV2ProductPlayableRoute } from "./src/server/v2-product-playable-routes.js";
import { extractJsonValue, validateAlchemyJson } from "./src/core/llm/json-extract.js";
import { mapLlmError } from "./src/server/llm-error-mapper.js";
import { buildOpenAICompatibleChatBody } from "./src/adapters/providers/openai-compatible.js";
import { createConfigRuntime } from "./src/server/config-runtime.js";
import { createConnectionRuntime } from "./src/server/connection-runtime.js";
import { createStaticShell } from "./src/server/static-shell.js";
import { createHttpApiRouter } from "./src/server/http-api-router.js";
import { createDebugLogger } from "./src/server/debug-log.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".");
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
const PORT = process.env.PORT || 3000;
const CHAT_INPUT_MAX_CHARS = 20000;
const HOST = process.env.WORLD_TREE_HOST || "127.0.0.1";
const MAX_BODY_BYTES = Number(process.env.WORLD_TREE_MAX_BODY_BYTES || 20 * 1024 * 1024);
const readBody = createReadBody({ limit: MAX_BODY_BYTES });
const DATA_ROOT_OVERRIDE = process.env.WORLD_TREE_DATA_DIR
  ? resolve(process.env.WORLD_TREE_DATA_DIR)
  : "";

// ═══════════════════════════════════════════════════════════════
//  安全：仅允许本地访问（桌面应用）
// ═══════════════════════════════════════════════════════════════

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_STATIC = 300;
const RATE_MAX_API = 120;
const { checkRateLimit, cleanupExpired: cleanupRateLimitEntries } = createRateLimiter({
  windowMs: RATE_WINDOW_MS
});

// 定期清理过期速率限制条目（每 120s，防止内存泄漏）
setInterval(() => {
  cleanupRateLimitEntries();
}, 120_000).unref(); // unref 防止阻止进程退出

// ═══════════════════════════════════════════════════════════════
//  全局调试日志缓冲区（--debug 模式或 Ctrl+Shift+D 触发）
// ═══════════════════════════════════════════════════════════════

const DEBUG_MODE = process.argv.includes("--debug");
const ENABLE_DEFERRED_PLUGINS = process.env.WORLD_TREE_ENABLE_DEFERRED_PLUGINS === "1";
const DEBUG_LOG = [];
const DEBUG_MAX = 200;

// 异步检查 GitHub 最新版本（非阻塞）
let latestVersion = null;

// Local-first default: no external network call unless explicitly enabled.
if (process.env.WORLD_TREE_ENABLE_UPDATE_CHECK === "1") {
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
}

const debugLog = createDebugLogger({ enabled: DEBUG_MODE, buffer: DEBUG_LOG, max: DEBUG_MAX });

// ═══════════════════════════════════════════════════════════════
//  路径与默认配置
// ═══════════════════════════════════════════════════════════════

const {
  dataRoot,
  configPath,
  secretsPath,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  maskSecret,
  loadSecrets,
  saveSecrets,
  getSecretState,
  getActiveLlmValue,
  saveLlmSecret,
  LLM_CONNECTION_SENTINEL,
  llmProbeMessages,
  parseChatCompletionProbe,
  strictProbeFailure,
  partialProbeResult,
  testLlmConnection
} = createConfigRuntime({ ROOT, DATA_ROOT_OVERRIDE, join, userDataPath, readJson, writeJson, chmod, buildOpenAICompatibleChatBody, llmHttpError, errorPayload });

const WORLDS_DIR = () => join(dataRoot(), "engine", "worlds");
const CHARACTERS_DIR = () => join(dataRoot(), "engine", "characters");
const PROFILES_DIR = () => join(ROOT, "defaults", "world-profiles");
const EXAMPLES_DIR = () => join(ROOT, "defaults", "examples");
const EXAMPLE_MANIFEST = () => join(EXAMPLES_DIR(), "manifest.json");
const CONNECTIONS_PATH = () => userDataPath("connections.json");
const REVIEW_QUEUE_PATH = () => DATA_ROOT_OVERRIDE
  ? join(DATA_ROOT_OVERRIDE, "userData", "alchemy-review.json")
  : userDataPath("alchemy-review.json");
const PLUGINS_DIR = () => userDataPath("plugins");
const TURN_DEBUG_DIR = (moduleId = "global") => userDataPath("turn-debug", slugName(moduleId, "global"));

// ═══════════════════════════════════════════════════════════════
//  Module Service（工厂函数注入）
// ═══════════════════════════════════════════════════════════════

const moduleService = createModuleService({
  dataRoot,
  profilesDir: PROFILES_DIR,
  worldsDir: WORLDS_DIR,
  charactersDir: CHARACTERS_DIR,
  readJsonSync,
  writeJson,
  ensureDir,
  pathWithinRoot,
  safeEntityId
});

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
    title: item.title || item.name || item.id,
    name: item.name || item.id,
    description: item.description || "",
    kind: item.kind || "example",
    contentPolicy: item.contentPolicy || "",
    entrypoint: item.entrypoint || "",
    files: Array.isArray(item.files) ? item.files : [],
    expectedInstallResult: item.expectedInstallResult || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    recommendedForFirstRun: item.recommendedForFirstRun === true,
    suggestedFirstInput: item.suggestedFirstInput || "",
    suggestedActions: Array.isArray(item.suggestedActions) ? item.suggestedActions : [],
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
    const runtimeState = readJsonSync(join(worldDir, "runtime", "state.json"), {});
    const engineGraph = buildEngineGraphSidecar(world, runtimeState);
    await writeJson(join(worldDir, "world.json"), stripRegenerableWorldFields(world));
    if (engineGraph) await writeJson(join(worldDir, "runtime", "engine-graph.json"), engineGraph);

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
  return moduleService.listModules();
}

/** 从配置模板创建新世界（新目录结构 shared/ + runtime/） */
async function createModule(body) {
  return moduleService.createModule(body);
}

async function finalizeDraftModule(body = {}) {
  const id = body.moduleKey || body.id || "";
  if (!id) return { status: "error", errorMsg: "缺少模组标识。" };
  return moduleService.finalizeDraft(id, body);
}

/** 删除世界模组 */
async function deleteModule(moduleId) {
  const result = await moduleService.deleteModule(moduleId);
  if (result?.status === "ok") {
    const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, ""), "");
    if (worldName) {
      clearPredictionStore(worldName);
      resetPendingStore(worldName);
    }
    getWorldSessionRegistry().clear(moduleId);
  }
  return result;
}

/** 构建引擎 model 对象（从新目录结构加载，含 chat 历史） */
async function buildModuleModel(moduleId, options = {}) {
  const model = await moduleService.buildModuleModel(moduleId);
  const snapshot = model?.moduleData?.runtime?.engineSnapshot || model?._overlay?.runtime?.engineSnapshot;
  if (options.restoreEngineState !== false && snapshot?.version) {
    try { importEngineState(snapshot); } catch (err) { console.warn("[buildModuleModel] engine snapshot restore failed:", err.message); }
  }
  return model;
}

function readOverlayData(worldDir) {
  return moduleService.readOverlayData(worldDir);
}

/** 完整持久化：保存引擎状态 + 对话记录 + 记忆快照 + overlay writeSet */
async function persistTurn(moduleId, input, result, engineState, kernelContext = null, recordMeta = {}) {
  const isCharacter = String(moduleId || "").startsWith("char:");
  const worldName = safeEntityId(String(moduleId || "").replace(/^world:/, "").replace(/^char:/, ""), "");
  const projectRoot = isCharacter ? join(CHARACTERS_DIR(), worldName) : moduleWorldDir(moduleId);
  const proposedBranchRoot = kernelContext?.branchRoot || projectRoot;
  const baseDir = !isCharacter && proposedBranchRoot && pathWithinRoot(projectRoot, proposedBranchRoot) ? proposedBranchRoot : projectRoot;
  if (!worldName || !projectRoot || !baseDir || !pathWithinRoot(isCharacter ? CHARACTERS_DIR() : WORLDS_DIR(), projectRoot) || !pathWithinRoot(projectRoot, baseDir)) return null;
  if (!existsSync(baseDir)) return null;
  const rtDir = join(baseDir, "runtime");
  ensureDir(rtDir);

  const previousRuntimeState = readJsonSync(join(rtDir, "state.json"), {});
  const turnCount = (previousRuntimeState.turnCount || readJsonSync(join(projectRoot, "world.json"), {}).turnCount || 0) + 1;
  const now = new Date().toISOString();
  const turnId = `turn-${turnCount}`;
  const userId = `turn-${turnCount}-user`;
  const assistantId = `turn-${turnCount}-assistant`;
  const saveId = safeEntityId(kernelContext?.activeBranchId || previousRuntimeState.activeBranch || "main", "main");
  const engineSnapshot = result.overlayPatch?._engineState || null;

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
        try { rmSync(join(backupDir, old), { force: true }); } catch (err) { console.warn("[persistTurn] old chat backup cleanup failed:", err?.message || "unknown error"); }
      }
    } catch (err) { console.warn("[persistTurn] chat backup failed (non-fatal):", err?.message || "unknown error"); }
  }

  // state.json — 完整覆盖
  await writeJson(join(rtDir, "state.json"), {
    ...previousRuntimeState,
    turnCount,
    activeBranch: saveId,
    lastScene: result.parsedSections?.["状态"]?.scene || "",
    lastInput: input,
    engineState: engineState || {},
    engineSnapshot,
    updatedAt: now
  });

  // chat.jsonl — 追加用户+助手消息（截断阈值放宽：上下文窗口充足无需过度紧缩）
  await appendJsonl(join(rtDir, "chat.jsonl"), { id: userId, turnId, role: "user", content: input.slice(0, CHAT_INPUT_MAX_CHARS), round: turnCount, ts: now, favorite: false, ...(recordMeta.user || {}) });
  await appendJsonl(join(rtDir, "chat.jsonl"), { id: assistantId, turnId, role: "assistant", content: (result.narrative || "").slice(0, 10000), round: turnCount, ts: new Date().toISOString(), sections: result.parsedSections || {}, favorite: false, candidates: [{ id: `${assistantId}-c0`, content: (result.narrative || "").slice(0, 10000), selected: true, createdAt: now }], ...(recordMeta.assistant || {}) });

  // memory.jsonl — 追加记忆快照
  if (result.overlayPatch?.memorySnapshot) {
    await appendJsonl(join(rtDir, "memory.jsonl"), result.overlayPatch.memorySnapshot);
  }

  // execute overlay writeSet — only whitelisted runtime/overlay files are writable.
  if (result.writeSet?.length) {
    try {
      await applyOverlayWriteSet(rtDir, result.writeSet, { moduleId });
    } catch (e) {
      console.warn("[persistTurn] writeSet 执行失败:", e.message);
    }
  }

  // world.json — 更新轮次
  if (isCharacter) {
    const st = readJsonSync(join(rtDir, "state.json"), {});
    await writeJson(join(rtDir, "state.json"), { ...st, turnCount, lastInput: input, engineState: engineState || {}, engineSnapshot, updatedAt: now });
  } else {
    const wj = readJsonSync(join(projectRoot, "world.json"), {});
    wj.turnCount = turnCount; wj.updatedAt = now;
    await writeJson(join(projectRoot, "world.json"), wj);
  }

  // Kernel hooks are branch-local sidecars. They never write hidden truth into prompts
  // and never bypass proposal approval for canonical changes.
  if (!isCharacter && kernelContext) {
    const nextSceneName = result.parsedSections?.["状态"]?.scene || result.parsedSections?.["状态建议"]?.scene || "";
    const previousSceneName = kernelContext.livingWorldPacket?.scene?.title || "";
    if (nextSceneName && nextSceneName !== previousSceneName) {
      await transitionScene(baseDir, { title: nextSceneName, modeId: kernelContext.modeId }, {
        summary: String(result.narrative || "").slice(0, 500),
        modeId: kernelContext.modeId,
        changes: result.appliedMechanismChanges || result.mechanismChanges || []
      });
    }
    await collectWorldTelemetry(baseDir, { branchId: saveId, turnId, turn: turnCount }, { persist: true });
    if (kernelContext.autoAdvancePreview) {
      await appendJsonl(join(rtDir, "auto-advance-state.jsonl"), { ...kernelContext.autoAdvancePreview, turnId, generatedAt: now });
    }
    const existingProposals = await readJsonlTail(join(rtDir, "world-proposals.jsonl"), 500);
    const existingProposalIds = new Set(existingProposals.map((item) => item.id));
    for (const proposal of (result.proposals || []).filter((item) => item?.id && item.status === "pending" && !existingProposalIds.has(item.id))) {
      await appendJsonl(join(rtDir, "world-proposals.jsonl"), proposal);
      await appendJsonl(join(rtDir, "tracking", "change-log.jsonl"), { id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, timestamp: now, source: "turn-kernel", proposalId: proposal.id, reason: proposal.reason || proposal.summary || "proposal generated", changeType: "proposal_generated", impactLevel: proposal.impactLevel || "medium", applied: false });
    }
    const growthCandidates = detectWorldbookCandidates({ concepts: result.worldbookCandidates || [], sceneId: nextSceneName || previousSceneName || null, turn: turnCount });
    for (const candidate of growthCandidates) await recordWorldbookCandidate(baseDir, candidate);
    for (const update of (result.emotionalInertiaUpdates || []).slice(0, 12)) {
      if (!update?.characterId) continue;
      await updateCharacterInertia(baseDir, update.characterId, update.patch || {}, { reason: update.reason || "turn update", sceneId: nextSceneName || previousSceneName || null, turn: turnCount });
    }
  }

  // TurnStateFrame — 每轮确认完成后生成并持久化。只读取已确认运行状态与机制缓存，
  // 不采纳未确认 proposal、debug、session 或密钥字段。
  const previousFrame = await loadLatestTurnStateFrame(moduleId, saveId);
  const mechanismCache = readJsonSync(mechanismCachePath(moduleId) || "", { mechanisms: [] });
  const beforeState = previousFrame?.afterState || emptyConfirmedState();
  const afterState = buildConfirmedAfterState({
    previousState: beforeState,
    engineState: engineState || {},
    parsedSections: result.parsedSections || {},
    overlayPatch: result.overlayPatch || {},
    mechanismCache,
    appliedMechanismChanges: result.appliedMechanismChanges || result.mechanismChanges || []
  });
  const frame = createTurnStateFrame({
    turnId, round: turnCount, userMessageId: userId, assistantMessageId: assistantId,
    moduleKey: moduleId, saveId,
    beforeState, afterState, engineState: engineState || {}, mechanismCache,
    worldbookHash: currentWorldbookHash(moduleId, isCharacter ? null : baseDir), createdAt: now
  });
  await saveTurnStateFrame(moduleId, frame);
  moduleService.clearModuleCache?.(moduleId);
  return { userId, assistantId, turnId, turnCount };
}

// ═══════════════════════════════════════════════════════════════
//  LLM 对话
// ═══════════════════════════════════════════════════════════════

async function handleLocalChatFallback(body = {}, reason = "LLM_NOT_CONFIGURED") {
  const { input, moduleKey, dataMode, engineState } = body || {};
  if (!moduleKey || String(moduleKey).startsWith("__")) {
    return { status: "error", code: reason, errorMsg: "未连接 AI 模型；请选择一个本地世界后再记录本地输入。" };
  }
  const model = await buildModuleModel(moduleKey);
  const selected = model?.selected || {};
  const now = new Date().toISOString();
  const cleanInput = String(input || "").slice(0, CHAT_INPUT_MAX_CHARS);
  const narrative = [
    "（本地占位回复）当前未连接 AI 模型，本次输入已记录到本地存档。",
    "",
    `已记录输入：${cleanInput.slice(0, 500)}`,
    "",
    "配置模型后可以继续进行正式 AI 互动。"
  ].join("\n");
  const nextState = {
    ...(engineState || {}),
    dataMode: dataMode || selected.dataMode || "worldbook",
    localFallback: true,
    fallbackReason: reason,
    updatedAt: now
  };
  const parsedSections = {
    "叙事": { _raw: narrative },
    "状态": { scene: model?.moduleData?.runtime?.lastScene || "" }
  };
  const persistedIds = await persistTurn(moduleKey, cleanInput, {
    narrative,
    parsedSections,
    engineState: nextState,
    overlayPatch: null,
    writeSet: []
  }, nextState, null);
  moduleService.clearModuleCache?.(moduleKey);
  return {
    status: "ok",
    localFallback: true,
    fallbackReason: reason,
    narrative,
    parsedSections,
    engineState: nextState,
    persistedIds,
    turnCount: persistedIds?.turnCount || nextState.turnCount || null
  };
}

async function persistFailedTurn(moduleKey, input, mappedError, engineState = {}, metadata = {}) {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir || !moduleKey || String(moduleKey).startsWith("__")) return null;
  ensureDir(rtDir);
  const state = readJsonSync(join(rtDir, "state.json"), {});
  const currentRound = Number(state.turnCount || 0);
  const now = new Date().toISOString();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const failedTurnId = metadata.failedTurnId || `failed-turn-${suffix}`;
  const userId = `${failedTurnId}-user`;
  const errorId = `${failedTurnId}-error`;
  const common = {
    failedTurnId,
    turnStatus: "failed",
    round: currentRound || null,
    ts: now,
    favorite: false
  };
  await appendJsonl(join(rtDir, "chat.jsonl"), {
    ...common,
    id: userId,
    turnId: failedTurnId,
    role: "user",
    content: String(input || "").slice(0, CHAT_INPUT_MAX_CHARS),
    attemptedAt: now,
    engineState: engineState || {},
    ...(metadata.user || {})
  });
  await appendJsonl(join(rtDir, "chat.jsonl"), {
    ...common,
    id: errorId,
    turnId: failedTurnId,
    role: "error",
    content: mappedError.userMessage || mappedError.errorMsg || "LLM 调用失败",
    code: mappedError.code || "LLM_UNKNOWN_ERROR",
    userMessage: mappedError.userMessage || mappedError.errorMsg || "",
    detail: mappedError.detail || "",
    retryable: mappedError.retryable !== false,
    attemptedAt: now,
    inputRefId: userId,
    ...(metadata.error || {})
  });
  moduleService.clearModuleCache?.(moduleKey);
  return { failedTurnId, userId, errorId };
}

async function findFailedTurn(moduleKey, failedTurnId) {
  const id = String(failedTurnId || "");
  if (!moduleKey || !id) return null;
  const records = await readChatRecords(moduleKey);
  const error = records.find((record) =>
    record.role === "error" && (record.failedTurnId === id || record.turnId === id || record.id === id)
  );
  if (!error) return null;
  const user = records.find((record) =>
    record.role === "user" && (
      record.id === error.inputRefId ||
      record.failedTurnId === error.failedTurnId ||
      record.turnId === error.failedTurnId ||
      record.turnId === error.turnId
    )
  );
  return { error, user, records };
}

function sseWrite(res, event, data = {}) {
  if (res.writableEnded || res.destroyed) return false;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  return true;
}

function splitSseText(text = "", size = 48) {
  const source = String(text || "");
  const chunks = [];
  for (let i = 0; i < source.length; i += size) chunks.push(source.slice(i, i + size));
  return chunks;
}

function createNarrativeStreamGate(onDelta) {
  let buffer = "";
  let narrativeOpen = false;
  let stopped = false;
  let emittedAny = false;
  const marker = "【叙事】";
  const emit = (text) => {
    const value = String(text || "");
    if (!value) return;
    emittedAny = true;
    onDelta(value);
  };
  return {
    feed(chunk = "") {
      if (stopped) return;
      buffer += String(chunk || "");
      if (!narrativeOpen) {
        const idx = buffer.indexOf(marker);
        if (idx < 0) {
          buffer = buffer.slice(-marker.length);
          return;
        }
        narrativeOpen = true;
        buffer = buffer.slice(idx + marker.length).replace(/^\s*\r?\n?/, "");
      }
      const nextSection = buffer.search(/\r?\n【[^】]+】/);
      if (nextSection >= 0) {
        emit(buffer.slice(0, nextSection));
        buffer = "";
        stopped = true;
        return;
      }
      const safeLength = Math.max(0, buffer.length - 12);
      if (safeLength > 0) {
        emit(buffer.slice(0, safeLength));
        buffer = buffer.slice(safeLength);
      }
    },
    flush() {
      if (stopped) return emittedAny;
      if (narrativeOpen && buffer) emit(buffer);
      buffer = "";
      return emittedAny;
    },
    get emittedAny() { return emittedAny; }
  };
}

async function runLlmChatSuccess(body, retryMeta = {}, streamHooks = {}) {
  const moduleKey = body?.moduleKey || "";
  const session = getWorldSessionRegistry().get(moduleKey || "__default__");
  return await session.runTurn(() => runLlmChatSuccessInSession(body, retryMeta, streamHooks, session));
}

async function runLlmChatSuccessInSession(body, retryMeta = {}, streamHooks = {}, worldSession = null) {
  const { input, moduleKey, dataMode, engineState, messages } = body || {};
  if (!input) return { status: "error", errorMsg: "请输入内容后再发送" };

  // 业务级输入长度限制（防止超长文本打入 LLM）
  if (String(input).length > CHAT_INPUT_MAX_CHARS) {
    return { status: "error", code: "INPUT_TOO_LONG", errorMsg: `输入文本过长（${String(input).length} 字符）。请精简到 ${CHAT_INPUT_MAX_CHARS} 字符以内再发送。` };
  }

  const config = await loadConfig();
  const apiKey = await getActiveLlmValue();
  const providerId = String(config.llmProvider || config.provider || "openai-compatible").toLowerCase();
  if (process.env.WORLD_TREE_DISABLE_LLM === "1") return await handleLocalChatFallback(body, "LLM_DISABLED");
  if (!apiKey && providerId !== "mock") return await handleLocalChatFallback(body, "LLM_API_KEY_MISSING");
  if (!config.llmBaseUrl || !config.llmModel) return await handleLocalChatFallback(body, "LLM_CONFIG_MISSING");

  // 懒加载引擎模块
  const { sendDualStageTurn, canUseDirectLlm } = await import("./src/adapters/llm.js");
  const { normalizeEngineState, DEFAULT_ENGINE_STATE } = await import("./src/core/engine/modules.js");

  if (!canUseDirectLlm(config, Boolean(apiKey))) {
    return await handleLocalChatFallback(body, "LLM_CONFIG_INCOMPLETE");
  }

  // 构建 model 对象
  const model = moduleKey ? await buildModuleModel(moduleKey, { restoreEngineState: false }) : {
    loaded: true, selected: { id: "default", name: "默认" },
    moduleData: { characters: [], scenes: [], worldbook: { entries: [] }, relations: {}, timeline: {}, worldState: {}, organizations: [], races: [], runtime: {}, tracking: [], canon: {} },
    entities: [], turnCount: 0
  };
  const sessionSnapshot = model?.moduleData?.runtime?.engineSnapshot || model?._overlay?.runtime?.engineSnapshot || null;

  // 标准化引擎状态
  const normState = normalizeEngineState(engineState || DEFAULT_ENGINE_STATE);
  const modeId = body.modeId || model.selected?.mode || model.moduleData?.runtime?.mode || (dataMode === "character_card" ? "character" : "world-rpg");
  const realPlayContext = buildRealPlayTurnContext({ modeId, input, engineState: normState, messages: messages || [] });
  if (!realPlayContext.ok) return { status: "error", code: "REAL_PLAY_COMMAND_INVALID", errorMsg: realPlayContext.error || "玩法命令无效" };
  const realPlayInput = realPlayContext.promptBlock ? `${input}\n\n${realPlayContext.promptBlock}` : input;
  const realPlayState = normalizeEngineState({ ...normState, realPlay: realPlayContext.state });
  const kernelProjectRoot = moduleKey && !String(moduleKey).startsWith("char:") && !String(moduleKey).startsWith("__") ? moduleWorldDir(moduleKey) : "";
  const kernelContext = await createKernelTurnContext({
    projectRoot: kernelProjectRoot || "",
    modeId,
    userInput: input,
    model,
    engineState: realPlayState,
    runtimeFlags: {
      advanceMode: body.advanceMode || "assisted",
      profileId: body.profileId,
      hiddenTruthRequired: body.hiddenTruthRequired === true,
      suggestedUserChoices: body.suggestedUserChoices || []
    }
  });

  const { prepareWorldbookInjection } = await import("./src/core/runtime/worldbook-runtime.js");
  const worldbookRuntime = prepareWorldbookInjection({
    model,
    input,
    engineState: normState,
    messages: messages || [],
    mode: "both"
  });
  const injectedWorldbook = worldbookRuntime.injectedWorldbook;

  debugLog("engine", `世界书匹配: ${injectedWorldbook.length} 条注入`, {
    dataMode: dataMode || "worldbook",
    moduleKey,
    droppedByBudget: worldbookRuntime.diagnostics.droppedByBudget.length
  });

  // 按 dataMode 构建模式专属 writer 包（仅角色卡模式走 buildCharacterCardPacket）
    let writerPacket = null;
    let effectiveState = realPlayState;
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

      const ccState = { ...realPlayState, dataMode: "character_card" };
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

    const pipelineProfile = resolvePipelineProfile(body.pipelineProfileId || config.pipelineProfileId || "balanced");
    const result = await sendDualStageTurn({
      model,
      config: { ...config, llmBaseUrl: config.llmBaseUrl, llmModel: config.llmModel },
      apiKey,
      messages: messages || [],
      input: realPlayInput,
      injectedWorldbook,
      engineState: effectiveState,
      moduleKey: moduleKey || "unloaded",
      dataMode: dataMode || "worldbook",
      skipDirector: true,
      skipGuardian: pipelineProfile?.guardian === "off",
      useLlmAnalysis: true,
      directorMode: pipelineProfile?.directorMode || "hybrid",
      writerPacket,
      kernelContext,
      streamWriter: streamHooks.streamWriter === true,
      onWriterToken: streamHooks.onWriterToken,
      onStreamFallback: streamHooks.onStreamFallback,
      finalizeTurn: worldSession ? async (completeTurn) => {
        const { result: finalized, restore } = await worldSession.finalizeWithSnapshot(sessionSnapshot, () => completeTurn());
        if (restore?.warning && finalized && typeof finalized === "object") finalized.sessionWarning = restore.warning;
        return finalized;
      } : null
    });

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
      const recordMeta = retryMeta.failedTurnId ? {
        user: { retryOf: retryMeta.failedTurnId },
        assistant: {
          retryOf: retryMeta.failedTurnId,
          supersedesErrorId: retryMeta.errorId || "",
          recoveredFromFailedTurnId: retryMeta.failedTurnId,
          recoveredAt: new Date().toISOString()
        }
      } : {};
      persistedIds = await persistTurn(moduleKey, input, persistResult, result.engineState || normState, kernelContext, recordMeta);
      await saveTurnDebug(moduleKey, {
        moduleKey,
        input,
        summary: `${injectedWorldbook.length} 条世界书命中，Guardian ${result.guardianResult?.score ?? "未评分"}`,
        worldbookHits: injectedWorldbook,
        worldbookRuntime: worldbookRuntime.diagnostics,
        characterState: dataMode === "character_card" ? { moduleKey, mode: "character_card" } : { characters: model.moduleData?.characters || [] },
        memorySnapshot: result.overlayPatch?.memorySnapshot || {},
        directionPacket: result.directorResult?.packet || result.directionPacket || result._dualStage?.directionPacket || {},
        guardian: result.guardianResult || {},
        parsedSections: sections,
        engineState: result.engineState || normState,
        kernel: summarizeKernelTurnContext(kernelContext)
      });
    }

    let usage = null;
    const stageUsage = result._dualStage?.usage || [];
    if (stageUsage.length && moduleKey && !moduleKey.startsWith("__")) {
      const { appendUsageRecord, readUsageSummary, summarizeUsageRecords } = await import("./src/core/llm/usage-meter.js");
      const usagePath = join(moduleRuntimeDir(moduleKey), "usage.jsonl");
      const turnUsage = summarizeUsageRecords(stageUsage, { yuanPerMillionTokens: config.yuanPerMillionTokens });
      await appendUsageRecord(usagePath, {
        ts: new Date().toISOString(),
        moduleKey,
        turnCount: persistedIds?.turnCount || (model.turnCount || 0) + 1,
        provider: config.llmProvider || config.provider || "openai-compatible",
        stages: stageUsage,
        turn: turnUsage
      });
      usage = { turn: turnUsage, session: await readUsageSummary(usagePath) };
    }

    const returnedState = normalizeEngineState({ ...(result.engineState || realPlayState), realPlay: realPlayContext.state });
    return { status: "ok", narrative: cleanNarrative, parsedSections: sections, engineState: returnedState, turnCount: persistedIds?.turnCount || (model.turnCount || 0) + 1, persistedIds, usage, pipelineProfile: pipelineProfile ? { id: pipelineProfile.id, quality: pipelineProfile.quality, speed: pipelineProfile.speed, cost: pipelineProfile.cost } : null, kernel: summarizeKernelTurnContext(kernelContext), modePlay: realPlayContext.publicState, commandResult: realPlayContext.commandResult, _dualStage: result._dualStage || null, _progress: progress };
}

async function handleLlmChat(body) {
  try {
    return await runLlmChatSuccess(body);
  } catch (err) {
    const mapped = mapLlmError(err);
    let persistedIds = null;
    const moduleKey = body?.moduleKey || "";
    if (moduleKey && !String(moduleKey).startsWith("__") && body?.input) {
      persistedIds = await persistFailedTurn(moduleKey, body.input, mapped, body.engineState || {});
    }
    return { ...mapped, persistedIds };
  }
}

async function handleLlmChatStream(req, res) {
  const body = await readBody(req);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  let closed = false;
  let wroteDelta = false;
  req.on("close", () => { closed = true; });
  const emit = (event, data) => !closed && sseWrite(res, event, data);
  const gate = createNarrativeStreamGate((content) => {
    wroteDelta = true;
    emit("delta", { content });
  });
  try {
    emit("stage", { name: "analysis", label: "分析输入" });
    emit("stage", { name: "writer", label: "生成叙事正文" });
    const result = await runLlmChatSuccess(body, {}, {
      streamWriter: true,
      onWriterToken: (chunk) => gate.feed(chunk),
      onStreamFallback: (err) => emit("stage", {
        name: "fallback",
        label: "stream 不可用，自动切换非流式完成",
        code: err?.code || "LLM_STREAM_FALLBACK"
      })
    });
    gate.flush();
    if (!wroteDelta) {
      for (const chunk of splitSseText(result.narrative || "（无回应）")) {
        wroteDelta = true;
        emit("delta", { content: chunk, fallbackMode: "non_streaming_server_fallback" });
      }
    }
    emit("stage", { name: "persist", label: "已完成落盘" });
    emit("done", result);
  } catch (err) {
    const mapped = mapLlmError(err);
    let persistedIds = null;
    const moduleKey = body?.moduleKey || "";
    if (moduleKey && !String(moduleKey).startsWith("__") && body?.input) {
      persistedIds = await persistFailedTurn(moduleKey, body.input, mapped, body.engineState || {});
    }
    emit("error", { ...mapped, persistedIds });
  } finally {
    if (!res.writableEnded && !res.destroyed) res.end();
  }
}

async function handleLlmChatRetry(body = {}) {
  const moduleKey = body.moduleKey || "";
  const failedTurnId = body.failedTurnId || body.turnId || body.messageId || "";
  const failed = await findFailedTurn(moduleKey, failedTurnId);
  if (!failed?.user || !failed?.error) {
    return { status: "error", code: "FAILED_TURN_NOT_FOUND", errorMsg: "没有找到可重试的失败回合。请重新加载对话后再试。", retryable: false };
  }
  try {
    return await runLlmChatSuccess({
      ...body,
      input: failed.user.content || body.input || "",
      messages: Array.isArray(body.messages) ? body.messages : []
    }, {
      failedTurnId: failed.error.failedTurnId || failed.error.turnId,
      errorId: failed.error.id
    });
  } catch (err) {
    const mapped = mapLlmError(err);
    const persistedIds = await persistFailedTurn(moduleKey, failed.user.content || "", mapped, body.engineState || {}, {
      failedTurnId: `retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      error: { retryOf: failed.error.failedTurnId || failed.error.turnId, previousErrorId: failed.error.id }
    });
    return { ...mapped, persistedIds };
  }
}

// ═══════════════════════════════════════════════════════════════
//  内容炼金台
// ═══════════════════════════════════════════════════════════════

/** 构建炼金台 LLM 调用适配器（协议：返回 content 字符串，匹配 classifier/extractor 的 String() 解析） */
function buildAlchemyLlmCall(config, apiKey) {
  if (process.env.WORLD_TREE_DISABLE_LLM === "1" || !apiKey || !config.llmBaseUrl || !config.llmModel) return null;
  const baseUrl = String(config.llmBaseUrl).replace(/\/$/, "");
  const timeoutMs = Number(config.llmTimeoutMs || 60000);
  return async (system, user) => {
    const { scrubPromptForPrivacy } = await import("./src/core/world-engine.js");
    const safeSystem = scrubPromptForPrivacy(system);
    const safeUser = scrubPromptForPrivacy(user);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildOpenAICompatibleChatBody({
        baseUrl,
        providerId: config.llmProvider || config.provider || "openai-compatible",
        model: config.llmModel,
        messages: [
          { role: "system", content: safeSystem },
          { role: "user", content: safeUser }
        ],
        temperature: 0.3,
        maxTokens: 2048,
        thinking: config.llmThinking ?? config.thinking ?? "auto"
      })),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  };
}

function parseAlchemyLlmJson(raw) {
  const purpose = arguments[1]?.purpose || "";
  const extracted = extractJsonValue(raw, {
    validate: (value) => validateAlchemyJson(value, purpose)
  });
  if (!extracted.ok) throw new Error(`LLM JSON parse failed: ${extracted.error}`);
  return extracted.value;
}

async function runAlchemyLlmJson(prompt, options = {}) {
  const config = await loadConfig();
  const apiKey = await getActiveLlmValue();
  const llmCall = buildAlchemyLlmCall(config, apiKey);
  if (!llmCall) {
    throw new Error("LLM connection is not configured");
  }

  const system = [
    "你是 World Tree 的炼金台 JSON 生成器。",
    "你必须只输出严格 JSON。",
    "不要输出 Markdown。",
    "不要输出解释文字。",
    "不要输出 HTML/script/style/js。"
  ].join("\n");

  const raw = await llmCall(system, String(prompt || ""));
  return parseAlchemyLlmJson(raw, options);
}

async function handleAlchemyImport(body) {
  const { text, moduleKey = "" } = body || {};
  if (!text) return { status: "error", errorMsg: "导入内容为空" };
  // 业务级输入长度限制
  const ALCHEMY_DIRECT_LLM_MAX_CHARS = 120000;
  if (String(text).length > ALCHEMY_DIRECT_LLM_MAX_CHARS) {
    return { status: "error", code: "TEXT_TOO_LONG", errorMsg: `导入文本过长（${String(text).length} 字符）。请分块导入，每块不超过 ${ALCHEMY_DIRECT_LLM_MAX_CHARS} 字符。` };
  }
  try {
    const config = await loadConfig();
    const apiKey = await getActiveLlmValue();
    const llmCall = buildAlchemyLlmCall(config, apiKey);
    const { importFile } = await import("./src/core/data/alchemy/alchemy-engine.js");
    const result = await importFile(text, { llmCall, options: { autoRelations: true } });
    const reviewItems = await enqueueReviewItems(result?.items || [], { source: "alchemy-import", snippet: String(text).slice(0, 240), moduleKey });
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

function alchemyPreviewRoot(moduleKey = "") {
  if (!moduleKey) return join(dataRoot(), "runtime", "alchemy-previews");
  const runtimeDir = moduleRuntimeDir(moduleKey);
  const ownerDir = runtimeDir ? dirname(runtimeDir) : "";
  if (!runtimeDir || !ownerDir || !pathWithinRoot(dataRoot(), runtimeDir) || !existsSync(ownerDir)) {
    throw new AlchemyPreviewError(400, "ALCHEMY_MODULE_INVALID", "目标世界不存在，请重新选择。");
  }
  return join(runtimeDir, "alchemy-previews");
}

function listAlchemyPreviewModuleKeys() {
  return listModules()
    .filter(module => module.type === "world" || module.type === "character_card")
    .map(module => module.id || module.name)
    .filter(Boolean);
}

const alchemyPreviewService = createAlchemyPreviewService({
  previewRoot: alchemyPreviewRoot,
  listModuleKeys: listAlchemyPreviewModuleKeys,
  readJson: readJsonSync,
  writeJson,
  exists: existsSync,
  guessTypes: guessTypeFromKeywords,
  async runAlchemy(text, context) {
    const config = await loadConfig();
    const apiKey = await getActiveLlmValue();
    const llmCall = buildAlchemyLlmCall(config, apiKey);
    const { importFile } = await import("./src/core/data/alchemy/alchemy-engine.js");
    const modeGuide = {
      import: "高保真提取已有素材，不补写未出现的事实。",
      co_create: "把灵感扩展为可审核的候选设定，并保留不确定性。",
      polish: "保留原意并整理结构，不擅自改变核心设定。",
      structure: "只做低创作性的结构拆分和分类。"
    }[context.mode];
    const targetGuide = context.target === "mixed" ? "自动识别类型" : `优先整理为 ${context.target}`;
    let processingText = text;
    let collaborationPhase = null;
    if (llmCall && (context.mode === "co_create" || context.mode === "polish")) {
      const system = context.mode === "co_create"
        ? "你是世界构建协作者。根据用户灵感生成克制、可审核的候选设定草稿；明确区分用户已给出的事实与推测，不把推测写成既定事实。只输出便于后续提取的中文结构化文本，不输出 HTML。"
        : "你是设定资料编辑。保留原意，把混乱素材整理成清晰、可审核的结构化文本；不要擅自添加核心事实，不输出 HTML。";
      const generated = await llmCall(system, `模式要求：${modeGuide}\n目标：${targetGuide}${context.userGoal ? `\n用户目标：${context.userGoal}` : ""}\n\n用户素材：\n${text}`);
      if (String(generated || "").trim()) {
        processingText = String(generated).trim().slice(0, 120000);
        collaborationPhase = { phase: "collaborate", method: "llm", tokenCost: "medium", outputLength: processingText.length };
      }
    }
    if (llmCall && !collaborationPhase) {
      processingText = `处理要求：${modeGuide}\n目标：${targetGuide}${context.userGoal ? `\n用户目标：${context.userGoal}` : ""}\n\n素材：\n${text}`;
    }
    const result = await importFile(processingText, { llmCall, options: { autoRelations: context.options.autoRelations } });
    return { ...result, phases: [...(collaborationPhase ? [collaborationPhase] : []), ...(result?.phases || [])], _llmUsed: Boolean(llmCall) };
  },
  enqueueReviewItems
});

// ── 炼金台 G1：Planner / Localizer / Delivery service ──
const alchemyPlannerService = createAlchemyPlannerService({
  getCapabilities: getAlchemyCapabilities,
  runLlmJson: runAlchemyLlmJson
});

const alchemyGenerationService = createAlchemyGenerationService({
  runLlmJson: runAlchemyLlmJson,
  now: () => new Date()
});

const alchemyLocalizerService = createAlchemyLocalizerService({
  normalizeWorldbookEntry: normalizeWorldbookEntryForSave,
  normalizeMechanismDraft,
  normalizeStrategySimSpec,
  sealStrategySimSpec,
  safeEntityId,
  now: () => new Date()
});

const alchemyDeliveryService = createAlchemyDeliveryService({
  dataRoot,
  worldsDir: WORLDS_DIR,
  moduleRuntimeDir,
  moduleWorldDir,
  readJson: readJsonSync,
  writeJson,
  writeFile,
  appendJsonl,
  readJsonlTail,
  exists: existsSync,
  ensureDir,
  normalizeWorldbookEntry: normalizeWorldbookEntryForSave,
  normalizeMechanismDraft,
  commitMechanismDrafts,
  normalizeStrategySimSpec,
  validateStrategySimSpec,
  sealStrategySimSpec,
  buildInstallableFolderDraft: alchemyLocalizerService.buildInstallableFolderDraft,
  safeEntityId,
  now: () => new Date()
});

async function handleAlchemyPreviewAction(action, body) {
  try {
    return await alchemyPreviewService[action](body || {});
  } catch (err) {
    if (err instanceof AlchemyPreviewError) {
      throw new HttpError(err.status, err.code, err.userMsg);
    }
    debugLog("alchemy", `${action} failed`, err?.message || "unknown error");
    throw new HttpError(502, "ALCHEMY_PREVIEW_FAILED", "炼金预览处理失败，请检查连接设置后重试。");
  }
}

function alchemyMechanismSource(body = {}) {
  if (typeof body.text === "string" && body.text.trim()) return { text: body.text, moduleKey: String(body.moduleKey || "") };
  if (!body.previewId) return { text: "", moduleKey: String(body.moduleKey || "") };
  try {
    const preview = alchemyPreviewService.load(String(body.previewId), String(body.moduleKey || ""));
    return { text: preview.input?.excerpt || "", moduleKey: preview.moduleKey || String(body.moduleKey || "") };
  } catch (err) {
    if (err instanceof AlchemyPreviewError) throw new HttpError(err.status, err.code, err.userMsg);
    throw err;
  }
}

async function handleMechanismDraftFromAlchemy(body = {}) {
  const source = alchemyMechanismSource(body);
  if (!source.text.trim()) throw new HttpError(400, "MECHANISM_TEXT_REQUIRED", "请输入炼金素材，或先生成有效预览。");
  const drafts = extractMechanismDrafts(source.text, { previewId: body.previewId || "" });
  const library = listMechanismLibrary({ text: `${source.text} ${body.userGoal || ""}`, drafts });
  return {
    status: "ok",
    drafts,
    libraryRecommendations: library.recommendations,
    summary: { inputMechanisms: drafts.length, libraryMatches: library.recommendations.length, warnings: drafts.length ? [] : ["未从输入中识别到明确机制，可从机制库手动补充。"] }
  };
}

async function handleMechanismLibrary(url = null) {
  const query = url?.searchParams.get("query") || "";
  const previewId = url?.searchParams.get("previewId") || "";
  const moduleKey = url?.searchParams.get("moduleKey") || "";
  let text = "";
  if (previewId) text = alchemyMechanismSource({ previewId, moduleKey }).text;
  const result = listMechanismLibrary({ query, text });
  return { status: "ok", ...result };
}

async function handleMechanismCommitDrafts(body = {}) {
  const moduleKey = String(body.moduleKey || "");
  const file = mechanismCachePath(moduleKey);
  if (!file || !existsSync(dirname(dirname(file)))) throw new HttpError(400, "MECHANISM_MODULE_INVALID", "目标世界不存在，请重新选择。");
  if (!Array.isArray(body.drafts)) throw new HttpError(400, "MECHANISM_DRAFTS_INVALID", "机制草稿格式无效。");
  const existing = readJsonSync(file, { version: "mechanism-cache.v1", mechanisms: [] });
  let result;
  try {
    result = commitMechanismDrafts(existing, body.drafts, { moduleKey, worldbookHash: currentWorldbookHash(moduleKey) });
  } catch (err) {
    if (err instanceof MechanismValidationError) throw new HttpError(400, "MECHANISM_SCHEMA_INVALID", err.message);
    throw err;
  }
  await writeJson(file, result.cache);
  return { status: "ok", committed: result.committed, committedNew: result.committedNew, updatedExisting: result.updatedExisting, unchanged: result.unchanged, skipped: result.skipped, cache: scrubMechanismValue(result.cache) };
}

async function handleMechanismWorld(url = null) {
  const moduleKey = String(url?.searchParams.get("moduleKey") || "");
  const file = mechanismCachePath(moduleKey);
  if (!file || !existsSync(dirname(dirname(file)))) throw new HttpError(400, "MECHANISM_MODULE_INVALID", "目标世界不存在，请重新选择。");
  const cache = readJsonSync(file, { version: "mechanism-cache.v1", moduleKey, mechanisms: [] });
  const worldbookHash = currentWorldbookHash(moduleKey);
  const stale = Boolean(cache.worldbookHash && cache.worldbookHash !== worldbookHash);
  return { status: "ok", stale, currentWorldbookHash: worldbookHash, cache: scrubMechanismValue({ ...cache, stale }) };
}

/** 炼金台 → 模组创建：解析内容 → 生成世界书条目 或 角色卡引擎数据 */
async function handleAlchemyDigest(body) {
  const { text, worldName, dataMode = "worldbook", subType = "classic", preset = "epic" } = body || {};
  if (!text) return { status: "error", errorMsg: "内容为空" };
  // 业务级输入长度限制
  const ALCHEMY_DIRECT_LLM_MAX_CHARS = 120000;
  if (String(text).length > ALCHEMY_DIRECT_LLM_MAX_CHARS) {
    return { status: "error", code: "TEXT_TOO_LONG", errorMsg: `导入文本过长（${String(text).length} 字符）。请分块导入，每块不超过 ${ALCHEMY_DIRECT_LLM_MAX_CHARS} 字符。` };
  }
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
      const refineBaseUrl = config.llmBaseUrl.replace(/\/$/, "");
      const refineRes = await fetch(refineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildOpenAICompatibleChatBody({
          baseUrl: refineBaseUrl,
          providerId: config.llmProvider || config.provider || "openai-compatible",
          model: config.llmModel,
          messages,
          temperature: 0.3,
          maxTokens: 4096,
          thinking: config.llmThinking ?? config.thinking ?? "auto"
        })),
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

function resolveInside(rootPath, unsafePath = "") {
  return resolveInsideRoot(rootPath, unsafePath);
}

function safeEntityId(value = "", fallback = "item") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return /^[\w\u4e00-\u9fff-]+$/u.test(raw) ? raw.slice(0, 48) : fallback;
}

function moduleWorldDir(moduleKey = "") {
  return moduleService.moduleWorldDir(moduleKey);
}

function resolveKernelProject(projectId = "") {
  const decoded = decodeURIComponent(String(projectId || ""));
  const moduleKey = decoded.startsWith("world:") ? decoded : `world:${decoded}`;
  const projectRoot = moduleWorldDir(moduleKey);
  if (!projectRoot || !pathWithinRoot(WORLDS_DIR(), projectRoot) || !existsSync(projectRoot)) return null;
  const world = readJsonSync(join(projectRoot, "world.json"), {});
  return { moduleKey, projectRoot, modeId: world.mode || world.worldMode || "world-rpg" };
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

function mechanismCachePath(moduleKey = "") {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir || !pathWithinRoot(dataRoot(), rtDir)) return null;
  return join(rtDir, "mechanisms", "cache.json");
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
}

function currentWorldbookHash(moduleKey = "", worldRootOverride = null) {
  const key = String(moduleKey || "");
  const file = key.startsWith("char:")
    ? join(CHARACTERS_DIR(), safeEntityId(key.replace(/^char:/, ""), ""), "worldbook.json")
    : join(worldRootOverride || moduleWorldDir(key) || "", "shared", "worldbook.json");
  const worldbook = file && existsSync(file) ? readJsonSync(file, { entries: [] }) : { entries: [] };
  return createHash("sha256").update(JSON.stringify(stableJson(worldbook))).digest("hex");
}

function toPublicModuleModel(model) {
  const safe = scrubStateValue(model || {});
  if (safe?.selected) {
    safe.selected.hasLocalPath = Boolean(model?.selected?.path);
    delete safe.selected.path;
  }
  return safe;
}

function statusRoot(moduleKey = "") {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir || !pathWithinRoot(dataRoot(), rtDir)) return null;
  return join(rtDir, "status");
}

function validateTurnId(turnId = "") {
  const value = String(turnId || "");
  return /^turn-[\w.-]{1,80}$/u.test(value) ? value : "";
}

function statusIndexPath(moduleKey = "") {
  const root = statusRoot(moduleKey);
  return root ? join(root, "index.json") : null;
}

function statusFramePath(moduleKey = "", turnId = "") {
  const root = statusRoot(moduleKey);
  const safeTurnId = validateTurnId(turnId);
  return root && safeTurnId ? join(root, "turn-frames", `${safeTurnId}.json`) : null;
}

async function saveTurnStateFrame(moduleKey, frame) {
  const file = statusFramePath(moduleKey, frame?.turnId);
  const indexPath = statusIndexPath(moduleKey);
  if (!file || !indexPath) return null;
  const safeFrame = scrubStateValue(frame);
  await writeJson(file, safeFrame);
  const current = readJsonSync(indexPath, { version: "turn-state-index.v1", turns: [] });
  const item = {
    turnId: safeFrame.turnId,
    round: safeFrame.round,
    userMessageId: safeFrame.userMessageId,
    assistantMessageId: safeFrame.assistantMessageId,
    saveId: safeFrame.saveId,
    createdAt: safeFrame.createdAt,
    summary: safeFrame.changes?.length ? `${safeFrame.changes.length} 项已确认状态变化` : "本轮暂无状态变化",
    changeCount: safeFrame.changes?.length || 0
  };
  const turns = [item, ...(Array.isArray(current.turns) ? current.turns : []).filter(entry => entry.turnId !== item.turnId)].slice(0, 500);
  await writeJson(indexPath, { version: "turn-state-index.v1", moduleKey, updatedAt: new Date().toISOString(), turns });
  return safeFrame;
}

async function loadTurnStateFrame(moduleKey, turnId, saveId = "main") {
  const file = statusFramePath(moduleKey, turnId);
  if (!file || !existsSync(file)) return null;
  const frame = readJsonSync(file, null);
  if (!frame || frame.moduleKey !== moduleKey || frame.saveId !== saveId) return null;
  return scrubStateValue(frame);
}

async function loadLatestTurnStateFrame(moduleKey, saveId = "main") {
  const indexPath = statusIndexPath(moduleKey);
  if (!indexPath) return null;
  const index = readJsonSync(indexPath, { turns: [] });
  const latest = (Array.isArray(index.turns) ? index.turns : []).find(item => item.saveId === saveId);
  return latest ? loadTurnStateFrame(moduleKey, latest.turnId, saveId) : null;
}

async function listTurnStateFrames(moduleKey, saveId = "main", limit = 50) {
  const indexPath = statusIndexPath(moduleKey);
  if (!indexPath) return [];
  const index = readJsonSync(indexPath, { turns: [] });
  return (Array.isArray(index.turns) ? index.turns : [])
    .filter(item => item.saveId === saveId)
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 50)))
    .map(item => scrubStateValue(item));
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

function moduleStatePath(moduleKey = "") {
  return moduleMetaPath(moduleKey);
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

function splitWorldbookKeys(value = "") {
  return String(value || "")
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeWorldbookEntryForSave(entry = {}, { now = new Date().toISOString(), index = 0, source = "manual", group = "默认", titleFallback = "" } = {}) {
  const keys = Array.isArray(entry.keys) ? entry.keys : splitWorldbookKeys(entry.keys || entry.keywords || entry.key || "");
  const id = entry.id || `wb-import-${Date.now()}-${index}`;
  return {
    ...entry,
    id,
    title: entry.title || entry.name || keys[0] || titleFallback || id,
    keys,
    content: String(entry.content || entry.text || entry.description || ""),
    priority: Number(entry.priority ?? 100),
    enabled: entry.enabled !== false,
    mode: entry.mode || "trigger",
    group: String(entry.group || entry.category || group).trim() || group,
    notes: String(entry.notes || "").trim(),
    source: entry.source || source,
    updatedAt: now,
    createdAt: entry.createdAt || now
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
  // V2 Capsule: 纯文本创建路线，不走 ST 卡解析
  if (body?.v2Capsule === true || body?.draft?.schemaVersion === "character-capsule.v2-draft.1") {
    const { createOrPreviewCharacterCapsule } = await import("./src/server/character-capsule-service.js");
    return createOrPreviewCharacterCapsule(body, { charactersRoot: CHARACTERS_DIR() });
  }

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
    source: "sillytavern",
    ignoredUnsupportedFields: parsed.ignoredUnsupportedFields || []
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
    ignoredUnsupportedFields: parsed.ignoredUnsupportedFields || [],
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

const {
  connectionTemplates,
  loadConnectionsRaw,
  saveConnectionsRaw,
  secretValueById,
  publicConnections,
  testConnectionProfile,
  handleConnections
} = createConnectionRuntime({ readJsonSync, CONNECTIONS_PATH, writeJson, loadSecrets, secretsPath, maskSecret, loadPipelineProfiles, errorPayload, llmProbeMessages, strictProbeFailure, LLM_CONNECTION_SENTINEL, mapLlmError, llmHttpError, parseChatCompletionProbe, partialProbeResult, buildOpenAICompatibleChatBody, slugName, saveConfig, saveSecrets, saveLlmSecret });

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
    next = Array.isArray(body.entries) ? body.entries.map((entry, index) => normalizeWorldbookEntryForSave(entry, { now, index, source: "manual" })) : next;
  } else if (action === "upsert") {
    const entry = body.entry || {};
    const id = entry.id || `wb-${Date.now()}`;
    const normalized = normalizeWorldbookEntryForSave({ ...entry, id }, { now, source: "manual" });
    next = [normalized, ...next.filter(e => e.id !== id)];
  } else if (action === "append") {
    const additions = (Array.isArray(body.entries) ? body.entries : [])
      .map((entry, index) => normalizeWorldbookEntryForSave(entry, { now, index, source: "bulk-import", group: "导入" }))
      .filter(e => e.content || e.keys.length);
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
  const { normalizeEngineState, DEFAULT_ENGINE_STATE } = await import("./src/core/engine/modules.js");
  const { prepareWorldbookInjection } = await import("./src/core/runtime/worldbook-runtime.js");
  const engineState = normalizeEngineState(body.engineState || DEFAULT_ENGINE_STATE);
  const runtime = prepareWorldbookInjection({
    worldbook,
    input: body.input || "",
    engineState,
    messages: body.messages || [],
    limit: body.limit || null,
    mode: body.mode || "both"
  });
  const hits = runtime.injectedWorldbook.map((entry, index) => ({
    id: entry.id || entry.keys?.[0] || `hit-${index + 1}`,
    title: entry.title || entry.name || entry.keys?.[0] || "未命名条目",
    keys: entry.keys || [],
    priority: entry.priority ?? 100,
    matchType: entry.matchType || "unknown",
    reason: entry.reason || "matched",
    budgetCost: entry.budgetCost || 0,
    content: entry.content || ""
  }));
  return { status: "ok", input: body.input || "", hits, diagnostics: runtime.diagnostics };
}

async function handleWorldbookImport(body = {}) {
  const input = body.lorebook || body.json || body.data || body.content || null;
  let json = input;
  try {
    if (typeof json === "string") json = JSON.parse(json);
  } catch (err) {
    return { status: "error", code: "WORLDBOOK_IMPORT_PARSE_FAILED", errorMsg: "世界书内容不是有效 JSON。", detail: err.message };
  }
  const { parseLorebook, lorebookToItems } = await import("./src/core/data/alchemy/parsers/nai-lorebook.js");
  const parsed = parseLorebook(json);
  if (!parsed) return { status: "error", code: "WORLDBOOK_IMPORT_UNSUPPORTED", errorMsg: "未识别到支持的 ST/NAI/World Tree 世界书格式。" };
  const items = lorebookToItems(parsed);
  const entries = items.map((item, index) => normalizeWorldbookEntryForSave({
    title: item.data?.title || item.entity,
    keys: item.data?.keywords || [],
    content: item.data?.content || "",
    group: item.data?.category || "导入",
    mode: item.data?.mode === "常驻" ? "persistent" : "trigger",
    source: item.sourceFormat || parsed.format
  }, { index, source: item.sourceFormat || parsed.format, group: item.data?.category || "导入" })).filter(entry => entry.content || entry.keys.length);
  if (!body.confirm || !body.moduleKey) return { status: "ok", preview: true, format: parsed.format, entries, ignoredUnsupportedFields: [] };
  const ctx = readWorldShared(body.moduleKey || "");
  if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "请先选择要导入世界书的世界。" };
  ensureDir(ctx.sharedDir);
  const path = join(ctx.sharedDir, "worldbook.json");
  const current = readJsonSync(path, { entries: [] });
  const merged = { ...current, entries: [...entries, ...(Array.isArray(current.entries) ? current.entries : [])] };
  await writeJson(path, merged);
  moduleService.clearModuleCache?.(body.moduleKey || "");
  return { status: "ok", format: parsed.format, imported: entries.length, entries };
}

async function readChatRecords(moduleKey = "") {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir) return [];
  const chatPath = join(rtDir, "chat.jsonl");
  if (!existsSync(chatPath)) return [];
  try {
    const text = (await readFile(chatPath, "utf-8")).trim();
    return text ? text.split("\n").map((line, index) => {
      try {
        const record = JSON.parse(line);
        return { id: record.id || `line-${index + 1}`, ...record };
      } catch {
        return null;
      }
    }).filter(Boolean) : [];
  } catch {
    return [];
  }
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
  const records = await readChatRecords(moduleKey);
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
  if (source.moduleKey) {
    const rtDir = moduleRuntimeDir(source.moduleKey);
    if (rtDir && pathWithinRoot(dataRoot(), rtDir)) {
      for (const item of additions) {
        await appendJsonl(join(rtDir, "pending.jsonl"), reviewRecordFromAlchemy(item, source.moduleKey));
      }
    }
  }
  return additions;
}

function reviewRecordFromAlchemy(item = {}, moduleKey = "") {
  const data = item.data || item.structured || {};
  return {
    id: item.id || `review-${Date.now()}`,
    status: item.status === "manual" ? "manual" : "pending",
    createdAt: item.createdAt || new Date().toISOString(),
    source: item.source || "alchemy",
    moduleId: moduleKey,
    targetType: item.typeId || item.type || "worldbook",
    operation: "upsert",
    confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0.5,
    entity: item.entity || item.name || data.name || data.title || "未命名",
    before: null,
    after: data,
    sourceSnippet: item.sourceSnippet || "",
    reason: item.reason || "",
    legacyReviewId: item.id || ""
  };
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

function reviewFactPath(moduleKey = "", file = "pending.jsonl") {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir || !pathWithinRoot(dataRoot(), rtDir)) return null;
  const p = join(rtDir, file);
  return pathWithinRoot(rtDir, p) ? p : null;
}

async function readReviewFactFile(moduleKey = "", file = "pending.jsonl") {
  const p = reviewFactPath(moduleKey, file);
  if (!p || !existsSync(p)) return [];
  try {
    const text = await readFile(p, "utf-8");
    return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        const item = JSON.parse(line);
        return { id: item.id || `line-${index + 1}`, ...item };
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeReviewFactFile(moduleKey = "", file = "pending.jsonl", items = []) {
  const p = reviewFactPath(moduleKey, file);
  if (!p) return false;
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, items.map(item => JSON.stringify(item)).join("\n") + (items.length ? "\n" : ""), "utf-8");
  return true;
}

async function appendReviewLog(moduleKey = "", action = "", item = {}, extra = {}) {
  const p = reviewFactPath(moduleKey, "review-log.jsonl");
  if (!p) return;
  await appendJsonl(p, { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: new Date().toISOString(), action, itemId: item.id || "", item, ...extra });
}

async function snapshotReviewTarget(moduleKey = "", item = {}) {
  const rtDir = moduleRuntimeDir(moduleKey);
  const worldDir = moduleWorldDir(moduleKey);
  if (!rtDir || !worldDir || !pathWithinRoot(dataRoot(), rtDir)) return null;
  const snapshotDir = join(rtDir, "snapshots");
  const file = join(snapshotDir, `review-${slugName(item.id || "item", "item")}-${Date.now()}.json`);
  const sharedDir = join(worldDir, "shared");
  await writeJson(file, {
    createdAt: new Date().toISOString(),
    item,
    worldbook: readJsonSync(join(sharedDir, "worldbook.json"), null),
    characters: readJsonSync(join(sharedDir, "characters.json"), null),
    overlay: item.file ? readJsonSync(join(rtDir, "overlay", item.file), null) : null
  });
  return file;
}

function normalizeReviewWorldbookEntry(item = {}) {
  const after = item.after || item.data || item.payload || {};
  const keys = Array.isArray(after.keys) ? after.keys : splitWorldbookKeys(after.keywords || after.keys || item.entity || after.name || after.title || "");
  return normalizeWorldbookEntryForSave({
    id: after.id || `review-${slugName(item.entity || after.name || after.title || item.id, "entry")}-${Date.now()}`,
    title: after.title || after.name || item.entity || "审核条目",
    keys,
    content: after.content || after.description || objToText(after, Object.keys(after)),
    enabled: after.enabled !== false,
    priority: after.priority ?? 100,
    source: item.source || "review"
  }, { source: "review", titleFallback: item.entity || item.id });
}

async function adoptReviewItem(moduleKey = "", item = {}, editedAfter = null) {
  const ctx = readWorldShared(moduleKey);
  if (!ctx) return { applied: false, reason: "未选择目标世界" };
  const candidate = editedAfter ? { ...item, after: editedAfter } : item;
  const snapshotPath = await snapshotReviewTarget(moduleKey, candidate);
  if (candidate.overlay?.file || candidate.file) {
    const rtDir = moduleRuntimeDir(moduleKey);
    await applyOverlayOperation(rtDir, { ...(candidate.overlay || candidate), policy: "auto" });
    return { applied: true, target: `runtime/overlay/${candidate.overlay?.file || candidate.file}`, snapshotPath };
  }
  if (candidate.targetType === "character" || candidate.targetType === "characters") {
    const p = join(ctx.sharedDir, "characters.json");
    const current = readJsonSync(p, []);
    const after = candidate.after || {};
    const id = slugName(after.id || candidate.entity || after.name || candidate.id, "character");
    const next = [{ id, name: after.name || candidate.entity || id, ...after, confirmedAt: new Date().toISOString() }, ...current.filter(c => c.id !== id && c.name !== (after.name || candidate.entity))];
    await writeJson(p, next);
    return { applied: true, target: "shared/characters.json", snapshotPath };
  }
  const p = join(ctx.sharedDir, "worldbook.json");
  const wb = readJsonSync(p, { entries: [] });
  const entry = normalizeReviewWorldbookEntry(candidate);
  await writeJson(p, { ...wb, entries: [entry, ...(wb.entries || []).filter(e => e.id !== entry.id)] });
  return { applied: true, target: "shared/worldbook.json", snapshotPath };
}

async function handleReviewFacts(body = {}, method = "GET", url = null) {
  const moduleKey = method === "GET" ? (url?.searchParams.get("moduleKey") || "") : (body.moduleKey || "");
  if (!moduleKey) return { status: "error", errorMsg: "缺少模组标识。请先选择一个世界。" };
  if (!moduleRuntimeDir(moduleKey)) return { status: "error", errorMsg: "模组标识无效。" };
  const pending = await readReviewFactFile(moduleKey, "pending.jsonl");
  const manual = await readReviewFactFile(moduleKey, "manual.jsonl");
  if (method === "GET") {
    return { status: "ok", pending: pending.filter(i => i.status === "pending"), manual: manual.filter(i => i.status === "manual"), items: [...pending, ...manual].filter(i => ["pending", "manual"].includes(i.status)) };
  }
  const action = body.action || "list";
  if (action === "list") return handleReviewFacts(body, "GET", new URL(`http://local/?moduleKey=${encodeURIComponent(moduleKey)}`));
  const id = body.id || body.pendingId;
  if (!id) return { status: "error", errorMsg: "缺少审核项 id。" };
  const sourceFile = pending.find(i => i.id === id) ? "pending.jsonl" : manual.find(i => i.id === id) ? "manual.jsonl" : "";
  if (!sourceFile) return { status: "error", errorMsg: "审核项不存在。" };
  const list = sourceFile === "pending.jsonl" ? pending : manual;
  const idx = list.findIndex(i => i.id === id);
  const item = list[idx];
  if (action === "reject") {
    list[idx] = { ...item, status: "rejected", reviewedAt: new Date().toISOString() };
    await writeReviewFactFile(moduleKey, sourceFile, list);
    await appendReviewLog(moduleKey, "reject", list[idx]);
    return { status: "ok", item: list[idx], pending: sourceFile === "pending.jsonl" ? list.filter(i => i.status === "pending") : pending.filter(i => i.status === "pending"), manual: sourceFile === "manual.jsonl" ? list.filter(i => i.status === "manual") : manual.filter(i => i.status === "manual") };
  }
  if (action === "adopt" || action === "edit-and-adopt") {
    let editedAfter = null;
    if (action === "edit-and-adopt") editedAfter = body.after || body.editedAfter || null;
    const apply = await adoptReviewItem(moduleKey, item, editedAfter);
    list[idx] = { ...item, after: editedAfter || item.after, status: apply.applied ? "adopted" : "approved", apply, reviewedAt: new Date().toISOString() };
    await writeReviewFactFile(moduleKey, sourceFile, list);
    await appendReviewLog(moduleKey, action, list[idx], { apply });
    return { status: "ok", item: list[idx], apply, pending: sourceFile === "pending.jsonl" ? list.filter(i => i.status === "pending") : pending.filter(i => i.status === "pending"), manual: sourceFile === "manual.jsonl" ? list.filter(i => i.status === "manual") : manual.filter(i => i.status === "manual") };
  }
  return { status: "error", errorMsg: `不支持的审核操作：${action}` };
}

async function handleReviewLog(url = null) {
  const moduleKey = url?.searchParams.get("moduleKey") || "";
  if (!moduleKey) return { status: "error", errorMsg: "缺少模组标识。" };
  return { status: "ok", log: await readReviewFactFile(moduleKey, "review-log.jsonl") };
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
    reviewQueue: body.includeReviewQueue === true,
    mechanisms: body.includeMechanisms === true,
    turnStateFrames: body.includeTurnStateFrames === true
  };
  const sharedFiles = {};
  for (const entry of readdirSync(ctx.sharedDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      if (/secret|debug|proposal|session/i.test(entry.name)) continue;
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
    const graphPath = join(ctx.worldDir, "runtime", "engine-graph.json");
    if (existsSync(graphPath)) optionalFiles["runtime/engine-graph.json"] = readJsonSync(graphPath, {});
  }
  if (include.reviewQueue) optionalFiles["userData/alchemy-review.json"] = loadReviewQueue();
  if (include.mechanisms) {
    const cachePath = mechanismCachePath(moduleKey);
    if (cachePath && existsSync(cachePath)) optionalFiles["runtime/mechanisms/cache.json"] = scrubMechanismValue(readJsonSync(cachePath, {}));
  }
  if (include.turnStateFrames) {
    const indexPath = statusIndexPath(moduleKey);
    const statusIndex = indexPath ? readJsonSync(indexPath, { turns: [] }) : { turns: [] };
    optionalFiles["runtime/status/index.json"] = scrubStateValue(statusIndex);
    for (const turn of (statusIndex.turns || []).slice(0, 500)) {
      const framePath = statusFramePath(moduleKey, turn.turnId);
      if (framePath && existsSync(framePath)) optionalFiles[`runtime/status/turn-frames/${turn.turnId}.json`] = scrubStateValue(readJsonSync(framePath, {}));
    }
  }
  const splitWorld = splitWorldForSave(ctx.world, optionalFiles["runtime/state.json"] || {});
  const exportWorld = splitWorld.world;
  if (include.runtimeState && splitWorld.engineGraph && !optionalFiles["runtime/engine-graph.json"]) {
    optionalFiles["runtime/engine-graph.json"] = splitWorld.engineGraph;
  }
  const pack = {
    format: "worldtree-pack",
    schemaVersion: "0.3.0",
    spec: "worldtree-pack",
    version: 1,
    appVersion: PKG_VERSION,
    exportedAt: new Date().toISOString(),
    contents: {
      worldbook: include.worldbook && Boolean(sharedFiles["shared/worldbook.json"]),
      characters: include.characters && Boolean(sharedFiles["shared/characters.json"]),
      runtimeState: include.runtimeState && Boolean(optionalFiles["runtime/state.json"]),
      reviewQueue: include.reviewQueue && Boolean(optionalFiles["userData/alchemy-review.json"]),
      mechanisms: include.mechanisms && Boolean(optionalFiles["runtime/mechanisms/cache.json"]),
      turnStateFrames: include.turnStateFrames && Boolean(optionalFiles["runtime/status/index.json"])
    },
    summary: {
      name: exportWorld.displayName || exportWorld.name,
      worldName: exportWorld.name,
      dataMode: exportWorld.dataMode || "worldbook",
      includes: [...(include.world ? ["world.json"] : ["world.json:minimal"]), ...Object.keys(sharedFiles), ...Object.keys(optionalFiles)],
      excludes: [
        "userData/secrets.json",
        "runtime/chat.jsonl",
        "runtime/memory.jsonl",
        "runtime/debug/",
        "runtime/proposals/",
        "runtime/session/",
        ...(include.runtimeState ? [] : ["runtime/state.json"]),
        ...(include.reviewQueue ? [] : ["unconfirmed alchemy review items"]),
        ...(include.mechanisms ? [] : ["runtime/mechanisms/"]),
        ...(include.turnStateFrames ? [] : ["runtime/status/"])
      ]
    },
    include,
    world: include.world ? exportWorld : { name: exportWorld.name, displayName: exportWorld.displayName, dataMode: exportWorld.dataMode, subType: exportWorld.subType },
    files: {
      ...(include.world ? { "world.json": exportWorld } : {}),
      ...sharedFiles,
      ...optionalFiles
    },
    provenance: body.provenance || "User exported local World Tree data."
  };
  return { status: "ok", filename: `${slugName(ctx.world.name || "world", "world")}.worldtree`, pack };
}

function validateWorldPack(pack) {
  if (!pack || typeof pack !== "object") return { ok: false, errorMsg: "这不是有效的 .worldtree 世界包。" };
  if ((pack.format || pack.spec) !== "worldtree-pack") return { ok: false, errorMsg: "世界包 format 不正确。" };
  if (!pack.files || typeof pack.files !== "object" || Array.isArray(pack.files)) return { ok: false, errorMsg: "世界包缺少 files 对象。" };

  const files = [];
  for (const key of Object.keys(pack.files)) {
    let clean = "";
    try {
      clean = validateImportFileKey(key);
    } catch {
      return { ok: false, errorMsg: `世界包包含不安全文件路径：${key}` };
    }
    const lower = clean.toLowerCase();
    if (lower.includes("secret") || lower.includes("config")) {
      return { ok: false, errorMsg: `世界包不能包含 secrets/config 文件：${key}` };
    }
    files.push(clean);
  }

  const world = pack.world || pack.files["world.json"] || {};
  const schemaVersion = String(pack.schemaVersion || (pack.version ? `legacy-${pack.version}` : "unknown"));
  const contents = {
    worldbook: files.includes("shared/worldbook.json"),
    characters: files.includes("shared/characters.json"),
    runtimeState: files.includes("runtime/state.json"),
    reviewQueue: files.some(f => f.includes("review") || f.includes("pending") || f.includes("manual"))
  };

  return {
    ok: true,
    files,
    schemaVersion,
    world: {
      id: String(world.id || world.name || pack.summary?.worldName || ""),
      displayName: String(world.displayName || pack.summary?.name || world.name || "未命名世界"),
      description: String(world.description || pack.summary?.description || "")
    },
    contents
  };
}

async function handleWorldPackImport(body = {}) {
  const pack = body.pack || body;
  const validation = validateWorldPack(pack);
  if (!validation.ok) return { status: "error", error: "WORLD_PACK_INVALID", errorMsg: validation.errorMsg };
  const files = validation.files;
  const conflictName = safeEntityId(pack.world?.name || pack.summary?.worldName || pack.summary?.name || "", "");
  const conflictDir = conflictName ? moduleWorldDir(`world:${conflictName}`) : null;
  const summary = {
    name: validation.world.displayName,
    worldId: validation.world.id,
    description: validation.world.description,
    packageVersion: validation.schemaVersion,
    fileCount: files.length,
    sharedFiles: files.filter(f => f.startsWith("shared/")),
    runtimeFiles: files.filter(f => f.startsWith("runtime/")),
    hasConflict: Boolean(conflictDir) && existsSync(conflictDir),
    willRename: Boolean(conflictDir) && existsSync(conflictDir),
    containsRuntime: validation.contents.runtimeState,
    containsReviewQueue: validation.contents.reviewQueue,
    contents: validation.contents,
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
  const importedRuntimeState = pack.files["runtime/state.json"] && typeof pack.files["runtime/state.json"] === "object"
    ? pack.files["runtime/state.json"]
    : {};
  const importedEngineGraph = buildEngineGraphSidecar(pack.world || pack.files["world.json"] || {}, importedRuntimeState);
  for (const [key, value] of Object.entries(pack.files)) {
    const clean = validateImportFileKey(key);
    if (clean.startsWith("runtime/") || clean.startsWith("userData/")) continue;
    const target = clean === "world.json" ? join(worldDir, "world.json") : resolveInside(worldDir, clean);
    if (!target) continue;
    ensureDir(dirname(target));
    await writeJson(target, clean === "world.json" ? stripRegenerableWorldFields({ ...(value || {}), name: worldName, displayName: body.displayName || value.displayName || summary.name, importedAt: new Date().toISOString() }) : value);
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
  if (importedEngineGraph) await writeJson(join(worldDir, "runtime", "engine-graph.json"), importedEngineGraph);
  if (!existsSync(join(worldDir, "runtime", "chat.jsonl"))) writeFileSync(join(worldDir, "runtime", "chat.jsonl"), "", "utf-8");
  if (!existsSync(join(worldDir, "runtime", "memory.jsonl"))) writeFileSync(join(worldDir, "runtime", "memory.jsonl"), "", "utf-8");
  await writeJson(join(worldDir, "runtime", "state.json"), {
    turnCount: 0,
    activeBranch: "main",
    importedAt: new Date().toISOString(),
    ...(importedEngineGraph?.moduleGraph ? { moduleGraph: importedEngineGraph.moduleGraph } : {}),
    ...(importedEngineGraph?.wrapperGraph ? { wrapperGraph: importedEngineGraph.wrapperGraph } : {}),
    engineState: { dataMode: pack.world?.dataMode || "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } }
  });
  return { status: "ok", module: { id: worldName, name: worldName, displayName: body.displayName || summary.name, type: "world", mode: pack.world?.mode || "", dataMode: pack.world?.dataMode || "worldbook", subType: pack.world?.subType || "classic", turnCount: 0 } };
}

async function handleWtpackExport(body = {}, url = null) {
  const base = await handleWorldPackExport({
    ...body,
    includeRuntimeState: false,
    includeReviewQueue: false,
    includeMechanisms: false,
    includeTurnStateFrames: false
  }, url);
  if (base.status !== "ok") return base;
  const world = base.pack.world || {};
  const pack = createWtpack({
    appVersion: PKG_VERSION,
    manifest: {
      kind: body.kind || "world",
      id: world.name || body.moduleKey || "world",
      title: world.displayName || world.name || "World Tree Pack",
      author: body.author || "Unknown",
      license: body.license || "UNSPECIFIED",
      minEngine: body.minEngine || PKG_VERSION,
      contentRating: body.contentRating || "unrated"
    },
    files: base.pack.files
  });
  return { status: "ok", filename: `${slugName(world.name || "world", "world")}.wtpack`, pack };
}

async function handleWtpackImport(body = {}) {
  const pack = body.pack || body;
  const validation = validateWtpack(pack);
  if (!validation.ok) return { status: "error", error: validation.code, code: validation.code, errorMsg: validation.errorMsg };
  const world = validation.files["world.json"] || {};
  const legacyPack = {
    format: "worldtree-pack",
    schemaVersion: `wtpack-${validation.manifest.specVersion}`,
    spec: "worldtree-pack",
    world: { ...world, name: world.name || validation.manifest.id, displayName: world.displayName || validation.manifest.title },
    summary: { name: validation.manifest.title, worldName: validation.manifest.id },
    files: validation.files,
    provenance: `wtpack:${validation.manifest.id}`
  };
  return handleWorldPackImport({ pack: legacyPack, preview: body.preview, confirm: body.confirm, name: body.name, displayName: body.displayName });
}

async function handlePlugins(body = {}, method = "GET") {
  ensureDir(PLUGINS_DIR());
  const statePath = userDataPath("plugins-state.json");
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

function overlayQueuePath(moduleKey = "", file = OVERLAY_FILES.PENDING) {
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir) return null;
  const queuePath = join(rtDir, "overlay", file);
  return pathWithinRoot(rtDir, queuePath) ? queuePath : null;
}

async function readOverlayQueue(moduleKey = "", file = OVERLAY_FILES.PENDING) {
  const queuePath = overlayQueuePath(moduleKey, file);
  if (!queuePath || !existsSync(queuePath)) return [];
  try {
    const text = await readFile(queuePath, "utf-8");
    return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        const item = JSON.parse(line);
        return { id: item.id || `line-${index + 1}`, ...item };
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeOverlayQueue(moduleKey = "", file = OVERLAY_FILES.PENDING, items = []) {
  const queuePath = overlayQueuePath(moduleKey, file);
  if (!queuePath) return false;
  await mkdir(dirname(queuePath), { recursive: true });
  await writeFile(queuePath, items.map(item => JSON.stringify(item)).join("\n") + (items.length ? "\n" : ""), "utf-8");
  return true;
}

async function handleOverlayPending(body = {}, method = "GET", url = null) {
  const moduleKey = method === "GET" ? (url?.searchParams.get("moduleKey") || "") : (body.moduleKey || "");
  if (!moduleKey) return { status: "error", errorMsg: "缺少模组标识。请先选择一个模组。" };
  const rtDir = moduleRuntimeDir(moduleKey);
  if (!rtDir || !pathWithinRoot(dataRoot(), rtDir)) return { status: "error", errorMsg: "模组标识无效。" };

  const pending = await readOverlayQueue(moduleKey, OVERLAY_FILES.PENDING);
  const manual = await readOverlayQueue(moduleKey, OVERLAY_FILES.MANUAL);
  if (method === "GET") return { status: "ok", pending, manual };

  const action = body.action || "list";
  if (action === "clear") {
    await writeOverlayQueue(moduleKey, OVERLAY_FILES.PENDING, []);
    return { status: "ok", pending: [], manual };
  }

  const id = body.id || body.pendingId;
  if (!id) return { status: "error", errorMsg: "缺少 pending id。" };
  const idx = pending.findIndex(item => item.id === id);
  if (idx < 0) return { status: "error", errorMsg: "没有找到这条 pending overlay。" };
  const [item] = pending.splice(idx, 1);

  if (action === "adopt" || action === "confirm") {
    await applyOverlayOperation(rtDir, { ...item, policy: "auto" });
  } else if (action !== "reject") {
    return { status: "error", errorMsg: `不支持的 pending 操作：${action}` };
  }

  await writeOverlayQueue(moduleKey, OVERLAY_FILES.PENDING, pending);
  return { status: "ok", item, pending, manual };
}

async function saveTurnDebug(moduleKey, debug) {
  const dir = TURN_DEBUG_DIR(moduleKey || "global");
  ensureDir(dir);
  await writeJson(join(dir, "latest.json"), scrubStateValue({ ...debug, updatedAt: new Date().toISOString() }));
}

async function handleTurnDebug(url = null) {
  const moduleKey = url?.searchParams?.get("moduleKey") || "global";
  const file = join(TURN_DEBUG_DIR(moduleKey), "latest.json");
  const data = readJsonSync(file, null);
  return { status: "ok", debug: scrubStateValue(data || { summary: "暂无叙事黑盒数据。发送一轮对话后会生成。", worldbookHits: [], characterState: {}, memorySnapshot: {}, directionPacket: {}, guardian: {} }) };
}

function statusRequestContext(url = null) {
  const moduleKey = url?.searchParams.get("moduleKey") || "";
  const saveId = safeEntityId(url?.searchParams.get("saveId") || "main", "main");
  if (!moduleKey || !moduleRuntimeDir(moduleKey)) throw new HttpError(400, "STATUS_MODULE_INVALID", "请先选择有效的世界或角色。");
  return { moduleKey, saveId };
}

async function handleLatestTurnState(url = null) {
  const { moduleKey, saveId } = statusRequestContext(url);
  return { status: "ok", frame: await loadLatestTurnStateFrame(moduleKey, saveId) };
}

async function handleTurnStateById(url, turnId) {
  const { moduleKey, saveId } = statusRequestContext(url);
  const safeTurnId = validateTurnId(turnId);
  if (!safeTurnId) throw new HttpError(400, "STATUS_TURN_INVALID", "回合标识无效。");
  return { status: "ok", frame: await loadTurnStateFrame(moduleKey, safeTurnId, saveId) };
}

async function handleTurnStateIndex(url = null) {
  const { moduleKey, saveId } = statusRequestContext(url);
  return { status: "ok", turns: await listTurnStateFrames(moduleKey, saveId, url?.searchParams.get("limit") || 50) };
}

/** 加载模组对话历史 */
async function handleModuleHistory(moduleId, limit = 50) {
  const rootRuntime = moduleRuntimeDir(moduleId);
  const projectRoot = String(moduleId || "").startsWith("char:") ? null : moduleWorldDir(moduleId);
  const timeline = projectRoot ? readJsonSync(join(projectRoot, "timeline-tree.json"), null) : null;
  const activeBranchId = safeEntityId(timeline?.activeBranchId || "", "");
  const branchRuntime = activeBranchId ? join(projectRoot, "branches", activeBranchId, "runtime") : null;
  const rtDir = branchRuntime && pathWithinRoot(projectRoot, branchRuntime) && existsSync(branchRuntime) ? branchRuntime : rootRuntime;
  if (!rtDir) return { status: "ok", messages: [], turnCount: 0, engineState: {}, lastScene: "" };
  const chatPath = join(rtDir, "chat.jsonl");
  const state = readJsonSync(join(rtDir, "state.json"), {});
  const messages = await readJsonlTail(chatPath, limit);
  return { status: "ok", messages, turnCount: state.turnCount || 0, engineState: state.engineState || {}, lastScene: state.lastScene || "", activeBranch: activeBranchId || state.activeBranch || "main" };
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
  } catch (err) { console.warn("[dashboardEntities] content registry unavailable (non-fatal):", err?.message || "unknown error"); }

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

const { PUBLIC_STATIC_FILES, serveStatic, serveConsoleShell } = createStaticShell({ checkRateLimit, RATE_MAX_STATIC, jsonError, ROOT, join, existsSync, extname, createReadStream, readFileSync });

const { handleAPI } = createHttpApiRouter({
  checkRateLimit,
  RATE_MAX_API,
  jsonError,
  parseOriginHost,
  isLocalRequest,
  LOCAL_HOSTS,
  handleV2ProductPlayableRoute,
  readBody,
  jsonResponse,
  dataRoot,
  loadConfig,
  getActiveLlmValue,
  moduleWorldDir,
  pathWithinRoot,
  safeEntityId,
  saveConfig,
  getSecretState,
  saveLlmSecret,
  maskSecret,
  testLlmConnection,
  handleLlmChatStream,
  handleLlmChat,
  handleLlmChatRetry,
  handleConnections,
  listModules,
  createModule,
  finalizeDraftModule,
  deleteModule,
  buildModuleModel,
  toPublicModuleModel,
  resolveKernelProject,
  getKernelSummary,
  handleBranchOperation,
  getLatestKernelTelemetry,
  refreshKernelTelemetry,
  previewAutoLight,
  getKernelStopLoss,
  approveKernelProposal,
  rejectKernelProposal,
  reverseKernelProposal,
  ingestProcessingMaterial,
  listProcessingCandidates,
  deliverProcessingById,
  handleWorkflowApiRequest,
  getWorkflowTypesResponse,
  getWorkflowStatus,
  listExamples,
  installExample,
  handleAlchemyImport,
  handleAlchemyPreviewAction,
  handleAlchemyDigest,
  handleAlchemyReview,
  getAlchemyCapabilities,
  alchemyPlannerService,
  alchemyGenerationService,
  alchemyLocalizerService,
  alchemyDeliveryService,
  handleMechanismDraftFromAlchemy,
  handleMechanismLibrary,
  handleMechanismWorld,
  handleMechanismCommitDrafts,
  handleReviewFacts,
  handleReviewLog,
  handleModuleHistory,
  listCharacters,
  handleCharacterImport,
  handleCharacterUpdate,
  join,
  existsSync,
  readJsonSync,
  rmSync,
  CHARACTERS_DIR,
  ensureDir,
  mkdirSync,
  readFileSync,
  writeFileSync,
  handleWorldbook,
  handleWorldbookImport,
  handleWorldbookTest,
  handleChatMessage,
  handleTurnDebug,
  handleLatestTurnState,
  handleTurnStateIndex,
  handleTurnStateById,
  handleWorldPackExport,
  handleWorldPackImport,
  handleWtpackExport,
  handleWtpackImport,
  ENABLE_DEFERRED_PLUGINS,
  DEBUG_MODE,
  handlePlugins,
  handleOverlayPending,
  handleDashboardTelemetry,
  handleDashboardEntities,
  handleDashboardNarrative,
  WORLDS_DIR,
  readdirSync,
  PKG_VERSION,
  userDataPath,
  calcDirectorySizeLimited,
  getLatestVersion: () => latestVersion,
  sanitizeWorldName,
  prepareImportFiles,
  dirname,
  DEBUG_LOG,
  HttpError
});

const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleAPI(req, res);
    return;
  }
  // 静态资源也走本地访问校验（防御纵深：即使误绑 0.0.0.0 也不暴露 UI）
  if (!isLocalRequest(req)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Forbidden: World Tree 只允许本机访问。");
  }
  serveStatic(req, res);
});

ensureDir(getUserDataRoot());
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
