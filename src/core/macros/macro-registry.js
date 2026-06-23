// macro-registry.js — M10 Macro System
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: runtime (template resolution) — never reads hidden/private

const HIDDEN_PATTERNS = /hiddenTruth|answerLock|truthLock|_private|_systemOnly|apiKey|secret/i;

export const SAFE_MACROS = {
  "mode.id": (ctx) => ctx.modeId || "",
  "branch.id": (ctx) => ctx.branchId || "main",
  "scene.title": (ctx) => ctx.sceneTitle || "",
  "protagonist.id": (ctx) => ctx.protagonistId || "",
  "character.name": (ctx) => ctx.characterName || "",
  "faction.name": (ctx) => ctx.factionName || "",
  "turn.count": (ctx) => String(ctx.turnCount || 0),
  "telemetry.tension": (ctx) => ctx.telemetryTension || "steady",
  "worldState.key": (ctx, args) => ctx.worldState?.[args] || ""
};

export function resolveMacro(template = "", context = {}) {
  const warnings = [];
  const resolved = String(template).replace(/\{\{(\w+(?:\.\w+)?)(?::(\w+))?\}\}/g, (match, key, arg) => {
    if (HIDDEN_PATTERNS.test(key)) {
      warnings.push(`macro blocked (hidden): ${key}`);
      return `{{FILTERED:${key}}}`;
    }
    const fn = SAFE_MACROS[key];
    if (!fn) {
      warnings.push(`unknown macro: ${key}`);
      return match;
    }
    return fn(context, arg);
  });
  return { resolved, warnings };
}

export function validateMacroScope(template = "") {
  const macros = String(template).match(/\{\{(\w+(?:\.\w+)?)(?::(\w+))?\}\}/g) || [];
  const blocked = macros.filter(m => HIDDEN_PATTERNS.test(m));
  const unknown = macros.filter(m => {
    const key = m.replace(/^\{\{|\}\}$/g, "").split(":")[0];
    return !SAFE_MACROS[key] && !HIDDEN_PATTERNS.test(key);
  });
  return { valid: blocked.length === 0, macros: macros.length, blocked, unknown };
}
