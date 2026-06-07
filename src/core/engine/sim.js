// ===== 模拟经营模式模块 v1.0 =====
// 资源管理 / 时间推进 / 决策后果 / NPC 忠诚度

// ═══════════════════════════════════════════════════════════════
//  1. 资源系统
// ═══════════════════════════════════════════════════════════════

export const RESOURCE_TYPES = {
  gold: { name: "金币", icon: "💰", perTurn: 0 },
  materials: { name: "材料", icon: "🧱", perTurn: 0 },
  manpower: { name: "人力", icon: "👥", perTurn: 0 },
  influence: { name: "影响力", icon: "⭐", perTurn: 0 }
};

export function createResources(initial = {}) {
  return {
    gold: initial.gold || 100,
    materials: initial.materials || 50,
    manpower: initial.manpower || 10,
    influence: initial.influence || 0,
    income: {
      gold: initial.goldIncome || 0,
      materials: initial.materialsIncome || 0,
      manpower: initial.manpowerIncome || 0,
      influence: initial.influenceIncome || 0
    }
  };
}

export function advanceResources(resources, turns = 1) {
  const r = { ...resources };
  r.gold += r.income.gold * turns;
  r.materials += r.income.materials * turns;
  r.manpower += r.income.manpower * turns;
  r.influence += r.income.influence * turns;
  return r;
}

/** 花费检查（不实际扣除） */
export function canAfford(resources, costs = {}) {
  for (const [res, amount] of Object.entries(costs)) {
    if ((resources[res] || 0) < amount) return false;
  }
  return true;
}

