import { startupPacket } from "../core/commands.js";
import { moduleTitle } from "../core/normalizers.js";
import { completeTurn, DIRECTOR_MODES, moduleContext, renderKnowledgeCards, scrubPromptForPrivacy } from "../core/world-engine.js";
import { characterCardMode } from "../core/data/character-card.js";
import { cardModeNarrativeHint } from "../core/data/character-card.js";
import { styleInstruction } from "../core/data/templates.js";
import { buildDirectorPacket, buildWriterPacket, buildEnginePacket, buildGuardianPacket } from "../core/world-engine.js";
import { formatDirectionPacket } from "../core/engine/direction-packet.js";
import { generateDirectionPacket } from "../core/engine/director.js";
import { validateNarrativeAgainstDirection, validateWithAutoCorrect } from "../core/engine/guardian.js";
import { extractVisibleNarrative } from "../core/engine/output-parser.js";
import { createHash } from "node:crypto";

function endpoint(config) {
  const base = (config.llmBaseUrl || "").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

// 🆕 v0.9.5 按角色解析模型
const ROLE_MODEL_KEYS = { director: "llmModelDirector", writer: "llmModelWriter", guardian: "llmModelGuardian" };
const ROLE_URL_KEYS  = { director: "llmBaseUrlDirector", writer: "llmBaseUrlWriter", guardian: "llmBaseUrlGuardian" };

/** 解析某角色实际使用的模型名 */
function resolveModelForRole(role, config = {}) {
  const key = ROLE_MODEL_KEYS[role];
  return config[key] || config.llmModel || "";
}

/** 解析某角色实际使用的 API 端点 */
function resolveEndpointForRole(role, config = {}) {
  const key = ROLE_URL_KEYS[role];
  const base = (config[key] || config.llmBaseUrl || "").replace(/\/$/, "");
  return base ? `${base}/chat/completions` : "";
}

export function canUseDirectLlm(config, secretAvailable = false) {
  // 至少有一个模型可用（默认或按角色）
  const hasDefault = Boolean(config.llmBaseUrl && config.llmModel);
  const hasAnyRole = ["director", "writer", "guardian"].some(
    (r) => resolveEndpointForRole(r, config) && resolveModelForRole(r, config)
  );
  return Boolean((hasDefault || hasAnyRole) && secretAvailable);
}

// ═══════════════════════════════════════════════════════════════
//  API Key 安全：检测同一 key 跨不同 hostname 使用
// ═══════════════════════════════════════════════════════════════

const keyHostMap = new Map(); // apiKey_hash → Set<hostname>

export function checkKeyHostnameReuse(apiKey, baseUrl) {
  if (!apiKey || !baseUrl) return null;
  const host = (() => { try { return new URL(baseUrl).hostname; } catch { return null; } })();
  if (!host) return null;
  const keyFingerprint = createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
  let hosts = keyHostMap.get(keyFingerprint);
  if (!hosts) {
    hosts = new Set();
    keyHostMap.set(keyFingerprint, hosts);
  }
  hosts.add(host);
  if (hosts.size > 1) {
    return { risk: "high", reason: `同一 API Key 尾号 ${keyFingerprint} 被用于多个不同 hostname: ${[...hosts].join(", ")}` };
  }
  return null;
}

export function resetKeyHostnameReuseForTests() {
  keyHostMap.clear();
}

const DIRECTOR_SYSTEM_PROMPT = `你是 World Tree Desktop 的 Director DM（叙事导演）。

你的职责：
- 分析玩家输入、情绪状态、剧情节奏
- 决定叙事方向：pacing / pressure / eventIntensity / sceneGoal
- 指定内容边界：mustInclude / mustNotInclude
- 设定写作约束：length / choices

限制：
- 你只输出 JSON 格式的 Narrative Direction Packet
- 你不写故事正文
- 你不编造世界事实
- 你不代替 Story Writer 创作

目前使用 AI 辅助的实时叙事引擎，你必须遵守方向包协议。`;

const WRITER_SYSTEM_PROMPT = `你是 World Tree Desktop 的 Story Writer（故事叙述者）。

你的职责：
- 在 Direction Packet 的边界内写出沉浸、准确、完整的故事
- 完成 mustInclude 中的所有内容
- 绝不使用 mustNotInclude 中的内容
- 保持世界事实、角色设定、场景状态一致
- 回应玩家刚刚的行动
- 结尾留下自然可继续的行动点

输出格式：
1. 【叙事】    ← 用户可见的故事正文（必须）
2. 【状态建议】 ← 状态变更（可选）
3. 【情绪反馈】 ← player: engagement=x, tension=x, fatigue=x, curiosity=x（可选）`;

const GUARDIAN_SYSTEM_PROMPT = `你是 World Tree Desktop 的 Guardian Auditor（叙事审计员）。

你的职责：
- 校验 Story Writer 输出是否符合 Direction Packet
- 检查 mustInclude 是否全部出现
- 检查 mustNotInclude 是否泄露
- 检查是否回应玩家输入
- 检查是否违反角色设定或世界规则
- 检查是否保留玩家行动空间

限制：
- 你不润色文本
- 你不创作内容
- 你只输出 JSON 格式的审计报告`;

// ═══════════════════════════════════════════════════════════════
//  统一 LLM 调用（按 role 分发）
// ═══════════════════════════════════════════════════════════════

const ROLE_PROMPTS = {
  director: DIRECTOR_SYSTEM_PROMPT,
  writer: WRITER_SYSTEM_PROMPT,
  guardian: GUARDIAN_SYSTEM_PROMPT
};

/**
 * 🆕 v0.9.5 按 role 调用 LLM（多模型分工版）
 * @param {string} role - "director" | "writer" | "guardian"
 * @param {string} packet - 构建好的 role-specific 输入包
 * @param {Object} config - { llmBaseUrl, llmModel, llmModelDirector, ... }
 * @param {string} apiKey
 * @param {Object} [options]
 * @param {Array} [options.messages] - 历史消息（writer 模式需要）
 * @returns {Promise<Object>} { role, rawResponse, parsedContent, modelUsed, endpointUsed }
 */
export async function callLLMByRole(role, packet, config, apiKey, options = {}) {
  if (!canUseDirectLlm(config, Boolean(apiKey))) {
    throw new Error("请先配置 LLM Base URL、Model 和 API Key");
  }

  const basePrompt = ROLE_PROMPTS[role] || WRITER_SYSTEM_PROMPT;
  // 🆕 Prompt Orchestration: prepend mode+task governance blocks
  const orchestrationPrefix = options.orchestrationPrefix || "";
  const systemPrompt = orchestrationPrefix ? `${orchestrationPrefix}\n\n---\n\n${basePrompt}` : basePrompt;
  const { messages: historyMessages = [], temperature: optTemp, max_tokens: optMaxTokens } = options;
  const temperature = optTemp ?? (role === "director" ? 0.3 : role === "guardian" ? 0.2 : 0.85);
  const maxTokens   = optMaxTokens ?? (role === "director" ? 1024 : role === "guardian" ? 1024 : 4096);
  const timeoutMs   = Number(options.timeoutMs || config.llmTimeoutMs || 60000);

  const messages = [
    { role: "system", content: systemPrompt },
    ...(role === "writer" ? (historyMessages || []).filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system").slice(-20) : []),
    { role: "user", content: packet }
  ];

  // 隐私防线：擦洗 prompt 中的本机绝对路径后再发送 LLM
  const safePacket = scrubPromptForPrivacy(packet);
  messages[messages.length - 1].content = safePacket;

  // 🆕 v0.9.5 角色专属模型 → 默认模型 → 报错
  const modelCandidates = buildModelCandidates(role, config);
  const urlCandidates  = buildUrlCandidates(role, config);

  let lastError = null;
  const attempts = [];

  // 笛卡尔积遍历：endpoint × model，按优先级排序
  for (const targetUrl of urlCandidates) {
    const keyWarning = checkKeyHostnameReuse(apiKey, targetUrl);
    if (keyWarning) console.warn(`[LLM] ${keyWarning.reason}`);
    for (const modelName of modelCandidates) {
      if (!modelName || !targetUrl) continue;

      attempts.push({ role, targetUrl, modelName });

      const body = { model: modelName, messages, temperature, max_tokens: maxTokens };

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs)
        });

      const text = await response.text();

      if (!response.ok) {
        // 404/模型不存在 → 尝试下一个候选
        if (response.status === 404 || response.status === 400) {
          console.warn(`[LLM] ${role} 模型 "${modelName}" 不可用 (${response.status})，尝试候补...`);
          lastError = new Error(`模型不可用: ${modelName} (${response.status})`);
          continue;
        }
        throw new Error(text || `LLM HTTP ${response.status}`);
      }

      const data = JSON.parse(text);
      const rawResponse = data?.choices?.[0]?.message?.content || JSON.stringify(data);

      return {
        role,
        rawResponse,
        parsedContent: rawResponse,
        modelUsed: modelName,
        endpointUsed: targetUrl,
        modelPath: "cartesian"
      };
    } catch (err) {
      // 超时错误 → 尝试下一个
      if (err.name === "AbortError" || err.name === "TimeoutError") {
        console.warn(`[LLM] ${role} 端点 "${targetUrl}" 超时 (${timeoutMs}ms)，尝试候补...`);
        lastError = new Error(`LLM_TIMEOUT: ${role} 请求超时 (${timeoutMs}ms)`);
        lastError.code = "LLM_TIMEOUT";
        continue;
      }
      // 网络错误 → 尝试下一个
      if (err.name === "TypeError" || err.message?.includes("fetch")) {
        console.warn(`[LLM] ${role} 端点 "${targetUrl}" 连接失败，尝试候补...`);
        lastError = err;
        continue;
      }
      throw err;
    }
    }
  }

  throw lastError || new Error(`LLM 调用失败：所有候选均不可用 (role=${role}, attempts=${attempts.length})`);
}

