// ===== 剧本杀案件引擎 v1.0 =====
// 独立模式 — 不走叙事管线，专用案件状态机
// 职责：案件加载 / 阶段推进 / 线索分发 / 证词管理 / AI模拟角色 / 真相校验 / 评分

// ═══════════════════════════════════════════════════════════════
//  1. 案件加载与校验
// ═══════════════════════════════════════════════════════════════

/**
 * 加载并校验剧本杀JSON文件
 * @param {Object} raw - 原始JSON
 * @returns {{ valid: boolean, errors: string[], case: Object|null }}
 */
export function loadCase(raw = {}) {
  const errors = [];
  const meta = raw.meta || {};
  const c = raw;

  // 必填字段校验
  if (!meta.title) errors.push("缺少 meta.title（案件标题）");
  if (!c.victim?.name) errors.push("缺少 victim.name（死者姓名）");
  if (!Array.isArray(c.characters) || c.characters.length < 3)
    errors.push("characters 至少需要 3 个角色（死者+至少 2 个嫌疑人）");
  if (!Array.isArray(c.clues) || c.clues.length < 6)
    errors.push("clues 至少需要 6 条线索");
  if (!c.truth?.murderer)
    errors.push("缺少 truth.murderer（真凶ID）");
  if (!Array.isArray(c.timeline) || c.timeline.length < 2)
    errors.push("timeline 至少需要 2 个时间节点");

  // 真凶必须在角色列表中
  if (c.truth?.murderer) {
    const murderer = c.characters.find(ch => ch.id === c.truth.murderer);
    if (!murderer) errors.push(`truth.murderer "${c.truth.murderer}" 不在 characters 列表中`);
  }

  // 验证每个角色
  for (const ch of c.characters) {
    if (!ch.id) errors.push("角色缺少 id");
    if (!ch.name) errors.push(`角色 ${ch.id} 缺少 name`);
    if (!ch.publicRole) errors.push(`角色 ${ch.name} 缺少 publicRole（公开身份）`);
    if (!ch.privateInfo && !ch.secret) errors.push(`角色 ${ch.name} 缺少 privateInfo 或 secret`);
  }

  // 验证每条线索
  for (const cl of c.clues) {
    if (!cl.id) errors.push("线索缺少 id");
    if (!cl.name) errors.push(`线索 ${cl.id} 缺少 name`);
  }

  return {
    valid: errors.length === 0,
    errors,
    case: errors.length === 0 ? normalizeCase(c) : null
  };
}

