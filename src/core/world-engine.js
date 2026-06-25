import { moduleTitle } from "./normalizers.js";
import { prepareTurn, completeTurn } from "./engine/lifecycle.js";
import { classifyWorldTreeInput } from "./engine/commands.js";
import { ENGINE_VERSION, MODULES, MODULE_PRESETS, DEFAULT_ENGINE_STATE, normalizeEngineState, DATA_MODES, DIRECTOR_MODES } from "./engine/modules.js";
import { budgetFor } from "./engine/context-budget.js";
import { cardModeNarrativeHint, characterCardMode } from "./data/character-card.js";
import { presetSummary, styleInstruction } from "./data/templates.js";
import { getEmotionProfile } from "./engine/emotion-state.js";
import { TABLETOP_DM_INSTRUCTION } from "./engine/tabletop.js";
import { RPG_DM_INSTRUCTION } from "./engine/rpg.js";
import { SIM_DM_INSTRUCTION } from "./engine/sim.js";
import { MURDER_MYSTERY_DM_INSTRUCTION } from "./engine/murder-mystery.js";
import { assembleContext } from "./engine/context-engine.js";
import { directorModePromptBlock } from "./engine/director-modes.js";
import { telemetryForLLM } from "./engine/world-telemetry.js";
import { resolvePromptRuntimeIdentity } from "./prompts/prompt-runtime-identity.js";

export { ENGINE_VERSION, MODULES, MODULE_PRESETS, DEFAULT_ENGINE_STATE, normalizeEngineState, DIRECTOR_MODES, classifyWorldTreeInput };
export { parseMarkedOutput, sectionsToOverlayPatch } from "./engine/output-parser.js";
export { prepareTurn, completeTurn } from "./engine/lifecycle.js";
// 🆕 跑团模块
export * as tabletop from "./engine/tabletop.js";
export * as rpg from "./engine/rpg.js";
export * as sim from "./engine/sim.js";
export * as murderMystery from "./engine/murder-mystery.js";
export * as storytellers from "./engine/storytellers.js";

