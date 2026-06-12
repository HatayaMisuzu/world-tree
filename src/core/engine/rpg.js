// ===== RPG 模式模块 v1.0 =====
// @hidden v2.3.0 — 模式未完成（status=hidden），不对用户暴露。引擎代码保留。
// 日式 RPG 模式：章节剧情 / 角色成长 / 任务系统 / 情感羁绊

// ═══════════════════════════════════════════════════════════════
//  1. 等级与经验
// ═══════════════════════════════════════════════════════════════

const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 65000];
// 10级以后公式：level * level * 1000

export function xpForLevel(level) {
  if (level <= 10) return XP_TABLE[level - 1] || 0;
  return level * level * 1000;
}

export function levelUp(char) {
  const next = (char.level || 1) + 1;
  if (next > 99) return { ...char, level: 99, xpToNext: 0 };
  const xpNeeded = xpForLevel(next);
  return {
    ...char,
    level: next,
    xpToNext: xpNeeded - (char.xp || 0),
    statPoints: (char.statPoints || 0) + 3,
    skillPoints: (char.skillPoints || 0) + 1
  };
}

export function addXP(char, amount) {
  let c = { ...char, xp: (char.xp || 0) + amount };
  let leveled = false;
  while (true) {
    const needed = xpForLevel((c.level || 1) + 1);
    if (c.xp >= needed && c.level < 99) {
      c = levelUp(c);
      leveled = true;
    } else {
      c.xpToNext = needed - c.xp;
      break;
    }
  }
  c._leveledUp = leveled;
  return c;
}

// ═══════════════════════════════════════════════════════════════
//  2. 任务系统
// ═══════════════════════════════════════════════════════════════

export function createQuest(id, title, type = "main", chapter = 1) {
  return {
    id, title, type,          // main | side | character
    chapter,
    status: "active",          // active | completed | failed
    objectives: [],            // [{ text, done }]
    rewards: { xp: 0, gold: 0, items: [] },
    giver: "",
    journal: []                // 任务日志
  };
}

export function addQuestObjective(quest, text) {
  return {
    ...quest,
    objectives: [...(quest.objectives || []), { text, done: false }]
  };
}

export function completeObjective(quest, index) {
  const obj = [...(quest.objectives || [])];
  if (obj[index]) obj[index] = { ...obj[index], done: true };
  const allDone = obj.every(o => o.done);
  return {
    ...quest,
    objectives: obj,
    status: allDone ? "completed" : "active"
  };
}

export function questJournal(quests = []) {
  const active = quests.filter(q => q.status === "active");
  const completed = quests.filter(q => q.status === "completed");
  return [
    `📋 进行中 (${active.length}):`,
    ...active.map(q => `  ${q.type === "main" ? "🔴" : "🔵"} [${q.type}] ${q.title} — ${q.objectives?.filter(o => !o.done).length || 0}个目标待完成`),
    completed.length ? `✅ 已完成: ${completed.length}` : ""
  ].filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
//  3. 情感羁绊
// ═══════════════════════════════════════════════════════════════

export const BOND_TIERS = [
  { tier: 0, name: "陌生人", min: 0 },
  { tier: 1, name: "相识", min: 20 },
  { tier: 2, name: "友好", min: 50 },
  { tier: 3, name: "信任", min: 100 },
  { tier: 4, name: "羁绊", min: 200 },
  { tier: 5, name: "灵魂之绊", min: 400 }
];

export function createBond(characterName) {
  return {
    character: characterName,
    points: 0,
    tier: 0,
    tierName: "陌生人",
    events: [],   // [{ event, points, at }]
    unlockedScene: false
  };
}

export function addBondPoints(bond, amount, event = "") {
  const points = (bond.points || 0) + amount;
  let tier = 0, tierName = "陌生人";
  for (const t of BOND_TIERS) {
    if (points >= t.min) { tier = t.tier; tierName = t.name; }
  }
  const tierUp = tier > (bond.tier || 0);
  return {
    ...bond,
    points,
    tier,
    tierName,
    unlockedScene: bond.unlockedScene || tierUp,
    events: [...(bond.events || []), { event: event || `+${amount}`, points: amount, at: new Date().toISOString() }]
  };
}

export function bondStatus(bond) {
  if (!bond) return "—";
  const nextTier = BOND_TIERS.find(t => t.min > bond.points);
  const next = nextTier ? `${nextTier.min - bond.points}点→${nextTier.name}` : "MAX";
  return `${bond.tierName} (${bond.points}) → ${next}`;
}

// ═══════════════════════════════════════════════════════════════
//  4. 章节结构
// ═══════════════════════════════════════════════════════════════

export function createChapter(number, title, theme = "") {
  return {
    number, title, theme,
    status: number === 1 ? "active" : "locked",
    scenes: [],
    boss: "",
    keyItems: [],
    completedAt: null
  };
}

export function chapterProgress(chapters = []) {
  const current = chapters.find(c => c.status === "active");
  const completed = chapters.filter(c => c.status === "completed").length;
  return {
    current: current ? `第${current.number}章: ${current.title}` : "序章",
    completed,
    total: chapters.length,
    progress: chapters.length ? Math.round((completed / chapters.length) * 100) : 0
  };
}

// ═══════════════════════════════════════════════════════════════
//  5. DM 指令
// ═══════════════════════════════════════════════════════════════

export const RPG_DM_INSTRUCTION = `你是 World Tree Desktop RPG 模式的 DM。

**RPG 模式核心规则：**

1. **章节递进**：
   - 主线剧情分章节推进，每章有明确的剧情目标和最终高潮
   - 章节推进由关键事件触发，不跳跃
   - 支线章节自由穿插，服务于世界观和角色羁绊

2. **角色成长**：
   - 战斗/完成任务 → 获得经验 → 升级 → 获得属性点/技能点
   - 角色通过使用学会新技能
   - 装备可改变角色能力——获取新装备是重要驱动力

3. **情感羁绊**：
   - 与队友互动积累羁绊点数
   - 羁绊有五层：陌生人→相识→友好→信任→羁绊→灵魂之绊
   - 达到特定羁绊层解锁专属剧情事件

4. **任务驱动**：
   - 主线任务(🔴)推进剧情，支线任务(🔵)丰富世界
   - 任务有明确目标和奖励
   - 用【任务更新】标记任务状态变化

5. **输出格式**：
   - 【叙事】← RPG 风格的沉浸式叙述（必须）
   - 【任务更新】← 任务完成/新增/变化（可选）
   - 【成长提示】← 经验获得/升级提示（可选）
   - 【状态建议】← 其他状态变更（可选）
   - 【情绪反馈】← player: engagement=x, tension=x（可选）

6. **RPG 风格**：
   - 允许一定程度的重复（练级/刷材料），但叙事化处理
   - 剧情揭示有节奏——不一次性抛出全部世界观
   - Boss 战/高潮场面有足够的铺垫和描写空间`;

export default {
  xpForLevel, levelUp, addXP,
  createQuest, addQuestObjective, completeObjective, questJournal,
  BOND_TIERS, createBond, addBondPoints, bondStatus,
  createChapter, chapterProgress,
  RPG_DM_INSTRUCTION
};
