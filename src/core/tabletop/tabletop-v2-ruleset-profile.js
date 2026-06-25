// Tabletop V2 Ruleset Profile
// Reusable ruleset definitions. Each profile defines dice behavior, difficulty scales,
// outcome bands, roll visibility defaults, and book override policy.

// ── Default profiles ──

const PROFILES = {
  d20_fantasy: {
    rulesetId: "d20_fantasy",
    kind: "d20",
    label: "D20 奇幻冒险",
    dicePolicy: {
      defaultExpression: "1d20",
      advantageSupported: true,
      disadvantageSupported: true,
      modifierRange: { min: -10, max: 20 },
    },
    probabilityPolicy: {
      showEstimate: true,
      estimateMethod: "exact",
    },
    rollVisibilityPolicy: {
      defaultVisibility: "public",
      allowHidden: true,
      hiddenActionTypes: ["stealth", "perception", "insight", "deception"],
    },
    difficultyScale: {
      trivial: 5,
      easy: 10,
      medium: 15,
      hard: 20,
      veryHard: 25,
      nearlyImpossible: 30,
    },
    outcomeBands: [
      { outcome: "critical_success", condition: "nat20", description: "大成功" },
      { outcome: "success", condition: "total >= dc", description: "成功" },
      { outcome: "failure_forward", condition: "total < dc", description: "失败但有前进" },
      { outcome: "critical_failure", condition: "nat1", description: "大失败" },
    ],
    failureForwardPolicy: "narrative_push", // advance story with complication
    bookOverridePolicy: "book_wins", // book-defined DC/difficulty overrides profile defaults
  },

  d100_investigation: {
    rulesetId: "d100_investigation",
    kind: "d100",
    label: "D100 调查/恐怖",
    dicePolicy: {
      defaultExpression: "1d100",
      modifierSupported: false,
    },
    probabilityPolicy: {
      showEstimate: false, // keep tension — player doesn't know exact odds
      estimateMethod: "exact",
    },
    rollVisibilityPolicy: {
      defaultVisibility: "hidden", // investigation rolls often hidden
      allowPublic: true,
      publicActionTypes: ["combat", "chase", "physical_feat"],
    },
    difficultyScale: {
      standard: 50,
      hard: 30,
      extreme: 15,
    },
    outcomeBands: [
      { outcome: "critical_success", condition: "roll <= extremeTarget", description: "极限成功" },
      { outcome: "success", condition: "roll <= hardTarget", description: "困难成功" },
      { outcome: "partial_success", condition: "roll <= target", description: "常规成功" },
      { outcome: "failure_forward", condition: "roll > target", description: "失败推动" },
    ],
    failureForwardPolicy: "clue_redirect", // always get a clue, but maybe misleading
    bookOverridePolicy: "book_wins",
  },

  "2d6_narrative": {
    rulesetId: "2d6_narrative",
    kind: "2d6",
    label: "2D6 叙事驱动",
    dicePolicy: {
      defaultExpression: "2d6",
      modifierRange: { min: -3, max: 4 },
    },
    probabilityPolicy: {
      showEstimate: true,
      estimateMethod: "exact",
    },
    rollVisibilityPolicy: {
      defaultVisibility: "public",
      allowHidden: true,
      hiddenActionTypes: [],
    },
    difficultyScale: {
      // 2d6 typically uses static bands, not variable DC
      success: 10,
      partial: 7,
    },
    outcomeBands: [
      { outcome: "success", condition: "total >= 10", description: "完全成功" },
      { outcome: "partial_success", condition: "7 <= total < 10", description: "部分成功" },
      { outcome: "failure_forward", condition: "total < 7", description: "失败但推进" },
    ],
    failureForwardPolicy: "hard_move", // GM makes a hard move on 6-
    bookOverridePolicy: "book_wins",
  },

  dice_pool_pressure: {
    rulesetId: "dice_pool_pressure",
    kind: "dice_pool",
    label: "Dice Pool 潜入/压力",
    dicePolicy: {
      defaultPool: 4,
      defaultSides: 6,
      successThreshold: 5,
      poolMode: "count_successes",
    },
    probabilityPolicy: {
      showEstimate: true,
      estimateMethod: "binomial",
    },
    rollVisibilityPolicy: {
      defaultVisibility: "public",
      allowHidden: true,
      hiddenActionTypes: ["stealth_check", "sabotage"],
    },
    difficultyScale: {
      easy: { requiredSuccesses: 1 },
      standard: { requiredSuccesses: 2 },
      hard: { requiredSuccesses: 3 },
      extreme: { requiredSuccesses: 4 },
    },
    outcomeBands: [
      { outcome: "critical_success", condition: "successes >= required + 1", description: "超额完成" },
      { outcome: "success", condition: "successes >= required", description: "完成" },
      { outcome: "partial_success", condition: "successes >= 1", description: "部分完成" },
      { outcome: "failure_forward", condition: "successes == 0", description: "压力上升" },
    ],
    failureForwardPolicy: "add_pressure_die", // add a stress/pressure consequence
    bookOverridePolicy: "book_wins",
  },

  low_dice_story: {
    rulesetId: "low_dice_story",
    kind: "low_dice",
    label: "低骰叙事书",
    dicePolicy: {
      defaultExpression: "1d6",
      modifierSupported: false,
    },
    probabilityPolicy: {
      showEstimate: false,
      estimateMethod: "none",
    },
    rollVisibilityPolicy: {
      defaultVisibility: "public",
      allowHidden: false,
    },
    difficultyScale: {
      // Low-dice: simple oracle-like outcomes
      favorable: { min: 5, max: 6, outcome: "success" },
      mixed: { min: 3, max: 4, outcome: "partial_success" },
      unfavorable: { min: 1, max: 2, outcome: "failure_forward" },
    },
    outcomeBands: [
      { outcome: "success", condition: "5-6", description: "顺利" },
      { outcome: "partial_success", condition: "3-4", description: "波折" },
      { outcome: "failure_forward", condition: "1-2", description: "逆转" },
    ],
    failureForwardPolicy: "narrative_complication",
    bookOverridePolicy: "book_wins",
  },
};

