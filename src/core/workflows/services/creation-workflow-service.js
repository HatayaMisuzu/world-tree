// services/creation-workflow-service.js — W1 Creation / Alchemy
import { createWizardSession, advanceStage } from "../../creation-wizard/wizard-session.js";
import { detectGaps, generateNextQuestion } from "../../creation-wizard/wizard-gap-detector.js";
import { buildBlueprintCandidate } from "../../creation-wizard/wizard-blueprint-builder.js";
import { reviewBlueprint, isReadyForDelivery } from "../../creation-wizard/wizard-risk-review.js";
import { WORKFLOW_TYPES } from "../workflow-types.js";

const sessions = new Map();

export const creationWorkflowService = {
  async run(envelope, { authorityDecision }) {
    switch (envelope.workflowType) {
      case WORKFLOW_TYPES.CREATION_START: return startCreation(envelope);
      case WORKFLOW_TYPES.CREATION_REFINE: return refineCreation(envelope);
      case WORKFLOW_TYPES.CREATION_INSTANTIATE: return instantiateCreation(envelope, authorityDecision);
      default: return startCreation(envelope);
    }
  }
};

function startCreation(envelope) {
  const session = createWizardSession({ modeHint: envelope.modeId, userInput: envelope.userInput });
  sessions.set(session.sessionId, session);
  const q = generateNextQuestion(session);
  const bp = buildBlueprintCandidate(session);
  return {
    visibleText: q.question || `创建向导已启动。当前阶段：${session.stage}`,
    candidates: [bp], runtimeUpdates: [{ key: "wizard_session", sessionId: session.sessionId, stage: session.stage }],
    proposals: [], canonWrites: [], warnings: [], debugSummary: { sessionId: session.sessionId }
  };
}

function refineCreation(envelope) {
  const sid = envelope.runtime?.wizardSessionId;
  const session = sid ? sessions.get(sid) : null;
  if (!session) return { ok: false, visibleText: "无活跃的创建会话。请先开始创建。", errors: ["no_session"] };
  if (envelope.userInput) {
    const gaps = session.gaps || [];
    if (gaps.length > 0) session.fields.hard[gaps[0].field] = envelope.userInput;
  }
  advanceStage(session);
  const q = generateNextQuestion(session);
  const bp = buildBlueprintCandidate(session);
  return { visibleText: q.question, candidates: [bp], runtimeUpdates: [{ key: "wizard_session", sessionId: session.sessionId, stage: session.stage }], canonWrites: [], warnings: [] };
}

function instantiateCreation(envelope, authority) {
  if (!authority.initializationWriteAllowed || !authority.canWriteCanon) {
    return { ok: false, visibleText: "需要用户确认才能创建项目。", candidates: [], errors: ["confirmation_required"], warnings: ["creation_requires_user_confirm"] };
  }
  const sid = envelope.runtime?.wizardSessionId;
  const session = sid ? sessions.get(sid) : createWizardSession({ modeHint: envelope.modeId, userInput: envelope.userInput });
  const bp = buildBlueprintCandidate(session);
  const review = reviewBlueprint(bp);
  if (!isReadyForDelivery(review)) {
    return { ok: false, visibleText: `蓝图未就绪：${review.findings.filter(f => f.level === "high").map(f => f.message).join("; ")}`, errors: review.findings.filter(f => f.level === "high").map(f => f.message) };
  }
  return { ok: true, visibleText: `项目「${bp.worldName}」创建完成！`, candidates: [], canonWrites: [{ target: "shared/worldbook.json", blueprint: bp, authority: "initialization_write" }], runtimeUpdates: [], warnings: [] };
}
