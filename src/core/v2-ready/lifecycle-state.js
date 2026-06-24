// src/core/v2-ready/lifecycle-state.js — v2-ready lifecycle/canon gate
// Stage 4: prevents premature shared canon writes, enforces runtime/candidate/proposal boundaries.

const VALID_LIFECYCLE = Object.freeze([
  "draft", "candidate", "pending_review", "active", "archived", "rejected"
]);

const VALID_CANON = Object.freeze([
  "runtime_only", "candidate_only", "shared_canon"
]);

const DEFAULTS = Object.freeze({
  status: "candidate",
  canonState: "candidate_only",
});

function safeEnum(v, valid, fb) {
  return valid.includes(v) ? v : fb;
}

export function normalizeLifecycleState(input = {}) {
  return Object.freeze({
    status: safeEnum(input?.status, VALID_LIFECYCLE, DEFAULTS.status),
    canonState: safeEnum(input?.canonState, VALID_CANON, DEFAULTS.canonState),
    reviewedAt: typeof input?.reviewedAt === "string" ? input.reviewedAt : null,
    approvedBy: typeof input?.approvedBy === "string" ? input.approvedBy : null,
  });
}

export function canWriteSharedCanon(record, authCtx = {}) {
  if (!record) return false;

  const cs = record.canonState || DEFAULTS.canonState;
  const status = record.status || DEFAULTS.status;

  // pending_review / rejected: ALWAYS blocked, regardless of canonState or auth
  if (status === "pending_review") return false;
  if (status === "rejected") return false;

  // runtime_only and candidate_only can NEVER write shared canon
  if (cs === "runtime_only") return false;
  if (cs === "candidate_only") return false;

  // shared_canon requires explicit approval
  if (cs === "shared_canon") {
    if (authCtx?.userConfirmed === true) return true;
    if (status === "active" && authCtx?.approvedProposal === true) return true;
    return false;
  }

  return false;
}

export function isActive(record) {
  return record?.status === "active";
}

export { VALID_LIFECYCLE, VALID_CANON };
