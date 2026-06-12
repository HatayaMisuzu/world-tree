export const SYSTEM_DIRS = new Set([
  "_engine",
  "_learned",
  "_material_warehouse",
  "_processing_engine",
  "_references",
  "_temp",
  "_console"
]);

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([id, data]) => ({ id, ...(data || {}) }));
}

export function compactText(value, limit = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

export function parseJson(text, source, warnings) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    warnings.push({ level: "warn", path: source, message: `JSON 解析失败：${error.message}` });
    return null;
  }
}

export function moduleKey(module) {
  return [module.path || module.name || "unknown", module.branch || "main"].join("#");
}

export function moduleTitle(module) {
  return module.title || module.name || module.id || module.path || "未命名模组";
}

export function normalizeIndex(indexJson, records) {
  const fromIndex = asArray(indexJson?.modules).map((item) => ({
    id: item.id || item.name,
    name: item.name || item.id,
    title: item.title || item.name || item.id,
    path: item.path || item.id || item.name,
    branch: item.branch || item.activeBranch || "main",
    source: "index"
  }));

  const dirs = new Set();
  for (const record of records) {
    const first = record.path.split("/")[0];
    if (first && !SYSTEM_DIRS.has(first) && first !== "index.json") dirs.add(first);
  }

  const existing = new Set(fromIndex.map((item) => item.path));
  const fromDisk = [...dirs]
    .filter((dir) => !existing.has(dir))
    .map((dir) => ({
      id: dir,
      name: dir,
      title: dir,
      path: dir,
      branch: "main",
      source: "disk"
    }));

  return [...fromIndex, ...fromDisk];
}

export function normalizeArchive(path, data, raw) {
  return {
    path,
    name: path.split("/").pop()?.replace(/\.json$/i, "") || path,
    title: data?.title || data?.name || data?.id || path,
    createdAt: data?.created_at || data?.createdAt || data?.time || "",
    summary: compactText(data?.summary || data?.content || data?.description || "", 260),
    data,
    raw
  };
}

export function normalizeCharacter(item) {
  return {
    id: item.id || item.name || item.key || "unknown",
    name: item.name || item.id || item.key || "未命名角色",
    role: item.role || item.type || item.archetype || "",
    status: item.status || item.state || "",
    location: item.location || item.scene || "",
    summary: compactText(item.summary || item.description || item.profile || item.personality || "", 220)
  };
}

export function normalizeScene(item) {
  return {
    id: item.id || item.name || item.title || "scene",
    title: item.title || item.name || item.id || "未命名场景",
    time: item.time || item.when || "",
    location: item.location || item.place || "",
    summary: compactText(item.summary || item.description || item.content || "", 260)
  };
}

export function normalizeTracking(name, data) {
  return {
    name,
    count: Array.isArray(data) ? data.length : Object.keys(data || {}).length,
    preview: compactText(JSON.stringify(data || {}, null, 2), 320),
    data
  };
}
