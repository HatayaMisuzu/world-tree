// ===== 跑团模块 v1.0 =====
// Tabletop RPG 模式专用模块。
// 职责：骰子判定 / 角色属性 / 难度推断 / 遭遇生成 / 方向包注入
// 不修改引擎核心，被 director/llm/world-engine 按需调用。

// ═══════════════════════════════════════════════════════════════
//  1. 骰子系统
// ═══════════════════════════════════════════════════════════════

/**
 * 解析骰子表达式 "2d6+3" / "1d20" / "4d6k3" / "2d20kh1"
 * 返回 { count, sides, modifier, keepHighest, keepLowest }
 */
export function parseDice(expr) {
  const s = String(expr || "").trim().toLowerCase().replace(/\s/g, "");
  if (!s) return { count: 1, sides: 20, modifier: 0 };

  // 解析 keep/drop: "4d6k3" / "2d20kh1" / "3d6dl1"
  let keepHighest = 0, keepLowest = 0;
  const khMatch = s.match(/^(\d+)d(\d+)kh?(\d+)/);
  if (khMatch) { keepHighest = parseInt(khMatch[3]); return { count: parseInt(khMatch[1]), sides: parseInt(khMatch[2]), modifier: 0, keepHighest, keepLowest: 0 }; }
  const dlMatch = s.match(/^(\d+)d(\d+)dl(\d+)/);
  if (dlMatch) { keepLowest = parseInt(dlMatch[3]); return { count: parseInt(dlMatch[1]), sides: parseInt(dlMatch[2]), modifier: 0, keepHighest: 0, keepLowest }; }

  // 标准格式 "XdY+Z" / "XdY-Z"
  const m = s.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) {
    // 纯数字当作 d20 加值
    const num = parseInt(s);
    if (!isNaN(num)) return { count: 1, sides: 20, modifier: num };
    return { count: 1, sides: 20, modifier: 0 };
  }
  return {
    count: parseInt(m[1]),
    sides: parseInt(m[2]),
    modifier: parseInt(m[3] || "0")
  };
}

/** 掷单个骰子 */
function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * 掷骰。返回 { total, rolls, modifier, expr, critical, fumble }
 */
export function roll(expr) {
  const parsed = parseDice(expr);
  const { count, sides, modifier, keepHighest, keepLowest } = parsed;

  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));

  let kept = rolls;
  if (keepHighest > 0 && keepHighest < count) {
    kept = [...rolls].sort((a, b) => b - a).slice(0, keepHighest);
  }
  if (keepLowest > 0 && keepLowest < count) {
    kept = [...rolls].sort((a, b) => a - b).slice(0, keepLowest);
  }

  const rawTotal = kept.reduce((s, v) => s + v, 0);
  const total = rawTotal + modifier;
  const naturalRoll = rolls.length === 1 && sides === 20 ? rolls[0] : null;
  const critical = naturalRoll === 20 ? "success" : naturalRoll === 1 ? "failure" : null;

  return {
    total,
    rolls,
    kept: kept.length !== rolls.length ? kept : undefined,
    modifier,
    expr,
    critical,
    natural: naturalRoll
  };
}

/**
 * 属性/技能检定 d20 + modifier vs DC
 * 返回 { pass, total, natural, margin, advantage, disadvantage, critical }
 */
export function check(modifier, dc, options = {}) {
  const { advantage = false, disadvantage = false } = options;
  const effectiveAdv = advantage && !disadvantage;
  const effectiveDis = disadvantage && !advantage;

  let r1 = roll("1d20");
  let r2 = null;

  if (effectiveAdv || effectiveDis) {
    r2 = roll("1d20");
  }

  let natural;
  if (r2) {
    natural = effectiveAdv
      ? Math.max(r1.natural, r2.natural)
      : Math.min(r1.natural, r2.natural);
  } else {
    natural = r1.natural;
  }

  const total = natural + modifier;
  const pass = total >= dc;
  const margin = total - dc;

  // 大成功/大失败
  let critical = null;
  if (r1.critical === "success" && (!r2 || r2.critical !== "failure")) {
    critical = "critical_success";
  } else if (r1.critical === "failure" && (!r2 || r2.critical !== "success")) {
    critical = "critical_failure";
  }

  return {
    pass,
    total,
    natural,
    dc,
    modifier,
    margin,
    advantage: effectiveAdv,
    disadvantage: effectiveDis,
    critical,
    rolls: r2 ? [r1.natural, r2.natural] : [r1.natural]
  };
}

