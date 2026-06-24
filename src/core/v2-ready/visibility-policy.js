// src/core/v2-ready/visibility-policy.js — v2-ready visibility filtering
// Stage 4: enforces hidden_truth / mode_private / system_only boundaries.
import { isHiddenTruth } from "./universal-metadata.js";

function playerSafety(r) {
  return {
    id: r?.id || "",
    type: r?.type || "",
    visibility: r?.visibility || "gm_only",
  };
}

export function canExposeToPlayer(record, context = {}) {
  if (!record) return false;
  const vis = record.visibility;

  // hidden_truth NEVER goes to player
  if (vis === "hidden_truth") return false;
  // system_only NEVER goes to player
  if (vis === "system_only") return false;
  // mode_private only if context.modeId is in allowed modes
  if (vis === "mode_private") {
    const allowed = Array.isArray(record.modeScope) ? record.modeScope : [];
    return allowed.includes(context?.modeId);
  }
  // gm_only — not player-visible in UI, but may be in GM context
  if (vis === "gm_only") return false;
  // player_visible — always OK
  if (vis === "player_visible") return true;

  // unknown visibility: safe default = deny
  return false;
}

export function filterPlayerVisible(records, context = {}) {
  if (!Array.isArray(records)) return [];
  return records.filter(r => canExposeToPlayer(r, context)).map(playerSafety);
}

export function filterPromptVisible(records, context = {}) {
  // For prompt injection: same boundaries but returns full records
  if (!Array.isArray(records)) return [];
  return records.filter(r => canExposeToPlayer(r, context));
}
