// Detective V2 Case Capsule
// Normalizes a detective case from input. Separates player view from hidden truth.
// Never exposes truthLedger/hiddenTruth/solutionChain/isLie/lieReason in player view.

import { normalizeTruthLedger, assertTruthLedgerNotInPlayerView } from "./detective-truth-ledger.js";
import { normalizeEvidenceRegistry } from "./detective-evidence-registry.js";
import { normalizeTestimonyRegistry } from "./detective-testimony-registry.js";
import { normalizeDetectiveAssetLinks, createDetectiveRuntimeIsolationMeta } from "./detective-asset-links.js";

export const DETECTIVE_CASE_SCHEMA_VERSION = "world-tree.detective.v2.case.1";

export function normalizeDetectiveCaseCapsule(input = {}) {
  if (!input || typeof input !== "object") return null;

  const caseId = input.caseId || input.id || `case_${Date.now()}`;

  return {
    schemaVersion: input.schemaVersion || DETECTIVE_CASE_SCHEMA_VERSION,
    mode: "detective",
    caseId,
    title: input.title || "未命名案件",
    sourceType: input.sourceType || "generated",
    difficultyProfile: input.difficultyProfile || {
      difficulty: input.difficulty || "standard",
      estimatedTurns: input.estimatedTurns || 20,
      suspectCount: input.suspectCount || 4,
      locationCount: input.locationCount || 3,
      coreClueCount: input.coreClueCount || 5,
      misdirectionCount: input.misdirectionCount || 3,
      testimonyCount: input.testimonyCount || 6,
    },
    estimatedPlayTime: input.estimatedPlayTime || "30-60 min",
    playerBrief: input.playerBrief || {
      premise: input.premise || "",
      setting: input.setting || "",
      initialBriefing: input.initialBriefing || "",
      publicFacts: input.publicFacts || [],
      castList: input.castList || [],
      locationDirectory: input.locationDirectory || [],
    },
    truthLedger: normalizeTruthLedger(input.truthLedger || {}),
    locations: (input.locations || []).map((l) => ({
      locationId: l.locationId || l.id || `loc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: l.name || "未命名地点",
      description: l.description || "",
      isStartingLocation: l.isStartingLocation || false,
      connectedLocations: l.connectedLocations || [],
      discoverableEvidence: l.discoverableEvidence || [],
      isHidden: l.isHidden || false,
      gmNotes: l.gmNotes || "",
    })),
    characters: (input.characters || []).map((c) => ({
      characterId: c.characterId || c.id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: c.name || "未命名人物",
      role: c.role || "witness",
      isSuspect: c.isSuspect !== undefined ? c.isSuspect : false,
      isCulprit: c.isCulprit !== undefined ? c.isCulprit : false,
      isVictim: c.isVictim || false,
      profile: c.profile || "",
      testimonyIds: c.testimonyIds || [],
      initialStatement: c.initialStatement || "",
      hiddenNotes: c.hiddenNotes || "",
    })),
    evidence: normalizeEvidenceRegistry(input.evidence || []),
    testimonies: normalizeTestimonyRegistry(input.testimonies || []),
    timeline: input.timeline || { realTimeline: [], publicTimeline: [] },
    notebookPolicy: input.notebookPolicy || { allowPlayerNotes: true, allowTags: true, allowLinks: true },
    deductionReportSchema: input.deductionReportSchema || null,
    generatorBlueprint: input.generatorBlueprint || null,
    assetLinks: normalizeDetectiveAssetLinks(input.assetLinks || {}),
    runtimeIsolation: createDetectiveRuntimeIsolationMeta(input.runtimeIsolation || {}),
    _extra: input._extra || {},
  };
}

export function validateDetectiveCaseCapsule(caseCapsule = {}) {
  const errors = [];
  if (!caseCapsule.caseId) errors.push("caseId is required");
  if (!caseCapsule.title) errors.push("title is required");
  if (!caseCapsule.truthLedger) errors.push("truthLedger is required");
  if (!Array.isArray(caseCapsule.locations)) errors.push("locations must be an array");
  if (!Array.isArray(caseCapsule.characters)) errors.push("characters must be an array");
  if (!Array.isArray(caseCapsule.evidence)) errors.push("evidence must be an array");
  if (!Array.isArray(caseCapsule.testimonies)) errors.push("testimonies must be an array");
  return { valid: errors.length === 0, errors };
}

export function extractDetectivePlayerCaseView(caseCapsule = {}) {
  const {
    truthLedger, _extra, runtimeIsolation, generatorBlueprint,
    ...safe
  } = caseCapsule;

  // Strip hidden fields from evidence
  safe.evidence = (safe.evidence || []).map((e) => {
    const { hiddenMeaning, unlockConditions, ...publicEvidence } = e;
    return publicEvidence;
  });

  // Strip deception reasons from testimonies
  safe.testimonies = (safe.testimonies || []).map((t) => {
    const { deceptionReason, ...publicTestimony } = t;
    return publicTestimony;
  });

  // Strip hidden notes from characters
  safe.characters = (safe.characters || []).map((c) => {
    const { hiddenNotes, isCulprit, ...publicChar } = c;
    return publicChar;
  });

  // Strip hidden scenes
  safe.locations = (safe.locations || []).filter((l) => !l.isHidden).map((l) => {
    const { gmNotes, discoverableEvidence, ...publicLoc } = l;
    return publicLoc;
  });

  return safe;
}

export function extractDetectiveHiddenCaseView(caseCapsule = {}) {
  return {
    caseId: caseCapsule.caseId,
    truthLedger: caseCapsule.truthLedger,
    hiddenLocations: (caseCapsule.locations || []).filter((l) => l.isHidden),
    hiddenEvidence: (caseCapsule.evidence || []).map((e) => ({
      evidenceId: e.evidenceId,
      label: e.label,
      hiddenMeaning: e.hiddenMeaning,
      isCoreClue: e.isCoreClue,
    })),
    deceptionMap: (caseCapsule.testimonies || []).map((t) => ({
      testimonyId: t.testimonyId,
      witnessName: t.witnessName,
      deceptionType: t.deceptionType,
      deceptionReason: t.deceptionReason,
    })),
    culpritCharacters: (caseCapsule.characters || []).filter((c) => c.isCulprit).map((c) => ({
      characterId: c.characterId,
      name: c.name,
      hiddenNotes: c.hiddenNotes,
    })),
  };
}
