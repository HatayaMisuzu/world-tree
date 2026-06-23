// services/character-workflow-service.js — WSD-1 deepened with M4+M5+M8+P1
import { createCharacterProfile, validateCharacterBoundary, getExpressionHints, getResponsePattern } from "../../character/character-kernel-v2.js";
import { createCognitionMatrix, addKnowledgeEntry, canCharacterReveal } from "../../cognition/cognition-matrix.js";
import { checkConsistency } from "../../narrative-radar/narrative-consistency-radar.js";

function buildFallbackReply(context) {
  const dna = context.expressionHints || [];
  return { ok: true, text: `[${context.name || "角色"}]: …（${dna[0] || "中性"}）`, llmUsed: false, warnings: ["LLM offline, fallback used"], debug: {} };
}

export async function runCharacterWorkflow(envelope, deps = {}) {
  const profile = deps.characterProfile || createCharacterProfile({ characterId: envelope.moduleKey || "default", name: "角色" });
  const cognition = deps.cognitionMatrix || createCognitionMatrix(profile.characterId);
  const expressionHints = getExpressionHints(profile);

  const context = { name: profile.canonProfile?.name || "角色", expressionHints, profile, cognition, emotionalInertia: deps.emotionalInertia || null };

  const draft = deps.llmAdapter ? await deps.llmAdapter({ envelope, profile, cognition, expressionHints }) : buildFallbackReply(context);
  const visibleText = draft.text || draft.visibleText || "";

  const radarReport = checkConsistency(visibleText);
  const postCheck = {
    visibleText,
    runtimeUpdates: [{ key: "emotion_update", characterId: profile.characterId }],
    candidates: [],
    proposals: [],
    warnings: [...(draft.warnings || []), ...(radarReport.warnings || []).map(w => w.reason)],
    checks: { oocRisk: visibleText.includes("AI"), intimacyRisk: false, hiddenLeak: radarReport.blocked.length > 0 }
  };

  if (radarReport.blocked.length > 0) {
    postCheck.warnings.push("RADAR_BLOCKED: hidden truth leak detected");
    postCheck.visibleText = "[输出被安全审查阻止]";
  }

  return postCheck;
}

export function buildCharacterWorkflowContext(envelope, deps = {}) {
  const profile = deps.characterProfile || createCharacterProfile({ characterId: envelope.moduleKey || "default" });
  const cognition = deps.cognitionMatrix || createCognitionMatrix(profile.characterId);
  return { profile, cognition, expressionHints: getExpressionHints(profile), responseLadder: profile.responseLadder || {} };
}

export function validateCharacterWorkflowOutput(output, envelope) {
  const errors = [];
  if (output.visibleText?.includes("hiddenTruth")) errors.push("hiddenTruth leak detected");
  if (output.visibleText?.includes("我是AI")) errors.push("OOC detected");
  return { ok: errors.length === 0, errors };
}

export const characterWorkflowService = {
  async run(envelope, { authorityDecision, deps = {} }) {
    const result = await runCharacterWorkflow(envelope, deps);
    return { ok: true, visibleText: result.visibleText, candidates: result.candidates || [], proposals: result.proposals || [], runtimeUpdates: result.runtimeUpdates || [], canonWrites: [], warnings: result.warnings || [], debug: result.checks || {} };
  }
};
