// ===== M-创作 · 全模块适配创作向导 =====
// 覆盖 M1-M19 全部模块的创建前精确确定需求。
// 分为硬性前置(必须确定)和模糊可延后(初值即可，运行时细化)。
// 关键决策通过 UI 交互与用户确认。

// ---- 创作优先级分类 ----
export const CREATION_PRIORITY = {
  HARD: "hard",       // 硬性前置：游戏开始前必须精确确定
  SOFT: "soft",       // 模糊可延后：初值即可，运行时逐步细化
  OPTIONAL: "optional" // 可选：可完全跳过
};

// ---- 全模块创作需求映射 ----
export const MODULE_CREATION_REQUIREMENTS = {
  M1: {
    name: "世界书隔离容器",
    priority: CREATION_PRIORITY.HARD,
    fields: [
      { key: "moduleName", label: "模组名称", type: "text", required: true, hint: "为你的世界取一个名字" },
      { key: "moduleType", label: "世界类型", type: "select", options: ["epic","scifi","wuxia","urban","campus","daily"], required: true, hint: "这决定了哪些模块默认激活" }
    ]
  },
  M2: {
    name: "触发式条目系统",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "coreEntries", label: "核心世界书条目", type: "list", required: false, hint: "至少定义3-5条核心设定（魔法体系/地理概况/主要势力/历史背景）", defaultCount: 5 },
      { key: "entryDetailLevel", label: "条目详细程度", type: "select", options: ["简略(1-2句)","适中(1段)","详细(多段)"], required: false }
    ]
  },
  M3: {
    name: "动态世界状态",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "initialVariables", label: "初始世界状态变量", type: "keyValue", required: false, hint: "例如：天气=晴, 季节=春, 局势=和平。可模糊，后续叙事中精确化" },
      { key: "trackedVariables", label: "需要追踪的状态", type: "checklist", options: ["天气","季节","政治局势","经济","民心","魔法浓度","科技水平"], required: false }
    ]
  },
  M4: {
    name: "组织实体",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "mainFactions", label: "主要势力/组织", type: "list", required: false, hint: "列出世界中的主要组织（王国/公会/教团/商会/学校等），每项含名称+简述" },
      { key: "factionRelations", label: "势力关系", type: "matrix", required: false, hint: "各势力之间的友好/中立/敌对关系" }
    ]
  },
  M8: {
    name: "角色预设系统",
    priority: CREATION_PRIORITY.HARD,
    fields: [
      { key: "protagonist", label: "主角", type: "characterCard", required: true, hint: "至少创建主角。需姓名/年龄/性别/外表。更重要的是以下动态人格和关系设计。" },
      { key: "protagonistLayers", label: "主角人格分层", type: "personalityLayers", required: true, hint: "表层人格(日常展现) vs 里层人格(隐藏的真实)。什么触发暴露？玩家哪些行为可以融化/恶化？不能是固定的——玩家选择应能改变角色。" },
      { key: "keyNPCs", label: "关键NPC", type: "characterList", required: false, hint: "2-5个关键NPC。每人除基本信息外，需包含：与主角的关系(类型/亲密度/动态)、人格分层、穿衣风格/武器/随身物品" },
      { key: "npcEndings", label: "NPC命运走向", type: "note", required: false, hint: "⚠️ NPC的结局不能预设固定。每个NPC标注其命运的影响因素：玩家哪些选择会改变TA的走向？可能的分支结局有哪些(不是确定的，而是可能的方向)。" },
      { key: "characterRelationships", label: "角色关系网", type: "relationGraph", required: false, hint: "不仅组织中有关系，角色之间也存在独立的关系网络。标注：谁与谁是朋友/对手/暗恋/师徒/世仇？这些关系不是静态的——受玩家行为影响。" },
      { key: "personalEffects", label: "随身物品与风格", type: "personalEffects", required: false, hint: "每个重要角色的穿衣风格(日常/战斗/正式场合)、武器或随身工具、标志性物品及其来历故事。替代原来的'小物件'概念——扩展为完整的外在形象。" }
    ]
  },
  M9: {
    name: "角色认知层",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "initialKnowledge", label: "角色初始认知", type: "perCharacter", required: false, hint: "每个角色知道什么、不知道什么。可模糊：'艾琳知道兄长失踪，但不知道原因'" },
      { key: "collectiveKnowledge", label: "世界常识", type: "text", required: false, hint: "这个世界里所有人都知道的事（例如：'魔法存在但普通人无法使用'）" },
      { key: "secrets", label: "核心秘密", type: "perCharacter", required: false, hint: "每个角色隐藏的秘密。这些是剧情驱动力，可先模糊后揭示" }
    ]
  },
  M10: {
    name: "种族维度",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "availableRaces", label: "可用种族", type: "list", required: false, hint: "列出世界中的智慧种族（人类/精灵/矮人等），每项含名称+简述+主要领地" },
      { key: "raceRelations", label: "种族关系基调", type: "select", options: ["和谐共存","局部冲突","全面对立","隔离不往来"], required: false }
    ]
  },
  M11: {
    name: "场景会话管理",
    priority: CREATION_PRIORITY.HARD,
    fields: [
      { key: "openingScene", label: "起始场景", type: "scene", required: true, hint: "故事从哪里开始？地点/时间/氛围/主角初始处境" },
      { key: "scenePool", label: "常用场景池", type: "list", required: false, hint: "列出3-8个可能频繁出现的场景地点（酒馆/学校/基地/飞船等）" }
    ]
  },
  M12: {
    name: "故事模板",
    priority: CREATION_PRIORITY.HARD,
    fields: [
      { key: "storyType", label: "故事类型", type: "select", options: ["史诗","冒险","悬疑","日常","爱情","成长","复仇","群像","科幻","武侠"], required: true },
      { key: "length", label: "篇幅倾向", type: "select", options: ["短篇","中篇","长篇"], required: true },
      { key: "stylePreset", label: "风格预设", type: "select", options: ["normal","cinematic","literary","light","tense","horror","adventure"], required: true },
      { key: "protagonistMotivation", label: "主角驱动力", type: "text", required: true, hint: "主角要做什么？为什么？什么在阻碍？失败了会怎样？" },
      { key: "coreConflict", label: "核心冲突", type: "text", required: true, hint: "故事的主要矛盾是什么" },
      { key: "endingPhilosophy", label: "结局架构原则", type: "note", required: false, hint: "⚠️ 关键原则：角色(尤其是受主角影响的人)的结局不能预设固定。一个好的故事结局应该由玩家的选择和行为自然导出。标注：哪些NPC的命运与玩家选择强相关？哪些大事件的结果是开放性的？世界格局可以预设，但个体命运应交由玩家塑造。" }
    ]
  },
  M13: {
    name: "叙事引擎五层",
    priority: CREATION_PRIORITY.OPTIONAL,
    fields: [
      { key: "activeLayers", label: "激活的叙事层", type: "checklist", options: ["角色层","环境层","剧情层","语气层","记忆层"], required: false, defaultValues: ["角色层","环境层","剧情层","语气层","记忆层"] }
    ]
  },
  M15: {
    name: "世界规则",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "physicsRules", label: "物理规则", type: "text", required: false, hint: "与现实世界不同的物理法则（例如：'魔法可以违反能量守恒''存在平行空间'）" },
      { key: "magicRules", label: "魔法/超能力规则", type: "text", required: false, hint: "如果有魔法，它怎么运作？代价是什么？限制是什么？" },
      { key: "socialRules", label: "社会规则", type: "text", required: false, hint: "这个世界的法律/道德/禁忌（例如：'贵族拥有豁免权''血亲复仇合法'）" },
      { key: "ruleStrictness", label: "规则严格度", type: "select", options: ["铁律","严格","正常","宽松","关闭"], required: false }
    ]
  },
  M16: {
    name: "时间模块",
    priority: CREATION_PRIORITY.SOFT,
    fields: [
      { key: "startingTime", label: "起始时间", type: "text", required: false, hint: "故事开始的时间点（例如：'帝国历127年·深秋'）" },
      { key: "calendar", label: "历法/时间制度", type: "text", required: false, hint: "如果有特殊历法（例如：'一年8个月，每月45天'），在此说明" },
      { key: "eraEvents", label: "时代背景事件", type: "list", required: false, hint: "故事开始前的重要历史事件（1-3条），影响当前世界格局" }
    ]
  },
  M17: {
    name: "随机性模块",
    priority: CREATION_PRIORITY.OPTIONAL,
    fields: [
      { key: "eventPoolPopulation", label: "随机事件池填充", type: "select", options: ["留空(手动填充)","自动生成(按世界类型)","混合(自动+手动)"], required: false, hint: "随机事件可以在游戏中逐步添加" },
      { key: "eventFrequency", label: "事件触发频率", type: "select", options: ["低频(每5-8轮)","中频(每3-5轮)","高频(每1-3轮)"], required: false }
    ]
  },
  M19: {
    name: "角色卡驱动模式",
    priority: CREATION_PRIORITY.OPTIONAL,
    fields: [
      { key: "enableCardMode", label: "是否启用角色卡模式", type: "boolean", required: false, hint: "如果这是角色卡驱动（而非世界书驱动），选择角色卡模式。此时大部分模块会自动关闭或轻量化。" }
    ]
  }
};

