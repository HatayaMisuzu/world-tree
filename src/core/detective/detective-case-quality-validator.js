// Detective V2 Case Quality Validator
// Current schema validator: testimonies, truthLedger.culpritIds, timeline.realTimeline/publicTimeline.

export function validatePlayableDetectiveCase(caseCapsule = {}) {
  const errors = [];
  const warnings = [];
  const checks = [];

  const characters = Array.isArray(caseCapsule.characters) ? caseCapsule.characters : [];
  const locations = Array.isArray(caseCapsule.locations) ? caseCapsule.locations : [];
  const evidence = Array.isArray(caseCapsule.evidence) ? caseCapsule.evidence : [];
  const testimonies = Array.isArray(caseCapsule.testimonies) ? caseCapsule.testimonies : [];
  const contradictions = Array.isArray(caseCapsule.contradictions) ? caseCapsule.contradictions : [];
  const timeline = caseCapsule.timeline || {};
  const truthLedger = caseCapsule.truthLedger || {};

  if (!caseCapsule.caseId) errors.push("missing caseId");
  if (!caseCapsule.title) errors.push("missing title");
  if (!caseCapsule.premise && !caseCapsule.playerBrief?.premise) errors.push("missing premise");
  if (characters.length < 4) errors.push("need at least 4 characters for Detective V2");
  if (locations.length < 4) errors.push("need at least 4 locations for Detective V2");
  if (evidence.length < 6) errors.push("need at least 6 evidence entries");
  if (testimonies.length < 4) errors.push("need at least 4 testimonies");
  if (!truthLedger || typeof truthLedger !== "object") errors.push("missing truthLedger");

  if (!Array.isArray(truthLedger.culpritIds) || truthLedger.culpritIds.length === 0) errors.push("truthLedger.culpritIds required");
  if (!truthLedger.motive) errors.push("truthLedger.motive required");
  if (!truthLedger.method) errors.push("truthLedger.method required");
  if (!Array.isArray(truthLedger.criticalEvidenceIds) || truthLedger.criticalEvidenceIds.length === 0) errors.push("truthLedger.criticalEvidenceIds required");
  if (!Array.isArray(truthLedger.solutionChain) || truthLedger.solutionChain.length === 0) errors.push("truthLedger.solutionChain required");

  if (!Array.isArray(timeline.realTimeline) || timeline.realTimeline.length === 0) errors.push("timeline.realTimeline required");
  if (!Array.isArray(timeline.publicTimeline) || timeline.publicTimeline.length === 0) warnings.push("timeline.publicTimeline missing");

  const evidenceIds = new Set(evidence.map((e) => e.evidenceId).filter(Boolean));
  const testimonyIds = new Set(testimonies.map((t) => t.testimonyId).filter(Boolean));
  const characterIds = new Set(characters.map((c) => c.characterId).filter(Boolean));

  for (const id of truthLedger.culpritIds || []) {
    if (!characterIds.has(id)) errors.push(`culpritId not found in characters: ${id}`);
  }
  for (const id of truthLedger.criticalEvidenceIds || []) {
    if (!evidenceIds.has(id)) errors.push(`criticalEvidenceId not found in evidence: ${id}`);
  }

  const hasEvidenceTestimonyLink = evidence.some((e) => (e.contradictsTestimonyIds || e.linkedTestimonyIds || []).some((id) => testimonyIds.has(id)))
    || testimonies.some((t) => (t.linkedEvidenceIds || t.relatedEvidenceIds || []).some((id) => evidenceIds.has(id)));
  if (!hasEvidenceTestimonyLink) errors.push("no evidence-testimony cross links");

  const validContradictions = contradictions.filter((c) => evidenceIds.has(c.evidenceId) && testimonyIds.has(c.testimonyId));
  if (validContradictions.length === 0) warnings.push("no valid contradiction pairs");

  checks.push({ check: "required_current_schema", passed: errors.length === 0, errors, warnings });

  return {
    playable: errors.length === 0,
    grade: errors.length === 0 ? (warnings.length === 0 ? "ready" : "ready_with_warnings") : "incomplete",
    checks,
    errors,
    warnings,
    counts: {
      characters: characters.length,
      locations: locations.length,
      evidence: evidence.length,
      testimonies: testimonies.length,
      contradictions: contradictions.length,
      realTimeline: timeline.realTimeline?.length || 0,
      publicTimeline: timeline.publicTimeline?.length || 0
    }
  };
}

