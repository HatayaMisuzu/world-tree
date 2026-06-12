// src/core/engine/guardian-llm.js
// v0.8.5 — Guardian LLM 事实注入 + 自动修正
// 当 JS Guardian 检测问题后，注入 canon_state 事实，
// 调 LLM 自动修正叙事，再重跑 JS Guardian 确认。
// ═══════════════════════════════════════════════════════════════

/**
 * 从 moduleData 中提取与当前叙事相关的事实
 * @param {string} narrative - Writer 输出正文
 * @param {Object} moduleData - 模型数据（含 canon、characters、worldbook、scenes 等）
 * @returns {string} 格式化的相关事实文本
 */
export function extractRelevantFacts(narrative = "", moduleData = {}) {
  const facts = [];
  const text = String(narrative || "");

  // 1. Canon 正史事实
  const canon = moduleData.canon || {};
  const confirmed = canon.confirmed || [];
  const implied = canon.implied || [];

  if (confirmed.length) {
    facts.push("【已确认事实】");
    for (const item of confirmed) {
      if (typeof item === "string") {
        facts.push(`- ${item}`);
      } else if (item && item.detail) {
        facts.push(`- ${item.detail}`);
      }
    }
  }
  if (implied.length) {
    facts.push("【隐含事实（高度可能）】");
    for (const item of implied.slice(0, 10)) {
      if (typeof item === "string") {
        facts.push(`- ${item}`);
      } else if (item && item.detail) {
        facts.push(`- ${item.detail}`);
      }
    }
  }

  // 2. 角色基本信息
  const characters = moduleData.characters || [];
  if (characters.length) {
    facts.push("【当前角色】");
    for (const char of characters.slice(0, 8)) {
      const name = char.name || char.id || "";
      if (!name) continue;
      // 检查角色名是否出现在叙事中
      const relevant = text.includes(name);
      const marker = relevant ? "★" : " ";
      facts.push(`${marker} ${name}${char.role ? ` (${char.role})` : ""}${char.location ? ` @ ${char.location}` : ""}`);
    }
  }

  // 3. 当前场景信息
  const scenes = moduleData.scenes || [];
  const runtime = moduleData.runtime || {};
  const currentScene = runtime.scene || runtime.currentScene || (scenes.length > 0 ? scenes[scenes.length - 1] : null);

  if (currentScene) {
    facts.push("【当前场景】");
    const sceneTitle = currentScene.title || currentScene.name || currentScene;
    facts.push(`- 标题: ${sceneTitle}`);
    if (currentScene.location) facts.push(`- 地点: ${currentScene.location}`);
    if (currentScene.time) facts.push(`- 时间: ${currentScene.time}`);
    if (currentScene.mood) facts.push(`- 氛围: ${currentScene.mood}`);
    if (currentScene.charactersPresent && Array.isArray(currentScene.charactersPresent)) {
      facts.push(`- 在场角色: ${currentScene.charactersPresent.join(", ")}`);
    }
  }

  // 4. 世界书条目（仅注入叙事中出现的相关条目）
  const wbEntries = moduleData.worldbook?.entries || moduleData.worldbook?.items || [];
  const relevantEntries = [];
  for (const entry of wbEntries.slice(0, 20)) {
    const keys = Array.isArray(entry.keys) ? entry.keys : [];
    const title = entry.title || entry.id || "";
    const content = entry.content || entry.text || "";
    // 检查叙事中是否出现相关关键词
    const isRelevant = keys.some((k) => text.includes(k)) || text.includes(title);
    if (isRelevant && content) {
      relevantEntries.push(`- [${title || keys.join("/")}] ${content.slice(0, 200)}`);
    }
  }
  if (relevantEntries.length) {
    facts.push("【相关世界设定】");
    facts.push(...relevantEntries.slice(0, 5));
  }

  // 5. 追踪/伏笔
  const tracking = moduleData.tracking || [];
  if (tracking.length) {
    facts.push("【活跃伏笔】");
    for (const track of tracking.slice(0, 5)) {
      const name = track.name || track.id || "";
      const count = track.count || 0;
      if (name) facts.push(`- ${name} (提及 ${count} 次)`);
    }
  }

  return facts.join("\n");
}

/**
 * 构建 LLM Guardian 自动修正的 prompt
 * @param {Object} opts
 * @param {string} opts.narrative - 原始叙事
 * @param {Object} opts.jsAudit - JS Guardian 校验结果 (validateNarrativeAgainstDirection 返回值)
 * @param {string} opts.relevantFacts - extractRelevantFacts 提取的事实
 * @param {Object} opts.directionPacket - 方向包
 * @param {string} opts.userInput - 玩家输入
 * @returns {string} LLM prompt
 */
