// ===== M19 角色卡驱动模式 + M8 增强角色模型 =====
// v12.19+ 动态人格分层 + 关系网 + 扩展随身物品
// 角色 = 完整互动世界，DM完全隐退，角色直连user。

// ---- 角色卡检测 ----
export function detectCardType(jsonData = {}) {
  const features = [];
  const data = jsonData;
  if (data.spec || data.entries || data.worldbook) features.push("worldbook");
  if (Array.isArray(data.entries) && data.entries.some((e) => e.keys && e.content)) features.push("worldbook");
  if ((data.name || data.名称) && (data.first_mes || data.首次对话) && (data.personality || data.性格)) features.push("character_card");
  if ((data.名称 || data.name) && (data.性格 || data.personality) && (data.首次对话 || data.first_mes)) features.push("character_card");
  if (data.mes_example || data.description || data.scenario) { if (!features.includes("character_card")) features.push("character_card"); }
  const uniqueFeatures = [...new Set(features)];
  return {
    type: uniqueFeatures.length === 1 ? uniqueFeatures[0] : uniqueFeatures.length > 1 ? "mixed" : "unknown",
    features: uniqueFeatures,
    label: uniqueFeatures.includes("worldbook") && uniqueFeatures.includes("character_card") ? "both" :
           uniqueFeatures.includes("worldbook") ? "worldbook" :
           uniqueFeatures.includes("character_card") ? "character_card" : "unknown"
  };
}

// ---- 动态人格分层模型 ----
export function parsePersonalityLayers(card = {}) {
  return {
    // 表层：日常对外展现的人格
    surface: {
      label: card.surfaceLabel || card.表层人格标签 || "",
      traits: card.personality || card.性格 || "",
      speechStyle: card.speechStyle || card.说话风格 || "",
      defaultMood: card.defaultMood || card.情绪默认态 || "平静"
    },
    // 里层：隐藏的真实人格（可能被创伤/经历覆盖）
    deep: {
      originalTraits: card.deepTraits || card.深层性格 || "",
      whatChanged: card.whatChanged || card.转变原因 || "",
      triggerToReveal: card.revealTrigger || card.触发暴露 || "",
      visibleWhen: card.visibleWhen || card.暴露条件 || ""
    },
    // 触发地图：什么行为/情境会激发哪一层
    triggers: {
      angerResponse: card.angerTrigger || card.愤怒触发 || "",
      softSpotResponse: card.softSpotTrigger || card.软肋触发 || "",
      fearResponse: card.fearTrigger || card.恐惧触发 || "",
      joyResponse: card.joyTrigger || card.喜悦触发 || ""
    },
    // 玩家影响：玩家的哪些行为可能改变角色的情感层次
    playerInfluence: {
      canMelt: card.canMelt || card.可融化 || "",
      canWorsen: card.canWorsen || card.可恶化 || "",
      keyDecisions: Array.isArray(card.keyDecisions) ? card.keyDecisions : (card.关键决策点 || "").split(",").filter(Boolean)
    }
  };
}

// ---- 情绪响应梯度 — 玩家情绪驱动角色反应 ----
// 让角色的表层/里层表现、语气、动作随玩家当前情绪状态动态调整。
// 情绪维度来自 Director 层（emotion-state.js）：engagement/tension/fatigue/curiosity
//
// 角色卡数据格式（可选字段）：
//   emotionGradients: {
//     highEngagement: { response, dialogueStyle, layerBias },
//     highTension: { response, dialogueStyle, layerBias },
//     ...
//   }
// 缺失时使用场景响应模式回退。

