// ===== M12 故事模板 — 完整预设系统 =====
// v12.19: 从世界书skill移植。双层架构：世界书(舞台设定) + 预设(故事模板)。
// 同一世界书可挂多个预设，类似同一舞台上的不同剧本。

export const STYLE_PRESETS = {
  normal: "清晰、沉浸、节奏稳定",
  cinematic: "镜头感强、动作与环境细节突出",
  literary: "文学性更强，注重意象、心理和韵律",
  light: "轻松、简洁、互动优先",
  tense: "紧凑、快节奏、压力感",
  horror: "暗黑、悬疑、压抑氛围"
};

// ---- 种子预设模板 ----
export const SEED_PRESETS = {
  normal: {
    storyType: "通用",
    length: "中篇",
    pace: "中性",
    descriptionDensity: "适中",
    dialogueRatio: "中",
    perspective: "第三人称限知",
    moodBase: "中性",
    humorLevel: 2
  },
  epic: {
    storyType: "史诗",
    length: "长篇",
    pace: "慢",
    descriptionDensity: "高",
    dialogueRatio: "中",
    perspective: "第三人称全知",
    moodBase: "史诗",
    humorLevel: 1
  },
  tense: {
    storyType: "悬疑/惊悚",
    length: "中篇",
    pace: "快",
    descriptionDensity: "精炼",
    dialogueRatio: "高",
    perspective: "第一人称或第三人称限知",
    moodBase: "紧张",
    humorLevel: 0
  },
  cozy: {
    storyType: "日常/治愈",
    length: "短篇",
    pace: "慢",
    descriptionDensity: "细腻",
    dialogueRatio: "高",
    perspective: "第一人称",
    moodBase: "温暖",
    humorLevel: 3
  },
  horror: {
    storyType: "悬疑/恐怖",
    length: "中篇",
    pace: "慢→加速",
    descriptionDensity: "高",
    dialogueRatio: "低",
    perspective: "第三人称限知",
    moodBase: "暗黑",
    humorLevel: 0
  },
  adventure: {
    storyType: "冒险",
    length: "中长篇",
    pace: "中",
    descriptionDensity: "适中",
    dialogueRatio: "中",
    perspective: "第三人称限知",
    moodBase: "激昂",
    humorLevel: 2
  }
};

// ---- 智能补全优先级链 ----
export function suggestCompletion(preset = {}, worldbookData = {}) {
  const suggestions = [];

  // 主角未指定 → 从世界书角色库找
  if (!preset.protagonist) {
    const candidates = (worldbookData.characters || []).filter((c) => c.playable || c.role === "protagonist" || !c.role);
    if (candidates.length) {
      suggestions.push({
        field: "protagonist",
        candidates: candidates.slice(0, 3).map((c) => c.name || c.id),
        source: "worldbook-character-pool"
      });
    }
  }

  // 驱动力缺失 → 从世界冲突推理
  if (!preset.motivation) {
    const conflicts = worldbookData.conflicts || [];
    if (conflicts.length) {
      suggestions.push({
        field: "motivation",
        candidates: conflicts.slice(0, 2).map((c) => c.name || c.description?.slice(0, 40)),
        source: "worldbook-conflicts"
      });
    }
  }

  // 开头场景 → 从世界书地理推断
  if (!preset.openingScene?.location) {
    const locations = worldbookData.locations || worldbookData.regions || [];
    if (locations.length) {
      suggestions.push({
        field: "openingScene.location",
        candidates: locations.slice(0, 3).map((l) => l.name || l),
        source: "worldbook-geography"
      });
    }
  }

  return suggestions;
}

