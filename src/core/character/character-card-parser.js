export function detectCharacterCardFormat(raw, options = {}) {
  if (!raw || typeof raw !== "string") return "unknown";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj.spec === "chara_card_v2" || obj.spec_version) return "chara_card_v2_json";
      if (obj.name && (obj.first_mes || obj.description || obj.personality)) return "character_card_v1_json";
      return "unknown_json";
    } catch { return "plain_text"; }
  }
  if (/^#\s/.test(trimmed) && /角色|身份|人格|性格/.test(trimmed)) return "character_md";
  return "plain_text";
}

export function parseCharacterCard(raw, options = {}) {
  const format = options.format || detectCharacterCardFormat(raw);
  const trimmed = String(raw || "").trim();
  let parsed = { format, raw, specVersion: "", data: {}, extensions: {}, unknownFields: {} };

  if (format === "chara_card_v2_json") {
    try {
      const obj = JSON.parse(trimmed);
      parsed.specVersion = obj.spec_version || "v2";
      const d = obj.data || obj;
      parsed.data = {
        name: d.name || "",
        description: d.description || "",
        personality: d.personality || "",
        scenario: d.scenario || "",
        firstMessage: d.first_mes || d.firstMessage || "",
        messageExamples: d.mes_example || d.messageExamples || "",
        creatorNotes: d.creator_notes || d.creatorNotes || "",
        systemPrompt: d.system_prompt || d.systemPrompt || "",
        postHistoryInstructions: d.post_history_instructions || d.postHistoryInstructions || "",
        alternateGreetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings : (d.alternateGreetings || []),
        tags: Array.isArray(d.tags) ? d.tags : (d.tags || []).split(",").map(s => s.trim()).filter(Boolean),
        creator: d.creator || "",
        characterVersion: d.character_version || d.characterVersion || ""
      };
      parsed.characterBook = d.character_book || d.characterBook || null;
      parsed.extensions = d.extensions || {};
      // Preserve unknown top-level keys
      for (const [k, v] of Object.entries(obj)) {
        if (!["spec", "spec_version", "data", "character_book", "extensions"].includes(k)) {
          parsed.unknownFields[k] = v;
        }
      }
    } catch { parsed.format = "plain_text"; }
  } else if (format === "character_card_v1_json") {
    try {
      const obj = JSON.parse(trimmed);
      parsed.data = {
        name: obj.name || "",
        description: obj.description || "",
        personality: obj.personality || "",
        scenario: obj.scenario || "",
        firstMessage: obj.first_mes || obj.firstMessage || "",
        messageExamples: obj.mes_example || obj.messageExamples || "",
        creatorNotes: obj.creator_notes || obj.creatorNotes || "",
        systemPrompt: obj.system_prompt || obj.systemPrompt || "",
        postHistoryInstructions: obj.post_history_instructions || obj.postHistoryInstructions || "",
        alternateGreetings: Array.isArray(obj.alternate_greetings) ? obj.alternate_greetings : [],
        tags: Array.isArray(obj.tags) ? obj.tags : (obj.tags || "").split(",").map(s => s.trim()).filter(Boolean),
        creator: obj.creator || "",
        characterVersion: obj.character_version || obj.characterVersion || ""
      };
      for (const [k, v] of Object.entries(obj)) {
        if (!["name","description","personality","scenario","first_mes","firstMessage","mes_example","messageExamples","creator_notes","creatorNotes","system_prompt","systemPrompt","post_history_instructions","postHistoryInstructions","alternate_greetings","alternateGreetings","tags","creator","character_version","characterVersion"].includes(k)) {
          parsed.unknownFields[k] = v;
        }
      }
    } catch { parsed.format = "plain_text"; }
  } else if (format === "character_md") {
    const lines = trimmed.split("\n");
    let name = "";
    for (const line of lines) {
      const m = line.match(/^#\s+(.+)/);
      if (m) { name = m[1].trim(); break; }
    }
    parsed.data = { name: name || "未命名角色", description: trimmed.slice(0, 500), personality: "", scenario: "", firstMessage: "", alternateGreetings: [], tags: [] };
  } else {
    // plain_text
    const firstLine = trimmed.split("\n")[0]?.trim()?.slice(0, 30) || "未命名角色";
    parsed.data = { name: firstLine, description: trimmed.slice(0, 500), personality: "", scenario: "", firstMessage: "", alternateGreetings: [], tags: [] };
  }

  return parsed;
}

export function normalizeImportedCharacterCard(parsed = {}, options = {}) {
  const base = {
    format: parsed.format || "unknown",
    specVersion: parsed.specVersion || "",
    data: {
      name: parsed.data?.name || "未命名角色",
      description: parsed.data?.description || "",
      personality: parsed.data?.personality || "",
      scenario: parsed.data?.scenario || "",
      firstMessage: parsed.data?.firstMessage || "",
      messageExamples: parsed.data?.messageExamples || "",
      creatorNotes: parsed.data?.creatorNotes || "",
      systemPrompt: parsed.data?.systemPrompt || "",
      postHistoryInstructions: parsed.data?.postHistoryInstructions || "",
      alternateGreetings: Array.isArray(parsed.data?.alternateGreetings) ? parsed.data.alternateGreetings : [],
      tags: Array.isArray(parsed.data?.tags) ? parsed.data.tags : [],
      creator: parsed.data?.creator || "",
      characterVersion: parsed.data?.characterVersion || ""
    },
    characterBook: parsed.characterBook || null,
    extensions: parsed.extensions && typeof parsed.extensions === "object" ? parsed.extensions : {},
    unknownFields: parsed.unknownFields || {},
    raw: parsed.raw || null
  };
  return base;
}

export function validateImportedCharacterCard(parsed = {}, options = {}) {
  const errors = [], warnings = [];
  if (!parsed.format) errors.push({ code: "missing_format", message: "format is required" });
  if (!parsed.data?.name || parsed.data.name === "未命名角色") warnings.push({ code: "unnamed", message: "using default character name" });
  return { ok: errors.length === 0, errors, warnings };
}

export function preserveRawCharacterCard(raw, parsed = {}, options = {}) {
  return { ...parsed, raw };
}

export function createImportedCharacterSummary(parsed = {}, options = {}) {
  return {
    format: parsed.format || "unknown",
    name: parsed.data?.name || "",
    hasFirstMessage: Boolean(parsed.data?.firstMessage),
    alternateGreetingCount: Array.isArray(parsed.data?.alternateGreetings) ? parsed.data.alternateGreetings.length : 0,
    hasCharacterBook: Boolean(parsed.characterBook),
    hasExtensions: Object.keys(parsed.extensions || {}).length > 0
  };
}
