// ===== 叙事导演模式 v1 =====
// 7种导演模式配置——不只是 prompt，而是影响检索/注入/格式/风控/事件的全套策略。
// 与 storytellers.js 的关系：导演模式控制结构性策略，叙事者风格控制调度参数。
// 冲突时导演模式优先。

// ═══════════════════════════════════════════════════════════════
//  模式定义
// ═══════════════════════════════════════════════════════════════

export const DIRECTOR_MODES = {

  // ── 轻小说 ──
  light_novel: {
    id: "light_novel",
    name: "轻小说",
    description: "角色互动优先，轻松氛围，适度幽默。适合角色卡和日常故事。",
    icon: "📖",

    // 上下文检索策略
    contextStrategy: {
      relationWeight: 0.9,       // 关系信息最高权重
      ruleWeight: 0.2,           // 不强调规则
      conflictWeight: 0.2,       // 降低冲突权重
      worldStateWeight: 0.4,
      memoryWeight: 0.6,        // 重视角色记忆
      maxWorldbookEntries: 3,
      maxIndexerClusters: 3,
      preferRecentMemory: true
    },

    // Prompt 模板
    promptTemplate: {
      systemPrefix: "你是轻小说风格的叙事者。你关注角色间的互动与情感流动，以温暖细腻的笔触描绘日常。",
      outputFormat: "自然段落，角色对话用「」包裹。不出现元层标记。",
      forbiddenPatterns: ["[旁白]", "[系统]", "★提案", "[状态]"],
      toneHints: ["轻松明快", "角色对话为主", "适度幽默", "不过度描写暴力"],
      detailLevel: "standard"
    },

    // 风险控制
    riskControl: {
      maxPressurePerScene: 0.4,
      minRestWindow: 4,
      forbidCharacterDeath: true,
      forbidWorldDestruction: true,
      autoResolveConflict: true,
      maxConflictIntensity: "暗流"
    },

    // 事件策略
    eventStrategy: {
      preferredTypes: ["relation", "slice_of_life", "humor", "emotional"],
      avoidedTypes: ["catastrophe", "war", "death", "betrayal"],
      eventFrequency: 0.25,
      maxEventIntensity: "light",
      randomEventMode: "low"
    },

    compatibleStorytellers: ["gentle", "intimate"]
  },

  // ── 跑团 DM ──
  tabletop_dm: {
    id: "tabletop_dm",
    name: "跑团 DM",
    description: "TRPG 风格——法庭式叙事，隐喻式骰子判定，场景入口和选择分支。",
    icon: "🎲",

    contextStrategy: {
      relationWeight: 0.5,
      ruleWeight: 0.9,          // 规则最重要
      conflictWeight: 0.6,
      worldStateWeight: 0.7,
      memoryWeight: 0.4,
      maxWorldbookEntries: 5,
      maxIndexerClusters: 5,
      preferRecentMemory: false
    },

    promptTemplate: {
      systemPrefix: "你是 TRPG 风格的 DM。用法庭式的叙事和隐喻式的骰子判定驱动故事。",
      outputFormat: "【场景】当前环境描述\n【行动】2-3个可探索方向\n【检定】当需要时标注DC和属性（不输出数字结果）",
      forbiddenPatterns: [],
      toneHints: ["客观描述", "法庭式陈述", "营造探索感", "失败不卡关——'是的但是…'"],
      detailLevel: "full"
    },

    riskControl: {
      maxPressurePerScene: 0.7,
      minRestWindow: 2,
      forbidCharacterDeath: false,
      forbidWorldDestruction: true,
      autoResolveConflict: false,
      maxConflictIntensity: "爆发"
    },

    eventStrategy: {
      preferredTypes: ["exploration", "encounter", "puzzle", "social"],
      avoidedTypes: [],
      eventFrequency: 0.5,
      maxEventIntensity: "moderate",
      randomEventMode: "moderate"
    },

    compatibleStorytellers: ["classic", "adventure"]
  },

  // ── 黑暗奇幻 ──
  dark_fantasy: {
    id: "dark_fantasy",
    name: "黑暗奇幻",
    description: "高压生存叙事——资源稀缺、安全窗口短、选择有代价。适合末日和黑暗世界观。",
    icon: "🌑",

    contextStrategy: {
      relationWeight: 0.4,
      ruleWeight: 0.7,
      conflictWeight: 0.9,      // 冲突权重最高
      worldStateWeight: 0.6,
      memoryWeight: 0.3,
      maxWorldbookEntries: 4,
      maxIndexerClusters: 4,
      preferRecentMemory: false
    },

    promptTemplate: {
      systemPrefix: "你是黑暗奇幻风格的叙事者。世界残酷而无情，每一个选择都有代价，希望是稀缺品。",
      outputFormat: "氛围描写优先，细节冷峻克制。对话简洁有力，不过度修饰。",
      forbiddenPatterns: ["轻松", "搞笑", "萌", "可爱"],
      toneHints: ["冷峻克制", "代价感", "氛围沉重", "不做道德说教"],
      detailLevel: "full"
    },

    riskControl: {
      maxPressurePerScene: 0.9,
      minRestWindow: 1,
      forbidCharacterDeath: false,
      forbidWorldDestruction: false,
      autoResolveConflict: false,
      maxConflictIntensity: "爆发"
    },

    eventStrategy: {
      preferredTypes: ["danger", "moral_choice", "resource_crisis", "betrayal"],
      avoidedTypes: ["slice_of_life", "humor", "wholesome"],
      eventFrequency: 0.7,
      maxEventIntensity: "major",
      randomEventMode: "high"
    },

    compatibleStorytellers: ["cruel", "chaos"]
  },

  // ── 治愈日常 ──
  healing_daily: {
    id: "healing_daily",
    name: "治愈日常",
    description: "低压陪伴——温暖细腻，很少危机，重视情绪回声和角色关系。适合治愈和日常故事。",
    icon: "🌸",

    contextStrategy: {
      relationWeight: 0.9,
      ruleWeight: 0.1,
      conflictWeight: 0.1,      // 几乎不注入冲突
      worldStateWeight: 0.3,
      memoryWeight: 0.7,
      maxWorldbookEntries: 2,
      maxIndexerClusters: 2,
      preferRecentMemory: true
    },

    promptTemplate: {
      systemPrefix: "你是治愈日常风格的叙事者。以温暖细腻的笔触描绘平凡的幸福，关注角色间的情感联结。",
      outputFormat: "温暖细腻的自然段落。角色对话自然流畅，注重微小的情感变化。",
      forbiddenPatterns: ["暴力", "死亡", "背叛", "灾难", "绝望", "[旁白]", "[系统]"],
      toneHints: ["温暖细腻", "情感共鸣", "微小幸福", "宁静安全感"],
      detailLevel: "compact"
    },

    riskControl: {
      maxPressurePerScene: 0.2,
      minRestWindow: 6,
      forbidCharacterDeath: true,
      forbidWorldDestruction: true,
      autoResolveConflict: true,
      maxConflictIntensity: "潜伏"
    },

    eventStrategy: {
      preferredTypes: ["slice_of_life", "emotional", "wholesome", "seasonal"],
      avoidedTypes: ["catastrophe", "war", "death", "betrayal", "danger", "horror"],
      eventFrequency: 0.15,
      maxEventIntensity: "light",
      randomEventMode: "off"
    },

    compatibleStorytellers: ["gentle"]
  },

  // ── 悬疑调查 ──
  mystery: {
    id: "mystery",
    name: "悬疑调查",
    description: "线索驱动——信息管制、细节留白、推理导向。适合侦探和调查类故事。",
    icon: "🔍",

    contextStrategy: {
      relationWeight: 0.3,
      ruleWeight: 0.5,
      conflictWeight: 0.4,
      worldStateWeight: 0.8,     // 线索和状态最重要
      memoryWeight: 0.6,
      maxWorldbookEntries: 5,
      maxIndexerClusters: 6,
      preferRecentMemory: false
    },

    promptTemplate: {
      systemPrefix: "你是悬疑调查风格的叙事者。信息是所有物——你控制揭示的节奏，每一处细节都可能是线索。",
      outputFormat: "细节描写+留白。不主动解释谜底，让线索自然浮现。对话中暗藏信息。",
      forbiddenPatterns: ["显然", "众所周知", "毫无疑问"],
      toneHints: ["克制含蓄", "细节留白", "信息管制", "气氛营造"],
      detailLevel: "full"
    },

    riskControl: {
      maxPressurePerScene: 0.6,
      minRestWindow: 2,
      forbidCharacterDeath: false,
      forbidWorldDestruction: true,
      autoResolveConflict: false,
      maxConflictIntensity: "暗流"
    },

    eventStrategy: {
      preferredTypes: ["clue", "revelation", "suspicion", "red_herring"],
      avoidedTypes: ["random_fight", "natural_disaster"],
      eventFrequency: 0.4,
      maxEventIntensity: "moderate",
      randomEventMode: "low"
    },

    compatibleStorytellers: ["mystery", "classic"]
  },

  // ── 战争史诗 ──
  war_epic: {
    id: "war_epic",
    name: "战争史诗",
    description: "宏大叙事——阵营博弈、战力体系、大规模冲突。适合战争和政治题材。",
    icon: "⚔️",

    contextStrategy: {
      relationWeight: 0.5,
      ruleWeight: 0.8,          // 战力和规则重要
      conflictWeight: 0.8,
      worldStateWeight: 0.7,
      memoryWeight: 0.3,
      maxWorldbookEntries: 6,
      maxIndexerClusters: 6,
      preferRecentMemory: false
    },

    promptTemplate: {
      systemPrefix: "你是战争史诗风格的叙事者。以宏大笔触描绘阵营博弈与战争图景，个体命运在历史洪流中沉浮。",
      outputFormat: "宏大叙事段落。阵营动态、战局变化、势力消长。角色对话展现立场和信念。",
      forbiddenPatterns: [],
      toneHints: ["宏大叙事", "阵营视角", "战力体系", "历史厚重感"],
      detailLevel: "full"
    },

    riskControl: {
      maxPressurePerScene: 0.8,
      minRestWindow: 2,
      forbidCharacterDeath: false,
      forbidWorldDestruction: false,
      autoResolveConflict: false,
      maxConflictIntensity: "爆发"
    },

    eventStrategy: {
      preferredTypes: ["battle", "political", "alliance", "betrayal", "siege"],
      avoidedTypes: ["slice_of_life", "humor"],
      eventFrequency: 0.6,
      maxEventIntensity: "major",
      randomEventMode: "high"
    },

    compatibleStorytellers: ["epic", "cruel"]
  },

  // ── 沙盒模拟 ──
  sandbox: {
    id: "sandbox",
    name: "沙盒模拟",
    description: "开放世界——全量均衡检索，无约束事件生成，自由格式输出。适合无预设目标的探索。",
    icon: "🏜️",

    contextStrategy: {
      relationWeight: 0.5,
      ruleWeight: 0.5,
      conflictWeight: 0.5,
      worldStateWeight: 0.5,
      memoryWeight: 0.5,
      maxWorldbookEntries: 10,
      maxIndexerClusters: 10,
      preferRecentMemory: false
    },

    promptTemplate: {
      systemPrefix: "你是开放世界沙盒的叙事者。世界在自然运转，你如实呈现事件的因果与连锁反应。",
      outputFormat: "自由格式。世界事件自然发生，不做叙事引导，不预设发展方向。",
      forbiddenPatterns: [],
      toneHints: ["自由开放", "事件驱动", "因果链", "不引导不预设"],
      detailLevel: "full"
    },

    riskControl: {
      maxPressurePerScene: 1.0,
      minRestWindow: 0,
      forbidCharacterDeath: false,
      forbidWorldDestruction: false,
      autoResolveConflict: false,
      maxConflictIntensity: "爆发"
    },

    eventStrategy: {
      preferredTypes: [],
      avoidedTypes: [],
      eventFrequency: 0.5,
      maxEventIntensity: "major",
      randomEventMode: "high"
    },

    compatibleStorytellers: ["classic", "chaos", "adventure"]
  }
};