/** 🆕 v0.9.5 构建模型候选列表：[角色专属, 默认, 兜底] */
function buildModelCandidates(role, config) {
  const candidates = [];
  const roleModel = resolveModelForRole(role, config);
  const defaultModel = config.llmModel || "";

  if (roleModel && roleModel !== defaultModel) candidates.push(roleModel);
  if (defaultModel) candidates.push(defaultModel);
  // 如果两者相同，只 push 一次
  if (candidates.length === 0 && defaultModel) candidates.push(defaultModel);

  return [...new Set(candidates)];
}

/** 🆕 v0.9.5 构建端点候选列表：[角色专属, 默认] */
function buildUrlCandidates(role, config) {
  const candidates = [];
  const roleUrl = resolveEndpointForRole(role, config);
  const defaultUrl = endpoint(config);

  if (roleUrl && roleUrl !== defaultUrl) candidates.push(roleUrl);
  if (defaultUrl) candidates.push(defaultUrl);

  return [...new Set(candidates)];
}

// ═══════════════════════════════════════════════════════════════
//  双段式主流程（Director → Writer → Guardian）
// ═══════════════════════════════════════════════════════════════

/**
 * 执行一轮完整叙事（Director → Writer → Guardian 双段式）
 * @param {Object} opts
 * @param {Object} opts.model
 * @param {Object} opts.config - { llmBaseUrl, llmModel }
 * @param {string} opts.apiKey
 * @param {Array} opts.messages - 历史消息
 * @param {string} opts.input - 玩家输入
 * @param {Object} opts.engineState - 引擎状态
 * @param {Array} opts.injectedWorldbook - 命中世界书条目
 * @param {Array} opts.knowledgeSnippets - 全文检索片段
 * @param {Array} opts.knowledgeCards - 模块知识卡
 * @param {Array} opts.cardContext - 卡片上下文
 * @param {string} opts.moduleKey - 模组标识
 * @param {string} opts.dataMode - worldbook / character_card / preset
 * @param {Object} [opts.turnPrep] - prepareTurn 结果
 * @param {boolean} [opts.skipDirector] - 是否跳过 Director LLM 调用（用 JS 方向包）
 * @param {boolean} [opts.skipGuardian] - 是否跳过 Guardian 校验
 * @param {boolean} [opts.useLlmAnalysis] - 轻量 LLM 分析（混合模式）
 * @param {string} [opts.directorMode] - "js" | "hybrid" | "llm"，覆盖 skipDirector/useLlmAnalysis
 * @returns {Promise<Object>}
 */
