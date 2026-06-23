// services/play-turn-workflow-service.js — WSD-4 deepened with LLM adapter + post-check
import { buildPromptOrchestrationPacket } from "../../prompts/prompt-builder.js";
import { generateWorkflowDraft } from "../adapters/llm-workflow-adapter.js";
import { checkConsistency } from "../../narrative-radar/narrative-consistency-radar.js";

export const playTurnWorkflowService = {
  async run(envelope, { authorityDecision, deps = {} }) {
    const promptPacket = buildPromptOrchestrationPacket({
      modeId: envelope.modeId, taskId: "writer", userInput: envelope.userInput,
      generationType: envelope.generationType, kernelContext: envelope.context?.p0p2Kernel,
      worldbookContext: envelope.context?.worldbook, characterContext: envelope.context?.character
    });
    const draft = await generateWorkflowDraft({ envelope, promptPacket, deps });
    const radarReport = checkConsistency(draft.text || "");
    const candidates = [];
    const proposals = [];
    if (radarReport.blocked.length > 0) {
      draft.text = "[输出被安全审查阻止]"; draft.warnings.push("RADAR_BLOCKED");
    }
    return {
      ok: true, visibleText: draft.text, candidates, proposals,
      runtimeUpdates: [{ key: "turn_completed", promptBlocks: promptPacket?.blocks?.length || 0, llmUsed: draft.llmUsed }],
      canonWrites: [], warnings: [...(draft.warnings || []), ...(radarReport.warnings || []).map(w => w.reason)],
      debug: { promptBlocks: promptPacket?.blocks || [], llmUsed: draft.llmUsed, fallback: draft.debug?.fallback || false }
    };
  }
};
