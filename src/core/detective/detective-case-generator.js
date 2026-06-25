// Detective V2 Case Generator
// Generates playable case capsules from premises, blueprints, or partial designs.
// Deterministic, local-first, no LLM required.

import { normalizeDetectiveCaseCapsule } from "./detective-case-capsule.js";
import { createHash } from "node:crypto";

export function generateDetectiveCaseFromPremise(premise = "", options = {}) {
  const cleanPremise = String(premise || "").trim();
  if (cleanPremise.length < 5) {
    return { status: "error", code: "PREMISE_TOO_SHORT", errorMsg: "premise too short (min 5 chars)" };
  }

  const seed = options.seed || hashPremise(cleanPremise);
  const genre = options.genre || inferGenre(cleanPremise);
  const caseId = options.caseId || `case_gen_${seed}`;
  const title = options.title || `案件：${cleanPremise.slice(0, 36)}`;

  const culpritId = `${caseId}_char_5`;
  const victimId = `${caseId}_char_0`;

  const characters = buildCharacters({ caseId, culpritId, victimId, genre });
  const locations = buildLocations({ caseId, genre });
  const evidence = buildEvidence({ caseId, culpritId, victimId });
  const testimonies = buildTestimonies({ caseId, culpritId, victimId });
  const contradictions = buildContradictions({ caseId });
  const timeline = buildTimeline({ caseId });

  const draft = {
    schemaVersion: "world-tree.detective.v2.case.1",
    caseId,
    title,
    sourceType: "generated",
    genre,
    premise: cleanPremise,
    playerBrief: {
      title,
      premise: cleanPremise,
      objective: "调查案件真相，建立证据链，并提交结案报告。",
      safety: "本案只描述调查与证据，不渲染血腥细节。"
    },
    characters,
    locations: attachEvidenceToLocations({ locations, evidence }),
    evidence,
    testimonies,
    contradictions,
    timeline,
    truthLedger: {
      culpritIds: [culpritId],
      motive: "凶手因长期利益冲突与被害人掌握的秘密记录而作案。",
      method: "凶手利用时间差、伪造的不在场证词和现场布置误导调查方向。",
      realTimeline: timeline.realTimeline,
      falseTimeline: timeline.publicTimeline,
      keyContradictions: contradictions.map((c) => c.contradictionId),
      criticalEvidenceIds: [`${caseId}_ev_1`, `${caseId}_ev_2`, `${caseId}_ev_5`, `${caseId}_ev_8`],
      misleadingEvidenceIds: [`${caseId}_ev_4`, `${caseId}_ev_7`],
      witnessDeceptions: [
        { characterId: `${caseId}_char_2`, type: "mistaken", testimonyId: `${caseId}_ts_2`, reason: "证人只听见声音，没有看到现场。" },
        { characterId: culpritId, type: "lie", testimonyId: `${caseId}_ts_5`, reason: "凶手隐瞒真实到场时间。" }
      ],
      solutionChain: [
        { step: 1, evidenceId: `${caseId}_ev_1`, claim: "关键物件显示公开时间线不可靠。" },
        { step: 2, evidenceId: `${caseId}_ev_2`, claim: "现场痕迹证明有人在公开证词前进入现场。" },
        { step: 3, testimonyId: `${caseId}_ts_5`, claim: "凶手的不在场证词与独立证据冲突。" },
        { step: 4, evidenceId: `${caseId}_ev_8`, claim: "隐藏记录给出动机和最终指向。" }
      ],
      gradingRubric: {
        culprit: 30,
        motive: 20,
        method: 20,
        evidenceChain: 20,
        timeline: 10
      }
    },
    deductionReportSchema: {
      locks: [
        { lockId: "culprit", label: "凶手身份", weight: 30, required: true },
        { lockId: "motive", label: "作案动机", weight: 20, required: true },
        { lockId: "method", label: "作案手法", weight: 20, required: true },
        { lockId: "evidence_chain", label: "证据链", weight: 20, required: true },
        { lockId: "timeline", label: "真实时间线", weight: 10, required: true }
      ]
    },
    notebookStarterTags: ["关键线索", "矛盾点", "可疑行为", "时间线节点", "待验证证词"],
    hintPolicy: {
      maxHints: 5,
      penaltyPerHint: 0.05,
      hintLevels: ["location", "testimony", "evidence-link", "contradiction"]
    },
    assetBindings: []
  };

  const normalized = normalizeDetectiveCaseCapsule(draft);
  return {
    status: "ok",
    draft: normalized,
    genre,
    seed,
    characterCount: characters.length,
    locationCount: locations.length,
    evidenceCount: evidence.length,
    testimonyCount: testimonies.length,
    contradictionCount: contradictions.length
  };
}

