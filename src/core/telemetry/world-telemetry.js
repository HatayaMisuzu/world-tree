import { join } from "node:path";
import { readJson, readJsonlTail, appendJsonl } from "../../server/fs-utils.js";
import { createTelemetryDigest } from "./telemetry-digest.js";

export async function collectWorldTelemetry(branchRoot, context = {}, options = {}) {
  const [changes, foreshadowing, conflicts, worldState, summaries, inertia] = await Promise.all([
    readJsonlTail(join(branchRoot, "runtime", "tracking", "change-log.jsonl"), 20),
    readJson(join(branchRoot, "runtime", "tracking", "foreshadowing.json"), { items: [] }),
    readJson(join(branchRoot, "runtime", "tracking", "conflicts.json"), { items: [] }),
    readJson(join(branchRoot, "shared", "world_state.json"), { states: {} }),
    readJsonlTail(join(branchRoot, "runtime", "scene-summaries.jsonl"), 5),
    readJson(join(branchRoot, "runtime", "character-inertia.json"), { characters: {} })
  ]);
  const digest = createTelemetryDigest({ ...context, changes, foreshadowing: foreshadowing.items, conflicts: conflicts.items, worldState, sceneSummaries: summaries, inertia });
  if (options.persist !== false) await appendJsonl(join(branchRoot, "runtime", "world-telemetry.jsonl"), { ...digest, generatedAt: new Date().toISOString() });
  return digest;
}