export async function sendDualStageTurn(opts = {}) {
  const {
    model, config, apiKey, messages = [], input = "",
    engineState, injectedWorldbook = [],
    knowledgeSnippets = [], knowledgeCards = [], cardContext = [],
    moduleKey = "unloaded", dataMode = "worldbook",
      turnPrep = null, directionPacket = null,
      writerPacket = null,  // 🆕 外部传入的 writer 包（由 buildEnginePacket 构建，按 dataMode 分发）
      kernelContext = null,
    skipDirector = true,  // 默认用 JS 方向包
    skipGuardian = true,  // 默认跳过 Guardian
    useLlmAnalysis = false, // 🆕 轻量 LLM 分析（混合模式）
    worldSubType = "classic",  // 🆕 classic | tabletop | rpg | sim | murder-mystery
    storytellerId = "classic"  // 🆕 叙事者风格
  } = opts;

  // 🆕 Prompt Orchestration Layer: build governance prefix for this turn
  let orchestrationPrefix = "";
  try {
    const resolvedModeId = engineState?.mode || (dataMode === "character_card" ? "character" : "world-rpg");
    const { buildInternalTaskPrompt } = await import("../core/prompts/prompt-builder.js");
    const orchPacket = buildInternalTaskPrompt({ modeId: resolvedModeId, taskId: "writer" });
    if (orchPacket.ok && orchPacket.promptText) {
      orchestrationPrefix = orchPacket.promptText;
    }
  } catch { /* non-critical */ }

  // 🆕 directorMode 覆盖 skipDirector/useLlmAnalysis
  let effectiveSkipDirector = skipDirector;
  let effectiveUseLlmAnalysis = useLlmAnalysis;
  if (opts.directorMode && DIRECTOR_MODES[opts.directorMode]) {
    const mode = DIRECTOR_MODES[opts.directorMode];
    effectiveSkipDirector = mode.skipDirector;
    effectiveUseLlmAnalysis = mode.useLlmAnalysis;
  }

  // === Step 1: LLM 分析输入（可选·混合模式） ===
  // 轻量调用分析玩家输入，输出分析数据供 JS generateDirectionPacket 使用
  let llmAnalysis = null;
  if (effectiveUseLlmAnalysis && input) {
    const analyzerInput = [
      `【分析指令】`,
      `分析以下玩家输入，输出 JSON。不要写故事，不要做决策，只做理解和分析。`,
      ``,
      `【玩家输入】${input}`,
      ``,
      `【当前情绪】`,
      turnPrep?.directorResult?.emotion?.formatted || "",
      ``,
      `【输出格式】`,
      `{`,
      `  "intent": "narrative"|"question"|"action"|"inquiry"|"acknowledgment",`,
      `  "emotionalSubtext": "玩家表面说了什么，实际在表达什么",`,
      `  "engagementDelta": 0, "tensionDelta": 0, "fatigueDelta": 0, "curiosityDelta": 0,`,
      `  "pacingSuggestion": "hook"|"hold"|"escalate"|"reveal_partial"|"resolve"|"relief"|"simplify",`,
      `  "pressureSuggestion": "none"|"low"|"medium"|"high",`,
      `  "eventIntensitySuggestion": "none"|"light"|"moderate"|"major",`,
      `  "sceneGoal": "本轮叙事的目标",`,
      `  "suggestedMustInclude": ["必须出现的内容"],`,
      `  "suggestedMustNotInclude": ["绝不能出现的内容"],`,
      `  "emotionalTarget": { "increase": [], "decrease": [] }`,
      `}`,
      ``,
      `注意：emotionalSubtext 是最关键字段——用一句话说出玩家输入背后的真实意图和情绪弦外音。`
    ].filter(Boolean).join("\n");

    try {
      const analysisResult = await callLLMByRole("director", analyzerInput, config, apiKey, { temperature: 0.3, max_tokens: 512, orchestrationPrefix });
      const parsed = JSON.parse(analysisResult.rawResponse);
      // 只采纳合法字段，其余用 JS 兜底
      llmAnalysis = {
        intent: typeof parsed.intent === "string" ? parsed.intent : null,
        emotionalSubtext: typeof parsed.emotionalSubtext === "string" ? parsed.emotionalSubtext : null,
        engagementDelta: typeof parsed.engagementDelta === "number" ? parsed.engagementDelta : null,
        tensionDelta: typeof parsed.tensionDelta === "number" ? parsed.tensionDelta : null,
        fatigueDelta: typeof parsed.fatigueDelta === "number" ? parsed.fatigueDelta : null,
        curiosityDelta: typeof parsed.curiosityDelta === "number" ? parsed.curiosityDelta : null,
        pacingSuggestion: typeof parsed.pacingSuggestion === "string" ? parsed.pacingSuggestion : null,
        pressureSuggestion: typeof parsed.pressureSuggestion === "string" ? parsed.pressureSuggestion : null,
        eventIntensitySuggestion: typeof parsed.eventIntensitySuggestion === "string" ? parsed.eventIntensitySuggestion : null,
        sceneGoal: typeof parsed.sceneGoal === "string" ? parsed.sceneGoal : null,
        suggestedMustInclude: Array.isArray(parsed.suggestedMustInclude) ? parsed.suggestedMustInclude : null,
        suggestedMustNotInclude: Array.isArray(parsed.suggestedMustNotInclude) ? parsed.suggestedMustNotInclude : null,
        emotionalTarget: typeof parsed.emotionalTarget === "object" && parsed.emotionalTarget ? parsed.emotionalTarget : null
      };
    } catch {
      // LLM 分析失败 → 使用纯 JS，不影响用户体验
      console.warn("LLM 输入分析失败，回退到纯 JS 方向包");
    }
  }

  // === Step 2: 方向包生成（JS + 可选的 LLM 分析） ===
  let finalDirectionPacket = directionPacket;
  if (!effectiveSkipDirector && !finalDirectionPacket) {
    const directorInput = buildDirectorPacket({ model, input, engineState, turnPrep, knowledgeCards });
    const directorResult = await callLLMByRole("director", directorInput, config, apiKey, { orchestrationPrefix });
    // 尝试解析 JSON
    try {
      const parsed = JSON.parse(directorResult.rawResponse);
      finalDirectionPacket = { packet: parsed };
    } catch {
      // Director LLM 输出不是合法 JSON → 回退到 JS 方向包
      console.warn("Director LLM 输出非法 JSON，回退到 JS 方向包");
      finalDirectionPacket = directionPacket;
    }
  }

  // 🆕 混合模式：轻量 LLM 分析 → JS generateDirectionPacket
  if (!finalDirectionPacket && llmAnalysis) {
    const jsResult = generateDirectionPacket({
      emotionState: turnPrep?.directorResult?.emotion?.state || turnPrep?.state?.emotionState,
      input,
      proximityEntities: model.entities || [],
      round: model.turnCount || 0,
      sceneChanged: turnPrep?.sceneTransition?.detected || false,
      lastEventRound: turnPrep?.state?.lastEventRound || 0,
      worldType: model.selected?.type || "daily",
      existingResult: turnPrep?.directorResult || null,
      moduleData: model.moduleData || {},
      llmAnalysis,  // 🆕 传入 LLM 分析，JS 守卫后采纳
      worldSubType,  // 🆕 跑团/经典模式区分
      storytellerId  // 🆕 叙事者风格
    });
    finalDirectionPacket = jsResult;
  }

  // 模式适配：在方向包层面应用模式约束
  if (finalDirectionPacket?.packet) {
    const dp = finalDirectionPacket.packet;
    // 防御性补齐：防止 LLM JSON 缺字段导致崩溃
    dp.directorDecision = dp.directorDecision || {};
    dp.contentPlan = dp.contentPlan || {};
    dp.contentPlan.mustInclude = dp.contentPlan.mustInclude || [];
    dp.contentPlan.mustNotInclude = dp.contentPlan.mustNotInclude || [];
    dp.writingConstraints = dp.writingConstraints || {};
    dp.storyState = dp.storyState || {};
    if (dataMode === "character_card") {
      // 角色卡模式：强制无外部事件、无新角色、无重大危机
      dp.directorDecision.eventIntensity = "none";
      if (!dp.contentPlan.mustNotInclude.includes("新角色")) {
        dp.contentPlan.mustNotInclude.push("新角色");
      }
      if (!dp.contentPlan.mustNotInclude.includes("外部事件")) {
        dp.contentPlan.mustNotInclude.push("外部事件、重大危机、世界级事件");
      }
      dp.contentPlan.mustNotInclude = [...new Set(dp.contentPlan.mustNotInclude)];
      dp.contentPlan.mustInclude = dp.contentPlan.mustInclude.filter(
        (m) => !m.includes("事件") && !m.includes("危机")
      );
    } else if (dataMode === "preset") {
      // 预设模式：简化方向包
      dp.storyState.openThreads = [];
      dp.storyState.relevantMemories = [];
      dp.directorDecision.pacing = "hold";
      dp.directorDecision.pressure = "low";
    }
  }

  // === Step 2: Writer LLM ===
  const baseWriterInput = writerPacket || buildWriterPacket({
      model, input, engineState,
    directionPacket: finalDirectionPacket,
    injectedWorldbook, knowledgeSnippets, knowledgeCards, cardContext,
    turnPrep,
    proximityData: turnPrep?.proximityData || null
    });
  const writerInput = kernelContext?.promptText
    ? `${baseWriterInput}\n\n${kernelContext.promptText}`
    : baseWriterInput;

  const writerResult = await callLLMByRole("writer", writerInput, config, apiKey, { messages, orchestrationPrefix });
  const rawText = writerResult.rawResponse;

  // === Step 3: Guardian（可选·v0.8.5 自动修正） ===
  let guardianResult = null;
  let correctedNarrative = null;
  if (!skipGuardian) {
    const narrative = extractVisibleNarrative(rawText);
    const jsAudit = validateNarrativeAgainstDirection({ narrative, directionPacket: finalDirectionPacket, userInput: input });

    // v0.8.5: JS 检测未通过且分数 < 50 → 自动修正流程
    if (!jsAudit.pass && jsAudit.score < 50) {
      console.log(`[Guardian] JS 检测未通过 (${jsAudit.score}分)，启动 LLM 自动修正...`);

      try {
        const autoResult = await validateWithAutoCorrect({
          narrative,
          directionPacket: finalDirectionPacket,
          moduleData: model.moduleData || {},
          userInput: input,
          config,
          apiKey,
          callLLM: (role, prompt, cfg, key, opts = {}) => callLLMByRole(role, prompt, cfg, key, { ...opts, orchestrationPrefix }),
          jsValidator: (opts) => validateNarrativeAgainstDirection({
            narrative: opts.narrative,
            directionPacket: opts.directionPacket,
            userInput: opts.userInput
          })
        });

        if (autoResult.correctionApplied) {
          // 用修正后的叙事替换原始输出中的【叙事】段
          correctedNarrative = autoResult.corrected;
          guardianResult = {
            ...autoResult.finalAudit,
            source: "llm_corrected",
            correctionApplied: true,
            correctionRounds: autoResult.rounds,
            originalScore: jsAudit.score,
            correctedScore: autoResult.finalAudit?.score || 0
          };
          console.log(`[Guardian] 自动修正完成 — ${autoResult.rounds} 轮, 评分 ${jsAudit.score} → ${autoResult.finalAudit?.score || "?"}`);
        } else {
          guardianResult = { ...jsAudit, source: "llm_no_correction" };
        }
      } catch (err) {
        console.warn("[Guardian] 自动修正失败:", err.message);
        guardianResult = { ...jsAudit, source: "js_fallback", correctionError: err.message };
      }
    } else {
      guardianResult = { ...jsAudit, source: jsAudit.pass ? "js_pass" : "js_minor" };
    }
  }

  // 如果进行了修正，替换 rawText 中的【叙事】段
  let effectiveRawText = rawText;
  if (correctedNarrative) {
    effectiveRawText = rawText.replace(
      /【叙事】\s*\n?[\s\S]*?(?=\n【[^】]+】|$)/,
      `【叙事】\n${correctedNarrative}`
    );
  }

  // === Step 4: 走原有 completeTurn 流程 ===
  const turnResult = completeTurn({ rawText: effectiveRawText, input, model, moduleKey, dataMode, directorResult: turnPrep?.directorResult || null, engineState: turnPrep?.state || engineState || {} });

  return {
    ...turnResult,
    directionPacket: finalDirectionPacket,
    guardianResult,
    _dualStage: {
      usedDirectorLLM: !effectiveSkipDirector,
      usedGuardianLLM: !skipGuardian && String(guardianResult?.source || "").startsWith("llm"),
      directionSummary: finalDirectionPacket?.summary || ""
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  旧单段式兼容（保持向后兼容）
// ═══════════════════════════════════════════════════════════════

function buildSystemPrompt({ model, config, personaText, enginePacket, dataMode, injectedWorldbook, cards }) {
  const mode = dataMode || "worldbook";

  if (mode === "character_card") {
    const primaryCard = cards?.find((c) => c.kind === "character-card");
    const charName = primaryCard?.name || "Character";
    return [
      enginePacket,
      "",
      "你在 World Tree Desktop 角色卡模式下运行。",
      "你是上面定义的角色——不是 DM，不是 AI 助手。",
      "用角色的身份、性格、语气直接和用户对话。",
      "永远不要跳出角色。"
    ].join("\n");
  }

  if (mode === "preset") {
    return [
      personaText || "You are a collaborative storytelling assistant.",
      "",
      enginePacket,
      "",
      "你在 World Tree Desktop 预设模式下运行。",
      "用户提供了基本设定，你据此快速构建世界并展开叙事。",
      "灵活、简洁、不啰唆。用户设定就是全部规则。"
    ].join("\n");
  }

  // 世界书模式：兼容旧路径
  const worldbookBlock = injectedWorldbook?.length
    ? ["", "Injected worldbook entries:", ...injectedWorldbook.map((item) => `- ${item.title}: ${item.content}`)].join("\n")
    : "";

  return [
    personaText || "You are a careful interactive fiction DM.",
    "",
    enginePacket,
    "",
    "World Tree Desktop direct-LLM mode:",
    "- Run the full World Tree engine protocol, not a generic chat scene.",
    "- Persistent changes must be expressed through Chinese marked sections; Desktop writes only to data/engine/ overlay.",
    "- Keep the player-facing narrative readable and immersive before any marked sections.",
    "",
    moduleContext(model),
    worldbookBlock
  ].join("\n");
}

/** 旧单段式兼容入口 */
export async function sendGameTurn({ model, config, apiKey, personaText, enginePacket = "", messages, input, injectedWorldbook = [], cards = [], moduleKey = "unloaded", dataMode = "worldbook" }) {
  if (!canUseDirectLlm(config, Boolean(apiKey))) {
    throw new Error("Please configure LLM Base URL, model, and API key.");
  }
  const timeoutMs = Number(config.llmTimeoutMs || 60000);

  const system = buildSystemPrompt({ model, config, personaText, enginePacket, dataMode, injectedWorldbook, cards });

  // 隐私防线
  const safeSystem = scrubPromptForPrivacy(system);
  const safeInput = scrubPromptForPrivacy(input);

  const body = {
    model: config.llmModel,
    messages: [
      { role: "system", content: safeSystem },
      ...messages.filter((item) => item.role === "user" || item.role === "assistant").slice(-20),
      { role: "user", content: safeInput }
    ],
    temperature: 0.85
  };

  const response = await fetch(endpoint(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text || `LLM HTTP ${response.status}`);
  const data = JSON.parse(text);
  const rawText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
  return completeTurn({ rawText, input, model, moduleKey, dataMode });
}