export function expandGeneratorBlueprintToPlayableCase(blueprint = {}, options = {}) {
  if (!blueprint || !(blueprint.premise || blueprint.title)) {
    return { status: "error", code: "BLUEPRINT_MISSING_PREMISE", errorMsg: "blueprint must have a premise or title" };
  }

  const result = generateDetectiveCaseFromPremise(blueprint.premise || blueprint.title, {
    ...options,
    genre: blueprint.genre || options.genre,
    title: blueprint.title || options.title,
    caseId: blueprint.caseId || options.caseId
  });
  if (result.status !== "ok") return result;

  const draft = structuredClone(result.draft);
  for (const key of ["characters", "locations", "evidence", "testimonies", "contradictions", "timeline", "truthLedger", "deductionReportSchema"]) {
    if (blueprint[key]) draft[key] = mergeByKind(draft[key], blueprint[key]);
  }

  return { status: "ok", draft: normalizeDetectiveCaseCapsule(draft) };
}

export function normalizeGeneratedDetectiveCase(caseDraft = {}) {
  return normalizeDetectiveCaseCapsule(caseDraft);
}

function buildCharacters({ caseId, culpritId, victimId }) {
  return [
    { characterId: victimId, name: "被害人", role: "victim", description: "案件核心人物，掌握一份关键记录。", isHidden: false },
    { characterId: `${caseId}_char_1`, name: "合伙人", role: "suspect", description: "与被害人有经济纠纷，动机明显但证据不足。", interviewProfile: { initialStatement: "我们只是普通争执，我没有必要害他。", knows: ["被害人最近焦虑"], hides: ["经济纠纷"], patience: 3 } },
    { characterId: `${caseId}_char_2`, name: "目击者", role: "witness", description: "提供关键时间证词，但观察条件有限。", interviewProfile: { initialStatement: "我在那个时间听见了声响，所以以为事情刚发生。", knows: ["公开时间线"], mistakenAbout: ["声音来源"], patience: 4 } },
    { characterId: `${caseId}_char_3`, name: "管理人", role: "authority", description: "负责保管现场记录和钥匙。", interviewProfile: { initialStatement: "现场记录我已经交给你了，但有几页不见了。", knows: ["记录缺页"], hides: [], patience: 5 } },
    { characterId: culpritId, name: "熟人", role: "suspect", description: "看似边缘人物，实际拥有进入现场的机会。", isCulprit: true, isHidden: true, interviewProfile: { initialStatement: "我到的时候一切已经结束了。", knows: ["真实到场时间"], hides: ["进入现场的方式", "真实动机"], patience: 2, emotionalTriggers: ["隐藏记录", "伪造时间"] } }
  ];
}

function buildLocations({ caseId }) {
  return [
    { locationId: `${caseId}_loc_1`, name: "案发现场", description: "现场保持了基本原貌，几个细节和公开时间线不一致。", isCrimeScene: true, areas: [] },
    { locationId: `${caseId}_loc_2`, name: "被害人房间", description: "房间里有被翻找过的痕迹。", areas: [] },
    { locationId: `${caseId}_loc_3`, name: "证人所在地点", description: "证人声称听见异常声音的位置。", areas: [] },
    { locationId: `${caseId}_loc_4`, name: "管理处", description: "存放钥匙、出入登记和维修记录。", areas: [] },
    { locationId: `${caseId}_loc_5`, name: "嫌疑人住处", description: "可找到与动机有关的残留记录。", areas: [] },
    { locationId: `${caseId}_loc_6`, name: "档案室", description: "旧资料能解释某些异常痕迹。", areas: [] }
  ];
}

