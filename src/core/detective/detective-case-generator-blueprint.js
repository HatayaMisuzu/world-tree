// Detective V2 Case Generator Blueprint
// Planning scaffold for case generation. Produces structured plans, NOT final playable cases.
// Inspired by GUMSHOE (core clue access), Obra Dinn (multi-lock deduction),
// Consulting Detective (location/person/document directory), Roottrees (searchable corpus).

// ── Complexity profile ──

const DIFFICULTY_PRESETS = {
  easy: { suspectCount: 3, locationCount: 2, coreClueCount: 3, misdirectionCount: 1, testimonyCount: 4, estimatedTurns: 12, deductionLocks: 4 },
  standard: { suspectCount: 4, locationCount: 3, coreClueCount: 5, misdirectionCount: 3, testimonyCount: 6, estimatedTurns: 20, deductionLocks: 6 },
  hard: { suspectCount: 5, locationCount: 4, coreClueCount: 7, misdirectionCount: 5, testimonyCount: 8, estimatedTurns: 30, deductionLocks: 7 },
};

export function createCaseComplexityProfile(input = {}) {
  const difficulty = ["easy", "standard", "hard"].includes(input.difficulty) ? input.difficulty : "standard";
  const preset = DIFFICULTY_PRESETS[difficulty];
  return {
    difficulty,
    suspectCount: input.suspectCount || preset.suspectCount,
    locationCount: input.locationCount || preset.locationCount,
    coreClueCount: input.coreClueCount || preset.coreClueCount,
    misdirectionCount: input.misdirectionCount || preset.misdirectionCount,
    testimonyCount: input.testimonyCount || preset.testimonyCount,
    estimatedTurns: input.estimatedTurns || preset.estimatedTurns,
    deductionLocks: input.deductionLocks || preset.deductionLocks,
    complexityNotes: input.complexityNotes || "",
  };
}

// ── Mystery logic graph ──

export function createMysteryLogicGraph(input = {}) {
  return {
    premise: input.premise || "",
    victimProfile: input.victimProfile || {},
    suspectMotivations: input.suspectMotivations || [],
    keyRelationships: input.keyRelationships || [],
    hiddenEvents: input.hiddenEvents || [],
    redHerrings: input.redHerrings || [],
    deceptionWeb: input.deceptionWeb || { lies: [], partialTruths: [], mistakes: [], protections: [] },
    logicHoles: input.logicHoles || [],
  };
}

// ── Solvability checklist ──

export function createSolvabilityChecklist(blueprint = {}) {
  const profile = blueprint.complexityProfile || {};
  const graph = blueprint.mysteryLogicGraph || {};
  const checklist = [];

  checklist.push({ id: "suspects", label: "嫌疑人数量充足", ok: (profile.suspectCount || 0) >= 3, note: `当前: ${profile.suspectCount || 0}` });
  checklist.push({ id: "coreClues", label: "核心线索均有访问路径", ok: (blueprint.cluePlan?.accessPaths?.length || 0) >= (profile.coreClueCount || 3), note: `路径数: ${blueprint.cluePlan?.accessPaths?.length || 0}` });
  checklist.push({ id: "motive", label: "动机链条完整", ok: (graph.suspectMotivations || []).length >= 2, note: `动机数: ${(graph.suspectMotivations || []).length}` });
  checklist.push({ id: "deception", label: "欺骗类型多样化", ok: (graph.deceptionWeb?.lies?.length || 0) + (graph.deceptionWeb?.partialTruths?.length || 0) + (graph.deceptionWeb?.mistakes?.length || 0) > 1, note: "非单一谎言型" });
  checklist.push({ id: "noDeadEnd", label: "无死胡同", ok: blueprint.cluePlan?.noDeadEndGuarantee !== false, note: "" });
  checklist.push({ id: "turns", label: "预估回合数合理", ok: (profile.estimatedTurns || 0) >= 10, note: `预估: ${profile.estimatedTurns || 0}` });
  checklist.push({ id: "locks", label: "推理锁数量充足", ok: (profile.deductionLocks || 0) >= 4, note: `锁数: ${profile.deductionLocks || 0}` });

  return {
    checklist,
    allOk: checklist.every((c) => c.ok),
    failures: checklist.filter((c) => !c.ok).map((c) => c.id),
  };
}

