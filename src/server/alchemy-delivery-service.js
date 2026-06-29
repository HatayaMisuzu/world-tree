import { dirname, join, normalize, relative, sep } from "node:path";
import { createHash } from "node:crypto";

const DELIVERY_TARGETS = new Set([
  "world_module",
  "worldbook",
  "character",
  "mechanism",
  "strategy_sim_spec",
  "tabletop_module",
  "detective_case",
  "scriptkill_case",
  "candidate_only"
]);

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function defaultSlug(value = "alchemy-world", fallback = "alchemy-world") {
  const clean = String(value || fallback)
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function resolveMaybeFn(value, ...args) {
  return typeof value === "function" ? value(...args) : value;
}

function pathInside(root, target) {
  const r = normalize(root);
  const t = normalize(target);
  const rel = relative(r, t);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`..${sep}`));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

async function callMaybe(fn, ...args) {
  if (typeof fn !== "function") return undefined;
  return await fn(...args);
}

async function readJsonSafe(readJson, path, fallback) {
  try {
    if (typeof readJson !== "function") return fallback;
    const value = await readJson(path, fallback);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function mergeByKey(current, incoming, keyFn) {
  const map = new Map();
  for (const item of arr(current)) map.set(keyFn(item), item);
  for (const item of arr(incoming)) map.set(keyFn(item), { ...(map.get(keyFn(item)) || {}), ...item });
  return [...map.values()];
}

export function createAlchemyDeliveryService({
  dataRoot,
  worldsDir,
  moduleRuntimeDir,
  moduleWorldDir,
  readJson,
  writeJson,
  writeFile,
  appendJsonl,
  exists,
  ensureDir,
  normalizeWorldbookEntry,
  normalizeMechanismDraft,
  commitMechanismDrafts,
  normalizeStrategySimSpec,
  validateStrategySimSpec,
  sealStrategySimSpec,
  buildInstallableFolderDraft,
  safeEntityId,
  now = () => new Date()
} = {}) {
  const slug = typeof safeEntityId === "function" ? safeEntityId : defaultSlug;

  function rootDir() {
    return resolveMaybeFn(dataRoot) || process.cwd();
  }

  function allWorldsDir() {
    return resolveMaybeFn(worldsDir) || join(rootDir(), "worlds");
  }

  function worldDirFor(moduleKey, preview) {
    const existing = moduleKey ? resolveMaybeFn(moduleWorldDir, moduleKey) : "";
    if (existing) return existing;
    const name = slug(preview?.playableWorld?.world?.name || preview?.world?.name || preview?.title || "alchemy-world", "alchemy-world");
    return join(allWorldsDir(), name);
  }

  function runtimeDirFor(moduleKey, worldDir) {
    const existing = moduleKey ? resolveMaybeFn(moduleRuntimeDir, moduleKey) : "";
    return existing || join(worldDir, "runtime");
  }

  async function writeJsonFile(path, value) {
    await callMaybe(ensureDir, dirname(path));
    if (typeof writeJson === "function") return await writeJson(path, value);
    throw new Error("writeJson dependency is required");
  }

  async function writeTextFile(path, value) {
    await callMaybe(ensureDir, dirname(path));
    if (typeof writeFile === "function") return await writeFile(path, value, "utf8");
    throw new Error("writeFile dependency is required");
  }

  async function appendLog(runtimeDir, record) {
    const logRecord = { ...record, createdAt: record.createdAt || now().toISOString() };
    const runtimeLog = join(runtimeDir, "alchemy-deliveries.jsonl");
    const globalLog = join(rootDir(), "alchemy-deliveries.jsonl");
    if (typeof appendJsonl === "function") {
      await callMaybe(ensureDir, dirname(runtimeLog));
      await appendJsonl(runtimeLog, logRecord);
      await callMaybe(ensureDir, dirname(globalLog));
      await appendJsonl(globalLog, logRecord);
      return;
    }
    const line = `${JSON.stringify(logRecord)}\n`;
    await writeTextFile(runtimeLog, line);
    await writeTextFile(globalLog, line);
  }

  async function snapshot(worldDir, runtimeDir, label, payload) {
    const snapPath = join(runtimeDir, "snapshots", `alchemy-${label}-${Date.now()}.json`);
    await writeJsonFile(snapPath, {
      createdAt: now().toISOString(),
      label,
      payload
    });
    return snapPath;
  }

  function candidatePreview(body = {}) {
    return body.editedPreview || body.preview || body.localFolderDraft?.preview || body.previewData || {};
  }

  function folderDraftFor(preview, body) {
    if (body.localFolderDraft?.files) return body.localFolderDraft;
    if (typeof buildInstallableFolderDraft === "function") return buildInstallableFolderDraft(preview, { selectedTargets: body.selectedTargets || [] });
    const name = slug(preview?.playableWorld?.world?.name || preview?.title || "alchemy-world", "alchemy-world");
    return {
      status: "ok",
      draftVersion: "worldtree-local-folder-draft.v1",
      moduleName: name,
      files: {
        "world.json": {
          name,
          displayName: preview.title || name,
          dataMode: "worldbook",
          subType: preview.mode === "localize_existing" ? "localized_import" : "alchemy_quick_create",
          preset: "custom",
          turnCount: 0,
          createdAt: now().toISOString(),
          updatedAt: now().toISOString()
        },
        "shared/worldbook.json": { entries: arr(preview.worldbookEntries) },
        "shared/characters.json": arr(preview.characters),
        "runtime/state.json": { turnCount: 0, activeBranch: "main" },
        "runtime/chat.jsonl": "",
        "runtime/memory.jsonl": ""
      },
      provenance: { source: "alchemy", previewId: preview.id || preview.previewId || "" }
    };
  }

  async function deliverWorldModule(body, preview, result) {
    const draft = folderDraftFor(preview, body);
    const worldRoot = allWorldsDir();
    const moduleName = slug(draft.moduleName || draft.files?.["world.json"]?.name || "alchemy-world", "alchemy-world");
    let worldDir = join(worldRoot, moduleName);
    let suffix = 1;
    while (typeof exists === "function" && exists(worldDir)) {
      suffix += 1;
      worldDir = join(worldRoot, `${moduleName}-${suffix}`);
    }
    if (!pathInside(worldRoot, worldDir)) throw new Error("Resolved world directory escaped WORLDS_DIR");

    for (const [relPath, value] of Object.entries(draft.files || {})) {
      const target = join(worldDir, relPath);
      if (!pathInside(worldDir, target)) throw new Error(`Unsafe local folder path: ${relPath}`);
      if (typeof value === "string") await writeTextFile(target, value);
      else await writeJsonFile(target, value);
    }

    result.moduleKey = `world:${worldDir.split(/[\\/]/).pop()}`;
    result.targetPaths.push({ target: "world_module", path: worldDir, runtimeReady: true });
    result.createdModule = draft.files?.["world.json"] || null;
    return { worldDir, runtimeDir: join(worldDir, "runtime") };
  }

  async function deliverWorldbook(worldDir, preview, result) {
    const path = join(worldDir, "shared", "worldbook.json");
    const current = await readJsonSafe(readJson, path, { entries: [] });
    const incoming = arr(preview.worldbookEntries).map((entry) => {
      const normalized = typeof normalizeWorldbookEntry === "function" ? normalizeWorldbookEntry(entry, { defaultAuthority: "candidate" }) : entry;
      return {
        ...normalized,
        id: normalized.id || normalized.entryId || `alchemy-${stableHash(normalized).slice(0, 10)}`,
        sourceRefs: normalized.sourceRefs || ["alchemy"]
      };
    });
    const nextEntries = mergeByKey(current.entries || [], incoming, (entry) => `${entry.title || entry.name}:${stableHash(entry.content || entry.description || entry)}`);
    await writeJsonFile(path, { ...current, entries: nextEntries });
    result.targetPaths.push({ target: "worldbook", path, count: incoming.length, runtimeReady: true });
  }

  async function deliverCharacters(worldDir, preview, result) {
    const path = join(worldDir, "shared", "characters.json");
    const current = await readJsonSafe(readJson, path, []);
    const incoming = arr(preview.characters).map((character) => ({
      ...character,
      id: character.id || slug(character.name || character.title || "character", "character"),
      name: character.name || character.title || "未命名角色",
      source: character.source || "alchemy"
    }));
    const next = mergeByKey(current, incoming, (character) => String(character.id || character.name || "").toLowerCase());
    await writeJsonFile(path, next);
    result.targetPaths.push({ target: "character", path, count: incoming.length, runtimeReady: true });
  }

  async function deliverMechanisms(worldDir, runtimeDir, preview, result) {
    const path = join(runtimeDir, "mechanisms", "cache.json");
    const existing = await readJsonSafe(readJson, path, { mechanisms: [] });
    const drafts = arr(preview.mechanismDrafts).map((draft) => typeof normalizeMechanismDraft === "function" ? normalizeMechanismDraft(draft) : draft);
    const committed = typeof commitMechanismDrafts === "function"
      ? commitMechanismDrafts(existing, drafts, { moduleKey: result.moduleKey || "", worldbookHash: stableHash(preview.worldbookEntries || []), now: now().toISOString() })
      : {
          cache: { ...existing, mechanisms: mergeByKey(existing.mechanisms || [], drafts, (item) => `${item.type}:${item.name}`.toLowerCase()) },
          committed: drafts.length
        };
    await writeJsonFile(path, committed.cache || committed);
    result.targetPaths.push({ target: "mechanism", path, count: drafts.length, runtimeReady: true });
  }

  async function deliverStrategySpec(worldDir, preview, result) {
    const path = join(worldDir, "shared", "strategy-sim", "spec.json");
    const raw = preview.strategySimSpecDraft;
    if (!raw) {
      result.targetPaths.push({ target: "strategy_sim_spec", path, skipped: true, reason: "preview has no strategySimSpecDraft", runtimeReady: false });
      return;
    }
    let spec = typeof normalizeStrategySimSpec === "function" ? normalizeStrategySimSpec(raw) : raw;
    if (typeof validateStrategySimSpec === "function") {
      const check = validateStrategySimSpec(spec);
      if (check?.ok === false) throw new Error(`StrategySimSpec validation failed: ${(check.errors || []).join("; ")}`);
    }
    spec = typeof sealStrategySimSpec === "function" ? sealStrategySimSpec(spec, { sealedAt: now().toISOString() }) : { ...spec, sealed: true };
    await writeJsonFile(path, spec);
    result.targetPaths.push({ target: "strategy_sim_spec", path, runtimeReady: true });
  }

  async function deliverDraft(worldDir, preview, key, relPath, result) {
    const value = preview[key];
    if (!value) {
      result.targetPaths.push({ target: relPath, skipped: true, reason: `preview has no ${key}`, runtimeReady: false });
      return;
    }
    const path = join(worldDir, "shared", relPath);
    await writeJsonFile(path, value);
    result.targetPaths.push({ target: relPath, path, runtimeReady: false });
  }

  async function deliver(body = {}) {
    if (body.userConfirmed !== true) {
      return { status: "error", code: "ALCHEMY_DELIVERY_CONFIRMATION_REQUIRED", errorMsg: "交付前必须由用户确认。" };
    }
    const selectedTargets = [...new Set(arr(body.selectedTargets).filter((target) => DELIVERY_TARGETS.has(target)))];
    if (!selectedTargets.length) {
      return { status: "error", code: "ALCHEMY_DELIVERY_TARGET_REQUIRED", errorMsg: "请选择至少一个输出目标。" };
    }

    const preview = candidatePreview(body);
    const result = {
      status: "ok",
      deliveryId: `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      previewId: body.previewId || preview.previewId || preview.id || "",
      planId: body.planId || preview.planId || "",
      moduleKey: body.moduleKey || "",
      selectedTargets,
      deliveryMode: body.deliveryMode || (selectedTargets.includes("world_module") ? "install_new_module" : "merge_into_existing"),
      targetPaths: [],
      createdAt: now().toISOString(),
      sourceHash: stableHash(preview),
      userConfirmed: true
    };

    let worldDir = worldDirFor(body.moduleKey, preview);
    let runtimeDir = runtimeDirFor(body.moduleKey, worldDir);
    await callMaybe(ensureDir, runtimeDir);

    const snapPath = await snapshot(worldDir, runtimeDir, "before", { selectedTargets, previewId: result.previewId });
    result.snapshotPath = snapPath;

    if (selectedTargets.includes("candidate_only")) {
      await appendLog(runtimeDir, { ...result, status: "candidate_only" });
      return { ...result, status: "ok", message: "已保存为候选，不写入正式入口。" };
    }

    if (selectedTargets.includes("world_module")) {
      const dirs = await deliverWorldModule(body, preview, result);
      worldDir = dirs.worldDir;
      runtimeDir = dirs.runtimeDir;
    }

    if (selectedTargets.includes("worldbook")) await deliverWorldbook(worldDir, preview, result);
    if (selectedTargets.includes("character")) await deliverCharacters(worldDir, preview, result);
    if (selectedTargets.includes("mechanism")) await deliverMechanisms(worldDir, runtimeDir, preview, result);
    if (selectedTargets.includes("strategy_sim_spec")) await deliverStrategySpec(worldDir, preview, result);
    if (selectedTargets.includes("tabletop_module")) await deliverDraft(worldDir, preview, "tabletopModuleDraft", "tabletop/module.json", result);
    if (selectedTargets.includes("detective_case")) await deliverDraft(worldDir, preview, "detectiveCaseDraft", "detective/case.json", result);
    if (selectedTargets.includes("scriptkill_case")) await deliverDraft(worldDir, preview, "scriptkillCaseDraft", "scriptkill/case.json", result);

    await appendLog(runtimeDir, { ...result, status: "delivered" });
    return result;
  }

  async function listDeliveries(query = {}) {
    return {
      status: "ok",
      note: "Delivery log is stored as runtime/alchemy-deliveries.jsonl and global alchemy-deliveries.jsonl. Wire readFile dependency if UI needs full listing.",
      moduleKey: query.moduleKey || ""
    };
  }

  return { deliver, listDeliveries };
}