// ═══════════════════════════════════════════════════════════════
//  查询 API
// ═══════════════════════════════════════════════════════════════

export function getDirectorMode(modeId) {
  return DIRECTOR_MODES[modeId] || DIRECTOR_MODES.light_novel;
}

export function listDirectorModes() {
  return Object.values(DIRECTOR_MODES).map(m => ({
    id: m.id, name: m.name, description: m.description, icon: m.icon
  }));
}

/**
 * 合并导演模式配置和上下文引擎模式策略
 * 导演模式 > context-engine 默认策略
 */
export function applyDirectorModeToContext(directorModeId, baseStrategy) {
  const mode = getDirectorMode(directorModeId);
  const cs = mode.contextStrategy;
  return {
    ...baseStrategy,
    detail: cs.detailLevel || baseStrategy.detail || "standard",
    maxTokens: (cs.maxWorldbookEntries || 5) * 400,
    includeRelations: cs.relationWeight > 0.3,
    includeTimeline: cs.ruleWeight > 0.3,
    includeCharacterMemory: cs.memoryWeight > 0.3
  };
}

/**
 * 生成导演模式的 LLM prompt 注入块
 */
export function directorModePromptBlock(modeId) {
  const mode = getDirectorMode(modeId);
  const pt = mode.promptTemplate;
  const rc = mode.riskControl;

  return [
    `【导演模式: ${mode.name}】`,
    pt.systemPrefix,
    "",
    "【风险控制】",
    `  禁止角色死亡: ${rc.forbidCharacterDeath ? "是" : "否"}`,
    `  最大冲突强度: ${rc.maxConflictIntensity}`,
    `  自动化解冲突: ${rc.autoResolveConflict ? "是" : "否"}`,
    pt.toneHints.length ? `【语调提示】${pt.toneHints.join("，")}` : "",
    pt.forbiddenPatterns.length ? `【禁止】${pt.forbiddenPatterns.join("，")}` : "",
    `【输出格式】${pt.outputFormat}`
  ].filter(Boolean).join("\n");
}

