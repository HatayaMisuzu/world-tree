// Detective V2 Case Generator
// Generates playable case capsules from premises, blueprints, or partial designs.
// No LLM. Deterministic expansion from structured templates.

import { normalizeDetectiveCaseCapsule } from "./detective-case-capsule.js";
import { createHash } from "node:crypto";

// ── Generate from premise ──

export function generateDetectiveCaseFromPremise(premise = "", options = {}) {
  if (!premise || premise.trim().length < 5) {
    return { status: "error", code: "PREMISE_TOO_SHORT", errorMsg: "premise too short (min 5 chars)" };
  }

  const seed = options.seed || hashPremise(premise);
  const genre = options.genre || inferGenre(premise);

  // Generate template structure
  const caseId = options.caseId || `case_gen_${Date.now()}`;
  
  // Characters: suspect and witness archetypes per genre
  const characterArchetypes = getCharacterArchetypes(genre);
  const locationTemplates = getLocationTemplates(genre);
  
  const draft = {
    schemaVersion: "world-tree.detective.v2.case.1",
    caseId,
    title: options.title || `案件: ${premise.slice(0, 40)}`,
    sourceType: "generated",
    genre,
    premise: premise.trim(),
    // Characters: generate 4-6 profiles
    characters: characterArchetypes.slice(0, options.characterCount || 5).map((arch, i) => ({
      characterId: `${caseId}_char_${i + 1}`,
      name: arch.name,
      role: arch.role,          // suspect / witness / victim / authority
      description: arch.description,
      isCulprit: arch.isCulprit || false,
      interviewProfile: {
        knows: arch.knows || [],
        hides: arch.hides || [],
        mistakenAbout: arch.mistakenAbout || [],
        protects: arch.protects || null,
        patience: arch.patience || 3,
        emotionalTriggers: arch.emotionalTriggers || [],
        unlocksAfterEvidence: arch.unlocksAfterEvidence || [],
        contradictionReactions: arch.contradictionReactions || [],
        initialStatement: arch.initialStatement || "",
      },
      isHidden: arch.isCulprit || false,
    })),
    // Locations: generate 5-8
    locations: locationTemplates.slice(0, options.locationCount || 6).map((loc, i) => ({
      locationId: `${caseId}_loc_${i + 1}`,
      name: loc.name,
      description: loc.description,
      areas: (loc.areas || [{
        areaId: `${caseId}_loc_${i + 1}_area_1`,
        label: "主区域",
        description: loc.description,
        evidenceIds: [],
        unlockConditions: null,
        revisitReveals: null,
        timeCost: 1,
      }]),
      discoverableEvidence: [],
      isHidden: false,
      isCrimeScene: loc.isCrimeScene || false,
    })),
    // Evidence: generate 12-24 stub items
    evidence: [],
    // Testimonies: generate 8-16 stub items
    testimonies: [],
    // Contradictions: 3-6 pairs
    contradictions: [],
    // Timeline
    timeline: { realTimeline: [], publicTimeline: [] },
    // Truth Ledger
    truthLedger: {
      culpritIds: [],
      motive: "",
      method: "",
      criticalEvidenceIds: [],
      misleadingEvidenceIds: [],
      keyContradictions: [],
      witnessDeceptions: [],
      solutionChain: [],
      realTimeline: [],
    },
    deductionReportSchema: {
      locks: [
        { lockId: "culprit", label: "凶手身份", weight: 35 },
        { lockId: "motive", label: "作案动机", weight: 25 },
        { lockId: "method", label: "作案手法", weight: 20 },
        { lockId: "evidence_chain", label: "证据链", weight: 15 },
        { lockId: "timeline", label: "时间线", weight: 5 },
      ],
    },
    notebookStarterTags: ["关键线索", "矛盾点", "可疑行为", "时间线节点"],
    hintPolicy: { maxHints: 5, penaltyPerHint: 0.05, hintLevels: ["location", "testimony", "evidence-link", "contradiction"] },
    assetBindings: [],
  };

  return {
    status: "ok",
    draft: normalizeDetectiveCaseCapsule(draft),
    genre,
    characterCount: draft.characters.length,
    locationCount: draft.locations.length,
  };
}

