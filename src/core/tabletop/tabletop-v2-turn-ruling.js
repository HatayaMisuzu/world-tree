// Tabletop V2 Turn Ruling
// Classifies player intent, validates against book, resolves deterministic ruling,
// and builds a GM narration packet. LLM narrates only after ruling is produced.

import {
  resolveD20Check,
  resolveD100Check,
  resolve2d6Check,
  resolveDicePoolCheck,
  rollOracleTable,
} from "./tabletop-v2-dice-engine.js";

// ── Intent classification ──

const ACTION_PATTERNS = [
  { type: "combat", patterns: [/攻击|战斗|砍|射|打|杀|格斗|防御|闪避|盾/i] },
  { type: "social", patterns: [/说服|交涉|谈判|欺骗|威胁|魅惑|恐吓|请求/i] },
  { type: "investigate", patterns: [/调查|搜索|检查|观察|侦查|分析|研究|鉴定/i] },
  { type: "stealth", patterns: [/潜行|隐藏|躲|偷|窃|暗中|悄悄|无声/i] },
  { type: "explore", patterns: [/探索|移动|前进|进入|离开|前往|穿过|攀爬/i] },
  { type: "use_skill", patterns: [/使用|施展|发动|启动|操作|撬锁|破解|追踪|治疗/i] },
  { type: "knowledge", patterns: [/知道|了解|记得|回忆|学识|历史|传闻/i] },
];

export function classifyPlayerIntent(intent = "", context = {}) {
  if (!intent || intent.trim().length === 0) {
    return { type: "unknown", confidence: 0 };
  }

  const results = ACTION_PATTERNS.map(({ type, patterns }) => {
    const matches = patterns.filter((p) => p.test(intent));
    return { type, matchCount: matches.length };
  });

  const best = results.sort((a, b) => b.matchCount - a.matchCount)[0];
  return {
    type: best.matchCount > 0 ? best.type : "explore", // default to explore
    confidence: best.matchCount > 0 ? Math.min(1, best.matchCount / 2) : 0.3,
    allMatches: results.filter((r) => r.matchCount > 0).map((r) => r.type),
  };
}

// ── Roll decision ──

function decideRollType(intentType, ruleset, scene) {
  const visibilityPolicy = ruleset?.rollVisibilityPolicy || {};
  const defaultVis = visibilityPolicy.defaultVisibility || "public";
  const hiddenTypes = visibilityPolicy.hiddenActionTypes || [];

  const visibility = hiddenTypes.includes(intentType) ? "hidden" : defaultVis;

  // Determine if a roll is needed
  const noRollTypes = ["knowledge", "explore"];
  const needsRoll = !noRollTypes.includes(intentType);

  return { needsRoll, visibility };
}

// ── Ruling request ──

export function createRulingRequest({ module, runState, playerIntent, actor } = {}) {
  if (!playerIntent || typeof playerIntent !== "string" || playerIntent.trim().length === 0) {
    return { error: "playerIntent is required and must be a non-empty string" };
  }

  const intent = playerIntent.trim();
  const scene = runState?.currentSceneId
    ? (module?.scenes || []).find((s) => s.sceneId === runState.currentSceneId)
    : null;

  const classification = classifyPlayerIntent(intent, { scene });
  const ruleset = module?.ruleset || { kind: "d20" };
  const rollDecision = decideRollType(classification.type, ruleset, scene);

  return {
    intent,
    classification,
    rollDecision,
    sceneId: runState?.currentSceneId || null,
    scene,
    actor: actor || runState?.playerCharacter || null,
    turnIndex: (runState?.turnIndex || 0) + 1,
    rulesetKind: ruleset.kind || "d20",
    moduleId: module?.moduleId,
  };
}

// ── Deterministic ruling (no LLM) ──

export function resolveRulingWithoutLlm(request) {
  if (!request || request.error) {
    return { error: request?.error || "invalid ruling request", roll: null, consequences: [] };
  }

  const { classification, rollDecision, rulesetKind, actor } = request;

  let roll = null;

  if (rollDecision.needsRoll) {
    const options = { visibility: rollDecision.visibility };

    switch (rulesetKind) {
      case "d20": {
        const mod = calculateModifier(classification.type, actor);
        const dc = estimateDC(classification.type, request.scene);
        roll = resolveD20Check({ modifier: mod, dc, visibility: rollDecision.visibility }, options);
        break;
      }
      case "d100": {
        const target = estimateD100Target(classification.type, request.scene);
        roll = resolveD100Check({ target, visibility: rollDecision.visibility }, options);
        break;
      }
      case "2d6": {
        const mod = calculateModifier(classification.type, actor);
        roll = resolve2d6Check({ modifier: mod, visibility: rollDecision.visibility }, options);
        break;
      }
      case "dice_pool": {
        const pool = estimateDicePool(classification.type, actor);
        roll = resolveDicePoolCheck({
          count: pool.count,
          sides: pool.sides,
          successThreshold: pool.successThreshold,
          mode: "count_successes",
          requiredSuccesses: pool.requiredSuccesses,
          visibility: rollDecision.visibility,
        }, options);
        break;
      }
      default: {
        // fallback to d20
        roll = resolveD20Check({ dc: 10, visibility: rollDecision.visibility }, options);
      }
    }
  }

  const consequences = deriveConsequences(classification, roll, request);

  return {
    roll,
    consequences,
    noRoll: !rollDecision.needsRoll,
    classification: classification.type,
    visibility: roll?.visibility || "public",
  };
}