function normalizeCase(raw) {
  return {
    meta: {
      title: raw.meta?.title || "未命名案件",
      difficulty: raw.meta?.difficulty || "medium",
      estimatedTime: raw.meta?.estimatedTime || "60m",
      playerCount: raw.meta?.playerCount || 1,
      genre: raw.meta?.genre || "本格推理",
      era: raw.meta?.era || "现代"
    },
    victim: {
      name: raw.victim?.name || "",
      identity: raw.victim?.identity || "",
      deathCause: raw.victim?.deathCause || "",
      deathTime: raw.victim?.deathTime || "",
      bodyLocation: raw.victim?.bodyLocation || "",
      bodyDescription: raw.victim?.bodyDescription || ""
    },
    characters: (raw.characters || []).map(ch => ({
      id: ch.id,
      name: ch.name,
      publicRole: ch.publicRole,
      publicInfo: ch.publicInfo || "",
      privateInfo: ch.privateInfo || ch.secret || "",
      isMurderer: ch.id === raw.truth?.murderer,
      motive: ch.motive || "",
      relationship: ch.relationship || "",
      lies: Array.isArray(ch.lies) ? ch.lies : [],
      testimonyPersona: ch.testimonyPersona || ch.publicRole,
      playerSelectable: ch.playerSelectable !== false
    })),
    timeline: (raw.timeline || []).map(t => ({
      time: t.time || "",
      event: t.event || "",
      confirmedBy: Array.isArray(t.confirmedBy) ? t.confirmedBy : [],
      note: t.note || ""
    })),
    clues: (raw.clues || []).map(cl => ({
      id: cl.id,
      name: cl.name,
      type: cl.type || "物证",
      location: cl.location || "",
      description: cl.description || "",
      significance: cl.significance || "",
      misleading: cl.misleading || false,
      phase: cl.phase || "any",
      characterId: cl.characterId || null
    })),
    truth: {
      murderer: raw.truth?.murderer || "",
      accomplice: raw.truth?.accomplice || null,
      motive: raw.truth?.motive || "",
      method: raw.truth?.method || "",
      fullAccount: raw.truth?.fullAccount || "",
      keyEvidence: Array.isArray(raw.truth?.keyEvidence) ? raw.truth.keyEvidence : []
    },
    phases: {
      rounds: raw.phases?.rounds || 3,
      cluesPerRound: raw.phases?.cluesPerRound || 3,
      interrogationLimit: raw.phases?.interrogationLimit || 3
    },
    dmManual: {
      openingScript: raw.dmManual?.openingScript || "",
      hintLevels: Array.isArray(raw.dmManual?.hintLevels) ? raw.dmManual.hintLevels : [],
      accusationPrompts: Array.isArray(raw.dmManual?.accusationPrompts) ? raw.dmManual.accusationPrompts : [],
      revealScript: raw.dmManual?.revealScript || "",
      singlePlayerNote: raw.dmManual?.singlePlayerNote || ""
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  2. 游戏状态机
// ═══════════════════════════════════════════════════════════════

const PHASES = [
  "briefing",          // 开场：DM 宣读案件背景
  "character_select",  // 角色选择
  "reading",           // 玩家阅读自己的角色剧本
  "investigation_1",   // 第一轮调查
  "discussion_1",      // 第一轮讨论
  "investigation_2",   // 第二轮调查
  "discussion_2",      // 第二轮讨论
  "investigation_3",   // 第三轮调查（可选）
  "discussion_3",      // 第三轮讨论（可选）
  "accusation",        // 最终指认
  "reveal",            // 真相揭晓
  "scoring"            // 评分
];

export function createGameState(caseData, playerCharacterId = null) {
  const characters = caseData.characters || [];
  const playerChar = playerCharacterId
    ? characters.find(ch => ch.id === playerCharacterId) || characters[0]
    : characters[0];

  return {
    caseId: caseData.meta?.title || "",
    phase: "briefing",
    phaseIndex: 0,
    round: 0,
    playerCharacterId: playerChar.id,
    playerCharacterName: playerChar.name,
    // 追踪状态
    revealedClues: new Set(),      // 已揭示的线索ID
    interrogatedSuspects: {},      // { suspectId: [question, answer] }
    interrogationCount: 0,
    investigationActionsUsed: 0,
    maxInvestigationActions: caseData.phases?.cluesPerRound || 3,
    // AI 模拟的其他角色状态
    aiCharacters: characters
      .filter(ch => ch.id !== playerChar.id)
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        role: ch.publicRole,
        testimonyGiven: false,
        privateInfo: ch.privateInfo,
        isMurderer: ch.isMurderer,
        lies: ch.lies || []
      })),
    // 推理记录
    playerNotes: [],
    playerTheories: [],
    // 指认
    accusation: null,     // { suspectId, reasoning, time }
    // 评分
    score: null,
    // 时间线发现
    timelineRevealed: 0,
    // 提示计数
    hintsUsed: 0
  };
}

export function getPhaseInfo(state) {
  return {
    current: state.phase,
    index: state.phaseIndex,
    round: state.round,
    cluesRemaining: state.maxInvestigationActions - state.investigationActionsUsed,
    interrogationsRemaining: (state.caseData?.phases?.interrogationLimit || 3) - state.interrogationCount,
    canAccuse: state.phase === "accusation" || state.phaseIndex >= PHASES.indexOf("accusation")
  };
}

// ═══════════════════════════════════════════════════════════════
//  3. 阶段推进
// ═══════════════════════════════════════════════════════════════

