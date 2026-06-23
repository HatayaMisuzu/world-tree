// narrative-consistency-radar.js — M8 Narrative Consistency Radar
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: runtime (reports/warnings) — never writes canon

const DIMENSIONS = ["facts", "character", "time", "rules", "rhythm", "visibility"];

export function createRadarReport() {
  return {
    version: 1,
    score: 1.0,
    dimensions: {
      facts: "pass", character: "pass", time: "pass",
      rules: "pass", rhythm: "pass", visibility: "pass"
    },
    warnings: [],
    blocked: [],
    suggestedRewrite: null
  };
}

export function checkConsistency(narrative = "", options = {}) {
  const report = createRadarReport();
  const text = String(narrative);

  // Visibility: hidden truth leak detection
  if (text.includes("hiddenTruth") || text.includes("answerLock") || text.includes("凶手是")) {
    report.dimensions.visibility = "block";
    report.blocked.push({ dimension: "visibility", reason: "potential hidden truth leak" });
  }

  // Character: OOC detection (heuristic)
  if (text.includes("AI") || text.includes("我是AI") || text.includes("作为语言模型")) {
    report.dimensions.character = "warn";
    report.warnings.push({ dimension: "character", reason: "potential OOC" });
  }

  // Time: reverse jump detection
  if (text.includes("昨天") && text.includes("明天") && text.indexOf("昨天") > text.indexOf("明天")) {
    report.dimensions.time = "warn";
    report.warnings.push({ dimension: "time", reason: "potential timeline reverse" });
  }

  // Rhythm: excessive length check
  if (text.length > 4000) {
    report.dimensions.rhythm = "warn";
    report.warnings.push({ dimension: "rhythm", reason: "excessive output length" });
  }

  // Score computation
  let passCount = 0;
  for (const dim of DIMENSIONS) {
    if (report.dimensions[dim] === "pass") passCount++;
    else if (report.dimensions[dim] === "block") report.score -= 0.3;
    else if (report.dimensions[dim] === "warn") report.score -= 0.1;
  }
  report.score = Math.max(0, Math.round(report.score * 100) / 100);

  return report;
}

export function shouldBlockOutput(report) {
  return report.blocked.length > 0 || report.score < 0.4;
}

export function shouldWarnOutput(report) {
  return report.warnings.length > 0 || report.score < 0.7;
}
