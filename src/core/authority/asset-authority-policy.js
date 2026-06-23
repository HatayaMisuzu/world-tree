// asset-authority-policy.js — Unified authority policy for all shared/ writes
// Stage 1: Authority/Candidate — World Tree Maturation v1

export const AUTHORITY_ACTION = Object.freeze({
  INITIALIZATION_WRITE: "initialization_write",
  MANUAL_CANON_EDIT: "manual_canon_edit",
  PROPOSAL_APPROVED_WRITE: "proposal_approved_write",
  CANDIDATE_ONLY: "candidate_only",
  RUNTIME_ONLY: "runtime_only",
  DEBUG_ONLY: "debug_only",
  ADMIN_REPAIR: "admin_repair"
});

export const TARGET_LAYERS = Object.freeze({
  SHARED: "shared",
  RUNTIME: "runtime",
  CANDIDATE: "candidate",
  DEBUG: "debug",
  UNKNOWN: "unknown"
});

export function createAuthorityContext({ action, source = "", moduleKey = "", targetFile = "", userConfirmed = false, proposalId = null, currentTurn = 0, reason = "" } = {}) {
  return {
    action, source, moduleKey, targetFile, targetLayer: classifyTargetLayer(targetFile), userConfirmed, proposalId, currentTurn, reason, createdAt: new Date().toISOString()
  };
}

export function classifyTargetLayer(targetFile = "") {
  const t = String(targetFile);
  if (t.startsWith("shared/")) return TARGET_LAYERS.SHARED;
  if (t.startsWith("runtime/")) return TARGET_LAYERS.RUNTIME;
  if (t.includes("candidate") || t.includes("candidates")) return TARGET_LAYERS.CANDIDATE;
  if (t.includes("debug") || t.includes("observability")) return TARGET_LAYERS.DEBUG;
  return TARGET_LAYERS.UNKNOWN;
}

export function validateAuthorityForWrite(ctx = {}) {
  if (!ctx || !ctx.action) return { ok: false, level: "error", reason: "missing authority action", requiresProposal: true, warnings: [], errors: ["missing action"] };
  const { action, targetLayer, userConfirmed, proposalId } = ctx;
  if (targetLayer !== TARGET_LAYERS.SHARED) {
    return { ok: true, level: "info", reason: `non-shared target (${targetLayer}), write allowed`, requiresProposal: false, warnings: [], errors: [] };
  }
  // Shared writes require specific authority
  if (action === AUTHORITY_ACTION.CANDIDATE_ONLY) {
    return { ok: false, level: "error", reason: "candidate-only cannot write shared", requiresProposal: true, warnings: [], errors: ["candidate_write_blocked"] };
  }
  if (action === AUTHORITY_ACTION.RUNTIME_ONLY || action === AUTHORITY_ACTION.DEBUG_ONLY) {
    return { ok: false, level: "error", reason: `${action} cannot write shared`, requiresProposal: false, warnings: [], errors: [`${action}_blocked`] };
  }
  if (action === AUTHORITY_ACTION.INITIALIZATION_WRITE) {
    if (!userConfirmed) return { ok: false, level: "warn", reason: "initialization requires user confirmation", requiresProposal: false, warnings: ["unconfirmed_init"], errors: [] };
    return { ok: true, level: "info", reason: "initialization write with user confirmation", requiresProposal: false, warnings: [], errors: [] };
  }
  if (action === AUTHORITY_ACTION.MANUAL_CANON_EDIT) {
    if (!userConfirmed) return { ok: false, level: "warn", reason: "manual canon edit requires user confirmation", requiresProposal: false, warnings: ["unconfirmed_edit"], errors: [] };
    return { ok: true, level: "info", reason: "manual canon edit confirmed by user", requiresProposal: false, warnings: [], errors: [] };
  }
  if (action === AUTHORITY_ACTION.PROPOSAL_APPROVED_WRITE) {
    if (!proposalId) return { ok: false, level: "error", reason: "proposal approved write requires proposalId", requiresProposal: true, warnings: [], errors: ["missing_proposal_id"] };
    return { ok: true, level: "info", reason: `proposal ${proposalId} approved write`, requiresProposal: false, warnings: [], errors: [] };
  }
  if (action === AUTHORITY_ACTION.ADMIN_REPAIR) {
    return { ok: true, level: "warn", reason: "admin repair (local-only, explicit reason required)", requiresProposal: false, warnings: ["admin_repair"], errors: [] };
  }
  return { ok: false, level: "error", reason: `unknown action: ${action}`, requiresProposal: true, warnings: [], errors: ["unknown_action"] };
}

export function requiresProposalForTarget(targetFile, impactLevel = "medium") {
  if (impactLevel === "major" || impactLevel === "critical") return true;
  if (String(targetFile).startsWith("shared/")) return impactLevel !== "light";
  return false;
}
