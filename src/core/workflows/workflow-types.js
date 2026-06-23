// workflow-types.js — W0 Workflow Spine
// Real Workflow Integration Layer — World Tree
export const WORKFLOW_TYPES = Object.freeze({
  CREATION_START: "creation.start", CREATION_REFINE: "creation.refine", CREATION_INSTANTIATE: "creation.instantiate",
  ALCHEMY_IMPORT: "alchemy.import", ALCHEMY_DIGEST: "alchemy.digest", ALCHEMY_DELIVER: "alchemy.deliver",
  PLAY_TURN: "play.turn", PLAY_CONTINUE: "play.continue", PLAY_AUTO_LIGHT: "play.auto_light",
  CHARACTER_CHAT: "character.chat", CHARACTER_RELATIONSHIP_SHIFT: "character.relationship_shift",
  MYSTERY_INVESTIGATE: "mystery.investigate", MYSTERY_INTERROGATE: "mystery.interrogate", MYSTERY_DEDUCE: "mystery.deduce",
  STRATEGY_TURN: "strategy.turn", STRATEGY_DIPLOMACY: "strategy.diplomacy", STRATEGY_RESOURCE_UPDATE: "strategy.resource_update",
  PROPOSAL_REVIEW: "proposal.review", PROPOSAL_APPROVE: "proposal.approve", PROPOSAL_REVERSE: "proposal.reverse",
  DEBUG_INSPECT: "debug.inspect"
});
// Route groups
export const CREATION_WORKFLOWS = new Set([WORKFLOW_TYPES.CREATION_START, WORKFLOW_TYPES.CREATION_REFINE, WORKFLOW_TYPES.CREATION_INSTANTIATE]);
export const ALCHEMY_WORKFLOWS = new Set([WORKFLOW_TYPES.ALCHEMY_IMPORT, WORKFLOW_TYPES.ALCHEMY_DIGEST, WORKFLOW_TYPES.ALCHEMY_DELIVER]);
export const PLAY_WORKFLOWS = new Set([WORKFLOW_TYPES.PLAY_TURN, WORKFLOW_TYPES.PLAY_CONTINUE, WORKFLOW_TYPES.PLAY_AUTO_LIGHT]);
export const CHARACTER_WORKFLOWS = new Set([WORKFLOW_TYPES.CHARACTER_CHAT, WORKFLOW_TYPES.CHARACTER_RELATIONSHIP_SHIFT]);
export const MYSTERY_WORKFLOWS = new Set([WORKFLOW_TYPES.MYSTERY_INVESTIGATE, WORKFLOW_TYPES.MYSTERY_INTERROGATE, WORKFLOW_TYPES.MYSTERY_DEDUCE]);
export const STRATEGY_WORKFLOWS = new Set([WORKFLOW_TYPES.STRATEGY_TURN, WORKFLOW_TYPES.STRATEGY_DIPLOMACY, WORKFLOW_TYPES.STRATEGY_RESOURCE_UPDATE]);
export const PROPOSAL_WORKFLOWS = new Set([WORKFLOW_TYPES.PROPOSAL_REVIEW, WORKFLOW_TYPES.PROPOSAL_APPROVE, WORKFLOW_TYPES.PROPOSAL_REVERSE]);
export const DEBUG_WORKFLOWS = new Set([WORKFLOW_TYPES.DEBUG_INSPECT]);
export const DIRECTION_WORKFLOWS = new Set([WORKFLOW_TYPES.PLAY_CONTINUE, WORKFLOW_TYPES.PLAY_AUTO_LIGHT]);
// Validation
export function validateWorkflowTypes() {
  const vals = Object.values(WORKFLOW_TYPES); const ids = new Set(vals);
  return { ok: vals.length === ids.size, count: vals.length, duplicateFree: vals.length === ids.size };
}
