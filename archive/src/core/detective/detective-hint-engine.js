// Detective V2 Hint Engine
// Tiered hints: location, testimony, evidence-link, contradiction, near-solution.
// Never reveals culprit, motive, or method directly.

const HINT_LEVELS = ["location", "testimony", "evidence-link", "contradiction", "near-solution"];

export function requestHint({ caseCapsule, runState, level = "location" } = {}) {
  if (!caseCapsule || !runState) return { status: "error", errorMsg: "caseCapsule and runState required" };

  const hintPolicy = caseCapsule.hintPolicy || { maxHints: 5, penaltyPerHint: 0.05 };
  const hintUsage = runState.publicState?.hintUsage || 0;

  if (hintUsage >= (hintPolicy.maxHints || 5)) {
    return { status: "error", errorMsg: "所有提示已用完" };
  }

  const hint = generateHint(caseCapsule, runState, level);
  if (!hint) return { status: "error", errorMsg: "无法生成此级别的提示" };

  return {
    status: "ok",
    hint,
    level,
    hintUsage: hintUsage + 1,
    remainingHints: (hintPolicy.maxHints || 5) - hintUsage - 1,
  };
}

function generateHint(caseCapsule, runState, level) {
  const discovered = runState.publicState?.discoveredEvidenceIds || [];
  const visited = runState.publicState?.visitedLocationIds || [];
  const interviewed = runState.publicState?.interviewedCharacterIds || [];
  const tl = caseCapsule.truthLedger || {};

  switch (level) {
    case "location": {
      // Suggest an unvisited location
      const allLocs = (caseCapsule.locations || []).filter((l) => !l.isHidden);
      const unvisited = allLocs.filter((l) => !visited.includes(l.locationId));
      if (unvisited.length > 0) {
        const loc = unvisited[0];
        return { type: "location", text: `你可以去看看${loc.name}。`, targetId: loc.locationId };
      }
      return { type: "location", text: "你已经走访了所有已知地点。" };
    }
    case "testimony": {
      // Suggest an uninterviewed character
      const chars = (caseCapsule.characters || []).filter((c) => !c.isHidden);
      const notInterviewed = chars.filter((c) => !interviewed.includes(c.characterId));
      if (notInterviewed.length > 0) {
        return { type: "testimony", text: `也许可以和${notInterviewed[0].name}聊聊。`, targetId: notInterviewed[0].characterId };
      }
      return { type: "testimony", text: "可以尝试向某人出示证据。" };
    }
    case "evidence-link": {
      // Suggest evidence that links to testimony
      const evidence = caseCapsule.evidence || [];
      const missing = evidence.filter((e) => !discovered.includes(e.evidenceId));
      if (missing.length > 0) {
        const e = missing[0];
        return { type: "evidence-link", text: `在${e.locationHint || "某个地点"}可能还有未发现的线索。`, targetId: e.locationHint };
      }
      return { type: "evidence-link", text: "试着把已有的证据联系起来。" };
    }
    case "contradiction": {
      // Point toward a contradiction
      const contradictions = caseCapsule.contradictions || [];
      const detected = runState.publicState?.contradictionIds || [];
      const undetected = contradictions.filter((c) => !detected.includes(c.contradictionId));
      if (undetected.length > 0) {
        return { type: "contradiction", text: "某个人的证词似乎和证据不一致……再仔细看看证词。" };
      }
      return { type: "contradiction", text: "所有已发现矛盾已解决。" };
    }
    case "near-solution": {
      // General direction without revealing the answer
      return { type: "near-solution", text: "把所有线索拼在一起——凶手、动机、手法，哪一个还不清楚？" };
    }
    default:
      return null;
  }
}

export function getAvailableHintLevels(caseCapsule, runState) {
  const hintUsage = runState?.publicState?.hintUsage || 0;
  const maxHints = caseCapsule?.hintPolicy?.maxHints || 5;
  if (hintUsage >= maxHints) return [];

  return HINT_LEVELS.slice(0, Math.min(hintUsage + 1, HINT_LEVELS.length));
}