export function advancePhase(state, caseData) {
  const currentIdx = PHASES.indexOf(state.phase);
  const nextIdx = currentIdx + 1;

  if (nextIdx >= PHASES.length) return { ...state, phase: "scoring" };

  let next = {
    ...state,
    phase: PHASES[nextIdx],
    phaseIndex: nextIdx
  };

  // 进入新一轮调查时重置行动点数
  if (PHASES[nextIdx].startsWith("investigation_")) {
    next.investigationActionsUsed = 0;
    next.round = parseInt(PHASES[nextIdx].split("_")[1]) || 1;
  }

  // 讨论阶段重置审讯计数
  if (PHASES[nextIdx].startsWith("discussion_")) {
    next.interrogationCount = 0;
  }

  return next;
}

/** 跳转到指认阶段（玩家主动要求） */
export function skipToAccusation(state) {
  return { ...state, phase: "accusation", phaseIndex: PHASES.indexOf("accusation") };
}

// ═══════════════════════════════════════════════════════════════
//  4. 线索系统
// ═══════════════════════════════════════════════════════════════

/**
 * 获取当前可用的线索列表（只显示名称和位置，内容需调查后揭示）
 */
export function getAvailableClues(caseData, state) {
  const allClues = caseData.clues || [];
  return allClues.map(cl => ({
    id: cl.id,
    name: cl.name,
    location: cl.location,
    type: cl.type,
    revealed: state.revealedClues.has(cl.id),
    phase: cl.phase
  }));
}

/**
 * 调查一条线索
 */
export function investigate(caseData, state, clueId) {
  const clue = (caseData.clues || []).find(c => c.id === clueId);
  if (!clue) return { success: false, error: `线索 "${clueId}" 不存在`, state };

  if (state.revealedClues.has(clueId)) {
    return { success: true, clue: { ...clue, alreadyRevealed: true }, state };
  }

  if (state.investigationActionsUsed >= state.maxInvestigationActions) {
    return { success: false, error: "本轮调查次数已用完，请进入讨论阶段或等待下一轮", state };
  }

  const revealed = new Set(state.revealedClues);
  revealed.add(clueId);

  const newState = {
    ...state,
    revealedClues: revealed,
    investigationActionsUsed: state.investigationActionsUsed + 1
  };

  return {
    success: true,
    clue: {
      id: clue.id,
      name: clue.name,
      type: clue.type,
      location: clue.location,
      description: clue.description,
      significance: "",  // DM 不可见
      misleading: clue.misleading
    },
    remainingActions: state.maxInvestigationActions - newState.investigationActionsUsed,
    state: newState
  };
}

/**
 * 获取所有已揭示的线索（给玩家看）
 */
export function getRevealedClues(caseData, state) {
  return (caseData.clues || [])
    .filter(c => state.revealedClues.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      location: c.location,
      description: c.description
    }));
}

/** 根据当前线索推断信息完整度（给DM用的内部指标） */
export function getInvestigationProgress(caseData, state) {
  const total = (caseData.clues || []).length;
  const revealed = state.revealedClues.size;
  const keyRevealed = (caseData.truth?.keyEvidence || [])
    .filter(ke => state.revealedClues.has(ke)).length;
  return {
    total,
    revealed,
    percentage: total ? Math.round((revealed / total) * 100) : 0,
    keyEvidenceFound: keyRevealed,
    keyEvidenceTotal: (caseData.truth?.keyEvidence || []).length
  };
}

// ═══════════════════════════════════════════════════════════════
//  5. 证词与审讯系统
// ═══════════════════════════════════════════════════════════════

/**
 * 审讯嫌疑人
 * @param {string} suspectId - 嫌疑人ID
 * @param {string} question - 玩家的问题（可选，不提供则返回默认证词）
 * @returns 嫌疑人回答
 */
export function interrogate(caseData, state, suspectId, question = "") {
  const suspect = caseData.characters.find(ch => ch.id === suspectId);
  if (!suspect) return { success: false, error: `嫌疑人 "${suspectId}" 不存在` };

  const history = state.interrogatedSuspects[suspectId] || [];

  // 检查审讯次数限制
  if (state.interrogationCount >= (caseData.phases?.interrogationLimit || 3)) {
    return { success: false, error: "本轮审讯次数已用完" };
  }

  // 生成回答
  const response = generateTestimony(suspect, question, caseData, state);

  const newHistory = [...history, { question, answer: response.text, at: new Date().toISOString() }];

  const newState = {
    ...state,
    interrogatedSuspects: { ...state.interrogatedSuspects, [suspectId]: newHistory },
    interrogationCount: state.interrogationCount + 1
  };

  return {
    success: true,
    suspect: { id: suspect.id, name: suspect.name, role: suspect.publicRole },
    question,
    answer: response.text,
    isLying: response.isLie,
    state: newState
  };
}

