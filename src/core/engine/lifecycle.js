import { injectionPreview, worldbookEntriesFromModel } from "../cards.js";
import { classifyWorldTreeInput, execSlashCommand } from "./commands.js";
import { budgetFor } from "./context-budget.js";
import { runGuardian } from "./guardian.js";
import { normalizeEngineState } from "./modules.js";
import { parseMarkedOutput, sectionsToOverlayPatch } from "./output-parser.js";
import { buildOverlayWriteSet } from "./overlay-store.js";
import { auditNarrative, checkFeasibility } from "../data/rules.js";
import { predictDirections } from "../data/prediction.js";
import { eventChance, proposeRandomEvent } from "../data/random-events.js";
import { summarizeScene, getContextWindow } from "../data/scenes.js";
import { detectRacialTension } from "../data/race.js";
import { isCardModeCommand } from "../data/character-card.js";
import { updateAllProximities, suggestActivationCandidates, analyzeNarrativeGap, proximitySummary, activateEntity } from "../data/proximity-scope.js";
import { directNarrative, parseEmotionSection, generateDirectionPacket } from "./director.js";
import { getDefaultEmotionState } from "./emotion-state.js";
import { createMemorySnapshot, searchMemorySnapshots, formatMemorySection, loadGlobalMemory } from "./global-memory.js";
import { recordSimulationRun, isSimulateActive } from "./simulator.js";
import { calculateWorldTelemetry, telemetryForLLM, directorHints as telemetryDirectorHints } from "./world-telemetry.js";

// ═══════════════════════════════════════════════════════════════
//  prepareTurn — 三种模式差异化预处理
// ═══════════════════════════════════════════════════════════════

export function prepareTurn({ model, input, engineState, worldbookState, cards = [], knowledgeCards = [] }) {
  const state = normalizeEngineState(engineState);
  const dataMode = state.dataMode || "worldbook";
  const intent = classifyWorldTreeInput(input);
  const budget = budgetFor(state.contextBudget);

  // 角色卡模式：跳过世界书匹配、场景检测、退化预警
  if (dataMode === "character_card") {
    const guard = runGuardian({ model, intent });
    const commandResult = execSlashCommand({ input, engineState: state, model });
    return {
      state, intent, budget, guard,
      injectedWorldbook: [],
      commandResult,
      cardContext: cards.slice(0, 5),
      knowledgeCards: knowledgeCards.filter((c) => ["M1", "M8", "M9", "M19"].includes(c.moduleId)),
      sceneTransition: { detected: false },
      degradationWarning: { ok: true, warnings: [] },
      dataMode
    };
  }

  // 预设模式：轻量世界书匹配，简化场景检测
  if (dataMode === "preset") {
    const guard = runGuardian({ model, intent });
    const injectedWorldbook = injectionPreview(worldbookEntriesFromModel(model, worldbookState), input).slice(0, 4);
    const commandResult = execSlashCommand({ input, engineState: state, model });
    const sceneTransition = detectSceneTransition(input, model);
    return {
      state, intent, budget, guard,
      injectedWorldbook,
      commandResult,
      cardContext: cards.slice(0, 8),
      knowledgeCards,
      sceneTransition,
      degradationWarning: { ok: true, warnings: [] },
      dataMode
    };
  }

  // 世界书模式：完整流程
  const guard = runGuardian({ model, intent });
  const injectedWorldbook = injectionPreview(worldbookEntriesFromModel(model, worldbookState), input).slice(0, budget.worldbookEntries);
  const commandResult = execSlashCommand({ input, engineState: state, model });
  const sceneTransition = detectSceneTransition(input, model);
  const degradationWarning = detectDegradation(intent, model);

  // Director 层评估（世界书模式）
  const emotionState = state.emotionState || getDefaultEmotionState();
  const directorResult = directNarrative({
    emotionState,
    input,
    proximityEntities: model.entities || [],
    round: model.turnCount || 0,
    sceneChanged: sceneTransition.detected,
    plotState: {},
    lastEventRound: state.lastEventRound || 0,
    worldType: model.selected?.type || "daily"
  });

  // 更新 engine state 中的情绪状态
  state.emotionState = directorResult.emotion.state;

  // World telemetry: read current module/state, calculate narrative KPI, feed director/writer.
  const telemetryResult = calculateWorldTelemetry({
    model,
    engineState: state,
    directorResult,
    round: model.turnCount || 0
  });
  state.telemetrySnapshot = telemetryResult.snapshot;
  state.telemetryData = telemetryResult.data;
  state.telemetryHints = telemetryDirectorHints(telemetryResult.snapshot);
  state.telemetryPrompt = telemetryForLLM(telemetryResult.snapshot);
  directorResult.telemetry = { snapshot: telemetryResult.snapshot, data: telemetryResult.data, hints: state.telemetryHints };

  // 全局记忆检索（世界书模式）
  const relevantMemories = searchMemorySnapshots({
    text: input,
    emotion: directorResult.emotion.state,
    moduleKey: model.selected?.id || model.selected?.name || null,
    limit: budget.knowledgeMode === "full" ? 5 : 3,
    minScore: 10,
    _currentRound: model.turnCount || 0
  });
  const memorySection = formatMemorySection(relevantMemories);

  // 生成方向包（Dual-stage pipeline 基座）
  const directionResult = generateDirectionPacket({
    emotionState,
    input,
    proximityEntities: model.entities || [],
    round: model.turnCount || 0,
    sceneChanged: sceneTransition.detected,
    plotState: {},
    lastEventRound: state.lastEventRound || 0,
    worldType: model.selected?.type || "daily",
    existingResult: directorResult,
    moduleData: model.moduleData || {},
    worldSubType: state.worldSubType || "classic",
    storytellerId: state.storyteller || "classic",
    telemetrySnapshot: telemetryResult.snapshot,
    telemetryHints: state.telemetryHints
  });

  return {
    state, intent, budget, guard,
    injectedWorldbook, commandResult,
    cardContext: cards.slice(0, 12),
    knowledgeCards,
    sceneTransition,
    degradationWarning,
    dataMode,
    directorResult,
    directionResult,  // 新增：方向包
    telemetry: telemetryResult,
    relevantMemories,
    memorySection
  };
}