// ---- 创作阶段 ----
export const CREATION_PHASES = [
  { id: "foundation", label: "地基", modules: ["M1","M12","M16"], description: "确定世界的基本框架：名称/类型/故事方向/时间背景" },
  { id: "characters", label: "角色", modules: ["M8","M9","M19"], description: "创建主角和关键NPC，确定角色认知边界" },
  { id: "world", label: "世界", modules: ["M2","M3","M10","M4"], description: "构建世界设定：世界书条目/状态变量/种族/组织" },
  { id: "rules", label: "规则", modules: ["M15","M13"], description: "设定世界运行的规则：物理/魔法/社会/叙事层" },
  { id: "scene", label: "开场", modules: ["M11"], description: "设计起始场景和常用场景池" },
  { id: "events", label: "事件", modules: ["M17"], description: "配置随机事件（可后续填充）" }
];

// ---- 生成用户确认问题 ----
export function generateCreationQuestions(selectedPhases = null, answers = {}) {
  const phases = selectedPhases || CREATION_PHASES.map(p => p.id);
  const questions = [];

  for (const phase of CREATION_PHASES) {
    if (!phases.includes(phase.id)) continue;
    
    const phaseQuestions = [];
    for (const moduleId of phase.modules) {
      const req = MODULE_CREATION_REQUIREMENTS[moduleId];
      if (!req) continue;
      
      for (const field of req.fields) {
        // 跳过已回答的
        const answerKey = `${moduleId}.${field.key}`;
        if (answers[answerKey] !== undefined) continue;
        
        // 跳过非必需的（用户可选择跳过）
        const question = {
          id: answerKey,
          module: moduleId,
          moduleName: req.name,
          priority: req.priority,
          phase: phase.id,
          field: field.key,
          label: field.label,
          type: field.type,
          options: field.options || null,
          hint: field.hint || "",
          required: field.required || false,
          defaultValues: field.defaultValues || null,
          defaultCount: field.defaultCount || null
        };
        
        if (req.priority === CREATION_PRIORITY.HARD) {
          phaseQuestions.unshift(question); // 硬性前置排最前
        } else {
          phaseQuestions.push(question);
        }
      }
    }
    
    if (phaseQuestions.length > 0) {
      questions.push({
        phase: phase.id,
        phaseLabel: phase.label,
        phaseDescription: phase.description,
        questions: phaseQuestions
      });
    }
  }
  
  return questions;
}

