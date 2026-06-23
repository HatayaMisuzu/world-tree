// wizard-gap-detector.js — Detect missing fields and generate questions
// Part of M1 Creation Wizard v2

import { getStageFields, getHardFields } from "./wizard-field-schema.js";
import { STAGES } from "./wizard-session.js";

export function detectGaps(session) {
  const gaps = [];
  const stageFields = getStageFields(session.stage);
  for (const field of stageFields.hard) {
    const value = session.fields.hard[field.key];
    if (!value || String(value).trim() === "") {
      gaps.push({ stage: session.stage, field: field.key, level: "hard", label: field.label, hint: field.hint || "" });
    }
  }
  session.gaps = gaps;
  return gaps;
}

export function generateNextQuestion(session) {
  const gaps = detectGaps(session);
  if (gaps.length > 0) {
    const g = gaps[0];
    return { question: `请提供「${g.label}」：${g.hint || ""}`, field: g.field, stage: g.stage, level: g.level };
  }
  const stageFields = getStageFields(session.stage);
  const unfilledSoft = stageFields.soft.filter(f => !session.fields.soft[f.key]);
  if (unfilledSoft.length > 0) {
    const f = unfilledSoft[0];
    return { question: `（可选）${f.label}：${f.hint || ""}`, field: f.key, stage: session.stage, level: "soft" };
  }
  return { question: "当前阶段信息已足够，可以继续下一阶段。", field: null, stage: session.stage, level: "complete" };
}

export function estimateCompleteness(session) {
  let totalHard = 0, filledHard = 0;
  for (const stage of STAGES) {
    const fields = getHardFields(stage);
    totalHard += fields.length;
    for (const key of fields) {
      if (session.fields.hard[key]) filledHard++;
    }
  }
  return totalHard > 0 ? Math.round((filledHard / totalHard) * 100) : 0;
}
