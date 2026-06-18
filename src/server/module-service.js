export function normalizeModuleKey(value = "") {
  return String(value || "").replace(/^world:/, "").replace(/^char:/, "").trim();
}

export function sanitizeWorldName(value = "", fallback = "") {
  const clean = String(value || "")
    .replace(/[^\w\u4e00-\u9fff\-_]/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return clean || fallback;
}

export function isInternalModuleKey(value = "") {
  return String(value || "").startsWith("__");
}
