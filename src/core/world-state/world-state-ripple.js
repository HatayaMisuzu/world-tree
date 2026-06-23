const IMPACT_DEPTH = Object.freeze({ light: 1, medium: 1, major: 2, critical: 3 });

export function normalizeRippleResult(result = {}, limits = {}) {
  const maxDepth = Math.max(0, Math.min(3, Number(limits.maxDepth ?? result.maxDepth ?? 1)));
  const maxItemsPerDepth = Math.max(1, Math.min(3, Number(limits.maxItemsPerDepth || 3)));
  const items = [];
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const candidates = (Array.isArray(result.items) ? result.items : [])
      .filter((item) => Number(item.depth) === depth)
      .filter((item) => Number(item.confidence ?? 0) >= (depth === 1 ? 0.75 : depth === 2 ? 0.6 : 0.45))
      .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
      .slice(0, maxItemsPerDepth)
      .map((item) => ({
        ...item,
        depth,
        action: depth === 1 ? "auto_proposal" : depth === 2 ? "pending_proposal" : "narrative_hook",
        requiresUserApproval: depth >= 2,
        causedBy: item.causedBy || result.rootChangeId || null
      }));
    items.push(...candidates);
  }
  return { ...result, maxDepth, items: items.slice(0, 9), limits: { maxDepth, maxItemsPerDepth, totalMaxItems: 9 } };
}

export function deriveBoundedRipple(_projectRoot, rootChange = {}, context = {}, options = {}) {
  const maxDepth = Math.min(Number(options.maxDepth ?? IMPACT_DEPTH[rootChange.impactLevel] ?? 1), 3);
  const seenRoots = options.seenRootChangeIds instanceof Set ? options.seenRootChangeIds : new Set(options.seenRootChangeIds || []);
  if (!rootChange.id || seenRoots.has(rootChange.id)) return { rootChangeId: rootChange.id || "", items: [], skipped: "duplicate_root" };
  const cooldown = Array.isArray(context.recentRippleChanges) && context.recentRippleChanges.some((item) => item.fieldPath === rootChange.fieldPath && JSON.stringify(item.newValue) === JSON.stringify(rootChange.newValue));
  if (cooldown && options.ignoreCooldown !== true) return { rootChangeId: rootChange.id, items: [], skipped: "cooldown" };
  const candidates = Array.isArray(rootChange.effects) ? rootChange.effects : [];
  return normalizeRippleResult({
    rootChangeId: rootChange.id,
    rootStateId: rootChange.stateId || rootChange.targetId || "",
    generatedAt: new Date().toISOString(),
    maxDepth,
    items: candidates.map((item, index) => ({ id: item.id || `rip_${rootChange.id}_${index + 1}`, impactLevel: item.impactLevel || "medium", confidence: Number(item.confidence ?? 0), ...item }))
  }, { maxDepth, maxItemsPerDepth: 3 });
}
