// Detective V2 Case Quality Validator
// Validates playability, detects speedrun risks, scores quality.

export function validatePlayableDetectiveCase(caseCapsule = {}) {
  const checks = [];
  const errors = [];
  const warnings = [];

  // Required fields
  if (!caseCapsule.caseId) errors.push("missing caseId");
  if (!caseCapsule.title) errors.push("missing title");
  if (!caseCapsule.premise) errors.push("missing premise");
  if (!(caseCapsule.characters || []).length) errors.push("no characters");
  if (!(caseCapsule.locations || []).length) errors.push("no locations");
  if (!(caseCapsule.evidence || []).length) errors.push("no evidence");
  if (!(caseCapsule.testimony || []).length) warnings.push("no testimony");
  if (!caseCapsule.truthLedger) errors.push("missing truthLedger");

  // Truth ledger checks
  const tl = caseCapsule.truthLedger || {};
  if (!tl.culprit) errors.push("truthLedger missing culprit");
  if (!tl.motive) errors.push("truthLedger missing motive");
  if (!tl.method) errors.push("truthLedger missing method");

  checks.push({ check: "required_fields", passed: errors.length === 0, errors, warnings });

  return {
    playable: errors.length === 0,
    grade: errors.length === 0 ? (warnings.length === 0 ? "ready" : "ready_with_warnings") : "incomplete",
    checks,
    errors,
    warnings,
  };
}

export function scoreDetectiveCaseQuality(caseCapsule = {}) {
  const scores = {};
  let total = 0;
  const maxTotal = 100;

  // Character diversity (20 pts)
  const chars = caseCapsule.characters || [];
  const hasCulprit = chars.some((c) => c.isCulprit);
  const hasWitness = chars.some((c) => c.role === "witness");
  const hasSuspects = chars.filter((c) => c.role === "suspect").length >= 2;
  scores.characterDiversity = (hasCulprit ? 7 : 0) + (hasWitness ? 6 : 0) + (hasSuspects ? 7 : 0);
  total += scores.characterDiversity;

  // Location coverage (15 pts)
  const locs = caseCapsule.locations || [];
  const hasCrimeScene = locs.some((l) => l.isCrimeScene);
  scores.locationCoverage = Math.min(15, locs.length * 2 + (hasCrimeScene ? 3 : 0));
  total += scores.locationCoverage;

  // Evidence depth (25 pts)
  const evidence = caseCapsule.evidence || [];
  scores.evidenceDepth = Math.min(25, evidence.length * 2);
  total += scores.evidenceDepth;

  // Testimony coverage (15 pts)
  const testimony = caseCapsule.testimony || [];
  scores.testimonyCoverage = Math.min(15, testimony.length * 1.5);
  total += scores.testimonyCoverage;

  // Contradictions (10 pts)
  const contradictions = caseCapsule.contradictions || [];
  scores.contradictions = Math.min(10, contradictions.length * 2);
  total += scores.contradictions;

  // Truth ledger completeness (15 pts)
  const tl = caseCapsule.truthLedger || {};
  let tlScore = 0;
  if (tl.culprit) tlScore += 4;
  if (tl.motive) tlScore += 4;
  if (tl.method) tlScore += 4;
  if ((tl.criticalEvidenceIds || []).length > 0) tlScore += 3;
  scores.truthLedgerCompleteness = tlScore;
  total += tlScore;

  return {
    total: Math.round(Math.min(maxTotal, total)),
    maxTotal,
    grade: total >= 75 ? "A" : total >= 50 ? "B" : total >= 25 ? "C" : "D",
    scores,
  };
}

export function detectDetectiveCaseSpeedrunRisks(caseCapsule = {}) {
  const risks = [];
  const tl = caseCapsule.truthLedger || {};
  const chars = caseCapsule.characters || [];

  // Single culprit? Easy guess
  const culpritCount = chars.filter((c) => c.isCulprit).length;
  if (culpritCount <= 1) risks.push({ risk: "single_culprit", severity: "medium", description: "只有一个凶手，可能被直接猜到" });

  // Only one suspect with motive?
  const motiveSuspects = chars.filter((c) => c.interviewProfile?.knows?.includes("动机"));
  if (motiveSuspects.length <= 1 && tl.motive) risks.push({ risk: "obvious_motive", severity: "high", description: "动机指向过于明显" });

  // Single deception type
  const deceptionTypes = tl.deceptionTypes || [];
  if (deceptionTypes.length <= 1) risks.push({ risk: "single_deception", severity: "low", description: "只有一种欺骗类型，缺乏深度" });

  // Missing timeline
  const hasTimeline = (caseCapsule.realTimeline || []).length > 0 || (caseCapsule.publicTimeline || []).length > 0;
  if (!hasTimeline) risks.push({ risk: "no_timeline", severity: "high", description: "没有时间线，缺少推理维度" });

  // Evidence-testimony links
  const evidence = caseCapsule.evidence || [];
  const testimony = caseCapsule.testimony || [];
  const hasCrossLinks = evidence.some((e) => e.linkedTestimonyIds?.length) || testimony.some((t) => t.linkedEvidenceIds?.length);
  if (!hasCrossLinks) risks.push({ risk: "no_cross_links", severity: "medium", description: "证据和证词没有互链" });

  return { speedrunRisk: risks.length > 2 ? "high" : risks.length > 0 ? "medium" : "low", risks };
}
