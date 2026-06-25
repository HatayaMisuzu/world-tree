// Tabletop V2 Dice Engine
// Deterministic dice rolling, probability estimation, and roll record invariants.
// LLM never produces dice results — all rolls go through this engine.

// ── Seeded RNG (mulberry32) ──

export function createSeededRng(seed = 1) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ── Expression parsing ──

const DICE_EXPR_RE = /^(\d*)d(\d+)([+-]\d+)?$/i;

export function normalizeDiceExpression(expression) {
  if (!expression || typeof expression !== "string") {
    return { ok: false, error: "expression must be a non-empty string" };
  }
  const match = String(expression).trim().match(DICE_EXPR_RE);
  if (!match) return { ok: false, error: `invalid dice expression: ${expression}` };
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (!Number.isInteger(count) || count < 1 || count > 100) return { ok: false, error: "dice count must be 1–100" };
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) return { ok: false, error: "dice sides must be 2–1000" };
  return { ok: true, count, sides, modifier, expression: `${count}d${sides}${modifier > 0 ? "+" + modifier : modifier < 0 ? String(modifier) : ""}` };
}

// ── Core roll ──

function resolveRng(options = {}) {
  if (options.rng) return options.rng;
  if (options.seed !== undefined) return createSeededRng(options.seed);
  return Math.random;
}

export function rollDie(sides, rng = Math.random) {
  return Math.floor(rng() * sides) + 1;
}

export function rollDiceExpression(expression = "1d20", options = {}) {
  const parsed = normalizeDiceExpression(expression);
  if (!parsed.ok) throw new Error(parsed.error);
  const rng = resolveRng(options);
  const results = Array.from({ length: parsed.count }, () => rollDie(parsed.sides, rng));
  const rawTotal = results.reduce((a, b) => a + b, 0);
  return {
    expression: parsed.expression,
    dice: [{ sides: parsed.sides, results }],
    modifier: parsed.modifier,
    total: rawTotal + parsed.modifier,
    rawTotal,
    count: parsed.count,
  };
}

// ── Probability estimation (no LLM) ──

function clampProb(v) {
  return Math.max(0, Math.min(1, v));
}

export function estimateDiceProbability(check = {}, options = {}) {
  const kind = check.kind || "d20";
  if (kind === "d20") {
    const mod = Number(check.modifier || 0);
    const dc = Number(check.dc || check.target || 10);
    const needed = dc - mod;
    const successFaces = Math.max(0, Math.min(20, 21 - needed));
    let prob = successFaces / 20;
    // advantage / disadvantage: enumerate 400 pairs
    if (check.advantage) prob = 1 - Math.pow((20 - successFaces) / 20, 2);
    if (check.disadvantage) prob = Math.pow(successFaces / 20, 2);
    return clampProb(prob);
  }
  if (kind === "d100") {
    const target = Number(check.target || 50);
    return clampProb(Math.min(target, 100) / 100);
  }
  if (kind === "2d6") {
    const mod = Number(check.modifier || 0);
    // 2d6 distribution: 7 is most common (6/36)
    const dist = [0, 0, 0, 1, 3, 6, 10, 15, 21, 26, 30, 33, 35, 36]; // cumulative ≤ n
    const neededForSuccess = 10 - mod;
    const neededForPartial = 7 - mod;
    if (neededForSuccess <= 2) return 1;
    if (neededForSuccess > 12) return 0;
    const successProb = (36 - dist[Math.min(12, neededForSuccess - 1)]) / 36;
    return clampProb(successProb);
  }
  if (kind === "dice_pool") {
    const count = check.count || Number((check.dice || "4d6").match(/^(\d+)d/)?.[1]) || 4;
    const sides = check.sides || 6;
    const threshold = check.successThreshold || 5;
    const singleSuccessProb = (sides - threshold + 1) / sides;
    const required = check.requiredSuccesses || 1;
    // binomial: at least `required` successes
    let prob = 0;
    for (let k = required; k <= count; k++) {
      prob += binomial(count, k, singleSuccessProb);
    }
    return clampProb(prob);
  }
  return null; // unknown kind
}