function buildEvidence({ caseId, culpritId }) {
  return [
    { evidenceId: `${caseId}_ev_1`, name: "停滞的时间记录", locationId: `${caseId}_loc_1`, visibleDescription: "记录停在公开认定时间附近。", hiddenMeaning: "时间被人为制造，不能直接作为死亡时间。", reliability: "high", evidenceStrength: "key", relatedTimePoints: [`${caseId}_time_real_2`], contradictsTestimonyIds: [`${caseId}_ts_2`] },
    { evidenceId: `${caseId}_ev_2`, name: "提前出现的痕迹", locationId: `${caseId}_loc_1`, visibleDescription: "现场有一处比公开时间更早形成的痕迹。", hiddenMeaning: "有人在证词时间前已经进入现场。", reliability: "high", evidenceStrength: "key", relatedPersons: [culpritId], contradictsTestimonyIds: [`${caseId}_ts_5`] },
    { evidenceId: `${caseId}_ev_3`, name: "缺页登记簿", locationId: `${caseId}_loc_4`, visibleDescription: "出入记录被撕走一页。", hiddenMeaning: "有人试图隐藏真实到场时间。", reliability: "medium", evidenceStrength: "supporting" },
    { evidenceId: `${caseId}_ev_4`, name: "明显的争吵记录", locationId: `${caseId}_loc_2`, visibleDescription: "合伙人与被害人的争吵记录。", hiddenMeaning: "动机明显但过于表面，是误导方向。", reliability: "medium", evidenceStrength: "misleading", isMisleading: true },
    { evidenceId: `${caseId}_ev_5`, name: "备用钥匙痕迹", locationId: `${caseId}_loc_4`, visibleDescription: "备用钥匙近期被使用过。", hiddenMeaning: "凶手有进入现场的实际机会。", reliability: "high", evidenceStrength: "decisive", relatedPersons: [culpritId] },
    { evidenceId: `${caseId}_ev_6`, name: "证人位置示意", locationId: `${caseId}_loc_3`, visibleDescription: "证人位置只能听见声音，无法看见现场。", hiddenMeaning: "证人证词可能是真诚但错误的。", reliability: "high", evidenceStrength: "supporting", contradictsTestimonyIds: [`${caseId}_ts_2`] },
    { evidenceId: `${caseId}_ev_7`, name: "伪装遗留物", locationId: `${caseId}_loc_1`, visibleDescription: "看似属于合伙人的物品。", hiddenMeaning: "它很可能被故意放置。", reliability: "low", evidenceStrength: "misleading", isMisleading: true },
    { evidenceId: `${caseId}_ev_8`, name: "隐藏记录", locationId: `${caseId}_loc_6`, visibleDescription: "一份关于旧纠纷的记录。", hiddenMeaning: "说明真凶动机与被害人掌握的秘密有关。", reliability: "high", evidenceStrength: "decisive", relatedPersons: [culpritId] }
  ];
}

