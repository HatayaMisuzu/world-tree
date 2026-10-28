// Detective V2 Contradiction Engine
// Detects and resolves contradictions between evidence and testimony.

export function detectContradictions({ caseCapsule, runState } = {}) {
  if (!caseCapsule) return { contradictions: [], newContradictions: [] };

  const allContradictions = caseCapsule.contradictions || [];
  const discoveredIds = runState?.publicState?.discoveredEvidenceIds || [];
  const testimonyIds = runState?.publicState?.discoveredTestimonyIds || [];
  const alreadyDetected = runState?.publicState?.contradictionIds || [];

  const detectable = allContradictions.filter((c) => {
    const hasEvidence = !c.evidenceId || discoveredIds.includes(c.evidenceId);
    const hasTestimony = !c.testimonyId || testimonyIds.includes(c.testimonyId);
    return hasEvidence && hasTestimony;
  });

  const newOnes = detectable.filter((c) => !alreadyDetected.includes(c.contradictionId));

  return {
    contradictions: detectable,
    newContradictions: newOnes,
    detectedCount: detectable.length,
    newCount: newOnes.length,
  };
}

export function markContradictionResolved({ caseCapsule, runState, contradictionId } = {}) {
  if (!runState || !contradictionId) return runState;

  const updated = structuredClone(runState);
  updated.publicState = updated.publicState || {};
  updated.publicState.contradictionIds = [...(updated.publicState.contradictionIds || []), contradictionId];

  return updated;
}

export function buildContradictionSummary({ caseCapsule, runState } = {}) {
  const allContradictions = caseCapsule?.contradictions || [];
  const resolvedIds = runState?.publicState?.contradictionIds || [];

  return allContradictions.map((c) => ({
    contradictionId: c.contradictionId,
    description: c.description || "",
    resolved: resolvedIds.includes(c.contradictionId),
  }));
}
