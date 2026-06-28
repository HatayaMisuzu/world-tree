// src/core/strategy-sim/strategy-sim-report-context.js
// Builds Report Writer context from public view only.

import { assertNoHiddenStrategyLeak, scrubStrategyPublicView } from "./strategy-sim-public-view-scrubber.js";

export function buildStrategyReportContext(spec, state, turnLog = null, options = {}) {
  const publicView = options.publicView || scrubStrategyPublicView(spec, state, options);
  const recentLog = turnLog || state?.turnLog?.[state.turnLog.length - 1] || null;

  const safeLog = recentLog ? {
    turn: recentLog.turn,
    playerActions: recentLog.playerActions || [],
    publicDelta: recentLog.publicDelta || [],
    publicEvents: recentLog.publicEvents || [],
    warnings: recentLog.warnings || []
  } : null;

  const context = Object.freeze({
    mode: "strategy-sim",
    purpose: "strategy_report_writer_context",
    instructionBoundary: "Use only this public context. Do not infer hidden values, true odds, secret events, or internal roll data.",
    spec: Object.freeze({
      specId: spec.specId,
      title: spec.title,
      turnUnit: spec.turnUnit,
      reportPolicy: spec.reportPolicy
    }),
    publicView,
    recentLog: safeLog
  });

  assertNoHiddenStrategyLeak(context, "reportContext");
  return context;
}