// ── Anti-speedrun validator ──

export function validateAntiSpeedrunDesign(blueprint = {}) {
  const warnings = [];
  const c = blueprint.complexityProfile || {};
  const g = blueprint.mysteryLogicGraph || {};

  if ((c.suspectCount || 0) < 4 && ["standard", "hard"].includes(c.difficulty)) {
    warnings.push(`suspectCount=${c.suspectCount} too low for ${c.difficulty} (need ≥4)`);
  }
  if ((c.deductionLocks || 0) < 5) {
    warnings.push(`deductionLocks=${c.deductionLocks} too low (need ≥5)`);
  }
  if ((blueprint.cluePlan?.accessPaths?.length || 0) < 2) {
    warnings.push("core clue access paths < 2 — risk of dead end");
  }
  const deceptionTypes = new Set();
  if (g.deceptionWeb) {
    for (const key of ["lies", "partialTruths", "mistakes", "protections"]) {
      if (Array.isArray(g.deceptionWeb[key]) && g.deceptionWeb[key].length > 0) deceptionTypes.add(key);
    }
  }
  if (deceptionTypes.size <= 1 && c.testimonyCount > 3) {
    warnings.push("only one deception type used — case may be too simple");
  }
  if (!g.suspectMotivations || g.suspectMotivations.length < 2) {
    warnings.push("fewer than 2 suspect motivations — only culprit has motive?");
  }
  if ((blueprint.cluePlan?.requiredClueIds?.length || 0) < 3) {
    warnings.push("fewer than 3 core clues — case may be solvable by guessing");
  }
  if ((c.testimonyCount || 0) < 4) {
    warnings.push(`testimonyCount=${c.testimonyCount} too low for meaningful cross-examination`);
  }

  return {
    passed: warnings.length === 0,
    warnings,
    severity: warnings.filter((w) => w.includes("too low") || w.includes("only one")).length > 2 ? "high" : "medium",
  };
}

// ── Main planner ──