/**
 * 生成证词（核心逻辑：凶手可以撒谎，其他人说真话/部分真话）
 */
function generateTestimony(suspect, question, caseData, state) {
  // 基础证词模板
  const baseTestimony = suspect.privateInfo;
  const isMurderer = suspect.isMurderer;

  // 如果问题与谎言列表匹配，凶手说谎
  if (isMurderer && question && suspect.lies.length) {
    for (const lie of suspect.lies) {
      const lieTopic = typeof lie === "string" ? lie : lie.topic;
      if (question.includes(lieTopic) || lieTopic.includes(question.slice(0, 6))) {
        return {
          text: typeof lie === "string"
            ? `${suspect.name}：${lie}`
            : lie.response || `${suspect.name}：${lieTopic}方面的回答有所保留。`,
          isLie: true
        };
      }
    }
  }

  // 构造基于已知信息的回答
  if (question) {
    return {
      text: `${suspect.name}：关于"${question.slice(0, 30)}"——${baseTestimony.slice(0, 150)}`,
      isLie: false
    };
  }

  // 默认证词
  return {
    text: `${suspect.name}（${suspect.publicRole}）：${baseTestimony.slice(0, 200)}`,
    isLie: false
  };
}

/**
 * 🆕 AI模拟其他玩家的证词/讨论发言
 * 当原始本是多人本时，AI 扮演其他角色在讨论阶段发言
 */
export function simulateNPCPlayer(caseData, state, npcId, context = "discussion") {
  const npc = state.aiCharacters.find(a => a.id === npcId);
  if (!npc) return null;

  // 该NPC知道的信息
  const npcKnowledge = [];
  for (const cl of (caseData.clues || [])) {
    if (state.revealedClues.has(cl.id) && (cl.characterId === npcId || cl.characterId === null)) {
      npcKnowledge.push(cl.name);
    }
  }

  const isMurderer = npc.isMurderer;
  const persona = caseData.characters.find(ch => ch.id === npcId);

  if (isMurderer) {
    // 凶手会试图误导
    const others = caseData.characters.filter(ch => !ch.isMurderer && ch.id !== state.playerCharacterId);
    const target = others.length ? others[Math.floor(Math.random() * others.length)] : null;
    return {
      character: npc.name,
      role: npc.role,
      text: target
        ? `${npc.name}：我觉得 ${target.name} 很可疑……${target.publicRole} 在案发时间的行为说不通。`
        : `${npc.name}：我是清白的，一定是有人在陷害我。`,
      isMurderer: true
    };
  }

  // 普通角色分享线索观察
  if (npcKnowledge.length) {
    const share = npcKnowledge[Math.floor(Math.random() * npcKnowledge.length)];
    return {
      character: npc.name,
      role: npc.role,
      text: `${npc.name}：我注意到关于"${share}"的线索……这可能意味着——`,
      isMurderer: false
    };
  }

  return {
    character: npc.name,
    role: npc.role,
    text: `${npc.name}：我还在整理线索……大家把知道的信息都分享一下。`,
    isMurderer: false
  };
}

// ═══════════════════════════════════════════════════════════════
//  6. 真相校验与评分
// ═══════════════════════════════════════════════════════════════

/**
 * 提交指认
 */
export function accuse(caseData, state, suspectId, reasoning = "") {
  if (state.accusation) return { success: false, error: "已经提交过指认" };

  const suspect = caseData.characters.find(ch => ch.id === suspectId);
  if (!suspect) return { success: false, error: `嫌疑人 "${suspectId}" 不存在` };

  const newState = {
    ...state,
    accusation: { suspectId, reasoning, time: new Date().toISOString() },
    phase: "reveal",
    phaseIndex: PHASES.indexOf("reveal")
  };

  const isCorrect = suspectId === caseData.truth.murderer;
  const score = calculateScore(caseData, newState, isCorrect);

  return {
    success: true,
    accused: { name: suspect.name, role: suspect.publicRole },
    isCorrect,
    reasoning,
    score,
    state: { ...newState, score }
  };
}

