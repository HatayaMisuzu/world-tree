/**
 * S4-5 visibility reveal via proposal-bus (no fourth write path).
 *
 * Flow: buildVisibilityRevealProposalInput → createProposal → approve/adopt/commit.
 * Without approve, knownBy / visibility on the source record and Canon stay unchanged.
 * After approveProposal, the write lands on overlay-store WRITE_POLICY (canon overlay).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJsonSync } from "../../shared/fs-utils.js";
import { createProposal } from "../system/proposal-bus.js";
import {
  buildVisibilityRevealProposalInput,
  normalizeKnownBy,
  normalizeVisibilityGrade
} from "./visibility-policy.js";

export const VISIBILITY_REVEAL_TARGET = "shared/visibility.json";

/**
 * Snapshot of a record's visibility fields (does not read overlay).
 */
export function readRecordVisibility(record = {}) {
  return {
    visibility: normalizeVisibilityGrade(record, "gm_only"),
    knownBy: normalizeKnownBy(record?.knownBy)
  };
}

/**
 * Documented write point after approve→commit: runtime/overlay/canon-overlay.json
 * under visibilityById[recordId] (merge from bus patch).
 */
export function readVisibilityOverlayEntry(projectRoot, recordId) {
  if (!projectRoot || !recordId) return null;
  const overlayPath = join(projectRoot, "runtime", "overlay", "canon-overlay.json");
  if (!existsSync(overlayPath)) return null;
  const overlay = readJsonSync(overlayPath, {});
  const bag = overlay?.visibilityById;
  if (!bag || typeof bag !== "object") return null;
  const entry = bag[recordId];
  return entry && typeof entry === "object" ? entry : null;
}

/**
 * Submit a visibility_reveal proposal through proposal-bus.
 * Returns the pending bus proposal; does not mutate `record` or write Canon/overlay.
 */
export function submitVisibilityRevealProposal(record = {}, options = {}) {
  const shaped = buildVisibilityRevealProposalInput(record, options);
  const recordId = String(shaped.patch.recordId || record.id || options.recordId || "").trim() || "unknown";
  const targetFile = options.targetFile || VISIBILITY_REVEAL_TARGET;
  const before = readRecordVisibility(record);
  const after = {
    visibility: shaped.patch.toVisibility,
    knownBy: shaped.patch.knownBy,
    fromVisibility: shaped.patch.fromVisibility,
    kind: "visibility_reveal",
    recordId
  };
  const mergePayload = {
    visibilityById: {
      [recordId]: after
    }
  };

  return createProposal({
    id: options.id,
    type: shaped.type,
    summary: shaped.summary,
    impactLevel: shaped.impactLevel || "major",
    targetFile,
    modeId: options.modeId || "",
    projectId: options.projectId || "",
    reason: options.reason || shaped.summary,
    patch: { merge: mergePayload },
    oldValue: before,
    newValue: after,
    source: options.source || "visibility-reveal",
    moduleKey: options.moduleKey || options.modeId || "visibility",
    round: Number(options.round || 0),
    changeCategory: "visibility",
    affectedEntities: recordId !== "unknown" ? [recordId] : [],
    metadata: {
      ...(shaped.metadata || {}),
      requiresUserApproval: shaped.requiresUserApproval !== false,
      kind: "visibility_reveal",
      recordId
    },
    requiresUserApproval: shaped.requiresUserApproval !== false
  });
}