export function parseEmotionalGradients(card = {}) {
  const raw = card.emotionGradients || card.情绪梯度 || {};
  return {
    highEngagement: {
      response: raw.highEngagementResponse || raw.高投入回应 || "",
      dialogueStyle: raw.highEngagementDialogue || raw.高投入对话风格 || "主动",
      layerBias: raw.highEngagementLayer || raw.高投入层次倾向 || "surface",
      gestureTendency: raw.highEngagementGesture || raw.高投入动作倾向 || "靠近"
    },
    highTension: {
      response: raw.highTensionResponse || raw.高压回应 || "",
      dialogueStyle: raw.highTensionDialogue || raw.高压对话风格 || "柔和",
      layerBias: raw.highTensionLayer || raw.高压层次倾向 || "deep",
      gestureTendency: raw.highTensionGesture || raw.高压动作倾向 || "试探"
    },
    highFatigue: {
      response: raw.highFatigueResponse || raw.疲劳回应 || "",
      dialogueStyle: raw.highFatigueDialogue || raw.疲劳对话风格 || "安静",
      layerBias: raw.highFatigueLayer || raw.疲劳层次倾向 || "surface",
      gestureTendency: raw.highFatigueGesture || raw.疲劳动作倾向 || "陪伴"
    },
    highCuriosity: {
      response: raw.highCuriosityResponse || raw.好奇回应 || "",
      dialogueStyle: raw.highCuriosityDialogue || raw.好奇对话风格 || "诱导",
      layerBias: raw.highCuriosityLayer || raw.好奇层次倾向 || "surface_or_deep",
      gestureTendency: raw.highCuriosityGesture || raw.好奇动作倾向 || "展示"
    },
    neutral: {
      response: raw.neutralResponse || raw.默认回应 || "",
      dialogueStyle: raw.neutralDialogue || raw.默认对话风格 || "自然",
      layerBias: raw.neutralLayer || raw.默认层次倾向 || "surface",
      gestureTendency: raw.neutralGesture || raw.默认动作倾向 || "平时"
    }
  };
}

/**
 * 根据玩家情绪画像选出最匹配的情绪梯度
 * @param {Object} gradients - parseEmotionalGradients 返回的梯度对象
 * @param {Object} emotionProfile - getEmotionProfile 返回的画像（含 dominant 数组）
 * @returns {Object} 选中的梯度 + 匹配原因
 */
export function selectEmotionalGradient(gradients = {}, emotionProfile = {}) {
  const dominant = emotionProfile.dominant || [];
  const state = emotionProfile.state || {};

  // 按优先级匹配 dominant 信号
  if (dominant.includes("stressed") && gradients.highTension?.dialogueStyle) {
    return { gradient: gradients.highTension, reason: "玩家紧张/压力大", from: "highTension" };
  }
  if (dominant.includes("fatigued") && gradients.highFatigue?.dialogueStyle) {
    return { gradient: gradients.highFatigue, reason: "玩家疲劳度较高", from: "highFatigue" };
  }
  if (dominant.includes("curious") && gradients.highCuriosity?.dialogueStyle) {
    return { gradient: gradients.highCuriosity, reason: "玩家好奇心高涨", from: "highCuriosity" };
  }
  if (dominant.includes("high-engagement") && gradients.highEngagement?.dialogueStyle) {
    return { gradient: gradients.highEngagement, reason: "玩家投入度高", from: "highEngagement" };
  }
  if (dominant.includes("low-engagement") && gradients.neutral?.dialogueStyle) {
    return { gradient: gradients.neutral, reason: "玩家投入度低→引导参与", from: "neutral" };
  }
  if (dominant.includes("satisfied") && gradients.neutral?.dialogueStyle) {
    return { gradient: gradients.neutral, reason: "玩家处于满足状态→自然互动", from: "neutral" };
  }
  if (dominant.includes("relaxed") && gradients.neutral?.dialogueStyle) {
    return { gradient: gradients.neutral, reason: "玩家放松→轻松互动", from: "neutral" };
  }

  // 第二优先：检查绝对值（非 dominant 但有强信号）
  if ((state.tension || 0) >= 7 && gradients.highTension?.dialogueStyle) {
    return { gradient: gradients.highTension, reason: `紧张度偏高(t=${state.tension})`, from: "highTension" };
  }
  if ((state.curiosity || 0) >= 7 && gradients.highCuriosity?.dialogueStyle) {
    return { gradient: gradients.highCuriosity, reason: `好奇心偏高(c=${state.curiosity})`, from: "highCuriosity" };
  }
  if ((state.fatigue || 0) >= 7 && gradients.highFatigue?.dialogueStyle) {
    return { gradient: gradients.highFatigue, reason: `疲劳度偏高(f=${state.fatigue})`, from: "highFatigue" };
  }
  if ((state.engagement || 0) >= 7 && gradients.highEngagement?.dialogueStyle) {
    return { gradient: gradients.highEngagement, reason: `投入度偏高(e=${state.engagement})`, from: "highEngagement" };
  }

  // 默认回退
  return { gradient: gradients.neutral, reason: "无显著情绪特征→默认模式", from: "neutral" };
}

