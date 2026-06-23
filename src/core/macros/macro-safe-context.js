// macro-safe-context.js — Safe context for macro resolution
import { SAFE_MACROS } from "./macro-registry.js";
export function buildMacroSafeContext({ workflowEnvelope, kernelContext, p3Context, model = {} } = {}) {
  return {
    modeId: workflowEnvelope?.modeId || "", branchId: workflowEnvelope?.activeBranchId || "main",
    sceneTitle: "", protagonistId: "", characterName: "", factionName: "",
    turnCount: model.turnCount || 0, telemetryTension: "steady",
    worldState: {}
  };
}
export function resolveSafeMacro(template, safeContext) {
  const { resolveMacro } = require("./macro-registry.js");
  return resolveMacro(template, safeContext);
}
export function validateMacroContextSafety(context = {}) {
  const unsafe = Object.keys(context).filter(k => /hiddenTruth|answerLock|private|secret|apiKey|path/i.test(k));
  return { safe: unsafe.length === 0, unsafe };
}
