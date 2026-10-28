// Enqueue depth≥2 bounded-ripple items into the proposal queue (proposal-bus shape).
// Called from the main turn path (completeTurn); depth 1 stays auto / non-queued.
import { stableId } from "../../shared/determinism.js";
import { deriveBoundedRipple } from "./world-state-ripple.js";
import { createWorldStateProposal } from "./world-state-proposals.js";

const IMPACT_DEPTH = Object.freeze({ light: 1, medium: 1, major: 2, critical: 3 });

/**
 * Build a ripple rootChange from Writer 【状态建议】 when impact is major/critical
 * (or when explicit effects are provided). Flat YAML cannot nest effect objects,
 * so effects are synthesized from impactLevel when absent.
 */
export function rootChangeFromStateSuggestion(sections = {}, { input = "", round = 0 } = {}) {
  const raw = sections?.["状态建议"];
  if (!raw || typeof raw !== "object") return null;
  const impactLevel = String(raw.impactLevel || "").toLowerCase();
  const hasExplicitEffects = Array.isArray(raw.effects) && raw.effects.some((e) => e && typeof e === "object");
  if (!hasExplicitEffects && !["major", "critical"].includes(impactLevel)) return null;

  const stateId = String(raw.stateId || raw.scene || "turn_state");
  const id = stableId("ripple", stateId, impactLevel || "major", String(input || "").slice(0, 120), Number(round) || 0);
  let effects = hasExplicitEffects ? raw.effects : null;
  if (!effects) {
    const depthCap = IMPACT_DEPTH[impactLevel] || 2;
    effects = [{ depth: 1, confidence: 0.9, stateId: `${stateId}_direct`, summary: raw.summary || "direct impact" }];
    if (depthCap >= 2) {
      effects.push({
        depth: 2,
        confidence: 0.8,
        stateId: `${stateId}_secondary`,
        summary: raw.secondarySummary || "secondary impact pending approval"
      });
    }
    if (depthCap >= 3) {
      effects.push({
        depth: 3,
        confidence: 0.7,
        stateId: `${stateId}_hook`,
        summary: raw.hookSummary || "narrative hook"
      });
    }
  }
  return {
    id,
    stateId,
    impactLevel: impactLevel || "major",
    summary: raw.summary || "",
    effects
  };
}

/** Derive bounded ripple and create pending proposals for depth≥2 (requiresUserApproval). */
export function enqueueRippleProposals(projectRoot, rootChange = {}, context = {}, options = {}) {
  if (!rootChange?.id) return { ripple: null, proposals: [] };
  const ripple = deriveBoundedRipple(projectRoot, rootChange, context, options);
  const proposals = [];
  for (const item of ripple.items || []) {
    if (Number(item.depth) < 2 || item.requiresUserApproval !== true) continue;
    const stateId = String(item.stateId || item.targetId || `${rootChange.stateId || rootChange.id}_d${item.depth}`);
    const proposal = createWorldStateProposal(projectRoot, {
      stateId,
      summary: item.summary || `Ripple depth-${item.depth} from ${rootChange.id}`,
      reason: item.reason || `bounded-ripple depth ${item.depth}`,
      impactLevel: item.impactLevel || "major",
      value: item.newValue ?? item.value,
      rippleDepth: item.depth,
      causedBy: rootChange.id
    }, context);
    proposals.push({
      ...proposal,
      status: "pending",
      rippleDepth: item.depth,
      causedBy: rootChange.id,
      action: item.action || "pending_proposal"
    });
  }
  return { ripple, proposals };
}