export function buildCorrectionPrompt({ narrative = "", jsAudit = {}, relevantFacts = "", directionPacket = null, userInput = "" } = {}) {
  const dp = directionPacket?.packet || directionPacket;
  const cp = dp?.contentPlan || {};
  const we = dp?.writingConstraints || {};

  const sections = [
    "【自动修正指令】",
    "",
    "你是 World Tree Desktop 的 Guardian。你的任务是：",
    "1. 理解原始叙事的内容和意图",
    "2. 阅读相关事实（canon、角色、场景、设定）",
    "3. 阅读 JS Guardian 检测到的问题列表",
    "4. 在保留叙事风格和内容的前提下，修正所有问题",
    "5. 输出修正后的完整叙事正文",
    "",
    "**修正原则：**",
    "- 只修正有问题的地方，其他部分保持不变",
    "- 如果方向包要求 mustInclude 但缺失 → 自然融入叙事中",
    "- 如果 mustNotInclude 泄露 → 移除相关内容并自然桥接上下文",
    "- 如果与 canon 事实冲突 → 以 canon 为准修正",
    "- 如果角色不在场景中但叙事出现了 → 移除该角色",
    "- 不要添加方向包未要求的新情节",
    "- 保留原始的语气、节奏和叙事风格",
    "",
    "═══ 相关事实 ═══",
    relevantFacts || "（无额外事实）",
    "",
    "═══ 方向包约束 ═══",
    `【必须出现】${(cp.mustInclude || []).join("；") || "无"}`,
    `【禁止出现】${(cp.mustNotInclude || []).join("；") || "无"}`,
    `【长度要求】${we.length || "medium"}`,
    `【视角要求】${we.perspective || "third_person"}`,
    `【玩家输入】${userInput || "无"}`,
    "",
    "═══ JS Guardian 检测到的问题 ═══",
    ...(jsAudit.issues || []).map((issue, i) => `${i + 1}. ${issue}`),
    "",
    "═══ 原始叙事 ═══",
    narrative,
    "",
    "═══ 输出要求 ═══",
    "只输出修正后的完整叙事正文（纯文本）。",
    "不要加任何解释、前缀、标记、JSON包装。",
    "如果叙事完全正确无需修正，原样输出。"
  ];

  return sections.join("\n");
}

/**
 * 清理 LLM 输出的修正文本（去掉可能的前缀、JSON包装等）
 * @param {string} rawOutput - LLM 原始输出
 * @param {string} originalNarrative - 原始叙事（用于长度异常检查）
 * @returns {string} 清理后的叙事
 */
function cleanCorrectedNarrative(rawOutput, originalNarrative) {
  let text = String(rawOutput || "").trim();

  // 去除可能的 JSON 包装
  if (text.startsWith("{") || text.startsWith("```")) {
    // 尝试从 markdown code block 中提取
    const codeMatch = text.match(/```(?:json|text)?\s*\n?([\s\S]*?)```/);
    if (codeMatch) text = codeMatch[1].trim();
    else {
      // 尝试作为 JSON 解析
      try {
        const parsed = JSON.parse(text);
        if (parsed.correctedNarrative) text = parsed.correctedNarrative;
        else if (parsed.narrative) text = parsed.narrative;
        else if (parsed.corrected) text = parsed.corrected;
      } catch {
        // 不是 JSON，保持原样
      }
    }
  }

  // 如果输出比原始短太多（>70%），可能是 LLM 只输出了一句点评，退回原始
  if (text.length < originalNarrative.length * 0.3 && text.length < 100) {
    console.warn("[Guardian LLM] 修正输出异常短，退回原始叙事");
    return originalNarrative;
  }

  // 如果输出完全为空，退回原始
  if (!text) return originalNarrative;

  return text;
}

/**
 * 完整的自动修正流程：
 * 1. JS Guardian 检测 → 2. 提取相关事实 → 3. LLM 修正 → 4. 重跑 JS Guardian
 * @param {Object} opts
 * @param {string} opts.narrative - 原始叙事
 * @param {Object} opts.directionPacket - 方向包
 * @param {Object} opts.moduleData - 模型数据
 * @param {string} opts.userInput - 玩家输入
 * @param {Object} opts.config - { llmBaseUrl, llmModel }
 * @param {string} opts.apiKey - API Key
 * @param {Function} opts.callLLM - LLM 调用函数 (role, prompt, config, apiKey) => { rawResponse }
 * @param {Function} opts.jsValidator - JS Guardian 校验函数
 * @returns {Promise<Object>} { corrected, finalAudit, correctionApplied, rounds }
 */
export async function validateWithAutoCorrect({
  narrative = "",
  directionPacket = null,
  moduleData = {},
  userInput = "",
  config = {},
  apiKey = "",
  callLLM = null,
  jsValidator = null
} = {}) {
  if (!callLLM || !jsValidator) {
    return { corrected: narrative, finalAudit: null, correctionApplied: false, rounds: 0, error: "缺少 LLM 调用函数或 JS 校验函数" };
  }

  let currentNarrative = narrative;
  let finalAudit = null;
  let correctionApplied = false;
  let rounds = 0;
  const MAX_ROUNDS = 2; // 最多修正2轮，防止无限循环

  // 先跑 JS Guardian
  let jsAudit = jsValidator({ narrative: currentNarrative, directionPacket, userInput });

  while (!jsAudit.pass && rounds < MAX_ROUNDS && jsAudit.score < 80) {
    rounds++;
    console.log(`[Guardian LLM] 第 ${rounds} 轮修正 — 评分: ${jsAudit.score}, 问题: ${jsAudit.issues.length}`);

    // 提取相关事实
    const relevantFacts = extractRelevantFacts(currentNarrative, moduleData);

    // 构建修正 prompt
    const correctionPrompt = buildCorrectionPrompt({
      narrative: currentNarrative,
      jsAudit,
      relevantFacts,
      directionPacket,
      userInput
    });

    try {
      // 调 LLM 修正
      const llmResult = await callLLM("guardian", correctionPrompt, config, apiKey, { temperature: 0.2, max_tokens: 4096 });
      const corrected = cleanCorrectedNarrative(llmResult.rawResponse, currentNarrative);

      if (corrected !== currentNarrative) {
        correctionApplied = true;
        currentNarrative = corrected;
      }

      // 重跑 JS Guardian
      jsAudit = jsValidator({ narrative: currentNarrative, directionPacket, userInput });

      if (jsAudit.pass) break;
    } catch (err) {
      console.warn(`[Guardian LLM] 第 ${rounds} 轮修正失败: ${err.message}`);
      break;
    }
  }

  finalAudit = jsAudit;

  return {
    corrected: currentNarrative,
    finalAudit,
    correctionApplied,
    rounds,
    originalPassed: rounds === 0 && finalAudit?.pass
  };
}
