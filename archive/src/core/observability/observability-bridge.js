// observability-bridge.js — Build redacted workflow observability packet
import { buildObservabilityPacket, redactDebugPacket } from "./observability-packet.js";
export function buildWorkflowObservabilityPacket({ workflowEnvelope, promptPacket, kernelContext, p3Context, result, guardian, radar } = {}) {
  const packet = buildObservabilityPacket({
    modeId: workflowEnvelope?.modeId || "", taskId: workflowEnvelope?.taskId || "writer",
    branchId: workflowEnvelope?.activeBranchId || "main",
    promptBlocks: promptPacket?.blocks || [], promptBudget: promptPacket?.budget || 0,
    promptHash: promptPacket?.activationLog?.promptHash || "",
    kernelStatus: kernelContext?.debug || { p0: true, p1: true, p2: true },
    turnCount: 0
  });
  if (p3Context) { packet.p3Mechanisms = Object.keys(p3Context.mechanisms || {}).length; }
  return redactDebugPacket(packet);
}
