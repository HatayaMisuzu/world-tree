const DICE_NOTATION = /^(\d+)d(\d+)([+-]\d+)?$/i;

export function parseDiceNotation(value = "") {
  const notation = String(value).trim().replace(/^\/roll\s+/i, "");
  const match = notation.match(DICE_NOTATION);
  if (!match) return { ok: false, error: "invalid dice notation" };
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (!Number.isInteger(count) || count < 1 || count > 100) return { ok: false, error: "dice count must be between 1 and 100" };
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) return { ok: false, error: "dice sides must be between 2 and 1000" };
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 10000) return { ok: false, error: "dice modifier out of range" };
  return { ok: true, notation: `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ""}`, count, sides, modifier };
}
export function rollDice(value, rng = Math.random) {
  const parsed = typeof value === "string" ? parseDiceNotation(value) : value;
  if (!parsed?.ok) return parsed || { ok: false, error: "invalid dice notation" };
  const rolls = Array.from({ length: parsed.count }, () => Math.floor(Math.max(0, Math.min(0.999999999, Number(rng())) ) * parsed.sides) + 1);
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + parsed.modifier;
  return {
    ...parsed,
    rolls,
    total,
    isCriticalSuccess: parsed.count === 1 && parsed.sides === 20 && rolls[0] === 20,
    isCriticalFailure: parsed.count === 1 && parsed.sides === 20 && rolls[0] === 1
  };
}

export function formatDicePromptContext(result = {}) {
  if (!result.ok) return "";
  return `【桌面判定】${result.notation} => [${result.rolls.join(", ")}] ${result.modifier ? `${result.modifier > 0 ? "+" : ""}${result.modifier}` : ""} = ${result.total}。骰子结果是已确认运行态，不得被 Writer 或 Guardian 改写。`;
}
