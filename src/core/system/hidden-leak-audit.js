const TRUTH_MODES = new Set([
  "single-player-scriptkill",
  "single-player-scriptkill-v2",
  "murder-mystery",
  "mystery-puzzle",
  "detective",
  "detective-v2"
]);

export function shouldRunHiddenCooccurrenceAudit(modeId = "", options = {}) {
  if (options.enabled === false) return false;
  if (options.enabled === true) return true;
  return TRUTH_MODES.has(String(modeId || ""));
}

export function scanHiddenEntityCooccurrence(visibleText = "", hiddenSource = {}, options = {}) {
  const modeId = options.modeId || hiddenSource.modeId || "";
  if (!shouldRunHiddenCooccurrenceAudit(modeId, options)) return { ok: true, findings: [], terms: [] };
  const paragraphs = String(visibleText || "").split(/\n{2,}|[。！？!?]/).map((item) => item.trim()).filter(Boolean);
  const termGroups = collectHiddenTermGroups(hiddenSource);
  const findings = [];
  for (const paragraph of paragraphs) {
    const normalized = paragraph.toLowerCase();
    for (const group of termGroups) {
      const hits = group.terms.filter((term) => normalized.includes(term.normalized));
      if (hits.length >= 2) {
        findings.push({
          type: "hidden_entity_cooccurrence",
          severity: "high",
          source: group.source,
          terms: hits.map((hit) => hit.raw),
          excerpt: paragraph.slice(0, 120)
        });
      }
    }
  }
  return {
    ok: findings.length === 0,
    findings,
    terms: [...new Set(termGroups.flatMap((group) => group.terms.map((term) => term.raw)))]
  };
}

export function collectHiddenTermGroups(hiddenSource = {}) {
  const records = [];
  const push = (source, value) => {
    const terms = extractEntityTerms(value);
    if (terms.length >= 2) records.push({ source, terms });
  };
  if (Array.isArray(hiddenSource)) {
    hiddenSource.forEach((item, index) => push(`hidden.${index}`, item));
  } else if (hiddenSource && typeof hiddenSource === "object") {
    for (const [key, value] of Object.entries(hiddenSource)) {
      if (/hidden|truth|secret|dm|culprit|solution|motive|method/i.test(key)) push(key, value);
    }
  } else {
    push("hidden", hiddenSource);
  }
  return records;
}

export function extractEntityTerms(value = "") {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  const cjk = (text.match(/[\u4e00-\u9fff]{1,12}/g) || [])
    .flatMap((phrase) => phrase.split(/其实|真正|就是|正是|不是|因为|所以|但是|并且|以及|和|与|是|为|在|的|了|着|过/))
    .map((term) => term.trim())
    .filter((term) => term.length >= 1 && term.length <= 8);
  const ascii = text.match(/\b[A-Z][A-Za-z0-9_-]{2,}\b/g) || [];
  return [...new Set([...cjk, ...ascii])]
    .filter((term) => !isWeakTerm(term))
    .slice(0, 12)
    .map((raw) => ({ raw, normalized: raw.toLowerCase() }));
}

function isWeakTerm(term = "") {
  return /^(其实|因为|所以|但是|一个|这个|那个|完整真相|隐藏真相|secret|hidden|truth)$/i.test(term);
}
