// Detective V2 Case Importer
// External case design text loading: classification, section extraction, draft creation.
// No LLM. Preserves source metadata.

import { normalizeDetectiveCaseCapsule, validateDetectiveCaseCapsule, extractDetectivePlayerCaseView } from "./detective-case-capsule.js";
import { planCaseCapsuleFromPremise } from "./detective-case-generator-blueprint.js";
import { createHash } from "node:crypto";

// ── Classification ──

export function classifyDetectiveCaseInput(input = {}) {
  const text = String(input.text || "").trim();
  const fileName = input.fileName || "";
  const sourceKind = input.sourceKind || "paste";

  if (!text) return { inputType: "unknown", sourceKind, fileName, rawTextHash: "" };

  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);

  // Try JSON first
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && (parsed.schemaVersion || parsed.caseId)) {
      return { inputType: "structured_json_case_capsule", sourceKind, fileName, rawTextHash: hash };
    }
  } catch { /* not JSON */ }

  // Check for markdown headings
  if (/^#{1,3}\s+/m.test(text)) {
    return { inputType: "markdown_case_design", sourceKind, fileName, rawTextHash: hash };
  }

  return { inputType: "plain_text_case_design", sourceKind, fileName, rawTextHash: hash };
}

// ── Section extraction from text ──

