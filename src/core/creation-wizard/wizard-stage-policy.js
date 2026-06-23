// wizard-stage-policy.js — Stage transition policy for Creation Wizard v2
// Part of M1 Creation Wizard v2

import { STAGES } from "./wizard-session.js";
import { detectGaps } from "./wizard-gap-detector.js";

export function canAdvanceToNextStage(session) {
  const gaps = detectGaps(session);
  return gaps.filter(g => g.level === "hard").length === 0;
}

export function getStageProgress(session) {
  const currentIdx = STAGES.indexOf(session.stage);
  const total = STAGES.length;
  return { current: currentIdx + 1, total, percent: Math.round(((currentIdx + 1) / total) * 100), stage: session.stage };
}

export function isWizardComplete(session) {
  return session.stage === "review" && canAdvanceToNextStage(session) === false
    ? false
    : session.stage === "review";
}