// ═══════════════════════════════════════════════════════════════
//  completeTurn — 三种模式差异化后处理
// ═══════════════════════════════════════════════════════════════

export function completeTurn({ rawText, input, model, moduleKey, dataMode = "worldbook", directorResult = null, engineState = {} }) {
  const parsed = parseMarkedOutput(rawText);
  const state = normalizeEngineState(engineState);

  // 角色卡模式：不解析标记段（DM隐退后不应有标记段），纯叙事
  if (dataMode === "character_card") {
    return {
      narrative: rawText,
      parsedSections: {},
      overlayPatch: {
        createdAt: new Date().toISOString(),
        input,
        narrative: rawText,
        memory: [rawText.slice(0, 200)]
      },
      writeSet: [{
        // 🆕 v0.7.4.1 数据归家
        path: `data/engine/runs/${dataMode}/modules/${(moduleKey || "unloaded").replace(/[^\w.-]/g, "-")}/memory-store.json`,
        mode: "append-json-array",
        value: [{ text: rawText.slice(0, 200), at: new Date().toISOString() }]
      }],
      audit: { parseErrors: [], quality: "narrative-only", rules: { pass: true } },
      sceneSummary: null,
      rawText,
      engineState: state
    };
  }

  // 预设模式：精简后处理
  if (dataMode === "preset") {
    const overlayPatch = sectionsToOverlayPatch(parsed, input);
    overlayPatch.sceneSummary = summarizeScene(input, parsed.narrative);
    return {
      narrative: parsed.narrative || rawText,
      parsedSections: parsed.sections,
      overlayPatch,
      writeSet: buildOverlayWriteSet(moduleKey, overlayPatch, dataMode),
      audit: { parseErrors: parsed.errors, quality: { consistency: "ok" }, rules: { pass: true } },
      sceneSummary: overlayPatch.sceneSummary,
      rawText,
      engineState: state
    };
  }

  // 世界书模式：完整后处理
  const overlayPatch = sectionsToOverlayPatch(parsed, input);

  // 注入 Director 评估结果（如在 prepareTurn 中已计算）
  if (directorResult) {
    overlayPatch.directorResult = directorResult;
    overlayPatch.directorTrigger = directorResult.event.trigger;
    overlayPatch.directorPacing = directorResult.pacing;
    overlayPatch.emotionProfile = directorResult.emotion.profile;
    overlayPatch.narrativeAdvice = directorResult.narrativeAdvice;
  }

  if (directorResult?.telemetry) {
    overlayPatch.telemetry = directorResult.telemetry.snapshot || directorResult.telemetry;
    overlayPatch.telemetryHints = directorResult.telemetry.hints || directorResult.telemetry.snapshot?.hints || [];
    state.telemetrySnapshot = overlayPatch.telemetry;
    state.telemetryHints = overlayPatch.telemetryHints;
  }

  overlayPatch.audit = auditNarrative(parsed.narrative, model);
  overlayPatch.ruleCheck = checkFeasibility(input, model.moduleData?.worldState, model.moduleData?.rules);

  if (model.moduleData?.races) {
    const characters = model.moduleData?.characters || [];
    overlayPatch.racialTensions = detectRacialTension(
      model.moduleData.races,
      characters.filter((c) => c.location && (model.moduleData?.scenes?.[0]?.title || "").includes(c.location))
    );
  }

  overlayPatch.prediction = overlayPatch.prediction?.next ? overlayPatch.prediction : predictDirections(model, input);
  const sceneSummary = summarizeScene(input, parsed.narrative);
  overlayPatch.sceneSummary = sceneSummary;

  // ---- 邻近环驱动模块调用 ----
  const coreEntities = (model.entities || []).filter((e) => e.proximity?.level === 0);

  // M17 随机事件：Director 层决策替代纯随机
  if (overlayPatch.directorTrigger) {
    // Director 已经决定了触发——直接使用
    overlayPatch.randomEvent = overlayPatch.directorTrigger.event;
  } else if (coreEntities.length > 0 && overlayPatch.directorPacing?.blockNewEvents !== true) {
    // 备选：Director 没有明确决定时，用旧的简单概率兜底（但经过 Director 冷却检查）
    const directorResult = overlayPatch.directorResult;
    if (directorResult?.event?.trigger?.trigger) {
      overlayPatch.randomEvent = directorResult.event.trigger.event;
    } else {
      overlayPatch.randomEvent = null; // Director 判定不触发
    }
  } else {
    overlayPatch.randomEvent = null; // 无核心实体或节奏阻止新事件
  }

  // 记录事件轮次
  if (overlayPatch.randomEvent) {
    state.lastEventRound = model.turnCount || 0;
  }

  // ---- 解析 LLM 的【情绪】标记段 ----
  const emotionUpdate = parseEmotionSection(parsed.sections);
  if (emotionUpdate) {
    const currentEmotion = state.emotionState || getDefaultEmotionState();
    state.emotionState = { ...currentEmotion, ...emotionUpdate };
    overlayPatch.emotionState = state.emotionState;
  }

  // M15 规则审查：仅严格审查核心环角色的行为
  if (coreEntities.length === 0) {
    overlayPatch.ruleCheck = { pass: true, note: "无核心实体，跳过规则审查" };
  }

  // M2 世界书匹配优化：优先为核心环场景匹配
  overlayPatch.proximityModulation = {
    coreCount: coreEntities.length,
    randomEventsBlocked: coreEntities.length === 0,
    ruleCheckRelaxed: coreEntities.length < 2,
    activeEntityIds: coreEntities.map((e) => e.id)
  };

  // ---- 邻近激活系统 ----
  const protagonist = {
    name: model.moduleData?.characters?.[0]?.name || "主角",
    location: model.moduleData?.scenes?.[0]?.title || "未知"
  };
  // 初始化实体列表（首次运行时）
  if (!model.entities || model.entities.length === 0) {
    model.entities = buildDefaultEntities(model.moduleData);
    // 立即计算初始邻近度
    model.entities = updateAllProximities(model.entities, protagonist);
  }
  // 场景变化时重新计算邻近度
  const sceneChanged = detectSceneTransition(input, model);
  if (sceneChanged.detected) {
    model.entities = updateAllProximities(model.entities, protagonist);
  }
  // 分析剧情缺口，生成候选激活建议(不自动激活)
  const activeEntities = (model.entities || []).filter((e) => e.proximity?.level != null && e.proximity.level <= 1);
  const gaps = analyzeNarrativeGap(
    activeEntities,
    model.moduleData?.recentEvents || [],
    { worldType: model.selected?.type || "daily", mainPlotResolved: overlayPatch.prediction?.confidence === "high" }
  );
  // 从沉睡实体中生成可激活候选
  const activationCandidates = suggestActivationCandidates(model.entities, protagonist, gaps);
  overlayPatch.proximity = {
    summary: proximitySummary(model.entities, protagonist),
    sceneChanged: sceneChanged.detected,
    candidates: activationCandidates,
    gaps: gaps.map((g) => g.reason)
  };

  // ---- 处理 LLM 的激活请求 ----
  if (overlayPatch.activationRequests && overlayPatch.activationRequests.length > 0) {
    for (const entityId of overlayPatch.activationRequests) {
      model.entities = activateEntity(model.entities, entityId);
    }
    // 激活后重新计算邻近摘要
    overlayPatch.proximity.summary = proximitySummary(model.entities, protagonist);
    overlayPatch.proximity.activated = overlayPatch.activationRequests;
  }

  // ---- 创建全局记忆快照（世界书模式·v0.9.0 可解释版） ----
  const affectedEntities = [];
  for (const ent of model.entities || []) {
    if (ent.proximity?.level != null && ent.proximity.level <= 1 && ent.name) {
      affectedEntities.push(ent.name);
    }
  }

  const memorySnapshot = createMemorySnapshot({
    moduleKey: (moduleKey || "unknown").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "-"),
    branch: model.selected?.branch || "main",
    scene: model.moduleData?.scenes?.[0]?.title || "未知",
    round: model.turnCount || 0,
    emotion: state.emotionState || getDefaultEmotionState(),
    summary: summarizeScene ? summarizeScene(input, parsed.narrative || rawText)?.summary || (parsed.narrative || rawText || "").slice(0, 200) : (parsed.narrative || rawText || "").slice(0, 200),
    keywords: [],
    keyEvents: overlayPatch.randomEvent ? [overlayPatch.randomEvent.title] : [],
    characterStatus: {},
    input,
    narrative: parsed.narrative || rawText || "",
    // 🆕 v0.9.0 可解释字段
    why: {
      trigger: "",   // 留空，由 global-memory 的 inferTrigger 自动推断
      significance: "", // 留空，由 buildSignificance 自动生成
      causalLink: model._relevantMemories?.[0]?.id || null  // 链接到最近的相关记忆
    },
    provenance: {
      source: directorResult ? "director" : "writer",
      inputDigest: (input || "").slice(0, 50),
      outputDigest: (parsed.narrative || rawText || "").slice(0, 50),
      confidence: overlayPatch.audit?.consistent !== false ? "confirmed" : "likely",
      affectedEntities: affectedEntities.slice(0, 5),
      turnContext: {
        pacing: overlayPatch.directorPacing?.type || overlayPatch.directorPacing || "",
        eventIntensity: overlayPatch.randomEvent?.intensity || "none",
        sceneChanged: sceneChanged.detected || false
      }
    }
  });
  overlayPatch.memorySnapshot = memorySnapshot;

  // ---- 模拟记录（仅调试时，需先 /模拟 on） ----
  if (isSimulateActive() && dataMode === "worldbook") {
    const dr = overlayPatch.directorResult;
    recordSimulationRun({
      round: model.turnCount || 0,
      scene: model.moduleData?.scenes?.[0]?.title || "",
      input,
      emotionBefore: state.emotionState || getDefaultEmotionState(),
      emotionAfter: dr?.emotion?.state || state.emotionState || getDefaultEmotionState(),
      emotionProfile: dr?.emotion?.profile || null,
      memories: model._relevantMemories || [],
      pacing: dr?.pacing || null,
      eventAssessment: dr?.event?.assessment || null,
      triggerResult: dr?.event?.trigger || null,
      cacheState: dr?.cache || null,
      promptTokens: 0,
      llmResponse: parsed.narrative || rawText || "",
      overlayPaths: (overlayPatch.writeSet || []).map((w) => w.path || "")
    });
  }

  return {
    narrative: parsed.narrative || rawText,
    parsedSections: parsed.sections,
    overlayPatch, sceneSummary,
    writeSet: buildOverlayWriteSet(moduleKey, overlayPatch, dataMode),
    audit: {
      parseErrors: parsed.errors,
      quality: overlayPatch.audit,
      rules: overlayPatch.ruleCheck,
      racialTensions: overlayPatch.racialTensions
    },
    rawText,
    engineState: state
  };
}