const SECTION_PATTERNS = [
  { key: "title", re: /^#\s+(.+)$/m },
  { key: "premise", re: /^#{1,3}\s+(Case|案件|案情|Premise|概要)\s*$/mi, contentUntilNextSection: true },
  { key: "charactersText", re: /^#{1,3}\s+(Characters|人物|嫌疑人|证人|Suspects|Witnesses)\s*$/mi, contentUntilNextSection: true },
  { key: "locationsText", re: /^#{1,3}\s+(Locations|地点|Places|Scenes)\s*$/mi, contentUntilNextSection: true },
  { key: "evidenceText", re: /^#{1,3}\s+(Evidence|证据|线索|Clues)\s*$/mi, contentUntilNextSection: true },
  { key: "testimonyText", re: /^#{1,3}\s+(Testimony|证词|口供|Statements)\s*$/mi, contentUntilNextSection: true },
  { key: "timelineText", re: /^#{1,3}\s+(Timeline|时间线|Chronology)\s*$/mi, contentUntilNextSection: true },
  { key: "truthText", re: /^#{1,3}\s+(Truth|真相|GM|主持人|Hidden)\s*$/mi, contentUntilNextSection: true },
  { key: "deductionText", re: /^#{1,3}\s+(Deduction|结案|推理问题|Questions)\s*$/mi, contentUntilNextSection: true },
];

export function extractDetectiveCaseSectionsFromText(text = "") {
  if (!text || typeof text !== "string") return { rawText: text || "" };

  const result = {
    title: "",
    premise: "",
    charactersText: "",
    locationsText: "",
    evidenceText: "",
    testimonyText: "",
    timelineText: "",
    truthText: "",
    deductionText: "",
    rawText: text,
  };

  // Extract title from first h1
  const titleMatch = text.match(/^#\s+(.+)$/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Find section boundaries (heading line indices)
  const headingLines = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+/.test(lines[i])) {
      headingLines.push({ index: i, line: lines[i] });
    }
  }

  // Extract content between section headings
  for (let i = 0; i < headingLines.length; i++) {
    const h = headingLines[i];
    const nextH = headingLines[i + 1];
    const content = lines.slice(h.index + 1, nextH ? nextH.index : lines.length).join("\n").trim();

    for (const pattern of SECTION_PATTERNS) {
      if (pattern.re && pattern.re.test && pattern.re.test(h.line) && pattern.key !== "title") {
        if (!result[pattern.key]) result[pattern.key] = content;
      }
    }
  }

  return result;
}

// ── JSON parsing ──

export function parseDetectiveCaseJson(input = {}) {
  try {
    const text = typeof input === "string" ? input : (input.text || "");
    let data;
    try {
      data = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      return { status: "error", errorMsg: "Invalid JSON" };
    }
    if (!data || typeof data !== "object") return { status: "error", errorMsg: "JSON must be an object" };

    const capsule = normalizeDetectiveCaseCapsule(data);
    const validation = validateDetectiveCaseCapsule(capsule);
    if (!validation.valid) return { status: "error", errorMsg: validation.errors.join("; ") };

    return {
      status: "ok",
      caseCapsule: capsule,
      playerCaseView: extractDetectivePlayerCaseView(capsule),
    };
  } catch (err) {
    return { status: "error", errorMsg: err.message };
  }
}

// ── Draft from external text ──

export function createDetectiveCaseDraftFromExternalText(text = "", options = {}) {
  const classification = classifyDetectiveCaseInput({ text, sourceKind: options.sourceKind || "paste", fileName: options.fileName });
  const sections = extractDetectiveCaseSectionsFromText(text);

  // Build a minimal case capsule draft
  const caseDraft = normalizeDetectiveCaseCapsule({
    title: sections.title || options.title || "导入案件",
    sourceType: "imported_text",
    playerBrief: {
      premise: sections.premise || text.slice(0, 500),
      setting: options.setting || "",
    },
  });

  // Map truth section
  if (sections.truthText) {
    const truthLines = sections.truthText.split("\n").filter(Boolean);
    const culpritNames = truthLines.filter((l) => l.startsWith("- ") || l.startsWith("* ")).map((l) => l.slice(2).trim());
    caseDraft.truthLedger = {
      culpritIds: culpritNames.length > 0 ? culpritNames : ["unknown"],
      motive: truthLines.find((l) => l.includes("动机") || l.includes("motive"))?.replace(/^.*?[：:]/, "").trim() || "",
      method: truthLines.find((l) => l.includes("手法") || l.includes("method"))?.replace(/^.*?[：:]/, "").trim() || "",
      solutionChain: truthLines.filter((l) => l.match(/^\d+\./)).map((l) => l.replace(/^\d+\.\s*/, "").trim()),
    };
  }

  // Attach source metadata
  caseDraft._extra = {
    ...(caseDraft._extra || {}),
    externalImport: {
      sourceKind: classification.sourceKind,
      fileName: classification.fileName,
      rawTextHash: classification.rawTextHash,
      rawTextPreview: text.slice(0, 500),
      detectedSections: Object.keys(sections).filter((k) => sections[k] && k !== "rawText"),
      importedAt: new Date().toISOString(),
    },
  };

  // Add generator blueprint
  caseDraft.generatorBlueprint = planCaseCapsuleFromPremise(sections.premise || text.slice(0, 200));

  return caseDraft;
}

// ── Completeness check ──

export function validateExternalDetectiveCaseCompleteness(caseDraft = {}) {
  const missing = [];
  if (!caseDraft.caseId && !caseDraft.title) missing.push("title");
  if (!caseDraft.playerBrief?.premise) missing.push("premise");
  if (!caseDraft.truthLedger?.culpritIds || caseDraft.truthLedger.culpritIds.length === 0) missing.push("culpritIds");
  if (!caseDraft.truthLedger?.motive) missing.push("motive");
  if (!caseDraft.truthLedger?.method) missing.push("method");
  if (!caseDraft.locations || caseDraft.locations.length < 1) missing.push("locations (≥1)");
  if (!caseDraft.characters || caseDraft.characters.length < 2) missing.push("characters (≥2)");
  if (!caseDraft.evidence || caseDraft.evidence.length < 3) missing.push("evidence (≥3)");
  if (!caseDraft.testimonies || caseDraft.testimonies.length < 2) missing.push("testimonies (≥2)");

  return {
    playable: missing.length === 0,
    missing,
    status: missing.length === 0 ? "ok" : "needs_completion",
  };
}

// ── Import preview builder ──

export function buildDetectiveImportPreview(input = {}, options = {}) {
  const text = input.text || "";
  const classification = classifyDetectiveCaseInput(input);

  // Try JSON parsing first for structured input
  let caseDraft;
  if (classification.inputType === "structured_json_case_capsule") {
    const jsonResult = parseDetectiveCaseJson(input);
    if (jsonResult.status === "ok") {
      caseDraft = jsonResult.caseCapsule;
    } else {
      caseDraft = createDetectiveCaseDraftFromExternalText(text, options);
    }
  } else {
    caseDraft = createDetectiveCaseDraftFromExternalText(text, options);
  }
  const completeness = validateExternalDetectiveCaseCompleteness(caseDraft);
  const sections = extractDetectiveCaseSectionsFromText(text);

  const preview = {
    title: caseDraft.title || sections.title || "无标题",
    sourceType: "imported_text",
    hasTruthLedger: !!(caseDraft.truthLedger?.culpritIds?.length),
    suspectCount: caseDraft.generatorBlueprint?.complexityProfile?.suspectCount || 0,
    locationCount: caseDraft.locations?.length || 0,
    evidenceCount: caseDraft.evidence?.length || 0,
    testimonyCount: caseDraft.testimonies?.length || 0,
    missing: completeness.missing,
    playable: completeness.playable,
  };

  return {
    status: completeness.playable ? "ok" : "needs_completion",
    inputType: classification.inputType,
    preview,
    playerCaseView: extractDetectivePlayerCaseView(caseDraft),
    sections: Object.keys(sections).filter((k) => sections[k] && k !== "rawText"),
  };
}
