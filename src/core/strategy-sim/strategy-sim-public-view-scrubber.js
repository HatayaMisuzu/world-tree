// src/core/strategy-sim/strategy-sim-public-view-scrubber.js
// Converts full StrategyRunState into report-safe/player-safe public view.

import { normalizeVisibility } from "./strategy-sim-spec.js";
import { getPlayerVisibleProbability } from "./strategy-probability-system.js";

function scrubNumericItem(item = {}, definition = {}) {
  const visibility = normalizeVisibility(definition.visibility || item.visibility, "hidden");
  const label = definition.label || item.label || item.id;

  if (visibility === "public") {
    return {
      id: item.id,
      label,
      value: item.value,
      min: item.min,
      max: item.max,
      rangeState: item.rangeState || null,
      visibility
    };
  }

  if (visibility === "partial") {
    return {
      id: item.id,
      label,
      hint: item.partialHint || definition.playerFacingHint || "状态有变化，但精确数值不可见",
      trend: item.trend || null,
      visibility
    };
  }

  if (visibility === "hidden") {
    return definition.canAppearInReport === false ? null : {
      id: item.id,
      label,
      hint: definition.playerFacingHint || "有隐藏因素正在影响局势",
      visibility
    };
  }

  return null;
}

export function scrubStrategyPublicView(spec, state, options = {}) {
  const resources = [];
  const variables = [];
  const omitted = [];
  const resourceDefs = new Map((spec.resources || []).map((item) => [item.id, item]));
  const variableDefs = new Map((spec.variables || []).map((item) => [item.id, item]));

  for (const [id, item] of Object.entries(state?.resources || {})) {
    const def = resourceDefs.get(id) || item;
    const scrubbed = scrubNumericItem(item, def);
    if (scrubbed) resources.push(scrubbed);
    else omitted.push({ id, type: "resource", visibility: def.visibility || item.visibility || "secret" });
  }

  for (const [id, item] of Object.entries(state?.variables || {})) {
    const def = variableDefs.get(id) || item;
    const scrubbed = scrubNumericItem(item, def);
    if (scrubbed) variables.push(scrubbed);
    else omitted.push({ id, type: "variable", visibility: def.visibility || item.visibility || "secret" });
  }

  const probabilityHints = (spec.probabilityRules || [])
    .filter((rule) => {
      const visibility = normalizeVisibility(rule.visibility, "hidden");
      if (visibility === "public" || visibility === "partial") return true;
      if (visibility === "hidden") return rule.publicDisclosure?.canHint === true;
      return false;
    })
    .map((rule) => {
    const visible = getPlayerVisibleProbability(rule, rule.visibility === "public" ? "exact" : rule.visibility);
    return {
      id: rule.id,
      label: rule.label,
      visibility: rule.visibility,
      display: visible.display,
      visible: visible.visible
    };
  });

  return Object.freeze({
    schemaVersion: 1,
    mode: "strategy-sim",
    specId: spec.specId,
    runId: state?.runId || "",
    turn: state?.currentTurn || 0,
    phase: state?.phase || "unknown",
    resources,
    variables,
    activeEvents: (state?.activeEvents || []).filter((event) => normalizeVisibility(event.visibility, "hidden") !== "secret"),
    probabilityHints,
    omitted,
    generatedAt: options.generatedAt || new Date().toISOString()
  });
}

export function assertNoHiddenStrategyLeak(value, path = "$") {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  const forbidden = ["secretState", "hiddenState", "hiddenModifiers", "rawRoll", "rngSeed", "rngCounter", "finalChance"];
  for (const key of forbidden) {
    if (text.includes(key)) {
      throw new Error(`hidden strategy leak detected at ${path}: ${key}`);
    }
  }
  return true;
}
