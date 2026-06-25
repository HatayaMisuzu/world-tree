// Single Player ScriptKill V2 Importer
//承接用户已有剧本。Never invent missing commercial script truth.

import { createSinglePlayerScriptKillPackage, validateSinglePlayerScriptKillPackage } from "./single-player-scriptkill-package.js";

function asText(v) { return String(v ?? "").trim(); }

export function classifySinglePlayerScriptKillInput(body = {}) {
  const text = asText(body.text || body.rawText || body.markdown);
  if (body.package && typeof body.package === "object") return { inputType: "json_package", textLength: 0 };
  if (text.startsWith("{") && text.includes("roleBooks")) return { inputType: "json_text", textLength: text.length };
  if (/^#|\n#|角色|DM|主持|线索|阶段|复盘|投票/.test(text)) return { inputType: "markdown_or_text", textLength: text.length };
  return { inputType: text ? "plain_text" : "empty", textLength: text.length };
}

export function buildSinglePlayerScriptKillImportPreview(body = {}) {
  const classification = classifySinglePlayerScriptKillInput(body);
  const ownership = body.ownershipDeclaration || {};

  if (classification.inputType === "empty") {
    return { status: "error", code: "EMPTY_INPUT", inputType: "empty", preview: null };
  }

  if (classification.inputType === "json_package" || classification.inputType === "json_text") {
    let raw = body.package;
    if (!raw) {
      try { raw = JSON.parse(body.text || body.rawText || "{}"); }
      catch (err) { return { status: "error", code: "JSON_PARSE_FAILED", errorMsg: err.message, inputType: classification.inputType }; }
    }
    const pkg = createSinglePlayerScriptKillPackage({ ...raw, ownershipDeclaration: { ...raw.ownershipDeclaration, ...ownership } });
    const validation = validateSinglePlayerScriptKillPackage(pkg);
    return {
      status: validation.ok ? (validation.playable ? "ready" : "needs_completion") : "not_playable",
      inputType: classification.inputType,
      packageDraft: pkg,
      validation,
      mappingHints: buildMappingHints(pkg, validation)
    };
  }

  const draft = createDraftFromExistingScriptText(body.text || body.rawText || body.markdown || "", { ownershipDeclaration: ownership, title: body.title });
  const validation = validateSinglePlayerScriptKillPackage(draft);
  return {
    status: "needs_mapping",
    inputType: classification.inputType,
    packageDraft: draft,
    validation,
    sections: extractLooseSections(body.text || body.rawText || ""),
    mappingHints: [
      "文本导入只做结构化草稿，不能假装完整可玩。",
      "请把角色本、DM手册、线索卡、阶段流程、复盘分别映射后再 commit。",
      ...buildMappingHints(draft, validation)
    ]
  };
}

export function commitSinglePlayerScriptKillImport(body = {}) {
  const preview = buildSinglePlayerScriptKillImportPreview(body);
  if (!["ready", "needs_completion"].includes(preview.status)) {
    return { ...preview, code: "NOT_READY_FOR_PLAY", errorMsg: "剧本结构不完整，不能开始完整剧本杀。" };
  }
  if (body.forceCommit !== true && preview.status !== "ready") {
    return { ...preview, status: "needs_mapping", code: "NOT_READY_FOR_PLAY", errorMsg: "剧本结构不完整，不能开始完整剧本杀。" };
  }
  return { status: "ok", package: preview.packageDraft, validation: preview.validation };
}

export function createDraftFromExistingScriptText(text = "", options = {}) {
  const sections = extractLooseSections(text);
  const roleSections = sections.filter(s => /角色|人物|role/i.test(s.title));
  const clueSections = sections.filter(s => /线索|clue|证据/i.test(s.title));
  const phaseSections = sections.filter(s => /阶段|流程|幕|phase|round|搜证|讨论|投票/i.test(s.title));
  const dmSections = sections.filter(s => /DM|主持|复盘|真相|答案|debrief/i.test(s.title));

  return createSinglePlayerScriptKillPackage({
    title: options.title || guessTitle(text),
    sourceType: "user_text_mapping_needed",
    ownershipDeclaration: options.ownershipDeclaration || {},
    publicIntro: { text: sections[0]?.content?.slice(0, 800) || text.slice(0, 800) },
    roleBooks: roleSections.map((section, i) => ({ roleId: `role_${i + 1}`, roleName: cleanRoleName(section.title, i), roleBookActs: [{ title: section.title, text: section.content }] })),
    clueCards: clueSections.map((section, i) => ({ clueId: `clue_${i + 1}`, title: section.title, visibleText: section.content.slice(0, 500) })),
    phases: phaseSections.map((section, i) => ({ phaseId: `phase_${i + 1}`, title: section.title, phaseType: inferPhaseType(section.title), dmInstructions: { openingLines: [section.content.slice(0, 200)], reminders: [], forbiddenSpoilers: [] } })),
    dmBook: { rawText: dmSections.map(s => `# ${s.title}\n${s.content}`).join("\n\n") },
    debrief: { fullText: dmSections.find(s => /复盘|答案|真相|debrief/i.test(s.title))?.content || "" }
  });
}

export function extractLooseSections(text = "") {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  const parts = normalized.split(/\n(?=#{1,4}\s+|【[^】]{1,40}】|\[[^\]]{1,40}\]|第[一二三四五六七八九十0-9]+幕|角色[:：]|线索[:：]|DM[:：]|复盘[:：])/g);
  return parts.map((part, index) => {
    const lines = part.trim().split("\n");
    const title = (lines.shift() || `section_${index + 1}`).replace(/^#{1,4}\s*/, "").replace(/[【】\[\]]/g, "").trim();
    return { sectionId: `section_${index + 1}`, title, content: lines.join("\n").trim() };
  }).filter(s => s.title || s.content);
}

function guessTitle(text) {
  const firstHeading = String(text || "").match(/^#\s+(.+)$/m);
  return firstHeading?.[1]?.trim() || "待映射单人剧本杀";
}
function cleanRoleName(title, i) { return title.replace(/^角色[:：]?\s*/i, "").trim() || `角色${i + 1}`; }
function inferPhaseType(title = "") {
  if (/读本|阅读/.test(title)) return "role_reading";
  if (/公聊|讨论/.test(title)) return "public_discussion";
  if (/私聊/.test(title)) return "private_chat";
  if (/搜证|线索/.test(title)) return "search";
  if (/投票/.test(title)) return "vote";
  if (/复盘|结局/.test(title)) return "debrief";
  return "custom";
}
function buildMappingHints(pkg, validation) {
  const hints = [];
  if (!pkg.ownershipDeclaration?.userConfirmedLegalAccess) hints.push("需要用户确认合法拥有并仅本地私用。" );
  if ((pkg.roleBooks || []).length < 2) hints.push("缺少多个角色本，无法复刻多人剧本杀。" );
  if (!pkg.dmBook?.available) hints.push("缺少 DM/主持人手册，不能完整开局或复盘。" );
  if (!(pkg.clueCards || []).length) hints.push("缺少线索卡/搜证资料。" );
  if (!(pkg.phases || []).length) hints.push("缺少剧本阶段流程，不能以剧本为准推进。" );
  if (!pkg.debrief?.available) hints.push("缺少复盘/真相/角色结局，不能完整闭环。" );
  return [...hints, ...(validation.errors || []).map(e => `ERROR: ${e}`), ...(validation.warnings || []).map(w => `WARN: ${w}`)];
}
