// prompt-context-bridge.js — Convert workflow envelope to prompt builder extraBlocks
import { createPromptBlock } from "./prompt-contract.js";
export function buildPromptContextBlocks({ workflowEnvelope, kernelContext, p3Context, worldbookRuntime, characterContext } = {}) {
  const blocks = [];
  if (workflowEnvelope) blocks.push(createPromptBlock({ id: "bridge.workflow-context", title: "Workflow Context", layer: "kernel", position: "context", priority: 250, required: false, content: `Workflow: ${workflowEnvelope.workflowType} | Mode: ${workflowEnvelope.modeId} | Task: ${workflowEnvelope.taskId}` }));
  if (p3Context?.mechanisms) blocks.push(createPromptBlock({ id: "bridge.p3-readiness", title: "P3 Readiness", layer: "kernel", position: "context", priority: 240, required: false, content: `P3 mechanisms: ${Object.keys(p3Context.mechanisms).length} ready` }));
  blocks.push(createPromptBlock({ id: "bridge.authority-boundary", title: "Authority Boundary", layer: "final_guard", position: "final_guard", priority: 800, required: true, content: "Authority: candidate-only. Do not write canon directly." }));
  return blocks;
}
