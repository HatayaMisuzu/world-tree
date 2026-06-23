export function safeString(value, fallback = "") {
  if (value == null) return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) {
    const text = String(value).trim();
    return text || fallback;
  }
  return fallback;
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function scrubLocalPaths(value = "") {
  return String(value || "")
    .replace(/[A-Za-z]:[\\/][^\s\n\r]+/g, "<local-path>")
    .replace(/\/(?:Users|home)\/[^\s\n\r]+/g, "<local-path>");
}

export function scrubSensitiveText(value = "") {
  return scrubLocalPaths(value)
    .replace(/\bBearer\s+\S+/gi, "Bearer <secret>")
    .replace(/\b(?:sk|gh[pousr])-[A-Za-z0-9_-]{8,}\b/g, "<secret>")
    .replace(/(api[_-]?key\s*[:=]\s*)\S+/gi, "$1<secret>");
}

export function truncateText(text, limit = 1200) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  const value = scrubSensitiveText(safeString(text));
  return value.length > safeLimit ? `${value.slice(0, Math.max(0, safeLimit - 3))}...` : value;
}

export function createWrapperResult(moduleId, legacyId, data = {}, warnings = []) {
  return {
    ok: true,
    moduleId,
    legacyId,
    data: data && typeof data === "object" && !Array.isArray(data) ? data : {},
    warnings: safeArray(warnings).map((warning) => truncateText(warning, 240)).filter(Boolean)
  };
}

export function createWrapperError(moduleId, legacyId, error) {
  return {
    ok: false,
    moduleId,
    legacyId,
    data: {},
    warnings: [truncateText(error?.message || error || "wrapper unavailable", 240)]
  };
}

export function createDebugInfo(wrapper, source, context, summary) {
  return {
    id: wrapper.id,
    legacyId: wrapper.legacyId,
    status: wrapper.status,
    source: truncateText(source, 240),
    summary: truncateText(summary, 360),
    warnings: safeArray(context?.warnings).map((warning) => truncateText(warning, 240)).filter(Boolean)
  };
}

export function countObjectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : 0;
}

export function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (value && typeof value === "object") return Object.values(value).some(hasMeaningfulValue);
  return value !== undefined && value !== null && String(value).trim() !== "";
}