// ── Helper: modifier from actor stats ──

function calculateModifier(actionType, actor) {
  if (!actor?.stats) return 0;
  const stats = actor.stats || {};
  const map = {
    combat: stats.strength || stats.combat || stats.fight || 0,
    social: stats.charisma || stats.social || stats.charm || 0,
    investigate: stats.intelligence || stats.perception || stats.investigation || 0,
    stealth: stats.dexterity || stats.stealth || stats.agility || 0,
    explore: stats.constitution || stats.athletics || stats.survival || 0,
    use_skill: stats.skill || stats.dexterity || 0,
    knowledge: stats.intelligence || stats.knowledge || 0,
  };
  return map[actionType] || 0;
}

function estimateDC(actionType, scene) {
  // Base DC by action type, could be overridden by scene
  const base = {
    combat: 13,
    social: 12,
    investigate: 12,
    stealth: 14,
    explore: 10,
    use_skill: 12,
    knowledge: 10,
  };
  return base[actionType] || 12;
}

function estimateD100Target(actionType, scene) {
  const base = {
    combat: 50,
    social: 50,
    investigate: 40,
    stealth: 40,
    explore: 60,
    use_skill: 50,
    knowledge: 60,
  };
  return base[actionType] || 50;
}

function estimateDicePool(actionType, actor) {
  const defaultPool = { count: 4, sides: 6, successThreshold: 5, requiredSuccesses: 2 };
  const map = {
    combat: { ...defaultPool },
    stealth: { count: 3, sides: 6, successThreshold: 5, requiredSuccesses: 3 },
    social: { count: 4, sides: 6, successThreshold: 4, requiredSuccesses: 2 },
  };
  return map[actionType] || defaultPool;
}

function deriveConsequences(classification, roll, request) {
  const consequences = [];

  if (!roll) {
    consequences.push({ type: "auto_success", description: "无需投骰，自动成功" });
    return consequences;
  }

  switch (roll.outcome) {
    case "critical_success":
      consequences.push({ type: "bonus", description: "大成功！额外收益或优势" });
      break;
    case "success":
      consequences.push({ type: "success", description: "行动成功" });
      break;
    case "partial_success":
      consequences.push({ type: "complication", description: "部分成功，附带代价或限制" });
      break;
    case "failure_forward":
      consequences.push({ type: "complication", description: "失败但剧情推进，局面变化" });
      break;
    case "critical_failure":
      consequences.push({ type: "setback", description: "大失败！严重挫折或意外" });
      break;
  }

  return consequences;
}

// ── GM narration packet ──

export function buildGmNarrationPacket(ruling) {
  if (!ruling || ruling.error) {
    return { error: ruling?.error || "invalid ruling", promptHints: [] };
  }

  const { roll, classification, consequences, noRoll } = ruling;

  const promptHints = [];

  if (noRoll) {
    promptHints.push("本次行动无需投骰。根据玩家意图和当前场景自然推进叙事。");
  } else if (roll) {
    promptHints.push(`投骰结果: ${roll.expression} = ${roll.total} (${roll.outcome})`);
    if (roll.probabilityEstimate !== undefined) {
      promptHints.push(`成功概率: ${Math.round(roll.probabilityEstimate * 100)}%`);
    }
  }

  for (const c of consequences) {
    promptHints.push(`后果: ${c.description}`);
  }

  promptHints.push("请根据投骰结果和后果描述，用第三人称叙事推进场景。不重复投骰细节，只呈现结果。");

  return {
    promptHints,
    rollSummary: roll
      ? {
          expression: roll.expression,
          total: roll.total,
          outcome: roll.outcome,
          visibility: roll.visibility,
        }
      : null,
    classification,
    consequences: consequences.map((c) => c.description),
  };
}

// ── Ruling validation ──

export function validateRuling(ruling) {
  const errors = [];
  if (!ruling) errors.push("ruling is required");
  else {
    if (ruling.roll && ruling.roll.source !== "system_dice_engine") {
      errors.push("roll must come from system_dice_engine");
    }
    if (ruling.roll && ruling.roll.llmGenerated !== false) {
      errors.push("roll must not be LLM-generated");
    }
    if (!ruling.classification) errors.push("classification is required");
  }
  return { valid: errors.length === 0, errors };
}
