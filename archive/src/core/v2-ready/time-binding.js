// src/core/v2-ready/time-binding.js — v2-ready lightweight time binding
// Stage 4: phase/turn/chapter binding for entities. NOT a full timeline engine.

function safeStr(v, fb = "") {
  return typeof v === "string" ? v.trim().slice(0, 200) : fb;
}

export function normalizeTimeBinding(input = {}) {
  return Object.freeze({
    phase: safeStr(input?.phase || "", ""),
    turnRange: Array.isArray(input?.turnRange) && input.turnRange.length === 2
      ? [Number(input.turnRange[0]) || 0, Number(input.turnRange[1]) || 0]
      : null,
    chapterId: safeStr(input?.chapterId || "", ""),
    dayPhase: safeStr(input?.dayPhase || "", ""),
    unlockCondition: safeStr(input?.unlockCondition || "", ""),
  });
}

export function isTimeBindingActive(binding, context = {}) {
  if (!binding) return true; // no binding = always active

  const currentTurn = Number(context?.turnCount || context?.turn || 0);
  const currentChapter = safeStr(context?.chapterId || "", "");

  // Turn range check
  if (binding.turnRange) {
    const [start, end] = binding.turnRange;
    if (currentTurn < start) return false;
    if (end > 0 && currentTurn > end) return false;
  }

  // Chapter check
  if (binding.chapterId && currentChapter && binding.chapterId !== currentChapter) {
    return false;
  }

  // Unlock condition: simple check — if set, must match context flag
  if (binding.unlockCondition) {
    const flag = context?.flags?.[binding.unlockCondition];
    if (flag !== true) return false;
  }

  return true;
}