/** 花费资源（原地修改） */
export function spend(resources, costs = {}) {
  const r = { ...resources };
  for (const [res, amount] of Object.entries(costs)) {
    r[res] = Math.max(0, (r[res] || 0) - amount);
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════
//  2. 时间系统
// ═══════════════════════════════════════════════════════════════

export const TIME_UNITS = {
  day: { name: "日", hours: 24 },
  week: { name: "周", days: 7 },
  month: { name: "月", days: 30 },
  season: { name: "季", months: 3 },
  year: { name: "年", days: 365 }
};

export function createCalendar(startYear = 1, startSeason = 1) {
  return {
    year: startYear,
    season: startSeason,  // 1=春 2=夏 3=秋 4=冬
    week: 1,
    day: 1,
    totalDays: 0
  };
}

export function advanceTime(calendar, unit, amount = 1) {
  const c = { ...calendar, totalDays: calendar.totalDays };
  switch (unit) {
    case "day": c.day += amount; c.totalDays += amount; break;
    case "week": c.day += amount * 7; c.totalDays += amount * 7; break;
    case "month": c.day += amount * 30; c.totalDays += amount * 30; break;
    case "season": c.day += amount * 90; c.totalDays += amount * 90; break;
    case "year": c.day += amount * 360; c.totalDays += amount * 360; break;
  }

  // 规范化
  while (c.day > 30) { c.day -= 30; c.week++; }
  while (c.week > 4) { c.week -= 4; c.season++; }
  while (c.season > 4) { c.season -= 4; c.year++; }

  return c;
}

export const SEASON_NAMES = ["", "春", "夏", "秋", "冬"];

export function calendarDisplay(cal) {
  return `第${cal.year}年·${SEASON_NAMES[cal.season] || ""}季·第${cal.week}周·第${cal.day}日`;
}

// ═══════════════════════════════════════════════════════════════
//  3. 决策系统
// ═══════════════════════════════════════════════════════════════

export function createDecision(id, title, description = "", options = []) {
  return {
    id, title, description,
    options,              // [{ text, costs:{}, rewards:{}, consequences:"叙事后果描述" }]
    chosen: null,
    deadline: null,       // 可选：超过时间自动选默认
    resolved: false
  };
}

export function decide(decision, optionIndex) {
  if (decision.resolved) return decision;
  const option = decision.options[optionIndex];
  if (!option) return decision;
  return {
    ...decision,
    chosen: optionIndex,
    resolved: true,
    resolvedAt: new Date().toISOString()
  };
}

/** 生成周期性决策 */
export function periodicDecisions(calendar, resources) {
  const decisions = [];

  // 季度决策
  if (calendar.week === 1 && calendar.day === 1) {
    decisions.push(createDecision(
      `season-plan-${calendar.year}-${calendar.season}`,
      `${SEASON_NAMES[calendar.season]}季规划`,
      "本季度的重点发展方向：",
      [
        { text: "发展经济", costs: { influence: 5 }, rewards: { goldIncome: 10 }, consequences: "增加金币收入" },
        { text: "扩军备战", costs: { gold: 50 }, rewards: { manpowerIncome: 5 }, consequences: "增强军事力量" },
        { text: "外交斡旋", costs: { gold: 30 }, rewards: { influence: 15 }, consequences: "提升政治影响力" },
        { text: "维持现状", costs: {}, rewards: {}, consequences: "稳定但不增长" }
      ]
    ));
  }

  return decisions;
}

// ═══════════════════════════════════════════════════════════════
//  4. NPC 忠诚度
// ═══════════════════════════════════════════════════════════════

export function createNPCLoyalty(name, role = "advisor") {
  return {
    name, role,
    loyalty: 50,        // 0-100
    satisfaction: 50,
    lastEvent: "",
    history: []
  };
}

export function adjustLoyalty(npc, delta, reason = "") {
  const loyalty = Math.max(0, Math.min(100, (npc.loyalty || 50) + delta));
  return {
    ...npc,
    loyalty,
    satisfaction: Math.max(0, Math.min(100, (npc.satisfaction || 50) + delta)),
    lastEvent: reason || (delta > 0 ? "满意" : "不满"),
    history: [...(npc.history || []), { delta, reason, at: new Date().toISOString(), loyalty }]
  };
}

export function loyaltyStatus(npc) {
  const l = npc.loyalty || 50;
  if (l >= 90) return "忠心耿耿";
  if (l >= 70) return "忠诚";
  if (l >= 50) return "中立";
  if (l >= 30) return "不满";
  if (l >= 10) return "即将叛变";
  return "已叛变";
}

// ═══════════════════════════════════════════════════════════════
//  5. DM 指令
// ═══════════════════════════════════════════════════════════════

export const SIM_DM_INSTRUCTION = `你是 World Tree Desktop 模拟经营模式的 DM。

**模拟经营模式核心规则：**

1. **时间自动推进**：
   - 每次互动后时间自动推进（日→周→月→季→年）
   - 周期性产出资源报告
   - 季度节点自动触发决策事件

2. **资源管理**：
   - 四维资源：金币💰/材料🧱/人力👥/影响力⭐
   - 每轮自动计算收入
   - 建造/投资/外交花费对应资源

3. **决策后果**：
   - 每次重大决策（季度规划/突发事件）有多个选项
   - 每个选项有明确的资源代价和预期收益
   - 决策影响后续事件路径——短期利益可能带来长期风险

4. **NPC 忠诚度**：
   - 核心 NPC 有忠诚度/满意度数值
   - 忠诚度随决策效果和待遇自然波动
   - 忠诚度低→叛变或效率下降，忠诚度高→特殊加成

5. **输出格式**：
   - 【周期报告】← 时间推进摘要+资源变化（必须）
   - 【事件驱动】← 突发事件/机遇（可选）
   - 【决策后果】← 上次决策的叙事结果（可选）
   - 【下阶段选项】← 接下来可做的选择（可选）

6. **叙事风格**：
   - 以报告/摘要/新闻体呈现——不是冒险叙事
   - 用数据和事件说话，保留管理者的俯瞰视角
   - 允许跳过细节，大跨度推进（数周/数月/数年）
   - 危机感来自"一个决策错了，整个势力下滑"的连锁反应`;

export default {
  RESOURCE_TYPES, createResources, advanceResources, canAfford, spend,
  TIME_UNITS, createCalendar, advanceTime, SEASON_NAMES, calendarDisplay,
  createDecision, decide, periodicDecisions,
  createNPCLoyalty, adjustLoyalty, loyaltyStatus,
  SIM_DM_INSTRUCTION
};
