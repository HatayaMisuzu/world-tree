// wizard-session.js — Creation Wizard v2 session manager
// Stage A: M1 — Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: candidate only — never writes canon directly

import { createHash } from "node:crypto";

const STAGES = ["foundation", "characters", "world", "rules", "opening", "events", "review"];
const STATUSES = ["draft", "ready_for_review", "delivered", "rejected"];

export function createWizardSession({ modeHint = "world-rpg", userInput = "" } = {}) {
  const sessionId = `wiz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    version: 2,
    sessionId,
    modeHint,
    userInput: String(userInput).slice(0, 5000),
    stage: "foundation",
    stageIndex: 0,
    fields: { hard: {}, soft: {}, optional: {} },
    gaps: [],
    risks: [],
    blueprintCandidate: null,
    status: "draft",
    hiddenFields: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function advanceStage(session) {
  const idx = STAGES.indexOf(session.stage);
  if (idx < STAGES.length - 1) {
    session.stage = STAGES[idx + 1];
    session.stageIndex = idx + 1;
    session.updatedAt = new Date().toISOString();
  }
  return session;
}

export function getCurrentStage(session) { return session?.stage || "foundation"; }
export function getNextStage(session) {
  const idx = STAGES.indexOf(session?.stage || "foundation");
  return idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
}
export { STAGES, STATUSES };