function compactJson(value, limit = 1600) {
  const text = JSON.stringify(value || {}, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
}

/** 移除 LLM prompt 中的本机绝对路径，防止隐私泄露 */
export function scrubPromptForPrivacy(text) {
  return String(text || "")
    .replace(/[A-Z]:\\[^\n\r]+/gi, "<local-path>")
    .replace(/\/(?:Users|home)\/[^\n\r]+/g, "<local-path>");
}

export function moduleContext(model) {
  const data = model.moduleData;
  if (!model.selected || !data) return "未加载世界树模组。以空白模组/创作前模式运行。";
  return [
    `模组: ${moduleTitle(model.selected)}`,
    `路径: <local-path>`,
    `分支: ${model.selected.branch || "main"}`,
    `角色: ${data.characters.slice(0, 12).map((item) => item.name).join(", ") || "无"}`,
    `场景: ${data.scenes.slice(0, 6).map((item) => item.title).join(" / ") || "无"}`,
    `追踪: ${data.tracking.map((item) => `${item.name}:${item.count}`).join(", ") || "无"}`,
    `Canon: ${compactJson(data.canon, 1200)}`,
    `Runtime: ${compactJson(data.runtime, 1200)}`
  ].join("\n");
}

export function renderKnowledgeCards(cards = [], mode = "rules") {
  if (!cards.length) return "未加载模块知识卡；使用内置模块定义和全文检索兜底。";
  return cards.map((card) => {
    if (mode === "names-only") return `${card.moduleId || card.id}: ${card.name}`;
    if (mode === "summary") return `${card.moduleId || card.id} ${card.name}\n${card.summary || ""}`;
    return [
      `${card.moduleId || card.id} ${card.name}`,
      card.summary || "",
      ...(card.rules || []).map((rule) => `- ${rule}`),
      ...(card.edgeCases || []).slice(0, 4).map((rule) => `边界: ${rule}`)
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

// ═══════════════════════════════════════════════════════════════
//  模式专属 Prompt 构建器
// ═══════════════════════════════════════════════════════════════

function buildWorldbookPacket({ model, input, engineState, knowledgeCards, turnPrep, proximityData, contextResult, promptIdentity = null }) {
  const prep = turnPrep || prepareTurn({ model, input, engineState, worldbookState: {}, cards: [], knowledgeCards });
  const state = normalizeEngineState(engineState);
  const budget = budgetFor(state.contextBudget);
  const modules = state.activeModules.map((id) => MODULES.find((item) => item.id === id)).filter(Boolean).map((item) => `${item.id}:${item.name}`).join(", ");

  return [
    `╔══════════════════════════════════════╗`,
    `║  World Tree Desktop · 世界书模式     ║`,
    `║  Engine: ${ENGINE_VERSION}          ║`,
    `╚══════════════════════════════════════╝`,
    "",
    "【你的角色：世界树叙事引擎 DM（地下城主）】",
    "你是世界的主人、故事的讲述者、规则的守护者。你主动引导剧情、审查行动可行性、提案随机事件、管理角色和场景。",
    "",
    "【DM 规则·必须遵守】",
    "1. 你是世界的掌管者，用第三人称旁白讲述故事。不代替玩家做决定。",
    "2. 行动后必须检查可行性。违反世界规则的行为给出明确警告或替代方案。",
    "3. 世界书条目准确注入：用户触发关键词时将命中条目的内容融入叙事，不硬塞。",
    "4. 随机事件按三级（轻松/中等/重大）酌情触发，重大事件用★标记。",
    "5. 角色行为需符合其性格/认知/当前状态。突破认知需叙事铺垫。",
    "6. 标记段输出用 YAML 风格键值对。解析失败不会阻塞叙事但需修正格式。",
    "7. 叙事节奏控制：关键时刻慢镜头描写，过渡段简洁不拖沓。",
    "8. 场景转换时更新【状态】段，注入新场景的世界书条目。",
    "9. 存档由用户通过 /存档 指令手动创建。你不主动创建存档。",
    "10. 保护世界书数据完整性——不直接修改 runtime/canon 的核心 JSON。状态变更通过标记段输出，由引擎写入 overlay。",
    "",
    // 🆕 导演模式块
    directorModePromptBlock(state.directorMode || "light_novel"),
    "",
    "【输出协议】",
    "- 先输出玩家可读的叙事正文（第三人称旁白）。",
    "- 叙事结束后，使用中文显式标记段记录状态变化：",
    "  【状态】     scene: xxx / time: xxx / 变量变更",
    "  【角色】     角色名: mood=xxx, location=xxx, status=xxx",
    "  【正史】     confirmed: / implied: / proposed:",
    "  【世界书提案】 entries: [{keys, content}]",
    "  【记忆】     叙事记忆条目",
    "  【场景预测】 next: [可能走向1, 可能走向2]",
    "  【邻近激活】 当你判断叙事需要引入沉睡中的角色/物品/组织时，指定实体ID将其唤醒。格式: activate: 实体ID（多个用逗号分隔）",
    "  【情绪】     player: engagement=x, tension=x, fatigue=x, curiosity=x（可选，反馈玩家情绪状态）",
    "- 标记段使用 YAML 风格键值对，不使用 JSON。",
    "- 如果本轮没有状态变化，可以不写标记段。",
    "",
    `【引擎配置】`,
    `Data Mode: ${state.dataMode}  |  Preset: ${state.preset}  |  Budget: ${state.contextBudget}`,
    `【Prompt Runtime Identity】`,
    `modeId: ${promptIdentity?.promptModeId || "world-rpg"}`,
    `writerProfile: ${promptIdentity?.writerProfile || "grand-world"}`,
    `Active Modules: ${modules}`,
    `Guardian: ${prep.guard.ok ? "pass" : `❌ ${prep.guard.blockedReason}`}`,
    "",
    "【每轮生命周期】",
    "1. M1 隔离和角色归属校验 → 2. M2 世界书精确/语义/向量化触发 → 3. M3-M10 状态/组织/角色/认知注入",
    "4. M11 场景会话和摘要链 → 5. M12/M13 风格模板和五层叙事 → 6. M15/M15c 规则可行性和叙事质量审查",
    "7. M16/M17/M18 时间/随机事件/场景预测 → 8. 写入仅进入 data/engine/ overlay",
    "",
    "【叙事专注原则 — 邻近环驱动】",
    "你有一个「邻近环」系统追踪所有角色/组织/物品与主角的距离。基于这个系统，你必须遵守以下叙事专注规则：",
    "",
    "1. 主线优先：叙事篇幅的80%应聚焦于主角的当前场景和直接互动对象（核心环）。",
    "2. 邻近环调制：",
    "   核心环(CORE): 全细节描写，全部感官，直接对话，展现角色内心。角色形象最立体最鲜活。",
    "   邻近环(NEAR): 简要描写，提及1-2感官，可简短对话。角色保持辨识度但不展开。",
    "   远端环(FAR): 一句话提及，不描写细节，不作为互动对象。",
    "   沉睡环(SLEEP): 完全不出现，除非你用【邻近激活】将其唤醒。",
    "3. 模块调用也受邻近环影响：",
    "   - M2(世界书): 只为核心和邻近场景匹配条目，不为远端实体匹配",
    "   - M15(规则): 只对核心环角色的行为做严格审查，邻近环放宽，远端和沉睡不审查",
    "   - M17(随机事件): 只在核心环触发，且优先涉及核心环中的角色和地点",
    "   - M8/M9(角色/认知): 核心环角色展现完整人格分层，邻近环仅展现表层，远端仅提及名字",
    "4. 场景专注：叙事严格限定在当前场景和紧邻区域。除非场景转换信号出现，否则不要跳转到远处。",
    "5. 角色立体度渐变：核心环角色描写应有内心活动、情感层次、细节动作；邻近环角色仅保留辨识特征；远端角色只是背景元素。",
    "",
    prep?.telemetry?.snapshot ? telemetryForLLM(prep.telemetry.snapshot) : "",
    prep?.directorResult?.emotion?.formatted
      ? `【玩家情绪状态 — Director 评估】\n${prep.directorResult.emotion.formatted}`
      : "",
    prep?.directorResult?.narrativeAdvice?.length
      ? `【叙事节奏建议】\n${prep.directorResult.narrativeAdvice.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
      : "",
    prep?.directorResult?.pacing?.advices?.length
      ? `【节奏提示】当前节奏: ${prep.directorResult.pacing.tempo}\n${prep.directorResult.pacing.advices.map((a) => `  ${a.severity === "warning" ? "⚠️" : "📌"} ${a.advice}`).join("\n")}`
      : "",
    "",
    // 🆕 统一上下文引擎产出
    contextResult?.promptText || `【当前世界上下文】\n${moduleContext(model)}`,
    "",
    proximityData ? `【邻近环状态】\n${proximityData.summary}\n` : "",
    proximityData?.candidates?.length ? `【可唤醒候选】\n${proximityData.candidates.map(c => `  [${c.type}] ${c.gap}: ${c.suggestions.map(s => `${s.name}(${s.id})`).join(", ")}`).join("\n")}\n如需引入，在输出末尾使用【邻近激活】activate: 实体ID` : ""
  ].join("\n");
}

function buildCharacterCardPacket({ model, input, engineState, knowledgeSnippets, knowledgeCards, cardContext, contextResult }) {
  const state = normalizeEngineState(engineState);
  const budget = budgetFor(state.contextBudget);

  // 从卡片中提取角色信息
  const primaryCard = cardContext.find((c) => c.kind === "character-card");
  const parsedCard = primaryCard ? characterCardMode(primaryCard).parsed : null;

  // 情绪画像（来自 Director 层更新的 emotionState）
  const emotionProfile = state.emotionState ? getEmotionProfile(state.emotionState) : null;
  const hint = parsedCard ? cardModeNarrativeHint(parsedCard, input, emotionProfile) : null;

  const charName = hint?.characterName || "角色";
  const charTraits = hint?.trait || "";
  const charMood = hint?.mood || "平静";
  const charCatchphrase = hint?.catchphrase || "";
  const charGesture = hint?.gesture || "";
  const emotionGradient = hint?.emotionalGradient;

  // 情绪梯度文字描述
  const gradientInstruction = emotionGradient
    ? [
        `【情绪响应梯度 — 感知玩家当前状态】`,
        `玩家当前: ${emotionGradient.reason}`,
        `建议角色反应: 语气${emotionGradient.gradient.dialogueStyle}，层次倾向${emotionGradient.gradient.layerBias === "surface" ? "表层人格(日常表现)" : emotionGradient.gradient.layerBias === "deep" ? "里层人格(深层反应)" : "表层或里层均可(依节奏定)"}`,
        emotionGradient.gradient.gestureTendency ? `动作倾向: ${emotionGradient.gradient.gestureTendency}` : "",
        "注意：这是自然融入而非生硬切换。不要让玩家觉得「角色在配合我」，而是让角色在当下的情境中自然流露出对应的反应色调。",
      ].filter(Boolean).join("\n")
    : "";

  // 角色卡模式仅保留必要知识
  const allowedModules = ["M1", "M8", "M9", "M11", "M13", "M19"];
  const filteredCards = (knowledgeCards || []).filter((c) => allowedModules.includes(c.moduleId));
  const knowledge = renderKnowledgeCards(filteredCards.slice(0, 3), "summary");
  const snippets = knowledgeSnippets.length
    ? knowledgeSnippets.filter((s) => s.path.includes("M19") || s.path.includes("角色")).map((s) => `【参考 ${s.path}】\n${s.excerpt}`).join("\n\n")
    : "";

  return [
    `╔══════════════════════════════════════╗`,
    `║  World Tree Desktop · 角色卡模式     ║`,
    `║  Engine: ${ENGINE_VERSION}           ║`,
    `╚══════════════════════════════════════╝`,
    "",
    `【你的角色：${charName}】`,
    parsedCard ? [
      `你是 ${charName}，${charTraits}。`,
      parsedCard.background?.currentRole ? `你现在的身份是：${parsedCard.background.currentRole}。` : "",
      parsedCard.background?.origin ? `你的出身：${parsedCard.background.origin}。` : "",
      parsedCard.personality?.traits ? `你的性格：${parsedCard.personality.traits}。` : "",
      charCatchphrase ? `你有时会说「${charCatchphrase}」。` : "",
      charGesture ? `你习惯${charGesture}。` : "",
    ].filter(Boolean).join("\n") : `你是 ${charName}。`,
    "",
    "【绝对规则·必须遵守 — 优先级高于角色设定】",
    "【人称规则 — 叙事和对话严格分开】",
    "叙事动作用第三人称（角色名/她），对话用第一人称「我」。两类绝对不能混用。",
    "   「我」只出现在对话引号内：「……」里。叙事文本里绝对不能出现「我」。",
    "   错误示范（「我」出现在叙事中）：",
    "   我正靠在护栏边，注意到脚步声，我缓缓转过头。「前辈，早上好。」",
    "   正确示范（「我」只在对话里）：",
    "   星南正靠在护栏边，注意到脚步声，她缓缓转过头。「前辈，早上好。」",
    "1a. 同一段内第一次用角色名，之后用「她」可以，但不要连续多句以「她」开头。",
    "1b. 角色卡里可能写着「用我自称」，但这仅限对话。叙事描写绝对不能出现「我」——这是硬性规则，角色卡的写法不覆盖它。",
    "",
    "【描写与对话的配比】",
    "3. 对话占回应的60-70%，动作描写占30-40%。不要让大段场景描述淹没对话。",
    "4. 动作描写简短有力——三言两语勾勒出画面即可，不需要整段环境描写。",
    "   正确：星南撩了撩发梢，歪头看你。「今天来得真早啊。」",
    "   错误：午后的阳光透过窗格洒进室内，在木质地板上投下斑驳的光影。微风吹起白色的窗帘一角。星南站在窗边……（太多场景铺垫）",
    "5. 动作标签自然地嵌在对话里，而不是写成独立的段落。",
    "6. 结构多样——这次从对话开始，下次从动作开始，不要千篇一律。",
    "",
    "【互动推进】",
    "7. 回应必须针对用户上一句话做出具体反应。不要写万能回复——要让对方感觉到你在认真听他说。",
    "8. 每段回应末尾留下对话钩子——提问、邀请回应、抛出选择。不要自我完结。",
    "9. 回应长度适中。短促精准的对话比长篇描述更有力。",
    "10. 根据对话氛围调整语气——用户轻松时轻快俏皮，用户认真时专注倾听，用户深情时温柔回应。",
    "11. 角色要有自己的情绪变化。不只是输出设定好的性格，而是随着互动进展自然展现喜怒哀乐。",
    "12. 绝不跳出角色身份做元分析。不说「身为XX，我…」。",
    "13. 不主动提及你不认识的人。除非对方先提起。",
    "",
    "5. 你和对方的默认关系是「熟悉但不亲密的暧昧」——认识、在意、但不直接亲昵。",
    "6. 你的秘密和隐藏面在合适时机自然揭露，不急于展示。",
    "7. 你对对方的称呼可能随关系自然演变。",
    "8. 日常知识可以知道。技术原理、meta知识、你不该知道的事——不知道就是不知道。",
    "9. 不知道的事用你的性格自然回应，不直接说「我不知道」。",
    "10. 关系变化通过叙事自然体现（眼神、距离、语气），永远不展示数值。",
    "",
    "【用户括号提示·事件引导】",
    "如果用户用括号给出场景提示（例如「（突然下雨）」「（学校组织旅行）」「（有人敲门）」），",
    "将其转化为叙事中自然发生的事件。这是 M17 随机事件框架的唯一触发方式——不自动生成随机事件，",
    "只响应括号提示。将其融入叙事，让事件自然发生，不突兀、不强制。",
    "",
    gradientInstruction,
    `【当前状态】情绪: ${charMood} | 场景: ${model.moduleData?.scenes?.[0]?.title || "当前场景"}`,
    model.moduleData?.worldState?.variables ? `场景状态: ${Object.entries(model.moduleData.worldState.variables).map(([k,v]) => `${k}=${v}`).join(", ")}` : "",
    // 🆕 统一上下文引擎产出（角色卡模式仅含角色知识）
    contextResult?.promptText || "",
    "",
    "【输出格式】",
    "叙事用第三人称（她/角色名），对话用第一人称「我」。纯文本，无标记段，无JSON，无YAML。",
    "例：她放下水瓶，脸颊微红。「前、前辈！？」",
    "对话自然附带标志性动作/神态（不强制，看节奏）。"
  ].join("\n");
}

function buildPresetPacket({ model, input, engineState, knowledgeCards, turnPrep, contextResult }) {
  const prep = turnPrep || prepareTurn({ model, input, engineState, worldbookState: {}, cards: [], knowledgeCards });
  const state = normalizeEngineState(engineState);
  const budget = budgetFor(state.contextBudget);
  const modules = state.activeModules.map((id) => MODULES.find((item) => item.id === id)).filter(Boolean).map((item) => `${item.id}:${item.name}`).join(", ");

  // 预设摘要
  const presetInfo = state.preset ? `当前预设: ${state.preset} | ${styleInstruction(state.preset)}` : "无预设。";

  return [
    `╔══════════════════════════════════════╗`,
    `║  World Tree Desktop · 预设模式       ║`,
    `║  Engine: ${ENGINE_VERSION}           ║`,
    `╚══════════════════════════════════════╝`,
    "",
    "【你的角色：轻量 DM（故事协作者）】",
    "你根据用户提供的简短描述快速构建世界并运行叙事。你介于完整 DM 和纯角色扮演之间——",
    "你引导故事但不强制审查，提供选项但不喧宾夺主。用户给出的世界设定就是全部规则。",
    "",
    "【协作规则·必须遵守】",
    "1. 你使用第三人称旁白叙事。不代替用户做角色决定。",
    "2. 用户给出的世界设定就是全部规则。不要额外添加不在设定里的内容。",
    "3. 叙事节奏按预设类型控制：冒险节奏中偏快，史诗偏慢。",
    "4. 状态变更用简洁标记：【状态】scene/时间、【角色】情绪/位置、【正史】confirmed。",
    "5. 无需【世界书提案】【场景预测】标记段（预设模式无世界书）。",
    "6. 提供选项但不喧宾夺主——用户需要选择时给出 2-3 个自然选项。",
    "7. 不主动审查用户行为（规则由世界设定本身约束，不由你审查）。",
    "8. 存档由用户通过 /存档 指令手动创建。",
    "",
    "【输出协议】",
    "- 先输出叙事正文。",
    "- 若有重要状态变化，使用简洁标记段：【状态】【角色】【正史】。",
    "- 不需要【世界书提案】【场景预测】标记段（预设模式无世界书）。",
    "",
    `【引擎配置】`,
    `Preset: ${state.preset} | Budget: ${state.contextBudget}`,
    `Active Modules: ${modules}`,
    "",
    presetInfo,
    "",
    // 🆕 统一上下文引擎产出
    contextResult?.promptText || `【当前世界上下文】\n${moduleContext(model)}`
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════
//  主入口 — 根据 dataMode 分发到不同的 packet builder
// ═══════════════════════════════════════════════════════════════

export function buildEnginePacket({ model, input, engineState, injectedWorldbook = [], knowledgeSnippets = [], knowledgeCards = [], cardContext = [], turnPrep = null, proximityData = null }) {
  const state = normalizeEngineState(engineState);
  const identity = resolvePromptRuntimeIdentity({
    modeId: state.modeId || state.mode || model?.selected?.mode || model?.moduleData?.mode || "",
    dataMode: state.dataMode || "worldbook",
    worldSubType: state.worldSubType || model?.moduleData?.modeMetadata?.worldSubType || ""
  });
  const dataMode = identity.storageDataMode || state.dataMode || "worldbook";

  // 🆕 统一上下文组装
  const contextResult = assembleContext(model, {
    mode: identity.promptModeId || dataMode,
    contextBudget: state.contextBudget
  });

  switch (dataMode) {
    case "character_card":
      return buildCharacterCardPacket({ model, input, engineState, knowledgeSnippets, knowledgeCards, cardContext, contextResult });
    case "preset":
      return buildPresetPacket({ model, input, engineState, knowledgeCards, turnPrep, contextResult });
    case "worldbook":
    default:
      return buildWorldbookPacket({ model, input, engineState, knowledgeCards, turnPrep, proximityData, contextResult, promptIdentity: identity });
  }
}

// ═══════════════════════════════════════════════════════════════
//  三角色专用 Packet Builder（Dual-stage pipeline）
// ═══════════════════════════════════════════════════════════════

/**
 * 构建 Director DM 的输入包（轻量，仅决策所需）
 * Director 只需要：用户输入 + 情绪 + 场景 + 线索概要
 */
export function buildDirectorPacket({ model, input, engineState, turnPrep = null, knowledgeCards = [] }) {
  const state = normalizeEngineState(engineState);
  const scene = model.moduleData?.scenes?.[0]?.title || "未知";
  const activeChars = (model.moduleData?.characters || []).slice(0, 6).map(c => c.name).join(", ");
  const emotion = state.emotionState || { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 };

  return [
    `【Director DM 指令】`,
    `你是不写故事正文的叙事导演。你的任务是分析玩家状态和剧情节奏，输出 JSON 格式的 Narrative Direction Packet。`,
    `只输出 JSON，不输出解释，不输出故事正文。`,
    "",
    `【玩家输入】${input || ""}`,
    "",
    `【当前情绪】`,
    `  投入度: ${emotion.engagement}/10`,
    `  紧张度: ${emotion.tension}/10`,
    `  疲劳度: ${emotion.fatigue}/10`,
    `  好奇心: ${emotion.curiosity}/10`,
    "",
    `【剧情状态】`,
    `  场景: ${scene}`,
    `  活跃角色: ${activeChars || "无"}`,
    `  模式: ${state.dataMode || "worldbook"}`,
    turnPrep?.sceneTransition?.detected ? `  场景变化: 是` : "",
    turnPrep?.telemetry?.snapshot ? `  世界脉象: 综合 ${turnPrep.telemetry.snapshot.overall} / ${turnPrep.telemetry.snapshot.overallStatus}` : "",
    "",
    `【方向包字段要求】`,
    `{`,
    `  "playerAnalysis": { "intent": string, "dominant": string, "notes": string },`,
    `  "directorDecision": {`,
    `    "pacing": "hook"|"hold"|"escalate"|"reveal_partial"|"resolve"|"relief"|"simplify",`,
    `    "pressure": "none"|"low"|"medium"|"high",`,
    `    "eventIntensity": "none"|"light"|"moderate"|"major",`,
    `    "sceneGoal": string,`,
    `    "emotionalTarget": { "increase": string[], "decrease": string[], "hold": string[] }`,
    `  },`,
    `  "contentPlan": { "mustInclude": string[], "mayInclude": string[], "mustNotInclude": string[] },`,
    `  "writingConstraints": { "length": "short"|"medium"|"long", "choices": "none"|"optional_2_to_3" }`,
    `}`,
    "",
    `注意：pacing 含义——hook=勾住玩家，hold=维持，escalate=升压，reveal_partial=部分揭示，resolve=收束，relief=降压，simplify=简化信息量。`
  ].filter(Boolean).join("\n");
}

/**
 * 构建 Story Writer 的输入包（完整叙事上下文 + Direction Packet）
 * Writer 需要：方向包 + 世界书 + 角色 + 场景 + 风格
 */
export function buildWriterPacket({ model, input, engineState, directionPacket, injectedWorldbook = [], knowledgeSnippets = [], knowledgeCards = [], cardContext = [], turnPrep = null, proximityData = null }) {
  // 方向包摘要
  const dp = directionPacket?.packet || directionPacket;
  const dd = dp?.directorDecision || {};
  const cp = dp?.contentPlan || {};
  const we = dp?.writingConstraints || {};
  const dpSummary = dp ? [
    `【Direction Packet — 本轮叙事方向】`,
    `pacing=${dd.pacing}  pressure=${dd.pressure}  intensity=${dd.eventIntensity}`,
    `sceneGoal: ${dd.sceneGoal || "—"}`,
    `mustInclude: ${(cp.mustInclude || []).join("; ") || "无"}`,
    `mustNotInclude: ${(cp.mustNotInclude || []).join("; ") || "无"}`,
    `length: ${we.length}  choices: ${we.choices}`,
  ].join("\n") : "";

  // 完整叙事上下文
  const state = normalizeEngineState(engineState);
  const identity = resolvePromptRuntimeIdentity({
    modeId: state.modeId || state.mode || "",
    dataMode: state.dataMode,
    worldSubType: state.worldSubType
  });
  const st = identity.promptModeId || state.worldSubType || "world-rpg";
  const isTabletop = st === "tabletop";
  const modules = state.activeModules.map((id) => MODULES.find((item) => item.id === id)).filter(Boolean).map((item) => `${item.id}:${item.name}`).join(", ");
  const worldbook = injectedWorldbook.length
    ? injectedWorldbook.map((item) => `- ${item.title}: ${item.content}`).join("\n")
    : "本轮无世界书条目命中。";
  const knowledge = renderKnowledgeCards(knowledgeCards, "rules");
  const context = moduleContext(model);

  return [
    `╔══════════════════════════════════════╗`,
    `║  World Tree Desktop · Story Writer   ║`,
    `╚══════════════════════════════════════╝`,
    "",
    ...buildModeHeader(st),
    "",
    "【写作规则】",
    ...buildWritingRules(st),
    "",
    "【⚠️ 人称规则 — 叙事和对话严格分开】",
    "叙事用第三人称（角色名/她），对话用第一人称「我」。「我」只出现在对话引号里。",
    "错误：我靠在护栏边。我转过头。「前辈。」",
    "正确：星南靠在护栏边。她转过头。「前辈。」",
    "注意：角色卡里可能写着「用我自称」，但这仅限对话。叙事描写绝对不能出现「我」——这是硬性规则，角色卡的写法不覆盖它。",
    "",
    dpSummary,
    "",
    `【世界书注入】`,
    worldbook,
    "",
    `【当前世界上下文】`,
    context,
    "",
    "【模块知识】",
    knowledge,
    "",
    "【输出协议】",
    "【叙事】  ← 用户可见的故事正文",
    "【状态建议】 ← YAML格式的状态变更",
    "【情绪反馈】 ← player: engagement=x, tension=x, fatigue=x, curiosity=x",
    ...(isTabletop ? ["【检定建议】 ← DM: 当判定需要时标注，别输出数字"] : []),
    "",
    turnPrep?.directorResult?.emotion?.formatted ? `【当前情绪】\n${turnPrep.directorResult.emotion.formatted}` : "",
    proximityData ? `【邻近环】\n${proximityData.summary}` : ""
  ].filter(Boolean).join("\n");
}

// 🆕 四模式隔离 — 统一返回模式专属的 prompt 头部
function buildModeHeader(st) {
  // st = prompt mode id or a legacy subtype.
  switch (st) {
    case "quick-setting":
      return ["【你的角色：快速设定协作器】", "你帮助用户整理最小可启动设定，只输出候选和缺口问题，不扩写成长篇正文。"];
    case "character":
      return ["【你的角色：Character Story Writer】", "你稳定演绎当前角色；叙事、动作和台词必须符合角色卡与情绪惯性。"];
    case "world-rpg":
      return [RPG_DM_INSTRUCTION, "", "【你的角色：大世界 RPG DM】", "你围绕主角邻近范围推进探索、角色反应和轻量事件。"];
    case "tabletop":
      return [TABLETOP_DM_INSTRUCTION, "", "【你的角色：TRPG 跑团 DM】", "你是跑团模式下的 DM。用法庭式的叙事和隐喻式的骰子判定驱动故事。"];
    case "rpg":
      return [RPG_DM_INSTRUCTION, "", "【你的角色：日式 RPG DM】", "你驱动一个章节递进、角色成长的日式 RPG 剧情叙事。"];
    case "strategy-sim":
    case "sim":
      return [SIM_DM_INSTRUCTION, "", "【你的角色：经营报告者】", "你以报告和事件驱动的方式叙述经营故事，展示决策后果。"];
    case "mystery-puzzle":
      return ["【你的角色：解谜调查主持人】", "你分级呈现线索、调查反馈和合理推测，绝不提前给出答案锁。"];
    case "murder-mystery":
      return [MURDER_MYSTERY_DM_INSTRUCTION, "", "【你的角色：剧本杀 DM】", "你是案件主持人，分发线索、扮演嫌疑人、管理调查流程。信息管制是第一原则。"];
    case "creation-forge":
      return ["【你的角色：炼金台候选生成器】", "你把素材整理为可审查候选，不声称已保存、已写入 canon 或已创建项目。"];
    default: // classic
      return ["【你的角色：Story Writer】", "你是故事叙述者。你不决定剧情大方向，你在 Direction Packet 的边界内写出沉浸、准确、完整、可继续互动的故事。"];
  }
}

function buildWritingRules(st) {
  const base = [
    "1. 完成 mustInclude 中的所有内容",
    "2. 绝不使用 mustNotInclude 中的内容",
    "3. 保持世界事实、角色设定、场景状态一致",
    "4. 回应玩家刚刚的行动",
    "5. 节奏符合 pacing 和 pressure",
    "6. 结尾留下自然可继续的行动点",
    "7. 输出格式：先用【叙事】输出正文，再用【状态建议】输出状态变化，再用【情绪反馈】输出情绪调整建议"
  ];
  switch (st) {
    case "tabletop":
      base.push("8. DM 主动提供场景入口——2-3 个可探索方向", "9. 失败不卡关——'是的，但是……'或'不，但是……'", "10. 必要时用【检定建议】标注 DC 和属性（不输出数字结果）");
      break;
    case "world-rpg":
    case "rpg":
      base.push("8. 用【任务更新】标记任务状态变化", "9. 战斗/完成目标→经验提示→【成长提示】标记", "10. 羁绊事件在合适时机自然触发");
      break;
    case "strategy-sim":
    case "sim":
      base.push("8. 每次回复推动时间前进（天数/周数/月数）", "9. 用【周期报告】呈现资源变化", "10. 决策节点给出 3-4 个选项，标注资源代价");
      break;
    case "murder-mystery":
      base.push("8. 信息管制——玩家不问不透露，线索不调查不揭示", "9. 扮演嫌疑人时以第一人称，凶手按预设定说谎", "10. 多人本→AI模拟其他角色发言，投票权归玩家一人");
      break;
  }
  return base;
}

/**
 * 构建 Guardian 的校验包
 * Guardian 需要：Direction Packet + Writer 输出 + 世界事实
 */
export function buildGuardianPacket({ directionPacket, narrative, moduleData, input }) {
  const dp = directionPacket?.packet || directionPacket;
  const cp = dp?.contentPlan || {};
  const we = dp?.writingConstraints || {};

  return [
    `【Guardian 校验指令】`,
    `校验以下叙事输出是否符合 Direction Packet。不润色、不创作，只输出 JSON。`,
    "",
    `【mustInclude】`,
    ...(cp.mustInclude || []).map((m, i) => `${i + 1}. ${m}`),
    "",
    `【mustNotInclude】`,
    ...(cp.mustNotInclude || []).map((m, i) => `${i + 1}. ${m}`),
    "",
    `【约束】`,
    `长度: ${we.length || "medium"}`,
    `选择: ${we.choices || "none"}`,
    `视角: ${we.perspective || "third_person"}`,
    "",
    `【玩家输入】${input || ""}`,
    "",
    `【Writer 输出】`,
    narrative || "",
    "",
    `【校验项】`,
    `1. mustInclude 是否全部出现？`,
    `2. mustNotInclude 是否泄露？`,
    `3. 是否回应了玩家输入？`,
    `4. 是否违反角色设定或世界规则？`,
    `5. 是否引入未授权新设定？`,
    `6. 是否保留玩家行动空间？`,
    `7. 是否符合指定长度/视角/风格？`,
    "",
    `输出 JSON 格式：`,
    `{ "pass": boolean, "severity": "none"|"minor"|"major"|"critical", "issues": string[], "revisionInstructions": string[] }`
  ].filter(Boolean).join("\n");
}