export function scoreDetectiveCaseQuality(caseCapsule = {}) {
  const characters = Array.isArray(caseCapsule.characters) ? caseCapsule.characters : [];
  const locations = Array.isArray(caseCapsule.locations) ? caseCapsule.locations : [];
  const evidence = Array.isArray(caseCapsule.evidence) ? caseCapsule.evidence : [];
  const testimonies = Array.isArray(caseCapsule.testimonies) ? caseCapsule.testimonies : [];
  const contradictions = Array.isArray(caseCapsule.contradictions) ? caseCapsule.contradictions : [];
  const timeline = caseCapsule.timeline || {};
  const tl = caseCapsule.truthLedger || {};

  const scores = {};

  const hasCulprit = (tl.culpritIds || []).length > 0 && characters.some((c) => (tl.culpritIds || []).includes(c.characterId));
  const witnessCount = characters.filter((c) => c.role === "witness").length;
  const suspectCount = characters.filter((c) => c.role === "suspect").length;
  scores.characterDiversity = Math.min(20, (hasCulprit ? 6 : 0) + Math.min(6, witnessCount * 3) + Math.min(8, suspectCount * 2));

  const hasCrimeScene = locations.some((l) => l.isCrimeScene);
  scores.locationCoverage = Math.min(15, locations.length * 2 + (hasCrimeScene ? 3 : 0));

  const decisiveCount = evidence.filter((e) => ["key", "decisive"].includes(e.evidenceStrength)).length;
  scores.evidenceDepth = Math.min(25, evidence.length * 1.5 + decisiveCount * 2);

  const linkedTestimonyCount = testimonies.filter((t) => (t.linkedEvidenceIds || t.relatedEvidenceIds || []).length > 0).length;
  scores.testimonyCoverage = Math.min(15, testimonies.length + linkedTestimonyCount);

  scores.contradictions = Math.min(10, contradictions.length * 3);

  let truthScore = 0;
  if ((tl.culpritIds || []).length) truthScore += 3;
  if (tl.motive) truthScore += 3;
  if (tl.method) truthScore += 3;
  if ((tl.criticalEvidenceIds || []).length) truthScore += 3;
  if ((tl.solutionChain || []).length) truthScore += 3;
  scores.truthLedgerCompleteness = truthScore;

  scores.timelineDepth = Math.min(15, (timeline.realTimeline?.length || 0) * 2 + (timeline.publicTimeline?.length || 0));

  const totalRaw = Object.values(scores).reduce((a, b) => a + b, 0);
  const total = Math.min(100, Math.round(totalRaw));
  return {
    total,
    maxTotal: 100,
    grade: total >= 85 ? "A" : total >= 70 ? "B" : total >= 50 ? "C" : "D",
    scores
  };
}

export function detectDetectiveCaseSpeedrunRisks(caseCapsule = {}) {
  const risks = [];
  const characters = Array.isArray(caseCapsule.characters) ? caseCapsule.characters : [];
  const evidence = Array.isArray(caseCapsule.evidence) ? caseCapsule.evidence : [];
  const testimonies = Array.isArray(caseCapsule.testimonies) ? caseCapsule.testimonies : [];
  const contradictions = Array.isArray(caseCapsule.contradictions) ? caseCapsule.contradictions : [];
  const timeline = caseCapsule.timeline || {};
  const tl = caseCapsule.truthLedger || {};

  if ((tl.culpritIds || []).length === 1 && characters.filter((c) => c.role === "suspect").length < 3) {
    risks.push({ risk: "too_few_suspects", severity: "high", description: "嫌疑人数量不足，容易速通。" });
  }
  if ((tl.criticalEvidenceIds || []).length < 3) {
    risks.push({ risk: "thin_evidence_chain", severity: "high", description: "关键证据链过短。" });
  }
  if (contradictions.length < 2) {
    risks.push({ risk: "few_contradictions", severity: "medium", description: "证词矛盾不足。" });
  }
  if ((timeline.realTimeline || []).length < 3) {
    risks.push({ risk: "weak_timeline", severity: "medium", description: "真实时间线过短。" });
  }
  const crossLinks = evidence.some((e) => (e.contradictsTestimonyIds || e.linkedTestimonyIds || []).length > 0)
    || testimonies.some((t) => (t.linkedEvidenceIds || t.relatedEvidenceIds || []).length > 0);
  if (!crossLinks) {
    risks.push({ risk: "no_cross_links", severity: "high", description: "证据与证词缺少互链。" });
  }

  return {
    speedrunRisk: risks.some((r) => r.severity === "high") ? "high" : risks.length > 0 ? "medium" : "low",
    risks
  };
}