function binomial(n, k, p) {
  if (k < 0 || k > n) return 0;
  return combinations(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function combinations(n, k) {
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

// ── System-specific resolvers ──

export function resolveD20Check(check = {}, options = {}) {
  const roll = rollDiceExpression("1d20", options);
  const modifier = Number(check.modifier || 0);
  const dc = Number(check.dc || check.target || 10);
  const natural = roll.dice[0].results[0];
  const total = natural + modifier;
  const probabilityEstimate = estimateDiceProbability({ kind: "d20", modifier, dc, advantage: check.advantage, disadvantage: check.disadvantage });

  let outcome;
  if (natural === 20 && check.disableCrit !== true) outcome = "critical_success";
  else if (natural === 1 && check.disableCrit !== true) outcome = "critical_failure";
  else if (total >= dc) outcome = "success";
  else outcome = "failure_forward";

  return {
    rollId: options.rollId,
    visibility: check.visibility || "public",
    rulesetKind: "d20",
    expression: roll.expression,
    dice: roll.dice,
    modifier,
    target: dc,
    probabilityEstimate,
    total,
    natural,
    outcome,
    source: "system_dice_engine",
    llmGenerated: false,
    seedInfo: options.seed !== undefined ? { seed: options.seed } : undefined,
  };
}

export function resolveD100Check(check = {}, options = {}) {
  const roll = rollDiceExpression("1d100", options);
  const natural = roll.dice[0].results[0] || roll.total;
  const target = Number(check.target || 50);
  const hardTarget = Number(check.hardTarget || Math.floor(target / 2));
  const extremeTarget = Number(check.extremeTarget || Math.floor(target / 5));
  const probabilityEstimate = estimateDiceProbability({ kind: "d100", target });

  let outcome;
  if (natural <= extremeTarget) outcome = "critical_success";
  else if (natural <= hardTarget) outcome = "success";
  else if (natural <= target) outcome = "partial_success";
  else outcome = "failure_forward";

  return {
    rollId: options.rollId,
    visibility: check.visibility || "public",
    rulesetKind: "d100",
    expression: roll.expression,
    dice: roll.dice,
    target,
    hardTarget,
    extremeTarget,
    probabilityEstimate,
    total: natural,
    natural,
    outcome,
    source: "system_dice_engine",
    llmGenerated: false,
    seedInfo: options.seed !== undefined ? { seed: options.seed } : undefined,
  };
}

export function resolve2d6Check(check = {}, options = {}) {
  const roll = rollDiceExpression("2d6", options);
  const modifier = Number(check.modifier || 0);
  const total = roll.total + modifier;
  const probabilityEstimate = estimateDiceProbability({ kind: "2d6", modifier });

  let outcome;
  if (total >= 10) outcome = "success";
  else if (total >= 7) outcome = "partial_success";
  else outcome = "failure_forward";

  return {
    rollId: options.rollId,
    visibility: check.visibility || "public",
    rulesetKind: "2d6",
    expression: roll.expression,
    dice: roll.dice,
    modifier,
    probabilityEstimate,
    total,
    rawTotal: roll.total,
    outcome,
    source: "system_dice_engine",
    llmGenerated: false,
    seedInfo: options.seed !== undefined ? { seed: options.seed } : undefined,
  };
}

export function resolveDicePoolCheck(check = {}, options = {}) {
  const count = check.count || 4;
  const sides = check.sides || 6;
  const expression = `${count}d${sides}`;
  const roll = rollDiceExpression(expression, options);
  const mode = check.mode || "count_successes";
  const successThreshold = check.successThreshold || 5;
  const results = roll.dice[0].results;
  const successes = results.filter((r) => r >= successThreshold).length;
  const highest = Math.max(...results);
  const probabilityEstimate = estimateDiceProbability({ kind: "dice_pool", count, sides, successThreshold, requiredSuccesses: check.requiredSuccesses || 1 });

  let outcome;
  if (mode === "count_successes") {
    const required = check.requiredSuccesses || 2;
    if (successes >= required + 1) outcome = "critical_success";
    else if (successes >= required) outcome = "success";
    else if (successes >= 1) outcome = "partial_success";
    else outcome = "failure_forward";
  } else if (mode === "take_highest") {
    const bands = check.bands || [{ min: 6, outcome: "success" }, { min: 4, outcome: "partial_success" }];
    const band = bands.find((b) => highest >= b.min);
    outcome = band ? band.outcome : "failure_forward";
  } else {
    outcome = successes > 0 ? "success" : "failure_forward";
  }

  return {
    rollId: options.rollId,
    visibility: check.visibility || "public",
    rulesetKind: "dice_pool",
    expression: roll.expression,
    dice: roll.dice,
    successThreshold,
    mode,
    successes,
    highest,
    probabilityEstimate,
    outcome,
    source: "system_dice_engine",
    llmGenerated: false,
    seedInfo: options.seed !== undefined ? { seed: options.seed } : undefined,
  };
}

// ── Oracle / random table ──

export function rollOracleTable(table = [], options = {}) {
  if (!Array.isArray(table) || table.length === 0) {
    throw new Error("oracle table must be a non-empty array");
  }
  // Determine dice expression from table ranges
  const maxRange = Math.max(...table.map((e) => e.range?.[1] || 0));
  let expression;
  if (maxRange <= 6) expression = "1d6";
  else if (maxRange <= 20) expression = "1d20";
  else if (maxRange <= 100) expression = "1d100";
  else expression = `1d${maxRange}`;

  const roll = rollDiceExpression(expression, options);
  const result = roll.dice[0].results[0];
  const entry = table.find((e) => e.range && result >= e.range[0] && result <= e.range[1]);

  return {
    rollId: options.rollId,
    visibility: options.visibility || "public",
    rulesetKind: "oracle",
    expression: roll.expression,
    dice: roll.dice,
    result,
    entry: entry || null,
    source: "system_dice_engine",
    llmGenerated: false,
    seedInfo: options.seed !== undefined ? { seed: options.seed } : undefined,
  };
}

// ── Roll record validation ──

export function validateRollRecord(record = {}) {
  const errors = [];
  if (!record.source || record.source !== "system_dice_engine") errors.push("source must be 'system_dice_engine'");
  if (record.llmGenerated !== false) errors.push("llmGenerated must be false");
  if (!record.expression) errors.push("expression is required");
  if (!Array.isArray(record.dice) || record.dice.length === 0) errors.push("dice array is required");
  else {
    for (const d of record.dice) {
      if (!d.sides || !Array.isArray(d.results)) errors.push("each die entry needs sides and results array");
    }
  }
  if (!record.outcome || !["critical_success", "success", "partial_success", "failure_forward", "critical_failure"].includes(record.outcome)) {
    errors.push("invalid outcome value");
  }
  return { valid: errors.length === 0, errors };
}
