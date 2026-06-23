// workflow-runner.js — W0 public orchestration entrypoint
import { routeWorkflowIntent } from "./workflow-intent-router.js";
import { createWorkflowContextEnvelope } from "./workflow-context-envelope.js";
import { decideWorkflowAuthority } from "./workflow-authority-gate.js";
import { routeWorkflowOutput } from "./workflow-output-router.js";
import { buildWorkflowTrace } from "./workflow-observability.js";
import { CREATION_WORKFLOWS, ALCHEMY_WORKFLOWS, PLAY_WORKFLOWS, CHARACTER_WORKFLOWS, MYSTERY_WORKFLOWS, STRATEGY_WORKFLOWS, DEBUG_WORKFLOWS, DIRECTION_WORKFLOWS } from "./workflow-types.js";

const STUB = { async run(e, a) { return { ok: true, visibleText: `[W0 stub: ${e.workflowType}]`, candidates: [], proposals: [], runtimeUpdates: [], canonWrites: [], warnings: [], debugSummary: null }; } };
export const creationWorkflowService = STUB, alchemyWorkflowService = STUB, playTurnWorkflowService = STUB, characterWorkflowService = STUB, mysteryWorkflowService = STUB, strategyWorkflowService = STUB, directionWorkflowService = STUB, observabilityWorkflowService = STUB;

function selectService(wt) {
  if (CREATION_WORKFLOWS.has(wt)) return creationWorkflowService;
  if (ALCHEMY_WORKFLOWS.has(wt)) return alchemyWorkflowService;
  if (CHARACTER_WORKFLOWS.has(wt)) return characterWorkflowService;
  if (MYSTERY_WORKFLOWS.has(wt)) return mysteryWorkflowService;
  if (STRATEGY_WORKFLOWS.has(wt)) return strategyWorkflowService;
  if (DIRECTION_WORKFLOWS.has(wt)) return directionWorkflowService;
  if (DEBUG_WORKFLOWS.has(wt)) return observabilityWorkflowService;
  return playTurnWorkflowService;
}

export async function runWorkflowAction(input = {}) {
  const workflowType = routeWorkflowIntent(input);
  const envelope = createWorkflowContextEnvelope({ ...input, workflowType });
  const authority = decideWorkflowAuthority(envelope, input.intent || input);
  const service = selectService(workflowType);
  const raw = await service.run(envelope, { authorityDecision: authority });
  const result = routeWorkflowOutput(envelope, raw, authority);
  const trace = buildWorkflowTrace(envelope, result, raw?.debug || {});
  return { ...result, debugSummary: trace };
}
