// Detective V2 Case Review
// Multi-lock deduction review, scoring, speedrun detection.

import { scoreDeductionReport } from "./detective-deduction-report.js";

export function reviewDetectiveCase({ caseCapsule, runState, deductionReport } = {}) {
  if (!caseCapsule || !runState) return { status: "error", errorMsg: "caseCapsule and runState required" };

  const tl = caseCapsule.truthLedger || {};
  const report = deductionReport || runState.publicState?.lastDeduction || {};
  const locks = caseCapsule.deductionReportSchema?.locks || [
    { lockId: "culprit", label: "凶手", weight: 40 },
    { lockId: "motive", label: "动机", weight: 30 },
    { lockId: "method", label: "手法", weight: 30 },
  ];

  const lockResults = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const lock of locks) {
    maxScore += lock.weight || 0;
    const playerAnswer = report[lock.lockId] || report.locks?.[lock.lockId] || "";
    const truthAnswer = tl[lock.lockId] || "";

    let match = "none";
    let score = 0;

    if (playerAnswer && truthAnswer) {
      const playerLower = String(playerAnswer).toLowerCase();
      const truthLower = String(truthAnswer).toLowerCase();
      if (playerLower === truthLower || playerLower.includes(truthLower)) {
        match = "full";
        score = lock.weight;
      } else if (String(playerAnswer).length > 0) {
        match = "partial";
        score = Math.round(lock.weight * 0.3);
      }
    }

    totalScore += score;
    lockResults.push({
      lockId: lock.lockId,
      label: lock.label,
      match,
      score,
      maxScore: lock.weight,
    });
  }

  // Evidence chain completeness
  const criticalIds = tl.criticalEvidenceIds || [];
  const discovered = runState.publicState?.discoveredEvidenceIds || [];
  const foundCritical = criticalIds.filter((id) => discovered.includes(id));
  const evidenceBonus = criticalIds.length > 0 ? Math.round((foundCritical.length / criticalIds.length) * 10) : 0;
  totalScore += evidenceBonus;
  maxScore += 10;

  // Speedrun penalty
  const turns = runState.turnCount || runState.turnIndex || 0;
  const speedrunPenalty = turns < 5 ? Math.round((5 - turns) * 2) : 0;
  totalScore = Math.max(0, totalScore - speedrunPenalty);

  // Hint penalty
  const hintUsage = runState.publicState?.hintUsage || 0;
  const hintPenalty = hintUsage * 3;
  totalScore = Math.max(0, totalScore - hintPenalty);

  // Notebook engagement
  const notebookEntries = (runState.publicState?.notebookEntries || []).length;
  const notebookBonus = Math.min(5, notebookEntries);

  // Final score
  const finalScore = Math.round(Math.min(100, totalScore + notebookBonus));
  const grade = finalScore >= 80 ? "S" : finalScore >= 60 ? "A" : finalScore >= 40 ? "B" : finalScore >= 20 ? "C" : "D";

  return {
    status: "ok",
    score: finalScore,
    grade,
    lockResults,
    evidenceChain: {
      found: foundCritical.length,
      total: criticalIds.length,
      bonus: evidenceBonus,
    },
    penalties: {
      speedrun: speedrunPenalty,
      hints: hintPenalty,
    },
    bonuses: {
      notebook: notebookBonus,
    },
    summary: buildReviewSummary(grade, lockResults, foundCritical.length, criticalIds.length),
  };
}

function buildReviewSummary(grade, lockResults, foundEvidence, totalEvidence) {
  const matchedLocks = lockResults.filter((l) => l.match === "full").length;
  const totalLocks = lockResults.length;

  if (grade === "S") return "出色的推理！所有关键锁都被解开，证据链完整。";
  if (grade === "A") return `推理质量很高。解开了 ${matchedLocks}/${totalLocks} 个关键锁。${foundEvidence < totalEvidence ? "部分关键证据未发现。" : ""}`;
  if (grade === "B") return `有一定推理能力，但还有 ${totalLocks - matchedLocks} 个关键锁未完全解开。`;
  if (grade === "C") return "推理还比较薄弱，建议重新审查证据和证词。";
  return "推理结果差距较大，真相远未被触及。";
}

export function detectCaseReviewSpeedrun(reviewResult = {}) {
  if (!reviewResult) return { speedrun: false };
  const score = reviewResult.score || 0;
  const lockResults = reviewResult.lockResults || [];
  const fullLocks = lockResults.filter((l) => l.match === "full").length;

  // Speedrun: high score but very few turns or guessed correctly without evidence
  if (score >= 60 && fullLocks >= 2 && reviewResult.penalties?.speedrun > 5) {
    return { speedrun: true, type: "lucky_guess", description: "虽然结论正确，但调查过程过于仓促" };
  }

  return { speedrun: false };
}