export function planCaseCapsuleFromPremise(premise = "", options = {}) {
  if (!premise || typeof premise !== "string" || premise.trim().length === 0) {
    return { error: "premise is required" };
  }

  const difficulty = options.difficulty || "standard";
  const profile = createCaseComplexityProfile({ difficulty, ...options });

  // Required asset counts
  const requiredAssets = {
    suspects: profile.suspectCount,
    locations: profile.locationCount,
    coreClues: profile.coreClueCount,
    misdirectionClues: profile.misdirectionCount,
    testimonies: profile.testimonyCount,
    deductionLocks: profile.deductionLocks,
  };

  // Mystery logic graph skeleton
  const mysteryLogicGraph = createMysteryLogicGraph({
    premise,
    suspectMotivations: Array.from({ length: profile.suspectCount }, (_, i) => ({
      suspectIndex: i,
      motivation: "",
      strength: "",
      evidenceLinks: [],
    })),
    deceptionWeb: {
      lies: [],
      partialTruths: Array.from({ length: Math.ceil(profile.testimonyCount * 0.3) }, () => ({})),
      mistakes: Array.from({ length: Math.ceil(profile.testimonyCount * 0.2) }, () => ({})),
      protections: Array.from({ length: Math.ceil(profile.testimonyCount * 0.15) }, () => ({})),
    },
    redHerrings: Array.from({ length: profile.misdirectionCount }, (_, i) => ({ index: i, description: "", targetSuspect: null })),
  });

  // Clue plan
  const cluePlan = {
    requiredClueIds: Array.from({ length: profile.coreClueCount }, (_, i) => `core_clue_${i + 1}`),
    accessPaths: Array.from({ length: profile.coreClueCount }, (_, i) => ({
      clueId: `core_clue_${i + 1}`,
      locationId: `loc_${(i % profile.locationCount) + 1}`,
      method: "investigate",
      fallbackMethod: "testimony",
    })),
    misdirectionClueSlots: Array.from({ length: profile.misdirectionCount }, (_, i) => ({ slotId: `misdirect_${i + 1}`, targetSuspect: null })),
    noDeadEndGuarantee: true,
  };

  // Testimony plan
  const testimonyPlan = {
    totalSlots: profile.testimonyCount,
    deceptionDistribution: {
      truthful: Math.ceil(profile.testimonyCount * 0.3),
      partial_truth: Math.ceil(profile.testimonyCount * 0.25),
      mistaken: Math.ceil(profile.testimonyCount * 0.15),
      self_protective: Math.ceil(profile.testimonyCount * 0.1),
      protecting_other: Math.ceil(profile.testimonyCount * 0.1),
      lie: Math.ceil(profile.testimonyCount * 0.1),
    },
    perWitnessSlots: [],
    contradictionPairs: [],
  };

  // Misdirection plan
  const misdirectionPlan = {
    redHerringCount: profile.misdirectionCount,
    strategies: ["false_timeline", "planted_evidence", "mistaken_identity", "hidden_relationship", "doctored_document"],
    falseTrails: Array.from({ length: profile.misdirectionCount }, (_, i) => ({ index: i, trail: "", targetSuspect: null })),
  };

  // Deduction locks
  const deductionLocks = [
    { lockId: "culprit", label: "凶手", required: true },
    { lockId: "motive", label: "动机", required: true },
    { lockId: "method", label: "手法", required: true },
    { lockId: "timeline", label: "时间线", required: true },
    { lockId: "keyEvidence", label: "关键证据", required: true },
    { lockId: "contradictedTestimony", label: "矛盾证言", required: false },
    { lockId: "misleadsIdentified", label: "识破误导", required: false },
  ].slice(0, profile.deductionLocks);

  // Solvability
  const solvabilityChecklist = createSolvabilityChecklist({
    complexityProfile: profile,
    cluePlan,
    mysteryLogicGraph,
  });

  // Anti-speedrun
  const antiSpeedrun = validateAntiSpeedrunDesign({
    complexityProfile: profile,
    cluePlan,
    mysteryLogicGraph,
    testimonyPlan,
  });

  return {
    premise: premise.trim(),
    complexityProfile: profile,
    requiredAssets,
    mysteryLogicGraph,
    cluePlan,
    testimonyPlan,
    misdirectionPlan,
    deductionLocks,
    solvabilityChecklist,
    antiSpeedrunWarnings: antiSpeedrun.warnings,
    antiSpeedrunPassed: antiSpeedrun.passed,
    _planOnly: true,
    _generatedAt: new Date().toISOString(),
  };
}

// ── Normalizer / validator for blueprint ──

export function normalizeCaseGeneratorBlueprint(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    blueprintId: input.blueprintId || `bp_${Date.now()}`,
    premise: input.premise || "",
    complexityProfile: createCaseComplexityProfile(input.complexityProfile || {}),
    requiredAssets: input.requiredAssets || {},
    mysteryLogicGraph: createMysteryLogicGraph(input.mysteryLogicGraph || {}),
    cluePlan: input.cluePlan || {},
    testimonyPlan: input.testimonyPlan || {},
    misdirectionPlan: input.misdirectionPlan || {},
    deductionLocks: input.deductionLocks || [],
    solvabilityChecklist: input.solvabilityChecklist || { checklist: [], allOk: false },
    antiSpeedrunWarnings: input.antiSpeedrunWarnings || [],
    antiSpeedrunPassed: input.antiSpeedrunPassed || false,
    _planOnly: true,
  };
}

export function validateCaseGeneratorBlueprint(blueprint = {}) {
  const errors = [];
  if (!blueprint.premise) errors.push("premise is required");
  if (!blueprint.complexityProfile) errors.push("complexityProfile is required");
  if (!blueprint.deductionLocks || blueprint.deductionLocks.length < 3) errors.push("at least 3 deduction locks required");
  return { valid: errors.length === 0, errors };
}