// ═══════════════════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════════════════

function detectSceneTransition(input = "", model = {}) {
  const text = String(input || "");
  const signals = [
    { pattern: /第二天|次日|第二天早上|过了一夜/, type: "time-advance" },
    { pattern: /放学后|下课后|放学/, type: "time-advance" },
    { pattern: /来到|到达|前往|进入|回到|返回/, type: "location-change" },
    { pattern: /晚上|傍晚|清晨|午后|午夜|黄昏|黎明/, type: "time-shift" },
    { pattern: /离开|出发|启程|上路/, type: "departure" }
  ];

  for (const signal of signals) {
    if (signal.pattern.test(text)) {
      const currentScene = model.moduleData?.scenes?.[0];
      return {
        detected: true,
        type: signal.type,
        trigger: text.match(signal.pattern)?.[0] || "",
        previousScene: currentScene?.title || "",
        actions: [
          "1. 保存当前场景快照", "2. 新场景重新扫描触发词",
          "3. 时间流逝联动世界状态变更", "4. 新地点检查组织势力范围",
          "5. 追踪角色体力/情绪/道具到新场景", "6. 环境重新描写",
          "7. 生成场景摘要追加到场景链", "8. 场景走向预测更新"
        ]
      };
    }
  }
  return { detected: false };
}

