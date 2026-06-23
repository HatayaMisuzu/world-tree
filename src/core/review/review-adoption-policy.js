// review-adoption-policy.js — Wraps old review/adopt paths with authority checks
// Stage 1: Authority/Candidate — World Tree Maturation v1

import { createAuthorityContext, validateAuthorityForWrite, AUTHORITY_ACTION } from "../authority/asset-authority-policy.js";
import { normalizeAlchemyReviewItem } from "../candidates/candidate-normalizer.js";

export function wrapReviewAdoptionWithAuthority(item, moduleKey = "", options = {}) {
  const isExplicitManual = options.explicitManualAdopt === true && options.userConfirmed === true;
  const authority = createAuthorityContext({
    action: isExplicitManual ? AUTHORITY_ACTION.MANUAL_CANON_EDIT : AUTHORITY_ACTION.CANDIDATE_ONLY,
    source: item.source || "review",
    moduleKey,
    targetFile: item.typeId === "character" ? "shared/characters.json" : "shared/worldbook.json",
    userConfirmed: options.userConfirmed === true,
    reason: options.reason || "review adoption"
  });
  const check = validateAuthorityForWrite(authority);
  if (!check.ok) {
    return {
      applied: false,
      status: "proposal_required",
      candidate: normalizeAlchemyReviewItem(item),
      authorityCheck: check,
      reason: "Review item requires explicit manual adoption to write canon. Set explicitManualAdopt:true and userConfirmed:true."
    };
  }
  return { applied: true, authority, status: "ready_to_write", note: "Authority check passed. Proceed with write + tracking log." };
}

export function wrapAlchemyDigestWrite(moduleKey = "", options = {}) {
  const isNewProject = options.isNewProject === true;
  const authority = createAuthorityContext({
    action: isNewProject ? AUTHORITY_ACTION.INITIALIZATION_WRITE : AUTHORITY_ACTION.CANDIDATE_ONLY,
    source: "alchemy-digest",
    moduleKey,
    targetFile: "shared/worldbook.json",
    userConfirmed: options.userConfirmed === true,
    reason: isNewProject ? "new project initialization" : "alchemy import to existing project"
  });
  const check = validateAuthorityForWrite(authority);
  return { ok: check.ok, authority, check, requiresExplicitAdopt: !isNewProject };
}
