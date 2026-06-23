// services/mystery-workflow-service.js — WSD-2 deepened with M5+M7+M8
import { createCognitionMatrix, addKnowledgeEntry, canCharacterReveal } from "../../cognition/cognition-matrix.js";
import { createRulesEngine, addRule, evaluateAction } from "../../world-rules/world-rules-engine.js";
import { checkConsistency } from "../../narrative-radar/narrative-consistency-radar.js";

function buildSuspectCognition(suspectId) {
  const m = createCognitionMatrix(suspectId);
  addKnowledgeEntry(m, { fact: "truth_lock_answer", state: "forbidden" });
  addKnowledgeEntry(m, { fact: "crime_scene_location", state: "known", confidence: 0.9 });
  addKnowledgeEntry(m, { fact: "victim_relationship", state: "suspected", confidence: 0.5 });
  return m;
}

export async function runMysteryWorkflow(envelope, deps = {}) {
  const suspectId = envelope.runtime?.suspectId || "suspect_default";
  const cognition = deps.cognitionMatrix || buildSuspectCognition(suspectId);
  const rulesEngine = deps.rulesEngine || createRulesEngine();
  const userInput = envelope.userInput || "";

  const truthLeakCheck = checkConsistency(userInput);
  const warnings = [...(truthLeakCheck.blocked.map(b => b.reason))];

  let visibleText = "";
  let candidates = [];
  let proposals = [];

  if (envelope.workflowType === "mystery.interrogate") {
    const reveal = canCharacterReveal(cognition, "truth_lock_answer");
    if (reveal.canReveal) {
      warnings.push("SUSPECT_KNOWS_TOO_MUCH: cognition boundary failure");
    }
    visibleText = `[审问] 嫌疑人：${userInput.includes("真相") ? "我不明白你在说什么" : "关于这件事，我知道的不多…"}`;
    if (userInput.includes("证据") || userInput.includes("线索")) {
      candidates.push({ id: `clue_${Date.now()}`, type: "caseClueCandidate", title: "新线索", summary: userInput.slice(0, 80), status: "candidate" });
    }
  } else if (envelope.workflowType === "mystery.investigate") {
    visibleText = `[调查] 你仔细检查了现场…发现了一些痕迹。`;
    candidates.push({ id: `clue_${Date.now()}`, type: "caseClueCandidate", title: "现场痕迹", summary: "调查发现", status: "candidate" });
  } else {
    visibleText = `[推理] 你的推论已记录。需要更多证据来确认。`;
    proposals.push({ type: "deduction_candidate", summary: userInput.slice(0, 100), status: "pending", requiresApproval: true });
  }

  const radarReport = checkConsistency(visibleText);
  if (radarReport.blocked.length > 0) {
    warnings.push("RADAR_BLOCKED: hidden truth leak"); visibleText = "[输出被安全审查阻止]";
  }

  return { ok: true, visibleText, candidates, proposals, runtimeUpdates: [], canonWrites: [], warnings, debug: { suspectId, truthProtected: true } };
}

export function buildMysteryWorkflowContext(envelope, deps = {}) {
  return { suspectId: envelope.runtime?.suspectId || "default", cognition: deps.cognitionMatrix || buildSuspectCognition("default") };
}

export function validateMysteryWorkflowOutput(output, envelope) {
  const errors = [];
  if (output.visibleText?.includes("凶手是")) errors.push("truth_lock_leak");
  if (output.visibleText?.includes("hiddenTruth")) errors.push("hidden_truth_leak");
  return { ok: errors.length === 0, errors };
}

export const mysteryWorkflowService = {
  async run(envelope, { authorityDecision, deps = {} }) {
    const result = await runMysteryWorkflow(envelope, deps);
    return { ...result };
  }
};