/**
 * 根据导演模式过滤事件
 */
export function filterEventsByMode(modeId, events = []) {
  const mode = getDirectorMode(modeId);
  const es = mode.eventStrategy;
  if (!es.preferredTypes.length && !es.avoidedTypes.length) return events;

  return events.filter(e => {
    const type = e.type || e.eventType || "";
    if (es.avoidedTypes.includes(type)) return false;
    if (es.preferredTypes.length && !es.preferredTypes.includes(type)) {
      // 非优先类型降权但不排除
      e._weightFactor = (e._weightFactor || 1) * 0.5;
    }
    if (e.intensity === "major" && es.maxEventIntensity === "light") return false;
    if (e.intensity === "moderate" && es.maxEventIntensity === "light") return false;
    return true;
  });
}

/**
 * 检查导演模式是否允许某操作
 */
export function isActionAllowed(modeId, action) {
  const mode = getDirectorMode(modeId);
  const rc = mode.riskControl;
  if (action === "character_death" && rc.forbidCharacterDeath) return false;
  if (action === "world_destruction" && rc.forbidWorldDestruction) return false;
  return true;
}

/**
 * 获取模式的疲劳保护阈值
 */
export function getFatigueThreshold(modeId) {
  const mode = getDirectorMode(modeId);
  return mode.riskControl?.maxPressurePerScene ?? 0.5;
}