// ── Expand blueprint to playable case ──

export function expandGeneratorBlueprintToPlayableCase(blueprint = {}, options = {}) {
  if (!blueprint || !blueprint.premise) return { status: "error", errorMsg: "blueprint must have a premise" };

  // Use blueprint's own structured data if available, otherwise generate
  const premise = blueprint.premise || blueprint.title || "";
  const result = generateDetectiveCaseFromPremise(premise, { 
    genre: blueprint.genre, 
    characterCount: blueprint.characterCount || blueprint.characters?.length || 5,
    locationCount: blueprint.locationCount || blueprint.locations?.length || 6,
  });

  if (result.status === "error") return result;

  // Merge blueprint details if provided
  const draft = result.draft;
  if (blueprint.title) draft.title = blueprint.title;
  if (blueprint.truthLedger) draft.truthLedger = { ...draft.truthLedger, ...blueprint.truthLedger };
  if (blueprint.characters) {
    draft.characters = blueprint.characters.map((c, i) => ({
      ...draft.characters[i] || {},
      ...c,
      characterId: c.characterId || draft.characters[i]?.characterId || `${draft.caseId}_char_${i + 1}`,
    }));
  }
  if (blueprint.locations) {
    draft.locations = blueprint.locations.map((l, i) => ({
      ...draft.locations[i] || {},
      ...l,
      locationId: l.locationId || draft.locations[i]?.locationId || `${draft.caseId}_loc_${i + 1}`,
    }));
  }

  return { status: "ok", draft: normalizeDetectiveCaseCapsule(draft) };
}

// ── Normalize generated case ──

export function normalizeGeneratedDetectiveCase(caseDraft = {}) {
  return normalizeDetectiveCaseCapsule(caseDraft);
}

// ── Helpers ──

function hashPremise(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

function inferGenre(premise = "") {
  const lower = premise.toLowerCase();
  if (lower.includes("密室") || lower.includes("locked room")) return "locked_room";
  if (lower.includes("毒") || lower.includes("poison")) return "poison";
  if (lower.includes("失踪") || lower.includes("missing")) return "missing_person";
  if (lower.includes("盗") || lower.includes("theft") || lower.includes("heist")) return "theft";
  if (lower.includes("连环") || lower.includes("serial")) return "serial";
  return "murder_mystery";
}

function getCharacterArchetypes(genre) {
  const base = [
    { name: "神秘人 A", role: "suspect", description: "行为可疑，有动机但没有确凿证据", isCulprit: false, knows: ["部分时间线"], hides: ["不在场证明的漏洞"], initialStatement: "我那天晚上在家，没人能证明。" },
    { name: "证人 B", role: "witness", description: "目击了部分事件", isCulprit: false, knows: ["关键时间点"], hides: [], patience: 4, initialStatement: "我看到了一个人影从现场离开。" },
    { name: "关系人 C", role: "suspect", description: "与受害者有密切关系", isCulprit: false, knows: ["受害者秘密"], hides: ["经济纠纷"], initialStatement: "我们的关系很好，没有矛盾。" },
    { name: "权威人士 D", role: "authority", description: "执法者/调查者", isCulprit: false, knows: ["官方信息"], patience: 5, initialStatement: "请提供任何有用线索。" },
    { name: "真凶 E", role: "suspect", description: "真正的凶手", isCulprit: true, knows: [], hides: ["全部真相"], patience: 2, emotionalTriggers: ["作案手法"], initialStatement: "我什么都不知道。" },
  ];
  return base;
}

function getLocationTemplates(genre) {
  return [
    { name: "案发现场", description: "案件发生的第一现场", isCrimeScene: true },
    { name: "受害者住所", description: "受害者的家或工作场所" },
    { name: "目击地点", description: "证人声称看到关键事件的地点" },
    { name: "嫌疑人住所", description: "主要嫌疑人的住处" },
    { name: "周边区域", description: "案发现场周边的街道/建筑" },
    { name: "隐藏地点", description: "不易被发现但可能藏有关键证据的地方" },
    { name: "公共场所", description: "相关人员聚集的公共场所" },
    { name: "档案室", description: "存有相关记录的官方场所" },
  ];
}
