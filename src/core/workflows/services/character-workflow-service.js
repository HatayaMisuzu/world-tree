// services/character-workflow-service.js — W3 Character + Mystery + Strategy stubs
import { WORKFLOW_TYPES } from "../workflow-types.js";

const charStub = async (envelope) => ({ ok: true, visibleText: `[Character] ${envelope.userInput.slice(0, 80)}`, candidates: [], proposals: [], runtimeUpdates: [{ key: "emotion_update" }], canonWrites: [], warnings: [] });
const mystStub = async (envelope) => ({ ok: true, visibleText: `[${envelope.workflowType}] ${envelope.userInput.slice(0, 80)}`, candidates: [], proposals: [], runtimeUpdates: [], canonWrites: [], warnings: envelope.userInput.includes("真相") ? ["truth_lock_protected"] : [] });
const stratStub = async (envelope) => ({ ok: true, visibleText: `[Strategy] ${envelope.userInput.slice(0, 80)}`, candidates: [], proposals: [{ type: "faction_update", status: "pending" }], runtimeUpdates: [], canonWrites: [], warnings: [] });

export const characterWorkflowService = { async run(e, a) { return charStub(e); } };
export const mysteryWorkflowService = { async run(e, a) { return mystStub(e); } };
export const strategyWorkflowService = { async run(e, a) { return stratStub(e); } };
