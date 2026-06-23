// services/play-turn-workflow-service.js — W2 Play Turn
import { buildPromptOrchestrationPacket } from "../../prompts/prompt-builder.js";
export const playTurnWorkflowService = {
  async run(envelope, { authorityDecision }) {
    const promptPacket = buildPromptOrchestrationPacket({ modeId: envelope.modeId, taskId: "writer", userInput: envelope.userInput, generationType: envelope.generationType, kernelContext: envelope.context?.p0p2Kernel, worldbookContext: envelope.context?.worldbook, characterContext: envelope.context?.character });
    const postCheck = runPostChecks(envelope, promptPacket?.promptText || "");
    return { ok: true, visibleText: `[Play Turn] ${envelope.userInput.slice(0, 100)}`, candidates: postCheck.candidates, proposals: postCheck.proposals, runtimeUpdates: [{ key: "turn_completed", promptBlocks: promptPacket?.blocks?.length || 0 }], canonWrites: [], warnings: postCheck.warnings, debug: { promptBlocks: promptPacket?.blocks || [], promptHash: promptPacket?.activationLog?.promptHash } };
  }
};
function runPostChecks(envelope, visibleText) {
  const warnings = [], candidates = [], proposals = [];
  if (visibleText.includes("hiddenTruth") || visibleText.includes("answerLock")) { warnings.push("potential hidden truth leak detected"); }
  return { warnings, candidates, proposals };
}
