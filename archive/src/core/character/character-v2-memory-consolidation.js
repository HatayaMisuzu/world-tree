// Character V2 Memory Consolidation
// Consolidates related memories into clusters.

export function consolidateMemoryCluster({ memories = [], policy = {} } = {}) {
  if (memories.length < 2) return { clusters: [], consolidated: [] };

  const clusters = [];
  const processed = new Set();

  for (let i = 0; i < memories.length; i++) {
    if (processed.has(i)) continue;
    const cluster = [memories[i]];
    processed.add(i);

    for (let j = i + 1; j < memories.length; j++) {
      if (processed.has(j)) continue;
      if (memories[j].type === memories[i].type || memoriesOverlap(memories[i], memories[j])) {
        cluster.push(memories[j]);
        processed.add(j);
      }
    }

    if (cluster.length >= 2) clusters.push(cluster);
  }

  const consolidated = clusters.map((cluster) => ({
    consolidatedId: `cons_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type: cluster[0].type,
    memories: cluster.map((m) => m.memoryId),
    summary: cluster.map((m) => m.content?.slice(0, 50)).join(" | "),
    consolidatedAt: new Date().toISOString(),
  }));

  return { clusters, consolidated };
}

function memoriesOverlap(a, b) {
  if (!a.content || !b.content) return false;
  const aWords = new Set(a.content.toLowerCase().split(/\s+/));
  const bWords = new Set(b.content.toLowerCase().split(/\s+/));
  const intersection = [...aWords].filter((w) => bWords.has(w) && w.length > 1);
  return intersection.length >= 3;
}
