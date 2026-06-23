// world-rules-engine.js — M7 World Rules Engine
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: shared (rules), runtime (evaluations/violations)
// Hidden rules must NOT leak to player-visible output

const RULE_TYPES = ["physics", "magic", "technology", "society", "law", "religion", "economy", "narrative_constraints", "mode_constraints"];

export function createRulesEngine() {
  return { version: 1, rules: [], updatedAt: new Date().toISOString() };
}

export function addRule(engine, { id, type = "narrative_constraints", title, rule, strictness = "soft", visibility = "public", violationPolicy = "warn" } = {}) {
  if (!id || !rule) throw new Error("rule requires id and rule text");
  if (!RULE_TYPES.includes(type)) throw new Error(`invalid rule type: ${type}`);
  engine.rules.push({ id, type, title: title || id, rule, strictness, visibility, violationPolicy });
  engine.updatedAt = new Date().toISOString();
  return engine;
}

export function evaluateAction(engine, { action = "", modeId = "", context = {} } = {}) {
  const report = { violations: [], warnings: [], blocked: false };
  for (const rule of engine.rules) {
    const match = String(action).includes(rule.rule);
    if (!match) continue;
    if (rule.strictness === "hard" && rule.violationPolicy === "block") {
      report.violations.push({ ruleId: rule.id, severity: "hard", message: `违反规则: ${rule.title || rule.id}` });
      report.blocked = true;
    } else if (rule.strictness === "soft") {
      report.warnings.push({ ruleId: rule.id, severity: "soft", message: `警告: ${rule.title || rule.id}` });
    }
  }
  return report;
}

export function getPublicRules(engine) {
  return engine.rules.filter(r => r.visibility === "public");
}

export function getHiddenRules(engine) {
  return engine.rules.filter(r => r.visibility === "hidden" || r.visibility === "system_only");
}

export function proposeRuleChange(engine, proposal) {
  return {
    type: "rule_change",
    ruleCount: engine.rules.length,
    change: proposal,
    status: "candidate",
    requiresApproval: true,
    note: "Rule changes must go through proposal approval."
  };
}
