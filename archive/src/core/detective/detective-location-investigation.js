// Detective V2 Location Investigation
// Area-based investigation with conditions, revisits, and unlock logic.

export function investigateLocationArea({ caseCapsule, runState, locationId, areaId, actionType = "search" } = {}) {
  if (!caseCapsule || !runState) return { status: "error", errorMsg: "caseCapsule and runState required" };
  if (!locationId) return { status: "error", errorMsg: "locationId required" };

  const location = (caseCapsule.locations || []).find((l) => l.locationId === locationId);
  if (!location) return { status: "error", errorMsg: `location ${locationId} not found` };
  if (location.isHidden && !(runState.hiddenCaseState?.unlockFlags || {})[locationId]) {
    return { status: "error", errorMsg: "location not accessible yet" };
  }

  // Mark location as visited
  const visited = [...(runState.publicState?.visitedLocationIds || []), locationId];
  
  // If area specified, investigate that area
  const area = areaId ? (location.areas || []).find((a) => a.areaId === areaId) : (location.areas || [])[0];
  if (!area) return { status: "error", errorMsg: `area ${areaId || "default"} not found in location ${locationId}` };

  // Check unlock conditions
  if (area.unlockConditions && !checkUnlockConditions(area.unlockConditions, runState)) {
    return { status: "error", errorMsg: "area locked - conditions not met", unlockConditions: area.unlockConditions };
  }

  // Filter evidence: new discoverable evidence that hasn't been found yet
  const discovered = runState.publicState?.discoveredEvidenceIds || [];
  const newEvidence = (caseCapsule.evidence || [])
    .filter((e) => (area.evidenceIds || location.discoverableEvidence || []).includes(e.evidenceId))
    .filter((e) => !discovered.includes(e.evidenceId))
    .map((e) => {
      const { hiddenMeaning, unlockConditions: _uc, ...publicEvidence } = e;
      return publicEvidence;
    });

  // Strip hidden info from location
  const { gmNotes, discoverableEvidence: _de, ...publicLocation } = location;

  return {
    status: "ok",
    location: publicLocation,
    area: { areaId: area.areaId, label: area.label, description: area.description },
    discoveredEvidence: newEvidence,
    newEvidenceIds: newEvidence.map((e) => e.evidenceId),
    visitedLocationIds: [...new Set(visited)],
    timeCost: area.timeCost || 1,
  };
}

export function revisitLocation({ caseCapsule, runState, locationId } = {}) {
  if (!caseCapsule || !runState || !locationId) return { status: "error", errorMsg: "caseCapsule, runState, locationId required" };

  const location = (caseCapsule.locations || []).find((l) => l.locationId === locationId);
  if (!location) return { status: "error", errorMsg: `location ${locationId} not found` };

  // On revisit, areas with revisitReveals unlock additional evidence
  const areas = location.areas || [];
  const revisitedAreas = areas.filter((a) => a.revisitReveals);

  const newEvidence = [];
  for (const area of revisitedAreas) {
    const evidenceIds = typeof area.revisitReveals === "object" ? (area.revisitReveals.evidenceIds || []) : [];
    for (const eId of evidenceIds) {
      const ev = (caseCapsule.evidence || []).find((e) => e.evidenceId === eId);
      if (ev && !(runState.publicState?.discoveredEvidenceIds || []).includes(eId)) {
        const { hiddenMeaning, unlockConditions, ...pub } = ev;
        newEvidence.push(pub);
      }
    }
  }

  return {
    status: "ok",
    locationId,
    revisited: true,
    discoveredEvidence: newEvidence,
    newEvidenceIds: newEvidence.map((e) => e.evidenceId),
    note: newEvidence.length === 0 ? "没有新发现" : `发现了 ${newEvidence.length} 条新证据`,
  };
}

export function unlockEvidenceByCondition({ caseCapsule, runState, condition } = {}) {
  if (!caseCapsule || !runState || !condition) return { status: "error", errorMsg: "caseCapsule, runState, condition required" };

  const unlocked = [];
  for (const ev of (caseCapsule.evidence || [])) {
    if (ev.unlockConditions && checkConditionMatch(ev.unlockConditions, condition)) {
      if (!(runState.publicState?.discoveredEvidenceIds || []).includes(ev.evidenceId)) {
        const { hiddenMeaning, unlockConditions: _uc, ...pub } = ev;
        unlocked.push(pub);
      }
    }
  }

  return {
    status: "ok",
    unlockedEvidence: unlocked,
    unlockedCount: unlocked.length,
  };
}

function checkUnlockConditions(conditions, runState) {
  if (!conditions) return true;
  if (typeof conditions === "string") {
    return (runState.hiddenCaseState?.unlockFlags || {})[conditions] === true;
  }
  return false;
}

function checkConditionMatch(conditions, target) {
  if (!conditions || !target) return false;
  if (Array.isArray(conditions)) return conditions.includes(target);
  return conditions === target;
}
