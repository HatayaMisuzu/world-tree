// src/core/v2-ready/v2-ready-normalizer.js — v2-ready aggregate normalizer
// Stage 4: convenience aggregator that normalizes an asset through all v2-ready layers.

import { normalizeUniversalMetadata } from "./universal-metadata.js";
import { normalizeLifecycleState } from "./lifecycle-state.js";
import { normalizeRelationRecord } from "./relation-record.js";
import { normalizeTimeBinding } from "./time-binding.js";

export function normalizeV2ReadyAsset(input = {}, defaults = {}) {
  const meta = normalizeUniversalMetadata(input?.metadata || input, defaults?.metadata);
  const lifecycle = normalizeLifecycleState(input?.lifecycle || input);
  const relations = Array.isArray(input?.relations)
    ? input.relations.map(r => normalizeRelationRecord(r))
    : [];
  const timeBinding = normalizeTimeBinding(input?.timeBinding || input);

  return Object.freeze({
    metadata: meta,
    lifecycle,
    relations,
    timeBinding,
    payload: input?.payload !== undefined ? { ...input.payload } : {},
  });
}