// ---- 生成创作摘要（用于最终确认） ----
export function generateCreationSummary(answers = {}) {
  const summary = [];
  
  for (const phase of CREATION_PHASES) {
    const phaseItems = [];
    for (const moduleId of phase.modules) {
      const req = MODULE_CREATION_REQUIREMENTS[moduleId];
      if (!req) continue;
      
      const moduleItems = [];
      for (const field of req.fields) {
        const key = `${moduleId}.${field.key}`;
        const value = answers[key];
        if (value !== undefined && value !== null && value !== "") {
          const label = field.label;
          const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
          moduleItems.push({ label, value: displayValue.length > 80 ? displayValue.slice(0,80)+"…" : displayValue });
        }
      }
      if (moduleItems.length > 0) {
        phaseItems.push({ module: `${moduleId} ${req.name}`, items: moduleItems });
      }
    }
    if (phaseItems.length > 0) {
      summary.push({ phase: phase.label, modules: phaseItems });
    }
  }
  
  return summary;
}

// ---- 获取模块间的依赖建议 ----
export function getCrossModuleSuggestions(answers = {}) {
  const suggestions = [];
  
  // 如果选了M10的种族但没有M2的种族条目
  if (answers["M10.availableRaces"] && !answers["M2.coreEntries"]?.toLowerCase()?.includes("种族")) {
    suggestions.push({
      type: "warning",
      message: "你定义了可用种族，但世界书条目中尚未包含种族相关设定。建议添加一条关于种族的触发条目。"
    });
  }
  
  // 如果选了M15规则但没有M2的规则条目
  if (answers["M15.physicsRules"] || answers["M15.magicRules"]) {
    if (!answers["M2.coreEntries"]?.toLowerCase()?.includes("规则") && !answers["M2.coreEntries"]?.toLowerCase()?.includes("法则")) {
      suggestions.push({
        type: "warning", 
        message: "你定义了世界规则，但世界书条目中尚未包含规则相关触发条目。建议添加，让LLM在叙事中能自动引用。"
      });
    }
  }
  
  // 如果选了M9认知但没有M8的角色
  if (answers["M9.initialKnowledge"] && !answers["M8.protagonist"]) {
    suggestions.push({
      type: "error",
      message: "你定义了角色认知，但尚未创建任何角色。请先完成「角色」阶段。"
    });
  }
  
  // M16时间与M11场景的关联
  if (answers["M16.startingTime"] && !answers["M11.openingScene"]) {
    suggestions.push({
      type: "info",
      message: "你已设定起始时间，建议在「开场」阶段将时间信息融入起始场景描述。"
    });
  }
  
  return suggestions;
}

// ---- 默认答案（快速开始） ----
export function quickStartDefaults(worldType = "daily") {
  const defaults = {
    "M1.moduleType": worldType,
    "M12.storyType": worldType === "epic" ? "史诗" : worldType === "scifi" ? "科幻" : worldType === "wuxia" ? "武侠" : "日常",
    "M12.length": "中篇",
    "M12.stylePreset": worldType === "epic" ? "epic" : worldType === "horror" ? "tense" : "normal",
    "M12.activeLayers": ["角色层","环境层","剧情层","语气层","记忆层"],
    "M15.ruleStrictness": "正常",
    "M17.eventFrequency": "中频",
    "M17.eventPoolPopulation": "自动生成",
  };
  return defaults;
}
