// services/strategy-workflow-service.js — WSD-3 deepened with M6+M7+M8
import { createFactionGraph, addFaction, addRelation, getSecretRelations } from "../../factions/faction-graph.js";
import { createRulesEngine, addRule, evaluateAction } from "../../world-rules/world-rules-engine.js";
import { checkConsistency } from "../../narrative-radar/narrative-consistency-radar.js";

function buildDefaultGraph() {
  const g = createFactionGraph();
  addFaction(g, { id: "kingdom", name: "王国军", type: "military" });
  addFaction(g, { id: "rebels", name: "反抗军", type: "rebel" });
  addRelation(g, { from: "kingdom", to: "rebels", type: "secret", publicKnown: false });
  return g;
}

export async function runStrategyWorkflow(envelope, deps = {}) {
  const graph = deps.factionGraph || buildDefaultGraph();
  const rules = deps.rulesEngine || createRulesEngine();
  addRule(rules, { id: "no_massacre", rule: "屠杀", strictness: "hard", violationPolicy: "block" });

  const userInput = envelope.userInput || "";
  const ruleReport = evaluateAction(rules, { action: userInput });
  const radarReport = checkConsistency(userInput);

  let visibleText = "";
  let proposals = [];
  let candidates = [];
  const warnings = [...ruleReport.warnings.map(w => w.message), ...radarReport.warnings.map(w => w.reason)];

  if (ruleReport.blocked) {
    visibleText = "[策略行动被世界规则阻止]"; warnings.push("RULE_BLOCKED");
  } else if (envelope.workflowType === "strategy.diplomacy") {
    const secrets = getSecretRelations(graph);
    visibleText = `[外交] 外交提议已记录。涉及 ${secrets.length} 个秘密关系（已隐藏）。`;
    proposals.push({ type: "diplomacy_proposal", summary: userInput.slice(0, 100), status: "pending", requiresApproval: true });
  } else {
    visibleText = `[策略] 行动已评估。需要提案审批才能生效。`;
    proposals.push({ type: "strategy_proposal", summary: userInput.slice(0, 100), status: "pending", requiresApproval: true });
  }

  if (radarReport.blocked.length > 0) {
    warnings.push("RADAR_BLOCKED"); visibleText = "[输出被安全审查阻止]";
  }

  return { ok: true, visibleText, candidates, proposals, runtimeUpdates: [], canonWrites: [], warnings, debug: { factions: Object.keys(graph.factions).length, secretRelations: getSecretRelations(graph).length } };
}

export function buildStrategyWorkflowContext(envelope, deps = {}) {
  return { factionGraph: deps.factionGraph || buildDefaultGraph(), rulesEngine: deps.rulesEngine || createRulesEngine() };
}

export function validateStrategyWorkflowOutput(output, envelope) {
  const errors = [];
  if (output.canonWrites?.length > 0) errors.push("strategy must not directly write canon");
  return { ok: errors.length === 0, errors };
}

export const strategyWorkflowService = {
  async run(envelope, { authorityDecision, deps = {} }) {
    const result = await runStrategyWorkflow(envelope, deps);
    return { ...result };
  }
};
