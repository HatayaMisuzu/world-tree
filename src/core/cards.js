function uid(prefix = "card") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeWorldbookEntries(entries) {
  const raw = Array.isArray(entries) ? entries : Object.values(entries || {});
  return raw.map((entry, index) => ({
    id: String(entry.id || entry.uid || entry.key || `entry-${index}`),
    title: entry.comment || entry.name || entry.title || entry.trigger?.[0] || entry.keys?.[0] || `Entry ${index + 1}`,
    keys: entry.keys || entry.key || entry.trigger || [],
    content: entry.content || entry.text || "",
    mode: entry.mode || "",
    priority: Number(entry.priority ?? entry.order ?? 100),
    enabled: entry.enabled !== false && entry.disable !== true
  }));
}

export function parseCard(imported) {
  const text = imported?.text || "";
  const fileName = imported?.name || "Imported";
  const baseName = fileName.replace(/\.[^.]+$/, "");

  if (imported?.format === "md" || fileName.toLowerCase().endsWith(".md")) {
    return {
      id: uid("dm"),
      kind: "dm-card",
      source: imported.filePath,
      name: baseName,
      personaText: text
    };
  }

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      id: uid("dm"),
      kind: "dm-card",
      source: imported.filePath,
      name: baseName,
      personaText: text
    };
  }

  const payload = data.data || data;
  if (payload.entries || data.spec === "worldtree-worldbook") {
    return {
      id: uid("worldbook"),
      kind: "worldbook-card",
      source: imported.filePath,
      name: payload.name || data.name || baseName,
      entries: normalizeWorldbookEntries(payload.entries || [])
    };
  }

  if (payload.name && (payload.first_mes || payload.personality || payload.description || payload.scenario)) {
    return {
      id: uid("character"),
      kind: "character-card",
      source: imported.filePath,
      name: payload.name,
      description: payload.description || "",
      personality: payload.personality || "",
      scenario: payload.scenario || "",
      firstMes: payload.first_mes || payload.firstMes || "",
      mesExample: payload.mes_example || payload.mesExample || ""
    };
  }

  return {
    id: uid("unknown"),
    kind: "unknown-card",
    source: imported.filePath,
    name: baseName,
    raw: data
  };
}

export function worldbookEntriesFromModel(model, state = {}) {
  const entries = [
    ...normalizeWorldbookEntries(model.moduleData?.worldbook?.entries || []),
    ...normalizeWorldbookEntries(model._overlay?.worldbook?.entries || []),
    ...normalizeWorldbookEntries(state.importedEntries || []).map((entry) => ({
      ...entry,
      id: `imported:${entry.id}`,
      title: `[Imported] ${entry.title}`
    }))
  ];
  const disabled = state.disabled || {};
  return entries.map((entry) => ({
    ...entry,
    enabled: entry.enabled && !disabled[entry.id]
  }));
}

export function injectionPreview(entries, input) {
  const query = String(input || "").toLowerCase();
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => {
      const keys = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
      const matched = keys.filter((key) => query && query.includes(String(key).toLowerCase()));
      const constant = keys.length === 0 || entry.mode === "常驻";
      return { ...entry, matched, inject: constant || matched.length > 0 };
    })
    .filter((entry) => entry.inject)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);
}