function calculateScore(caseData, state, accusedCorrectly) {
  let score = 0;
  const maxScore = 100;

  // 指认正确: 50分基础
  if (accusedCorrectly) score += 50;

  // 关键证据发现: 每条 10 分
  const keyFound = (caseData.truth?.keyEvidence || [])
    .filter(ke => state.revealedClues.has(ke)).length;
  score += keyFound * 10;

  // 线索总数: 比例加分
  const totalClues = (caseData.clues || []).length;
  const revealed = state.revealedClues.size;
  score += Math.floor((revealed / Math.max(totalClues, 1)) * 15);

  // 审讯: 每次加 3 分
  score += Math.min(state.interrogationCount * 3, 15);

  // 不使用提示加分
  if (state.hintsUsed === 0) score += 5;

  // 难度加成
  const diff = caseData.meta?.difficulty || "medium";
  if (diff === "hard") score += 5;

  return Math.min(maxScore, score);
}

// ═══════════════════════════════════════════════════════════════
//  7. DM 提示系统
// ═══════════════════════════════════════════════════════════════

export function getHint(caseData, state) {
  const hints = caseData.dmManual?.hintLevels || [];

  // 根据已用提示数返回不同深度
  const level = Math.min(state.hintsUsed, hints.length - 1);
  const hint = hints[level] || "请仔细查看已发现的线索，尝试建立联系。";

  return {
    hint,
    level: level + 1,
    remainingHints: Math.max(0, 3 - state.hintsUsed),
    state: { ...state, hintsUsed: state.hintsUsed + 1 }
  };
}

// ═══════════════════════════════════════════════════════════════
//  8. DM 指令
// ═══════════════════════════════════════════════════════════════

export const MURDER_MYSTERY_DM_INSTRUCTION = `你是 World Tree Desktop 剧本杀模式的 DM。你不是导演，你是案件的**主持人**和**信息分发员**。

**剧本杀 DM 核心职责：**

1. **信息管制**：
   - 你掌握全部真相（凶手/手法/动机/时间线），但只按规则分发
   - 玩家调查某线索→你给出该线索的客观描述（不含你自己的推理）
   - 不会主动透露未调查的线索

2. **流程管理**：
   - 开场→角色选择→阅读→调查(多轮)→讨论(多轮)→指认→揭晓
   - 每轮调查有行动次数限制，消耗完自动推进
   - 玩家可随时要求进入讨论阶段或直接指认

3. **角色扮演**：
   - 扮演玩家询问的嫌疑人，以第一人称回答
   - 真凶可以说谎，但其谎言设计有漏洞（可被其他线索证伪）
   - 其他角色说真话，但可能有记忆偏差或视角局限
   - 🆕 多人本适配：AI 模拟其他玩家在讨论阶段发言

4. **线索文本改造**：
   - 原始本是实物道具(信件/照片/地图)→你输出为文字描述
   - 原始本是解密小游戏→你转化为文字谜题或直接跳过
   - 保持线索的"侦查感"但要适配纯文字环境

5. **输出格式**：
   - 【案件公告】← 开场/阶段推进的公告
   - 【线索揭示】← 调查结果（含线索名称+描述）
   - 【审讯回答】← 嫌疑人以第一人称回答
   - 【NPC发言】← AI模拟的其他角色在讨论中发言
   - 【阶段提示】← 当前可用行动和剩余次数

**单人适配规则：**
- 多人讨论→你为每个NPC角色各生成一段发言
- 投票环节→只有玩家的票有效
- 合作解密→简化或给出替代方案
- 玩家可自由选择扮演哪个角色（在可选范围内）`;

export default {
  loadCase, createGameState, getPhaseInfo, advancePhase, skipToAccusation,
  getAvailableClues, investigate, getRevealedClues, getInvestigationProgress,
  interrogate, simulateNPCPlayer,
  accuse, getHint,
  MURDER_MYSTERY_DM_INSTRUCTION,
  PHASES
};