// ---- 预设构建器 ----
export function buildPreset(seedName = "normal", overrides = {}) {
  const base = SEED_PRESETS[seedName] || SEED_PRESETS.normal;
  return {
    _meta: {
      name: overrides.name || seedName,
      worldbook: overrides.worldbook || "",
      createdAt: new Date().toISOString(),
      active: true
    },
    style: { ...base, ...(overrides.style || {}) },
    protagonist: overrides.protagonist || null,
    motivation: {
      goal: overrides.goal || "",
      motive: overrides.motive || "",
      conflict: overrides.conflict || "",
      stakes: overrides.stakes || ""
    },
    supporting: {
      keyNPCs: overrides.keyNPCs || [],
      organization: overrides.organization || null,
      region: overrides.region || "",
      items: overrides.items || []
    },
    openingScene: {
      location: overrides.openingLocation || "",
      time: overrides.openingTime || "",
      mood: overrides.openingMood || "",
      situation: overrides.openingSituation || "",
      hook: overrides.openingHook || ""
    }
  };
}

// ---- 风格指令 ----
export function styleInstruction(preset = "normal") {
  if (typeof preset === "object" && preset.style) {
    const s = preset.style;
    return [
      `故事类型: ${s.storyType || "通用"}`,
      `节奏: ${s.pace || "中性"}`,
      `描写密度: ${s.descriptionDensity || "适中"}`,
      `对话比例: ${s.dialogueRatio || "中"}`,
      `视角: ${s.perspective || "第三人称限知"}`,
      `氛围基调: ${s.moodBase || "中性"}`
    ].join(" / ");
  }
  return STYLE_PRESETS[preset] || STYLE_PRESETS.normal;
}

// ---- 技术卡系统 (v2.2 更新) ----
// 创作工具箱的 10 张技术卡。每张 = 创作维度的结构指南。
// v2.2: 人物锚点→动态人格分层, 小物件→随身物品与风格, 结局架构→开放结局

