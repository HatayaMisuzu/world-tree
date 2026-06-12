import {
  moduleKey,
  normalizeArchive,
  normalizeCharacter,
  normalizeIndex,
  normalizeScene,
  normalizeTracking,
  parseJson
} from "./normalizers.js";

function recordMap(records) {
  return new Map(records.map((record) => [record.path.replace(/\\/g, "/"), record]));
}

function readText(files, path) {
  return files.get(path)?.text || "";
}

function readJson(files, path, warnings, required = false) {
  const record = files.get(path);
  if (!record) {
    if (required) warnings.push({ level: "warn", path, message: "未找到文件" });
    return null;
  }
  return parseJson(record.text, path, warnings);
}

function listJson(files, prefix) {
  const normalizedPrefix = prefix ? `${prefix.replace(/\/$/, "")}/` : "";
  return [...files.keys()]
    .filter((path) => path.startsWith(normalizedPrefix) && path.toLowerCase().endsWith(".json"))
    .sort();
}

function firstJson(files, paths, warnings) {
  for (const path of paths) {
    const data = readJson(files, path, warnings);
    if (data) return { path, data };
  }
  return { path: "", data: null };
}

function branchBase(module) {
  const base = module.path;
  const branch = module.branch || "main";
  return branch === "main" ? base : `${base}/branches/${branch}`;
}

function collectCharacters(files, module, warnings) {
  const base = branchBase(module);
  const sources = [
    readJson(files, `${base}/characters_state.json`, warnings),
    readJson(files, `${module.path}/shared/characters_base.json`, warnings)
  ].filter(Boolean);
  return sources.flatMap((source) => {
    const raw = source.characters || source.items || source;
    return Array.isArray(raw) ? raw : Object.values(raw || {});
  }).map(normalizeCharacter);
}

function collectScenes(files, module, warnings) {
  const base = branchBase(module);
  const hit = firstJson(files, [
    `${base}/scene-chain.json`,
    `${base}/scene_chain.json`,
    `${module.path}/context/scene-chain.json`,
    `${module.path}/context/scene_chain.json`
  ], warnings);
  const raw = hit.data?.scenes || hit.data?.items || hit.data || [];
  return (Array.isArray(raw) ? raw : Object.values(raw || {})).map(normalizeScene);
}

function collectArchives(files, module, warnings) {
  return listJson(files, `${module.path}/archive`).map((path) => {
    const record = files.get(path);
    const data = readJson(files, path, warnings);
    return normalizeArchive(path, data, record?.text || "");
  });
}

function collectBranches(files, module, warnings) {
  const prefix = `${module.path}/branches/`;
  const names = new Set();
  for (const path of files.keys()) {
    if (!path.startsWith(prefix)) continue;
    const parts = path.slice(prefix.length).split("/");
    if (parts[0]) names.add(parts[0]);
  }
  const branches = ["main", ...names].map((name) => ({
    id: name,
    active: name === (module.branch || "main"),
    canon: name === "main"
      ? readJson(files, `${module.path}/canon_state.json`, warnings)
      : readJson(files, `${module.path}/branches/${name}/canon_state.json`, warnings)
  }));
  return branches;
}

function collectTracking(files, module, warnings) {
  const base = branchBase(module);
  const paths = [
    `${base}/tracking/tracking-index.json`,
    `${base}/tracking/foreshadowing.json`,
    `${base}/tracking/conflicts.json`,
    `${base}/tracking/narrative_review.json`
  ];
  return paths.map((path) => normalizeTracking(path.split("/").pop(), readJson(files, path, warnings) || {}));
}

export function buildModel(tree, previousModuleKey = "", dataMode = "worldbook") {
  const warnings = [];
  const files = recordMap(tree?.records || []);
  const index = readJson(files, "index.json", warnings) || {};
  const modules = normalizeIndex(index, tree?.records || []);
  const selected =
    modules.find((item) => `${item.path}#${item.branch || "main"}` === previousModuleKey) ||
    modules[0] ||
    null;

  const engine = {
    commands: readJson(files, "_engine/commands.json", warnings) || null,
    presets: readJson(files, "_engine/presets.json", warnings) || null,
    canonTemplate: readJson(files, "_engine/canon_state.template.json", warnings) || null,
    agentProfiles: readJson(files, "_engine/agent_profiles.json", warnings) || null
  };

  const moduleData = selected ? {
    runtime: readJson(files, `${branchBase(selected)}/runtime.json`, warnings),
    canon: readJson(files, `${branchBase(selected)}/canon_state.json`, warnings),
    worldbook: readJson(files, `${selected.path}/shared/worldbook.json`, warnings),
    worldState: readJson(files, `${branchBase(selected)}/world_state.json`, warnings),
    organizations: readJson(files, `${branchBase(selected)}/organizations_state.json`, warnings),
    cognition: readJson(files, `${branchBase(selected)}/cognition_state.json`, warnings),
    randomEvents: readJson(files, `${branchBase(selected)}/random_events.json`, warnings),
    rules: readJson(files, `${selected.path}/shared/rules.json`, warnings),
    characters: collectCharacters(files, selected, warnings),
    scenes: collectScenes(files, selected, warnings),
    archives: collectArchives(files, selected, warnings),
    branches: collectBranches(files, selected, warnings),
    tracking: collectTracking(files, selected, warnings)
  } : null;

  // ===== Overlay 合并 =====
  if (moduleData && selected) {
    const modeKey = String(dataMode || "worldbook").replace(/[^\w.-]/g, "-");
    const modKey = moduleKey(selected).replace(/[^\w.-]/g, "-");
    // 🆕 v0.7.4.1 数据归家
    const overlayBase = `data/engine/runs/${modeKey}/modules/${modKey}`;
    const rtOverlay = readJson(files, `${overlayBase}/runtime-overlay.json`, warnings);
    const cnOverlay = readJson(files, `${overlayBase}/canon-overlay.json`, warnings);
    const chOverlay = readJson(files, `${overlayBase}/characters-overlay.json`, warnings);
    if (rtOverlay) moduleData.runtime = { ...(moduleData.runtime || {}), ...rtOverlay };
    if (cnOverlay) moduleData.canon = { ...(moduleData.canon || {}), ...cnOverlay };
    if (chOverlay) {
      moduleData.characters = [
        ...moduleData.characters.filter((c) => !(chOverlay[c.id || c.name])),
        ...Object.values(chOverlay).filter(
          (v) => typeof v === "object" && v !== null && !Array.isArray(v) && (v.id || v.name)
        ).map(normalizeCharacter)
      ];
    }
    const scOverlay = readJson(files, `${overlayBase}/scene-chain.json`, warnings);
    if (scOverlay && scOverlay.scenes) {
      moduleData.scenes = [
        ...(moduleData.scenes || []),
        ...(Array.isArray(scOverlay.scenes) ? scOverlay.scenes.map(normalizeScene) : [])
      ];
    }
  }

  return {
    loaded: Boolean(tree),
    dataMode: dataMode || "worldbook",
    rootPath: tree?.rootPath || "",
    loadedAt: tree?.loadedAt || "",
    fileCount: tree?.records?.length || 0,
    index,
    modules,
    selected,
    engine,
    moduleData,
    warnings
  };
}
