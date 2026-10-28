// src/core/v2-ready/v2-ready-validator.js — v2-ready safety validator
// Stage 4: validates v2-ready assets against visibility/lifecycle/capability rules.

import { isHiddenTruth } from "./universal-metadata.js";
import { canExposeToPlayer } from "./visibility-policy.js";
import { canWriteSharedCanon } from "./lifecycle-state.js";
import { validateModeAssetCompatibility } from "./mode-capability-contract.js";

export function validateV2ReadyAsset(asset, context = {}) {
  const issues = [];

  // 1. Hidden truth must NOT be player-visible
  if (isHiddenTruth(asset?.metadata) && canExposeToPlayer(asset?.metadata, context)) {
    issues.push({ severity: "blocker", rule: "hidden_truth_leak", detail: "hidden_truth asset is player-visible" });
  }

  // 2. Must not write shared canon without proper authority
  if (canWriteSharedCanon(asset?.lifecycle || asset?.metadata, context?.authority)) {
    // Only block if the authority context doesn't explicitly allow it
    if (!context?.authority?.userConfirmed && !context?.authority?.approvedProposal) {
      issues.push({ severity: "blocker", rule: "illegal_canon_write", detail: "shared canon write without user confirmation or approved proposal" });
    }
  }

  // 3. Mode compatibility
  if (context?.modeId && asset?.metadata?.type) {
    const compat = validateModeAssetCompatibility(asset.metadata.type, context.modeId);
    if (!compat.ok) {
      issues.push({ severity: "warning", rule: "mode_incompatibility", detail: compat.error });
    }
  }

  // 4. Metadata validity
  if (!asset?.metadata?.id) {
    issues.push({ severity: "warning", rule: "missing_id", detail: "asset has no metadata.id" });
  }

  return {
    ok: !issues.some(i => i.severity === "blocker"),
    issues,
    blockerCount: issues.filter(i => i.severity === "blocker").length,
    warningCount: issues.filter(i => i.severity === "warning").length,
  };
}