// ---- 角色关系模型 ----
export function parseCharacterRelations(card = {}, allCharacters = []) {
  // 从角色卡提取关系
  const directRelations = Array.isArray(card.relations) ? card.relations :
    Array.isArray(card.关系) ? card.关系 : [];
  
  // 补充：从其他角色反向查找
  const reverseRelations = allCharacters
    .filter((c) => c.relations?.some((r) => r.target === card.name || r.target === card.名称))
    .map((c) => {
      const rel = (c.relations || []).find((r) => r.target === card.name || r.target === card.名称);
      return { from: c.name || c.名称, to: card.name || card.名称, type: rel?.type || "关联", note: rel?.note || "" };
    });

  return {
    outgoing: directRelations.map((r) => ({
      target: r.target || r.name || r.对象 || "",
      type: r.type || r.关系 || "中性",
      closeness: r.closeness || r.亲密度 || "一般",
      dynamicsDescription: r.dynamics || r.动态描述 || r.note || ""
    })),
    incoming: reverseRelations,
    // 关系动态说明：关系不是固定的
    dynamics: card.relationshipDynamics || card.关系动态 || "关系随玩家行为自然演变，不设固定终点"
  };
}

// ---- 扩展随身物品模型（同前） ----
export function parsePersonalEffects(card = {}) {
  return {
    // 穿衣风格
    clothingStyle: card.clothingStyle || card.穿衣风格 || "",
    clothingDetails: card.clothingDetails || card.服装细节 || "",
    // 武器/工具
    weapon: card.weapon || card.武器 || "",
    weaponDescription: card.weaponDescription || card.武器描述 || "",
    // 随身物品
    carriedItems: Array.isArray(card.carriedItems) ? card.carriedItems :
      Array.isArray(card.随身物品) ? card.随身物品 : [],
    // 标志物（原小物件概念保留但归入此体系）
    signatureItem: card.signatureItem || card.标志物 || card.小物件 || "",
    signatureItemStory: card.signatureItemStory || card.标志物来历 || ""
  };
}