function detectDegradation(intent = {}, model = {}) {
  const warnings = [];
  if (intent.kind === "narrative" && (model.consecutiveNarrative || 0) > 8) {
    warnings.push({
      signal: "silent-completion",
      level: "warning",
      detail: "已连续 8+ 轮纯叙事无指令交互。建议 /存档 保存进度或使用指令引导方向。"
    });
  }
  if (intent.kind === "narrative") {
    const text = String(intent.text || "");
    if (text.length > 0 && text.length < 6) {
      warnings.push({
        signal: "vague-input",
        level: "info",
        detail: "输入较简短。如需详细引导，可提供更多上下文或使用 /场景 /角色 等指令。"
      });
    }
  }
  return { ok: warnings.length === 0, warnings };
}

// ---- 从模块数据构建默认实体列表 ----
function buildDefaultEntities(moduleData = {}) {
  const entities = [];
  const scene = moduleData?.scenes?.[0]?.title || "未知";

  // 角色 → 实体
  for (const char of (moduleData?.characters || [])) {
    const location = char.location && scene.includes(char.location) ? "sameScene" :
                     char.location ? "sameArea" : "sameWorld";
    entities.push({
      id: char.id || char.name, type: "character", name: char.name,
      location, time: "present",
      relationship: char.role === "protagonist" || char.role === "主角" ? "intimate" :
                    char.role === "ally" || char.role === "朋友" ? "close" : "acquainted",
      description: char.role || "", tags: char.tags || [],
      proximity: null, lastActive: null, activeCount: 0, wakeTriggers: []
    });
  }

  // 组织 → 实体
  for (const org of (moduleData?.organizations || [])) {
    entities.push({
      id: org.id || org.name, type: "organization", name: org.name,
      location: "sameRegion", time: "present", relationship: "indirect",
      description: org.description || "", tags: org.tags || [],
      proximity: null, lastActive: null, activeCount: 0, wakeTriggers: []
    });
  }

  return entities;
}


