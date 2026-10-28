// Detective V2 Interrogation Engine
// Character questioning, evidence presentation, testimony challenges.

export function askCharacterQuestion({ caseCapsule, runState, characterId, question } = {}) {
  if (!caseCapsule || !runState || !characterId) return { status: "error", errorMsg: "caseCapsule, runState, characterId required" };
  if (!question || question.trim().length < 2) return { status: "error", errorMsg: "question too short" };

  const character = (caseCapsule.characters || []).find((c) => c.characterId === characterId);
  if (!character) return { status: "error", errorMsg: `character ${characterId} not found` };
  
  const profile = character.interviewProfile || {};
  
  // Check patience
  const patienceUsed = (runState.hiddenCaseState?.characterPatience || {})[characterId] || 0;
  if (patienceUsed >= (profile.patience || 3)) {
    return { status: "warn", warning: "character patience exhausted", answer: "（对方不愿再回答更多问题了。）" };
  }

  // Match question against known topics
  const knows = profile.knows || [];
  const hides = profile.hides || [];
  const mistakenAbout = profile.mistakenAbout || [];

  const questionLower = question.toLowerCase();
  let answer = profile.initialStatement || "我不太清楚你在问什么。";
  let revealed = false;
  let stumbled = false;

  // Check if question hits known info
  for (const k of knows) {
    if (questionLower.includes(String(k).toLowerCase())) {
      answer = `关于${k}，我知道一些情况...`;
      revealed = true;
      break;
    }
  }

  // Check if question hits hidden info
  for (const h of hides) {
    if (questionLower.includes(String(h).toLowerCase())) {
      answer = "（对方显得紧张，回避了这个问题。）";
      stumbled = true;
      break;
    }
  }

  // Update patience
  const newPatience = { ...(runState.hiddenCaseState?.characterPatience || {}), [characterId]: patienceUsed + 1 };

  return {
    status: "ok",
    characterId,
    question: question.slice(0, 200),
    answer,
    revealed,
    stumbled,
    patienceUsed: patienceUsed + 1,
    patienceRemaining: (profile.patience || 3) - patienceUsed - 1,
  };
}

export function presentEvidenceToCharacter({ caseCapsule, runState, characterId, evidenceIds = [] } = {}) {
  if (!caseCapsule || !runState || !characterId || !evidenceIds.length) {
    return { status: "error", errorMsg: "caseCapsule, runState, characterId, evidenceIds required" };
  }

  const character = (caseCapsule.characters || []).find((c) => c.characterId === characterId);
  if (!character) return { status: "error", errorMsg: `character ${characterId} not found` };

  const profile = character.interviewProfile || {};
  const reactions = [];

  for (const eId of evidenceIds) {
    const evidence = (caseCapsule.evidence || []).find((e) => e.evidenceId === eId);
    if (!evidence) continue;

    // Check if character has specific reaction to this evidence
    const unlocksAfter = profile.unlocksAfterEvidence || [];
    if (unlocksAfter.includes(eId)) {
      reactions.push({
        evidenceId: eId,
        reaction: "unlock",
        newInfo: profile.knows?.slice(0, 2) || [],
        description: "出示证据后，对方的态度发生了变化。",
      });
    }

    // Check contradictions
    const contradictions = caseCapsule.contradictions || [];
    const related = contradictions.filter((c) => c.evidenceId === eId && c.characterId === characterId);
    for (const con of related) {
      reactions.push({
        evidenceId: eId,
        reaction: "contradiction",
        contradictionId: con.contradictionId,
        description: con.description || "证词与此证据矛盾！",
      });
    }

    if (reactions.length === 0) {
      reactions.push({ evidenceId: eId, reaction: "dismiss", description: "对方看了一眼，似乎不以为意。" });
    }
  }

  return {
    status: "ok",
    characterId,
    presentedEvidenceIds: evidenceIds,
    reactions,
    unlockedInfo: reactions.filter((r) => r.reaction === "unlock").flatMap((r) => r.newInfo || []),
    contradictionIds: reactions.filter((r) => r.reaction === "contradiction").map((r) => r.contradictionId),
  };
}

export function challengeTestimony({ caseCapsule, runState, testimonyId, evidenceId } = {}) {
  if (!caseCapsule || !runState || !testimonyId) {
    return { status: "error", errorMsg: "caseCapsule, runState, testimonyId required" };
  }

  const testimony = (caseCapsule.testimony || []).find((t) => t.testimonyId === testimonyId);
  if (!testimony) return { status: "error", errorMsg: `testimony ${testimonyId} not found` };

  const contradiction = (caseCapsule.contradictions || []).find(
    (c) => c.testimonyId === testimonyId && (evidenceId ? c.evidenceId === evidenceId : true)
  );

  if (contradiction) {
    return {
      status: "ok",
      testimonyId,
      challenged: true,
      contradictionDetected: true,
      contradictionId: contradiction.contradictionId,
      description: contradiction.description || "证词被证据推翻！",
      resolved: true,
    };
  }

  return {
    status: "ok",
    testimonyId,
    challenged: true,
    contradictionDetected: false,
    description: "没有发现明显矛盾。",
  };
}