// ---- 增强角色卡解析（合并所有模型） ----
export function parseCharacterCard(card = {}, allCharacters = []) {
  const name = card.name || card.名称 || "Unknown Character";
  const personalityLayers = parsePersonalityLayers(card);
  const relationships = parseCharacterRelations(card, allCharacters);
  const personalEffects = parsePersonalEffects(card);
  const emotionalGradients = parseEmotionalGradients(card);

  return {
    identity: {
      name,
      aliases: card.aliases || card.别名 || [],
      age: card.age || card.年龄 || "",
      gender: card.gender || card.性别 || "",
      species: card.species || card.种族 || "",
      appearance: card.appearance || card.外貌 || card.description || ""
    },
    // 动态人格分层（新）
    personalityLayers,
    // 情绪响应梯度（新·v1）
    emotionalGradients,
    // 人格底盘（creation-skill 四层之第一层）
    personalityChassis: {
      desire: card.desire || card.欲望 || "",
      fear: card.fear || card.恐惧 || "",
      obsession: card.obsession || card.执念 || "",
      defaultMood: personalityLayers.surface.defaultMood,
      triggerPoints: card.triggerPoints || card.情绪爆发点 || ""
    },
    // 表达DNA（四层之第二层）
    expressionDNA: {
      catchphrases: card.catchphrases || card.口癖 || [],
      particleDensity: card.particleDensity || card.语气词密度 || "中频",
      sentenceStyle: card.sentenceStyle || card.句式偏好 || "",
      addressPattern: card.addressPattern || card.称呼习惯 || "默认称呼user",
      forbiddenSpeech: card.forbiddenSpeech || card.禁用语感 || [],
      signatureGesture: card.signatureGesture || card.签名动作 || ""
    },
    // 性格
    personality: {
      traits: card.personality || card.性格 || "",
      hiddenTraits: card.hiddenTraits || card.隐藏面 || "",
      contradictions: card.contradictions || card.矛盾反差 || "",
      boundaries: card.boundaries || card.底线禁忌 || ""
    },
    // 背景
    background: {
      origin: card.origin || card.出身 || "",
      currentRole: card.currentRole || card.当前身份 || "",
      experience: card.experience || card.核心经历 || "",
      goal: card.goal || card.当前目标 || ""
    },
    // 场景响应模式（四层之第三层·5个核心场景）
    sceneResponses: {
      firstMeeting: card.firstMeetingResponse || card.初次见面 || { reaction: "", gesture: "", dialogueStyle: "" },
      praised: card.praisedResponse || card.被夸奖 || { reaction: "", gesture: "", dialogueStyle: "" },
      offended: card.offendedResponse || card.被冒犯 || { reaction: "", gesture: "", dialogueStyle: "" },
      intimacyTest: card.intimacyResponse || card.亲密试探 || { reaction: "", gesture: "", dialogueStyle: "" },
      lonelyLow: card.lonelyResponse || card.孤独低落时 || { reaction: "", gesture: "", dialogueStyle: "" }
    },
    // 知识边界（四层之第四层）
    knowledgeBoundary: {
      canKnow: card.canKnow || card.可以知道 || [],
      shouldNotKnow: card.shouldNotKnow || card.不应该知道 || [],
      fuzzyHandle: card.fuzzyHandle || card.模糊处理 || "用角色世界观逻辑理解陌生事物"
    },
    // 扩展随身物品（新·替代小物件）
    personalEffects,
    // 角色关系（新）
    relationships,
    // 成长阶段（可选）
    growth: {
      currentStage: card.growthStage || card.成长阶段 || "",
      possibleDirections: card.growthDirections || card.可能的成长方向 || []
    },
    // 对话
    dialogue: {
      firstMessage: card.first_mes || card.首次对话 || "",
      examples: card.mes_example || card.对话示例 || "",
      scenario: card.scenario || ""
    },
    // 元信息
    meta: {
      source: card.source || "imported",
      format: card.format || "unknown",
      createdAt: card.createdAt || new Date().toISOString()
    }
  };
}

// ---- 角色卡模式配置 ----
export function characterCardMode(card = {}) {
  const parsed = parseCharacterCard(card);
  return {
    mode: "character_card",
    dmVisibility: "retreat",
    activeCharacter: parsed.identity.name,
    outputStyle: "pure-narrative",
    rules: [
      "1. 角色始终以第一人称「我」说话",
      "2. 对话自然附带标志性动作/神态（不强制，看节奏）",
      "3. 绝不跳出角色身份做元分析",
      "4. 不主动提及关系网中其他人（除非user先提）",
      "5. 默认关系起点：「熟悉但不亲密的暧昧」",
      "6. 隐藏面/秘密在合适时机自然揭露",
      "7. 对user的称呼随关系自然演变",
      "8. 日常本土化知识可以知道，技术原理/meta不应该知道",
      "9. 人格层次随玩家行为动态切换（表层↔里层由触发条件激活）",
      "10. NPC的命运走向受玩家选择影响，不为固定结局"
    ],
    parsed
  };
}

