import { readTrackingCollections } from "./tracking-store.js";

export async function readTrackingDigest(projectRoot, options = {}) {
  const data = await readTrackingCollections(projectRoot);
  const limit = Math.max(1, Math.min(20, Number(options.limit || 8)));
  return {
    recentChanges: data.changes.slice(-limit),
    activeForeshadowing: data.foreshadowing.items.filter((item) => item.status !== "resolved" && item.visibility !== "secret").slice(0, limit),
    openConflicts: data.conflicts.items.filter((item) => item.status !== "resolved").slice(0, limit)
  };
}
