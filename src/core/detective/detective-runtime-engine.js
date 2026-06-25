// Detective V2 Runtime Engine
// Core play logic: investigate, interrogate, notebook, deduction.
// Pure functions. No file IO. No LLM calls. No hidden truth leakage.

import { extractDetectivePlayerCaseView } from "./detective-case-capsule.js";
import { createNotebookEntryFromSelection, updateNotebookEntry } from "./detective-player-notebook.js";
import { scoreDeductionReport, normalizeDeductionReport } from "./detective-deduction-report.js";

// ── Investigate ──

export function investigateDetectiveLocation({ caseCapsule, runState, locationId, target } = {}) {
  if (!caseCapsule || !runState) return { status: "error", errorMsg: "caseCapsule and runState required" };

  const location = (caseCapsule.locations || []).find((l) => l.locationId === locationId);
  if (!location) return { status: "error", errorMsg: `location ${locationId} not found` };
  if (location.isHidden) return { status: "error", errorMsg: "location not accessible" };

  // Discover evidence linked to this location
  const discoverableIds = location.discoverableEvidence || [];
  const newEvidenceIds = discoverableIds.filter((id) => !(runState.publicState?.discoveredEvidenceIds || []).includes(id));
  const discoveredEvidence = (caseCapsule.evidence || [])
    .filter((e) => newEvidenceIds.includes(e.evidenceId))
    .map((e) => {
      const { hiddenMeaning, unlockConditions, ...publicEvidence } = e;
      return publicEvidence;
    });

  // Public location info
  const { gmNotes, discoverableEvidence: _d, ...publicLocation } = location;

  return {
    status: "ok",
    location: publicLocation,
    discoveredEvidence,
    newEvidenceIds,
    discoveryCount: discoveredEvidence.length,
  };
}

// ── Interrogate ──

export function interrogateDetectiveCharacter({ caseCapsule, runState, characterId, question, presentedEvidenceIds } = {}) {
  if (!caseCapsule || !runState) return { status: "error", errorMsg: "caseCapsule and runState required" };

  const character = (caseCapsule.characters || []).find((c) => c.characterId === characterId);
  if (!character) return { status: "error", errorMsg: `character ${characterId} not found` };

  // Get the character's testimonies
  const testimonyIds = character.testimonyIds || [];
  const testimonies = (caseCapsule.testimonies || []).filter((t) => testimonyIds.includes(t.testimonyId));
  const newTestimonyIds = testimonyIds.filter((id) => !(runState.publicState?.discoveredTestimonyIds || []).includes(id));

  // Deterministic fallback answer
  let answer;
  if (character.initialStatement) {
    answer = `${character.name}：「${character.initialStatement}」`;
  } else if (testimonies.length > 0) {
    answer = `${character.name}：「${testimonies[0].summary}」`;
  } else {
    answer = `${character.name}：「……（沉默）」`;
  }

  // Player-safe character info (no isCulprit, no hiddenNotes)
  const { isCulprit, hiddenNotes, ...publicChar } = character;

  // Player-safe testimonies (no deceptionReason)
  const publicTestimonies = testimonies.map((t) => {
    const { deceptionReason, ...publicTestimony } = t;
    return publicTestimony;
  });

  return {
    status: "ok",
    character: publicChar,
    answer,
    testimony: publicTestimonies.length > 0 ? publicTestimonies[0] : null,
    allTestimonies: publicTestimonies,
    newTestimonyIds,
    questionAnswered: !!question,
  };
}

// ── Notebook ──

export function extractDetectiveNotebookEntry({ runState, selection, options } = {}) {
  if (!runState) return { status: "error", errorMsg: "runState required" };
  const entry = createNotebookEntryFromSelection(selection, options);
  if (!entry) return { status: "error", errorMsg: "invalid selection" };

  const notebook = runState.notebookState || {};
  const updated = {
    ...notebook,
    entries: [...(notebook.entries || []), entry],
    updatedAt: new Date().toISOString(),
  };

  return { status: "ok", entry, notebook: updated };
}

export function updateDetectiveNotebook({ runState, entryId, patch } = {}) {
  if (!runState) return { status: "error", errorMsg: "runState required" };
  if (!entryId) return { status: "error", errorMsg: "entryId required" };

  const notebook = runState.notebookState || {};
  const updated = updateNotebookEntry(notebook, entryId, patch || {});

  return { status: "ok", notebook: updated };
}

// ── Deduction ──

export function submitDetectiveDeduction({ caseCapsule, runState, report } = {}) {
  if (!caseCapsule || !runState) return { status: "error", errorMsg: "caseCapsule and runState required" };

  const normalized = normalizeDeductionReport({ ...report, caseId: caseCapsule.caseId });
  const truthLedger = caseCapsule.truthLedger || {};
  const scoreResult = scoreDeductionReport(normalized, truthLedger);

  // Public feedback only — no full truth dump
  const publicFeedback = scoreResult.locks.map((l) => ({
    lockId: l.lockId,
    label: l.label,
    submitted: true,
    scored: l.score > 0,
    feedback: l.reason,
  }));

  return {
    status: "ok",
    score: scoreResult.score,
    maxScore: scoreResult.maxScore,
    percentage: Math.round((scoreResult.score / scoreResult.maxScore) * 100),
    locks: publicFeedback,
    missingCriticalEvidenceCount: scoreResult.missingCriticalEvidenceIds.length,
    // Never include full truthLedger in public response
  };
}

// ── Hidden leak scanner ──

const FORBIDDEN_KEYS = ["truthLedger", "hiddenMeaning", "deceptionReason", "isCulprit", "hiddenNotes", "solutionChain", "realTimeline"];

export function assertNoDetectiveHiddenLeak(payload = {}) {
  const text = JSON.stringify(payload || {});
  const leaked = FORBIDDEN_KEYS.filter((key) => text.includes(key));
  return { ok: leaked.length === 0, leaked };
}
