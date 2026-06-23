// workflow-intent-router.js — Route user action/mode to workflow type
import { inferWorkflowType } from "./workflow-context-envelope.js";
export function routeWorkflowIntent(input = {}) { return inferWorkflowType(input); }
