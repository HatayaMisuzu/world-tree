// Detective V2 Deduction Report
// Multi-lock deduction grading. Structured lock results, not just a number.

export function createDeductionReportSchema(input = {}) {
  return {
    schemaVersion: input.schemaVersion || "world-tree.detective.v2.deduction.1",
    locks: input.locks || [
      { lockId: "culprit", label: "凶手", required: true, maxScore: 30 },
      { lockId: "motive", label: "动机", required: true, maxScore: 20 },
      { lockId: "method", label: "手法", required: true, maxScore: 20 },
      { lockId: "timeline", label: "时间线", required: false, maxScore: 10 },
      { lockId: "keyEvidence", label: "关键证据", required: false, maxScore: 10 },
      { lockId: "contradictedTestimony", label: "矛盾证言", required: false, maxScore: 5 },
      { lockId: "misleadsIdentified", label: "识破误导", required: false, maxScore: 5 },
    ],
  };
}

export function normalizeDeductionReport(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    reportId: input.reportId || `dr_${Date.now()}`,
    caseId: input.caseId || "",
    culpritIds: input.culpritIds || [],
    motive: input.motive || "",
    method: input.method || "",
    timelineClaims: input.timelineClaims || [],
    keyEvidenceIds: input.keyEvidenceIds || [],
    contradictedTestimonyIds: input.contradictedTestimonyIds || [],
    misleadsIdentified: input.misleadsIdentified || [],
    openQuestions: input.openQuestions || [],
    submittedAt: input.submittedAt || new Date().toISOString(),
  };
}

export function validateDeductionReport(report = {}, schema = {}) {
  const errors = [];
  if (!report.caseId) errors.push("caseId is required");
  const requiredLocks = (schema.locks || []).filter((l) => l.required);
  for (const lock of requiredLocks) {
    if (lock.lockId === "culprit" && (!report.culpritIds || report.culpritIds.length === 0)) {
      errors.push(`required lock "${lock.label}" is empty`);
    }
    if (lock.lockId === "motive" && !report.motive) errors.push(`required lock "${lock.label}" is empty`);
    if (lock.lockId === "method" && !report.method) errors.push(`required lock "${lock.label}" is empty`);
  }
  return { valid: errors.length === 0, errors };
}

export function scoreDeductionReport(report = {}, truthLedger = {}, options = {}) {
  const schema = options.schema || createDeductionReportSchema();
  const locks = [];

  for (const lock of schema.locks) {
    let ok = false;
    let reason = "";

    switch (lock.lockId) {
      case "culprit": {
        const correct = truthLedger.culpritIds || [];
        ok = correct.length > 0 && correct.every((id) => report.culpritIds?.includes(id))
          && report.culpritIds?.length === correct.length;
        reason = ok ? "凶手正确" : "凶手不正确";
        break;
      }
      case "motive":
        ok = report.motive && truthLedger.motive
          ? report.motive.toLowerCase().includes(truthLedger.motive.toLowerCase())
          : false;
        reason = ok ? "动机匹配" : "动机不正确";
        break;
      case "method":
        ok = report.method && truthLedger.method
          ? report.method.toLowerCase().includes(truthLedger.method.toLowerCase())
          : false;
        reason = ok ? "手法匹配" : "手法不正确";
        break;
      case "timeline":
        ok = report.timelineClaims?.length > 0;
        reason = ok ? "时间线已提交" : "时间线未提交";
        break;
      case "keyEvidence":
        ok = report.keyEvidenceIds?.some((id) => truthLedger.criticalEvidenceIds?.includes(id));
        reason = ok ? "有关键证据" : "缺少关键证据";
        break;
      case "contradictedTestimony":
        ok = report.contradictedTestimonyIds?.length > 0;
        reason = ok ? "指出了矛盾证言" : "未指出矛盾证言";
        break;
      case "misleadsIdentified":
        ok = report.misleadsIdentified?.length > 0;
        reason = ok ? "识破了误导" : "未识破误导";
        break;
      default:
        reason = "未评分";
    }

    locks.push({
      lockId: lock.lockId,
      label: lock.label,
      ok,
      score: ok ? lock.maxScore : 0,
      maxScore: lock.maxScore,
      reason,
    });
  }

  const score = locks.reduce((sum, l) => sum + l.score, 0);
  const maxScore = locks.reduce((sum, l) => sum + l.maxScore, 0);
  const missingCriticalEvidenceIds = (truthLedger.criticalEvidenceIds || []).filter(
    (id) => !report.keyEvidenceIds?.includes(id)
  );

  return { score, maxScore, locks, missingCriticalEvidenceIds, incorrectClaims: [] };
}