// ── Factory ──

export function createDefaultRulesetProfile(kind = "d20_fantasy") {
  const profile = PROFILES[kind];
  if (!profile) throw new Error(`unknown ruleset kind: ${kind}. Supported: ${Object.keys(PROFILES).join(", ")}`);
  return structuredClone(profile);
}

// ── Normalizer ──

export function normalizeRulesetProfile(profile = {}) {
  if (!profile || typeof profile !== "object") return null;
  const defaultProfile = PROFILES[profile.kind] ? structuredClone(PROFILES[profile.kind]) : null;

  return {
    rulesetId: profile.rulesetId || defaultProfile?.rulesetId || profile.kind || "custom",
    kind: profile.kind || defaultProfile?.kind || "custom",
    label: profile.label || defaultProfile?.label || "自定义规则集",
    dicePolicy: { ...(defaultProfile?.dicePolicy || {}), ...(profile.dicePolicy || {}) },
    probabilityPolicy: { ...(defaultProfile?.probabilityPolicy || {}), ...(profile.probabilityPolicy || {}) },
    rollVisibilityPolicy: { ...(defaultProfile?.rollVisibilityPolicy || {}), ...(profile.rollVisibilityPolicy || {}) },
    difficultyScale: { ...(defaultProfile?.difficultyScale || {}), ...(profile.difficultyScale || {}) },
    outcomeBands: profile.outcomeBands || defaultProfile?.outcomeBands || [],
    failureForwardPolicy: profile.failureForwardPolicy || defaultProfile?.failureForwardPolicy || "narrative_push",
    bookOverridePolicy: profile.bookOverridePolicy || defaultProfile?.bookOverridePolicy || "book_wins",
    // preserve custom fields
    custom: profile.custom || {},
  };
}

// ── Validator ──

export function validateRulesetProfile(profile = {}) {
  const errors = [];
  if (!profile.rulesetId) errors.push("rulesetId is required");
  if (!profile.kind) errors.push("kind is required");
  if (!["d20", "d100", "2d6", "dice_pool", "low_dice", "custom"].includes(profile.kind)) {
    errors.push(`unknown ruleset kind: ${profile.kind}`);
  }
  if (!profile.dicePolicy) errors.push("dicePolicy is required");
  if (!profile.outcomeBands || profile.outcomeBands.length === 0) errors.push("outcomeBands must be a non-empty array");
  if (!profile.failureForwardPolicy) errors.push("failureForwardPolicy is required");
  return { valid: errors.length === 0, errors };
}

// ── List available kinds ──

export function listRulesetKinds() {
  return Object.keys(PROFILES).map((k) => ({ kind: k, label: PROFILES[k].label }));
}