/**
 * 骰池：掷 count 个 d<sides>，统计 >= threshold 的成功数
 */
export function dicePool(count, sides = 6, threshold = 4) {
  const rolls = [];
  let successes = 0;
  for (let i = 0; i < count; i++) {
    const r = rollDie(sides);
    rolls.push(r);
    if (r >= threshold) successes++;
  }
  return { successes, rolls, count, sides, threshold, total: successes };
}

// ═══════════════════════════════════════════════════════════════
//  2. 角色属性
// ═══════════════════════════════════════════════════════════════

export const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];
export const ATTRIBUTE_LABELS = {
  str: "力量", dex: "敏捷", con: "体质", int: "智力", wis: "感知", cha: "魅力"
};

/** 属性值 → 修正值（D&D 标准：10=+0, 每 2 点 +1） */
export function modifierOf(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * 创建空白角色属性表
 */
export function createCharacterSheet(name = "", options = {}) {
  const { scores = {}, proficiency = 2, level = 1 } = options;
  const base = {
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    ...scores
  };

  const mods = {};
  for (const attr of ATTRIBUTES) {
    mods[attr] = modifierOf(base[attr]);
  }

  const hpMax = 10 + mods.con + (level - 1) * 6;

  return {
    name,
    level,
    proficiencyBonus: proficiency,
    // 六维 + 修正值
    attributes: base,
    modifiers: mods,
    // 衍生
    hp: { current: hpMax, max: hpMax, temp: 0 },
    armorClass: 10 + mods.dex,
    initiative: mods.dex,
    speed: 30,
    // 技能熟练
    skills: {},
    // 装备
    equipment: [],
    // 状态
    conditions: [],
    inspiration: false
  };
}

/**
 * 技能检定
 */
export function skillCheck(sheet, skillKey, dc, options = {}) {
  const skill = sheet.skills[skillKey] || {};
  const attrMod = sheet.modifiers[skill.attribute || "dex"] || 0;
  const profBonus = skill.proficient ? sheet.proficiencyBonus : 0;
  const modifier = attrMod + profBonus + (skill.bonus || 0);
  const result = check(modifier, dc, options);
  return {
    ...result,
    skill: skillKey,
    attribute: skill.attribute || "dex",
    proficient: skill.proficient || false,
    attrMod,
    profBonus
  };
}

/**
 * 属性豁免
 */
export function savingThrow(sheet, attribute, dc, options = {}) {
  const mod = sheet.modifiers[attribute] || 0;
  const proficient = sheet[`${attribute}SaveProficient`] || false;
  const totalMod = mod + (proficient ? sheet.proficiencyBonus : 0);
  const result = check(totalMod, dc, options);
  return { ...result, attribute, proficient, mod, profBonus: proficient ? sheet.proficiencyBonus : 0 };
}

/** 造成伤害 */
export function takeDamage(sheet, amount) {
  const remaining = amount - sheet.hp.temp;
  if (remaining <= 0) {
    sheet.hp.temp -= amount;
    return { damage: amount, tempLost: amount, hpLost: 0, current: sheet.hp.current, down: false };
  }
  sheet.hp.temp = 0;
  sheet.hp.current = Math.max(0, sheet.hp.current - remaining);
  return {
    damage: amount,
    tempLost: amount - remaining,
    hpLost: remaining,
    current: sheet.hp.current,
    down: sheet.hp.current <= 0
  };
}

/** 治疗 */
export function heal(sheet, amount) {
  if (sheet.hp.current <= 0) return { healed: 0, current: 0, message: "无法治疗濒死角色" };
  const before = sheet.hp.current;
  sheet.hp.current = Math.min(sheet.hp.max, sheet.hp.current + amount);
  return { healed: sheet.hp.current - before, current: sheet.hp.current };
}

// ═══════════════════════════════════════════════════════════════
//  3. 难度推断
// ═══════════════════════════════════════════════════════════════

/** 根据叙事上下文推断 DC */
export function inferDC(context = {}) {
  const {
    action = "",           // 玩家行动描述
    proficiency = "none",  // none | trained | expert
    environment = "normal",// normal | hostile | favorable
    resources = "none",    // none | adequate | abundant
    timePressure = false,
    narrativeWeight = "standard" // trivial | standard | dramatic | heroic
  } = context;

  let base = 12; // 普通难度

  // 熟练度调整
  if (proficiency === "expert") base -= 3;
  else if (proficiency === "trained") base -= 1;
  else base += 2; // 未受过训练

  // 环境
  if (environment === "hostile") base += 4;
  else if (environment === "favorable") base -= 2;

  // 资源
  if (resources === "abundant") base -= 3;
  else if (resources === "adequate") base -= 1;
  else base += 2;

  // 时间压力
  if (timePressure) base += 3;

  // 叙事权重
  if (narrativeWeight === "trivial") base -= 4;
  else if (narrativeWeight === "heroic") base += 4;
  else if (narrativeWeight === "dramatic") base += 2;

  return Math.max(5, Math.min(30, base));
}

/** 打印 DC 难度等级 */
export function dcLabel(dc) {
  if (dc <= 5) return { tier: "trivial", label: "非常容易", emoji: "🌟" };
  if (dc <= 10) return { tier: "easy", label: "容易", emoji: "✅" };
  if (dc <= 15) return { tier: "medium", label: "中等", emoji: "⚖️" };
  if (dc <= 20) return { tier: "hard", label: "困难", emoji: "⚡" };
  if (dc <= 25) return { tier: "very_hard", label: "非常困难", emoji: "🔥" };
  return { tier: "nearly_impossible", label: "几乎不可能", emoji: "💀" };
}

// ═══════════════════════════════════════════════════════════════
//  4. 遇敌/遭遇生成
// ═══════════════════════════════════════════════════════════════

const ENCOUNTER_TABLE = {
  wilderness: [
    { weight: 20, entry: "巡逻的守卫" },
    { weight: 15, entry: "迷路的旅行商人" },
    { weight: 15, entry: "受伤的野兽" },
    { weight: 10, entry: "埋伏的强盗" },
    { weight: 10, entry: "神秘的地精营地" },
    { weight: 8, entry: "古老的石像——似乎在移动" },
    { weight: 7, entry: "浓雾中传来马蹄声" },
    { weight: 5, entry: "龙的气息——只是路过" },
    { weight: 5, entry: "废弃营地，留有血迹和密信" },
    { weight: 5, entry: "树精的低语声" }
  ],
  urban: [
    { weight: 20, entry: "乞讨的孤儿" },
    { weight: 15, entry: "喧哗的酒馆争执" },
    { weight: 15, entry: "可疑的街头小贩" },
    { weight: 12, entry: "巡逻的城卫" },
    { weight: 10, entry: "贵族马车疾驰而过" },
    { weight: 8, entry: "张贴栏上的新悬赏令" },
    { weight: 8, entry: "小巷里的秘密接头" },
    { weight: 7, entry: "宗教游行的队伍" },
    { weight: 5, entry: "从屋顶跳下的暗影" }
  ],
  dungeon: [
    { weight: 20, entry: "暗处的动静——窸窣声" },
    { weight: 15, entry: "地上的陷阱触发装置" },
    { weight: 12, entry: "巡逻的巨鼠群" },
    { weight: 10, entry: "废弃的篝火——不久前有人" },
    { weight: 10, entry: "墙上的铭文发出微弱的光" },
    { weight: 8, entry: "骷髅从墙壁上脱落" },
    { weight: 7, entry: "幽魂的低语从前方传来" },
    { weight: 5, entry: "显然不是自然形成的巨大裂缝" }
  ],
  social: [
    { weight: 20, entry: "一个人向你搭话" },
    { weight: 18, entry: "无意中听到的对话片段" },
    { weight: 15, entry: "递到你面前的邀请函" },
    { weight: 12, entry: "明显的谎言被说出" },
    { weight: 10, entry: "一场争论吸引人围观" },
    { weight: 10, entry: "有人求助于你" },
    { weight: 8, entry: "一个秘密被无意泄露" },
    { weight: 7, entry: "意外的重逢——旧识" }
  ]
};

/** 根据环境生成遭遇 */
export function generateEncounter(environment = "wilderness", count = 1) {
  const table = ENCOUNTER_TABLE[environment] || ENCOUNTER_TABLE.wilderness;
  const totalWeight = table.reduce((s, e) => s + e.weight, 0);
  const results = [];

  for (let i = 0; i < count; i++) {
    let roll = Math.random() * totalWeight;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) {
        results.push({ ...entry });
        break;
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
//  5. 跑团方向包（给 LLM 的叙事指令格式）
// ═══════════════════════════════════════════════════════════════

/**
 * 将检定结果格式化为 LLM 可读的叙事指令
 * 跑团 DM 通过叙事隐式反映检定结果，而非直接输出数字。
 */
export function formatCheckResult(result, action = "") {
  const { pass, total, natural, dc, margin, critical } = result;

  // 大成功/大失败 → 直接叙事标记
  if (critical === "critical_success") {
    return `【检定·大成功】nat20！行动"${action}"以意想不到的方式完美成功。超出预期的效果，DM 应给予额外奖励或戏剧性描写。`;
  }
  if (critical === "critical_failure") {
    return `【检定·大失败】nat1！行动"${action}"悲惨失败。DM 应描写戏剧性失败但不完全封锁推进路径。`;
  }

  if (pass) {
    const degree = margin >= 10 ? "出色" : margin >= 5 ? "顺利" : "勉强";
    return `【检定·成功】${degree}（${total} vs DC${dc}）。行动"${action}"成功。DM：用叙事描写成功的细节和满足感。`;
  }
  const degree = margin <= -10 ? "惨败" : margin <= -5 ? "失败" : "差点成功";
  return `【检定·失败】${degree}（${total} vs DC${dc}）。行动"${action}"未成功。DM：叙事中保留推进空间，让玩家知道还差多少。`;
}

/**
 * 生成跑团方向包的 DM 叙事建议段
 */
export function buildTabletopDirectionPacket(input = "", characterSheets = [], environment = "wilderness", round = 0) {
  const parts = [];

  // 玩家输入分析
  const actionKeywords = extractActionKeywords(input);
  if (actionKeywords.length) {
    parts.push(`【玩家行动分析】\n${actionKeywords.map(k => `- ${k}`).join("\n")}`);
  }

  // 检定建议
  const checks = suggestChecks(input, characterSheets);
  if (checks.length) {
    parts.push(`【检定建议】\nDM：在以下时机考虑让玩家掷骰：\n${checks.map(c => `- ${c}`).join("\n")}`);
  }

  // 当前状态
  parts.push(`【当前状态】\n环境: ${environment} | 轮次: ${round}`);

  // 跑团叙事规则
  parts.push(`【跑团叙事规则】
1. 玩家声明行动 → DM 判定难度 → 如需要则让玩家或代掷骰子
2. 检定结果用叙事隐式呈现——成功了怎么顺、失败了怎么不顺
3. DM 不输出数值面板，但可通过角色反应暗示
4. 保留玩家行动空间——每次回应结束时给出可探索的选项
5. 跑团三支柱：探索(环境/信息)、社交(说服/欺骗/威胁)、战斗(命中等)
6. 失败≠卡关，DM 应给出"是的，但是……"或"不，但是……"的变通路径`);

  return parts.join("\n\n");
}

/** 从玩家输入中提取行动关键词 */
function extractActionKeywords(input) {
  const text = String(input || "");
  const patterns = [
    [/(?:我想|我要|我打算)(.+?)(?:[。！，,\n]|$)/g, 1],
    [/^(?:撬开|打开|推开|踢开|破坏)(.+)/, 0],
    [/^(?:说服|威胁|欺骗|交涉)(.+)/, 0],
    [/^(?:寻找|搜索|调查|侦察)(.+)/, 0],
    [/^(?:潜行|躲藏|跟踪|尾随)(.+)/, 0],
    [/^(?:跳跃|攀爬|游泳|跑向)(.+)/, 0],
    [/^(?:破解|鉴定|回忆|研究)(.+)/, 0],
    [/(\w+)检定/i, 0]
  ];

  const keywords = [];
  for (const [re, group] of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const kw = (group === 0 ? m[0] : m[group]).trim();
      if (kw && !keywords.includes(kw)) keywords.push(kw);
      if (!re.global) break;
    }
  }
  return keywords.slice(0, 5);
}

/** 建议检定类型 */
function suggestChecks(input, sheets = []) {
  const text = String(input || "").toLowerCase();
  const suggestions = [];

  // 物理动作 → 力量/敏捷
  if (/撬|开|推|踢|撞|举|扔|攀|跳|跑|躲|爬|游泳/.test(text)) {
    suggestions.push("运动/力量(STR) 或 特技/敏捷(DEX)");
  }
  // 社交 → 魅力
  if (/说服|威胁|欺骗|交涉|谈判|演讲|求情|诱惑/.test(text)) {
    suggestions.push("说服/魅力(CHA) 或 欺骗/魅力(CHA)");
  }
  // 搜索/观察 → 感知/智力
  if (/找|搜|查看|发现|侦察|注意|观察|听到/.test(text)) {
    suggestions.push("察觉/感知(WIS) 或 调查/智力(INT)");
  }
  // 潜行 → 敏捷
  if (/潜行|隐藏|尾随|跟踪|偷袭|暗杀/.test(text)) {
    suggestions.push("潜行/敏捷(DEX)");
  }
  // 知识 → 智力
  if (/鉴定|回忆|破解|破译|认出|知道|历史|魔法/.test(text)) {
    suggestions.push("神秘/智力(INT) 或 历史/智力(INT)");
  }
  // 战斗 → 命中
  if (/攻|打|砍|刺|射|施法|咏唱/.test(text)) {
    suggestions.push("攻击掷骰(STR/DEX) 或 施法检定");
  }

  return suggestions;
}

// ═══════════════════════════════════════════════════════════════
//  6. 跑团模式 DM 指令（注入 world-engine prompt）
// ═══════════════════════════════════════════════════════════════

export const TABLETOP_DM_INSTRUCTION = `你是 World Tree Desktop 跑团模式的 DM。

**跑团模式核心规则：**

1. **骰子判定**：
   - 当玩家声明有风险的动作时，在叙事前进行 d20 检定
   - 使用「【检定】建议DC=x, 技能=y」标记告知系统你的判定
   - 系统会返回「【检定结果】」供你叙事化呈现
   - 不要直接输出数字——用叙事隐式表达成败

2. **DM 主动性**：
   - 积极引导场景——比经典模式更主动提供线索和选项
   - 每个场景给出 2-3 个可探索方向
   - 跑团三支柱：探索 / 社交 / 战斗 循环切换

3. **自由探求**：
   - 玩家可以尝试任何合理的行动
   - 失败不卡关——给出「是的，但是……」或「不，但是……」的变通路径
   - 骰子只是调味——叙事才是核心

4. **输出格式**：
   - 【叙事】← 包含检定结果的沉浸式描写（必须）
   - 【检定建议】← 对接下来可能需要的检定预判（可选）
   - 【状态建议】← 地图/道具/NPC 变化（可选）
   - 【情绪反馈】← player: engagement=x, tension=x（可选）

5. **角色反应**：
   - NPC 的行动也遵守世界逻辑——不是玩家做什么都能成功
   - 但有合理尝试方向时，NPC 可以提示难度，鼓励玩家冒险`;

// ═══════════════════════════════════════════════════════════════
//  7. 导出整合
// ═══════════════════════════════════════════════════════════════

export default {
  // 骰子
  roll, check, dicePool, parseDice,
  // 角色
  ATTRIBUTES, ATTRIBUTE_LABELS, modifierOf,
  createCharacterSheet, skillCheck, savingThrow,
  takeDamage, heal,
  // 难度
  inferDC, dcLabel,
  // 遇敌
  generateEncounter, ENCOUNTER_TABLE,
  // 方向包
  formatCheckResult, buildTabletopDirectionPacket,
  // DM 指令
  TABLETOP_DM_INSTRUCTION
};