export const TECH_CARDS = {
  // ===== 原8卡（已按新设计原则更新）=====
  dynamicPersonality: {
    id: "dynamicPersonality",
    name: "动态人格分层",
    replaces: "人物锚点",
    category: "角色",
    summary: "角色不是固定标签，而是可切换的层次结构。表层人格(日常对外)、里层人格(隐藏真实)、触发条件(什么情境切换)、玩家影响(什么行为融化/恶化)。",
    checklist: [
      "每个重要角色标注表层和里层人格",
      "表层→里层的切换触发条件是否明确？",
      "玩家哪些行为可以融化角色的防御？",
      "哪些行为可能让角色更封闭？",
      "情感转变是否有渐进过程而非突然跳变？"
    ],
    antiPattern: "角色只有一个性格标签(如「傲娇」)。角色性格不随剧情发展变化。"
  },
  openEnding: {
    id: "openEnding",
    name: "开放结局设计",
    replaces: "结局架构",
    category: "结构",
    summary: "NPC的命运不能预设固定结局。标注每个角色受玩家哪些选择影响、可能的分支方向。世界格局可预设，个体命运交由玩家塑造。",
    checklist: [
      "每个关键NPC标注其命运的影响因素",
      "列出2-4个可能的命运方向(非固定结局)",
      "哪些大事件的结果是开放性的？",
      "玩家如果不干预，NPC的默认走向是什么？",
      "结局是否有「好」「坏」「灰色」多种可能？"
    ],
    antiPattern: "所有NPC都有「从此幸福地生活在一起」的预设结局。主要反派的死亡是必然的。"
  },
  narrativeDensity: {
    id: "narrativeDensity",
    name: "叙事密度",
    category: "节奏",
    summary: "控制信息释放的节奏——什么时候详写、什么时候略写。高潮段需要慢镜头，过渡段需要简洁。不是所有情节都需要同等篇幅。",
    checklist: [
      "高潮段落是否预留了足够篇幅？",
      "过渡/赶路/日常是否有压缩空间？",
      "世界观信息是否均匀分布而非一次性倾倒？",
      "是否有「信息密度地图」标出各章节的详略？"
    ],
    antiPattern: "每个场景都写得很详细，读者不知道什么是重要的。整个故事节奏一致无变化。"
  },
  blankSpace: {
    id: "blankSpace",
    name: "留白指南",
    category: "技巧",
    summary: "不是所有信息都要写出来。给读者留下想象空间反而增强沉浸感。角色的过去、世界的边缘、未解之谜——这些「不说」的部分往往是故事魅力的来源。",
    checklist: [
      "每个角色是否有「不可言说」的过去？",
      "世界是否有「地图边缘」的未知区域？",
      "是否有伏笔不急于回收？",
      "对话中是否有欲言又止的瞬间？"
    ],
    antiPattern: "每个设定都被详细解释，没有神秘感。每个角色背景都完整交代。"
  },
  personalStyle: {
    id: "personalStyle",
    name: "随身物品与风格",
    replaces: "小物件",
    category: "角色",
    summary: "从小物件扩展为完整外在形象：穿衣风格(日常/战斗/正式)、武器或随身工具、标志物及其来历故事。外在形象是内在人格的延伸。",
    checklist: [
      "重要角色的穿衣风格是否反映其性格/身份？",
      "武器或工具是否有故事背景？",
      "标志物(首饰/旧物/纹身等)的来历是否与角色经历相关？",
      "不同场合(日常/战斗/仪式)的着装是否有区分？",
      "物品是否承载情感记忆而不仅是道具？"
    ],
    antiPattern: "所有角色穿着没有区分度。武器只是武器没有故事。小物件只是装饰没有意义。"
  },
  openingDesign: {
    id: "openingDesign",
    name: "开局设计",
    category: "结构",
    summary: "第一句话/第一段/第一个场景决定读者是否继续。好的开局包含：钩子(引发好奇)、情境(让读者迅速理解处境)、暗示(为后续埋线)。",
    checklist: [
      "第一句话是否制造了好奇或情感共鸣？",
      "开局是否迅速建立场景氛围？",
      "主角的初始处境是否清晰？",
      "是否有「入戏钩子」——让读者想知道接下来发生什么？"
    ],
    antiPattern: "开头有大段世界观介绍。第一页没有发生任何推动故事的事件。"
  },
  infoLayering: {
    id: "infoLayering",
    name: "信息分层",
    category: "技巧",
    summary: "信息分三层释放：表层(直接展示，对话/场景中自然呈现)、暗示层(侧面提及，让读者自行拼凑)、隐藏层(后期揭示，形成恍然大悟的效果)。",
    checklist: [
      "哪些信息应该直接展示？(表层)",
      "哪些信息应该暗示而非明说？(暗示层)",
      "哪些信息应该作为后期转折揭示？(隐藏层)",
      "三层之间是否有合理的揭晓时序？"
    ],
    antiPattern: "所有信息一次性交代。后期转折没有前期铺垫(显得突兀)。"
  },
  triggerAndPosition: {
    id: "triggerAndPosition",
    name: "触发与位置策略",
    category: "世界书",
    summary: "世界书条目的触发词设计和放置位置直接影响叙事流畅度。好的触发：自然出现在叙事中而非生硬插入。好的位置：该出现时才出现，不提前剧透。",
    checklist: [
      "条目触发词是否会在叙事中自然出现？",
      "条目内容是否是「该场景需要的」而非「系统硬塞的」？",
      "是否有条目会在不该触发的时候误触发？",
      "层级分配(base/context/instant)是否合理？"
    ],
    antiPattern: "触发词是生僻词几乎不会在叙事中出现。条目内容太长打断叙事节奏。"
  },

  // ===== v2.2 新增2卡 =====
  relationshipWeb: {
    id: "relationshipWeb",
    name: "角色关系网",
    category: "角色",
    summary: "角色关系不仅存在于组织(M4)中，角色之间也有独立的关系网络。关系是动态的——随玩家行为演变，不是静态标签。标注关系的类型/亲密度/动态方向。",
    checklist: [
      "每对重要角色之间是否有明确的关系定义？",
      "关系类型是否多样化(朋友/对手/暗恋/师徒/世仇等)？",
      "关系是否标注了初始亲密度和可能演变方向？",
      "是否有「三角关系」或「多角关系」能产生戏剧张力？",
      "玩家行为是否可能改变角色间的关系？"
    ],
    antiPattern: "角色之间只有「友好」和「敌对」两种关系。关系在整部作品中保持不变。"
  },
  emotionalProgression: {
    id: "emotionalProgression",
    name: "情感分层与转变",
    category: "角色",
    summary: "角色的情感不是平板的。设计情感的渐进层次：从警惕→放松→信任→依赖，或从冷漠→好奇→关心→羁绊。每一层转变都需要叙事事件作为催化剂。转变应该「有迹可循」而非突兀。",
    checklist: [
      "每个重要角色的情感转变是否有明确的阶段划分？",
      "每个转变是否有对应的「催化剂事件」？",
      "转变过程是否有回退(反复)的可能？",
      "不同关系的转变节奏是否有区分(快的不能太慢，慢的不能太快)？",
      "角色自身是否意识不到某些情感变化？"
    ],
    antiPattern: "角色突然从冷漠变成热情没有中间过渡。所有关系以相同速度发展。"
  }
};