function buildTestimonies({ caseId, culpritId }) {
  return [
    { testimonyId: `${caseId}_ts_1`, speakerId: `${caseId}_char_1`, rawQuote: "我和他只是争吵，没有再见过他。", claimedFacts: ["与被害人有争执"], reliability: "partial_truth", isLie: false, linkedEvidenceIds: [`${caseId}_ev_4`] },
    { testimonyId: `${caseId}_ts_2`, speakerId: `${caseId}_char_2`, rawQuote: "我在公开时间听见了异常声响。", claimedFacts: ["公开时间发生异常"], reliability: "mistaken", isLie: false, linkedEvidenceIds: [`${caseId}_ev_1`, `${caseId}_ev_6`] },
    { testimonyId: `${caseId}_ts_3`, speakerId: `${caseId}_char_3`, rawQuote: "登记簿少了一页，备用钥匙也被动过。", claimedFacts: ["记录缺页", "备用钥匙被动过"], reliability: "first_hand", isLie: false, linkedEvidenceIds: [`${caseId}_ev_3`, `${caseId}_ev_5`] },
    { testimonyId: `${caseId}_ts_4`, speakerId: `${caseId}_char_1`, rawQuote: "那件遗留物确实像我的，但我不知道为什么会在那里。", claimedFacts: ["遗留物可能属于合伙人"], reliability: "self_protective", isLie: false, linkedEvidenceIds: [`${caseId}_ev_7`] },
    { testimonyId: `${caseId}_ts_5`, speakerId: culpritId, rawQuote: "我到的时候现场已经没人了，我没有提前进去。", claimedFacts: ["凶手否认提前进入现场"], reliability: "lie", isLie: true, lieReason: "隐藏真实到场时间和进入方式", linkedEvidenceIds: [`${caseId}_ev_2`, `${caseId}_ev_5`] }
  ];
}

function buildContradictions({ caseId }) {
  return [
    { contradictionId: `${caseId}_ct_1`, testimonyId: `${caseId}_ts_2`, evidenceId: `${caseId}_ev_1`, description: "证人听见异常声音的时间不能直接证明案发时间。" },
    { contradictionId: `${caseId}_ct_2`, testimonyId: `${caseId}_ts_5`, evidenceId: `${caseId}_ev_2`, description: "凶手否认提前到场，但现场痕迹表明有人更早进入。" },
    { contradictionId: `${caseId}_ct_3`, testimonyId: `${caseId}_ts_5`, evidenceId: `${caseId}_ev_5`, description: "备用钥匙痕迹说明凶手具备进入机会。" }
  ];
}

function buildTimeline({ caseId }) {
  return {
    realTimeline: [
      { timeId: `${caseId}_time_real_1`, label: "早于公开时间", event: "凶手提前进入现场。" },
      { timeId: `${caseId}_time_real_2`, label: "公开时间前", event: "现场关键事件已发生。" },
      { timeId: `${caseId}_time_real_3`, label: "公开时间", event: "误导性声音或记录制造了错误时间感。" }
    ],
    publicTimeline: [
      { timeId: `${caseId}_time_public_1`, label: "公开时间", event: "证人听见异常声响，误以为案件刚发生。" },
      { timeId: `${caseId}_time_public_2`, label: "随后", event: "现场被发现，明显线索指向错误嫌疑人。" }
    ]
  };
}

function attachEvidenceToLocations({ locations, evidence }) {
  return locations.map((loc) => {
    const ids = evidence.filter((e) => e.locationId === loc.locationId).map((e) => e.evidenceId);
    return {
      ...loc,
      discoverableEvidence: ids,
      areas: (loc.areas && loc.areas.length > 0 ? loc.areas : [{
        areaId: `${loc.locationId}_area_1`,
        label: "主区域",
        description: loc.description,
        evidenceIds: ids,
        unlockConditions: null,
        revisitReveals: null,
        timeCost: 1
      }])
    };
  });
}

function hashPremise(text) {
  return createHash("sha256").update(String(text)).digest("hex").slice(0, 8);
}

function inferGenre(premise = "") {
  const lower = String(premise).toLowerCase();
  if (lower.includes("密室") || lower.includes("locked room")) return "locked_room";
  if (lower.includes("毒") || lower.includes("poison")) return "poison";
  if (lower.includes("失踪") || lower.includes("missing")) return "missing_person";
  if (lower.includes("盗") || lower.includes("theft") || lower.includes("heist")) return "theft";
  if (lower.includes("连环") || lower.includes("serial")) return "serial";
  return "murder_mystery";
}

function mergeByKind(baseValue, patchValue) {
  if (Array.isArray(baseValue) && Array.isArray(patchValue)) return patchValue.length ? patchValue : baseValue;
  if (baseValue && typeof baseValue === "object" && patchValue && typeof patchValue === "object") return { ...baseValue, ...patchValue };
  return patchValue ?? baseValue;
}