// ---- 软性拒绝机制 ----
export function softReject(personalityType = "傲娇", question = "") {
  const responses = {
    "傲娇": ["…我干嘛要知道那种事。", "哼，问别人去。"],
    "温柔": ["啊…这个我也不太清楚呢。", "不好意思…" + (question ? "关于" + question + "我帮不上忙。" : "")],
    "冷淡": ["……", "（沉默，转移话题）"],
    "天真": ["诶？那是什么？", "（好奇地盯着你）"],
    "元气": ["唔——这个嘛…", "啊哈哈，跳过跳过！"]
  };
  const pool = responses[personalityType] || responses["傲娇"];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---- 关系追踪（隐形·叙事化） ----
export function cardRelationshipPatch(card = {}, mood = "", stage = "familiar") {
  const stages = {
    stranger: { distance: "保持距离", initiative: "等user开口", eyeContact: "移开" },
    familiar: { distance: "不介意靠近", initiative: "会回应", eyeContact: "会看你" },
    close: { distance: "主动靠近", initiative: "会找话题", eyeContact: "盯着看然后慌" },
    intimate: { distance: "零距离", initiative: "会约user", eyeContact: "不躲了" }
  };
  const s = stages[stage] || stages.familiar;
  return {
    character: card.name || card.identity?.name || "character",
    mood, stage, signals: s,
    updatedAt: new Date().toISOString()
  };
}

// ---- M9 重构：角色卡专属认知层 ----
export function cardCognitionModel(characterName = "", userInfo = {}) {
  return {
    character: characterName,
    towardUser: {
      known: userInfo.known || [],
      guesses: userInfo.guesses || [],
      unknown: userInfo.unknown || [],
      misunderstandings: userInfo.misunderstandings || []
    },
    ownSecrets: [],
    updateRule: "叙事中自然更新。user告诉新信息→未知→已知；角色观察行为→生成猜测；秘密被揭露→戏剧张力。"
  };
}

// ---- 角色卡模式保留指令 ----
export const CARD_MODE_ALLOWED_COMMANDS = [
  "archive", "scene", "characters", "branch", "engine"
];

export function isCardModeCommand(category = "") {
  return CARD_MODE_ALLOWED_COMMANDS.includes(category);
}

// ---- 角色卡模式叙事引导 ----
export function cardModeNarrativeHint(parsedCard = {}, userInput = "", emotionProfile = null) {
  const name = parsedCard.identity?.name || "角色";
  const mood = parsedCard.personalityChassis?.defaultMood || "平静";
  const trait = typeof parsedCard.personality?.traits === "string" ?
    parsedCard.personality.traits.split(",")[0]?.trim() : "";
  const catchphrase = Array.isArray(parsedCard.expressionDNA?.catchphrases) ?
    parsedCard.expressionDNA.catchphrases[0] : "";
  const gesture = parsedCard.expressionDNA?.signatureGesture || "";

  // 情绪梯度选择
  const gradients = parsedCard.emotionalGradients;
  const gradientMatch = gradients && emotionProfile
    ? selectEmotionalGradient(gradients, emotionProfile)
    : null;

  return {
    characterName: name, mood, trait, catchphrase, gesture, input: userInput,
    emotionalGradient: gradientMatch,
    rules: [
      "DM完全隐退，不输出任何元层标记",
      "角色直接以第一人称对user说话",
      "叙事由user驱动，角色自然回应",
      "关系变化通过叙事暗示，不展示数值",
      "人格层次随互动动态切换，非固定人设",
      "NPC命运由玩家选择塑造，不预设结局",
      "情绪响应：角色对玩家当前情绪状态有感知并作出自然反应（非生硬切换）"
    ]
  };
}