// ---- 按分类获取技术卡 ----
export function techCardsByCategory(category = null) {
  const cards = Object.values(TECH_CARDS);
  if (!category) return cards;
  return cards.filter((c) => c.category === category);
}

// ---- 获取技术卡检查清单 ----
export function techCardChecklist(cardId = "") {
  const card = TECH_CARDS[cardId];
  return card ? card.checklist : [];
}

// ---- 技术卡验证报告 ----
export function validateWithTechCards(creationAnswers = {}) {
  const report = { passed: [], warnings: [], suggestions: [] };

  for (const card of Object.values(TECH_CARDS)) {
    const checks = card.checklist;
    let passedCount = 0;
    for (const check of checks) {
      // 简化检查：如果相关答案存在，视为部分通过
      const relatedFields = extractRelatedFields(card.id, creationAnswers);
      if (relatedFields.length > 0) passedCount++;
    }
    const ratio = checks.length > 0 ? passedCount / checks.length : 1;
    if (ratio >= 0.6) {
      report.passed.push(card.name);
    } else if (ratio >= 0.3) {
      report.warnings.push({ card: card.name, message: `${card.name}部分覆盖，建议补充。` });
    } else {
      report.suggestions.push({ card: card.name, message: `${card.name}尚未涉及，建议检查。`, checklist: checks });
    }
  }
  return report;
}

function extractRelatedFields(cardId, answers) {
  const mapping = {
    dynamicPersonality: ["M8.protagonistLayers", "M8.keyNPCs"],
    openEnding: ["M8.npcEndings", "M12.endingPhilosophy"],
    narrativeDensity: ["M12.stylePreset"],
    blankSpace: [],
    personalStyle: ["M8.personalEffects"],
    openingDesign: ["M11.openingScene"],
    infoLayering: ["M2.coreEntries"],
    triggerAndPosition: ["M2.coreEntries"],
    relationshipWeb: ["M8.characterRelationships", "M4.factionRelations"],
    emotionalProgression: ["M8.protagonistLayers", "M8.keyNPCs"]
  };
  const fields = mapping[cardId] || [];
  return fields.filter((f) => answers[f] !== undefined && answers[f] !== null && answers[f] !== "");
}
export function listPresets(worldbookData = {}) {
  const presets = worldbookData.presets || {};
  return Object.keys(presets).map((name) => ({
    name,
    type: presets[name]._meta?.storyType || presets[name].style?.storyType || "通用",
    active: presets[name]._meta?.active !== false
  }));
}

// ---- 预设摘要 ----
export function presetSummary(preset) {
  if (!preset) return "未加载预设。";
  const p = preset._meta || preset;
  return [
    `预设: ${p.name || "未命名"}`,
    preset.protagonist ? `主角: ${typeof preset.protagonist === "string" ? preset.protagonist : preset.protagonist.name || "未指定"}` : "主角: 未指定",
    preset.motivation?.goal ? `目标: ${preset.motivation.goal}` : "",
    preset.openingScene?.location ? `起始: ${preset.openingScene.location}` : ""
  ].filter(Boolean).join(" | ");
}
