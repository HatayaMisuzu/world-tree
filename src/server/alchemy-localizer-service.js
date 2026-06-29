import { createHash } from "node:crypto";

const SECRET_KEY_RE = /api.?key|secret|token|authorization|cookie/i;
const LOCAL_PATH_RE = /\b[A-Za-z]:\\[^\s<>:"|?*]+|\/(?:Users|home|var|tmp)\/[^\s]+/g;

function scrubText(value, max = 12000) {
  return String(value ?? "")
    .replace(/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(LOCAL_PATH_RE, "[LOCAL_PATH]")
    .replace(/<\/?(?:script|style)[^>]*>/gi, "")
    .slice(0, max);
}

function scrubValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => scrubValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 200)) {
    if (SECRET_KEY_RE.test(key) || /^(?:raw)?(?:html|css|js|javascript|script|style)$/i.test(key)) continue;
    result[key] = scrubValue(item, depth + 1);
  }
  return result;
}

function slugName(value = "alchemy-world", fallback = "alchemy-world") {
  const clean = String(value || fallback)
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function arr(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function defaultWorld(preview = {}, nowIso) {
  const input = preview.playableWorld?.world || preview.moduleDraft?.world || preview.world || {};
  const displayName = scrubText(input.displayName || input.title || preview.title || "炼金世界", 80);
  const name = slugName(input.name || displayName || "alchemy-world");
  return {
    name,
    displayName,
    dataMode: scrubText(input.dataMode || "worldbook", 40),
    subType: scrubText(input.subType || (preview.mode === "localize_existing" ? "localized_import" : "alchemy_quick_create"), 60),
    preset: scrubText(input.preset || "custom", 60),
    source: "alchemy",
    createdAt: nowIso,
    updatedAt: nowIso,
    turnCount: 0
  };
}

function normalizeEntry(input = {}, normalizeWorldbookEntry, nowIso) {
  const clean = scrubValue(input);
  const title = scrubText(clean.title || clean.name || clean.entity || "炼金条目", 160);
  const entry = {
    id: clean.id || `alchemy-${slugName(title, "entry")}-${stableHash(clean).slice(0, 8)}`,
    title,
    keys: arr(clean.keys || clean.keywords || title),
    content: scrubText(clean.content || clean.description || clean.summary || title, 5000),
    visibility: clean.visibility || "public",
    authority: clean.authority || "candidate",
    sourceRefs: arr(clean.sourceRefs || clean.source || "alchemy"),
    metadata: {
      ...(clean.metadata || {}),
      source: "alchemy",
      sourceState: clean.source || clean.sourceState || "llm_suggested",
      createdAt: nowIso
    }
  };
  return typeof normalizeWorldbookEntry === "function" ? normalizeWorldbookEntry(entry, { defaultAuthority: "candidate", now: nowIso }) : entry;
}

function normalizeCharacter(input = {}, nowIso) {
  const clean = scrubValue(input);
  const name = scrubText(clean.name || clean.title || clean.entity || "未命名角色", 120);
  return {
    id: clean.id || slugName(name, "character"),
    name,
    description: scrubText(clean.description || clean.summary || "", 4000),
    role: scrubText(clean.role || "", 500),
    personality: scrubText(clean.personality || "", 1000),
    relationshipToPlayer: scrubText(clean.relationshipToPlayer || clean.relationship || "", 1000),
    source: clean.source || clean.sourceState || "llm_suggested",
    createdAt: clean.createdAt || nowIso,
    updatedAt: nowIso
  };
}

function normalizeMechanism(input = {}, normalizeMechanismDraft) {
  const clean = scrubValue(input);
  const draft = {
    name: clean.name || clean.title || "未命名机制",
    type: clean.type || "custom",
    description: clean.description || "",
    scope: clean.scope || "save",
    stateSchema: clean.stateSchema || {},
    visualHint: clean.visualHint || { preferredType: "status_list", showToPlayer: true },
    source: clean.source || "llm_suggested",
    selected: clean.selected !== false
  };
  return typeof normalizeMechanismDraft === "function" ? normalizeMechanismDraft(draft) : draft;
}

function previewWorldbookEntries(preview = {}) {
  if (Array.isArray(preview.worldbookEntries)) return preview.worldbookEntries;
  if (preview.moduleDraft?.sharedFiles?.["worldbook.json"]?.entries) return preview.moduleDraft.sharedFiles["worldbook.json"].entries;
  if (Array.isArray(preview.items)) {
    return preview.items
      .filter((item) => ["worldbook", "location", "faction", "rule", "plot", "opening", "other"].includes(item.type))
      .map((item) => ({
        title: item.title,
        keys: item.fields?.keys || [item.title],
        content: item.content || item.summary,
        visibility: item.visibility || "public",
        source: item.source || "alchemy"
      }));
  }
  return [];
}

function previewCharacters(preview = {}) {
  if (Array.isArray(preview.characters)) return preview.characters;
  if (Array.isArray(preview.moduleDraft?.sharedFiles?.["characters.json"])) return preview.moduleDraft.sharedFiles["characters.json"];
  if (Array.isArray(preview.items)) {
    return preview.items
      .filter((item) => item.type === "character")
      .map((item) => ({
        name: item.title,
        description: item.content || item.summary,
        source: item.source || "alchemy"
      }));
  }
  return [];
}

function openingFor(preview = {}) {
  const opening = preview.playableWorld?.opening || preview.opening || {};
  const scene = scrubText(opening.scene || preview.title || "故事开始。", 1000);
  return {
    scene,
    playerRole: scrubText(opening.playerRole || "玩家", 200),
    initialGoal: scrubText(opening.initialGoal || "探索当前世界并推进第一幕。", 500),
    firstPrompt: scrubText(opening.firstPrompt || `${scene}\n\n你将如何行动？`, 1500)
      .replace(/hiddenTruth|gm_only|system_only/gi, "[HIDDEN]")
  };
}

export function createAlchemyLocalizerService({
  normalizeWorldbookEntry,
  normalizeMechanismDraft,
  normalizeStrategySimSpec,
  sealStrategySimSpec,
  safeEntityId,
  now = () => new Date()
} = {}) {
  const safeName = typeof safeEntityId === "function" ? safeEntityId : slugName;

  function buildModuleDraft(preview = {}, options = {}) {
    const nowIso = now().toISOString();
    const world = defaultWorld(preview, nowIso);
    world.name = safeName(world.name, "alchemy-world") || slugName(world.name);
    const opening = openingFor(preview);
    return {
      status: "ok",
      draftVersion: "worldtree-module-draft.v1",
      previewId: preview.previewId || preview.id || "",
      mode: preview.mode || options.mode || "quick_create",
      world,
      opening,
      sourcePolicy: {
        userSpecifiedPreserved: true,
        llmSuggestedMarked: true,
        userMustConfirmDelivery: true,
        ...(preview.sourcePolicy || {})
      }
    };
  }

  function buildSharedFiles(preview = {}, options = {}) {
    const nowIso = now().toISOString();
    const entries = previewWorldbookEntries(preview).map((entry) => normalizeEntry(entry, normalizeWorldbookEntry, nowIso));
    const characters = previewCharacters(preview).map((character) => normalizeCharacter(character, nowIso));
    const locations = Array.isArray(preview.locations) ? scrubValue(preview.locations) : [];
    const organizations = Array.isArray(preview.organizations) ? scrubValue(preview.organizations) : [];
    const rules = Array.isArray(preview.rules) ? scrubValue(preview.rules) : [];
    const shared = {
      "worldbook.json": { entries },
      "characters.json": characters,
      "locations.json": locations,
      "organizations.json": organizations,
      "rules.json": rules
    };

    if (preview.strategySimSpecDraft) {
      const spec = typeof normalizeStrategySimSpec === "function"
        ? normalizeStrategySimSpec(preview.strategySimSpecDraft)
        : scrubValue(preview.strategySimSpecDraft);
      shared["strategy-sim/spec.json"] = typeof sealStrategySimSpec === "function" ? sealStrategySimSpec(spec, { sealedAt: nowIso }) : spec;
    }
    if (preview.tabletopModuleDraft) shared["tabletop/module.json"] = scrubValue(preview.tabletopModuleDraft);
    if (preview.detectiveCaseDraft) shared["detective/case.json"] = scrubValue(preview.detectiveCaseDraft);
    if (preview.scriptkillCaseDraft) shared["scriptkill/case.json"] = scrubValue(preview.scriptkillCaseDraft);
    return shared;
  }

  function buildRuntimeFiles(preview = {}, options = {}) {
    const module = buildModuleDraft(preview, options);
    const mechanismDrafts = Array.isArray(preview.mechanismDrafts)
      ? preview.mechanismDrafts.map((draft) => normalizeMechanism(draft, normalizeMechanismDraft))
      : [];
    const mechanismCache = {
      version: "mechanism-cache.v1",
      moduleKey: "",
      worldbookHash: stableHash(previewWorldbookEntries(preview)),
      compiledAt: now().toISOString(),
      updatedAt: now().toISOString(),
      stale: false,
      definitionHash: stableHash(mechanismDrafts),
      mechanisms: mechanismDrafts
    };
    return {
      "state.json": {
        turnCount: 0,
        activeBranch: "main",
        lastScene: module.opening.scene,
        lastInput: "",
        engineState: {
          dataMode: module.world.dataMode,
          directorMode: "hybrid",
          preset: module.world.preset,
          opening: module.opening,
          emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
        },
        createdAt: now().toISOString(),
        updatedAt: now().toISOString()
      },
      "chat.jsonl": "",
      "memory.jsonl": "",
      "mechanisms/cache.json": mechanismCache,
      "alchemy-deliveries.jsonl": ""
    };
  }

  function buildInstallableFolderDraft(preview = {}, options = {}) {
    const module = buildModuleDraft(preview, options);
    const sharedFiles = buildSharedFiles(preview, options);
    const runtimeFiles = buildRuntimeFiles(preview, options);
    const files = {
      "world.json": module.world,
      ...Object.fromEntries(Object.entries(sharedFiles).map(([path, value]) => [`shared/${path}`, value])),
      ...Object.fromEntries(Object.entries(runtimeFiles).map(([path, value]) => [`runtime/${path}`, value]))
    };

    return {
      status: "ok",
      draftVersion: "worldtree-local-folder-draft.v1",
      previewId: module.previewId,
      moduleName: module.world.name,
      files: scrubValue(files),
      summary: {
        worldbookEntries: sharedFiles["worldbook.json"]?.entries?.length || 0,
        characters: sharedFiles["characters.json"]?.length || 0,
        mechanisms: runtimeFiles["mechanisms/cache.json"]?.mechanisms?.length || 0,
        hasStrategySpec: Boolean(sharedFiles["strategy-sim/spec.json"]),
        mode: module.mode
      },
      provenance: {
        source: "alchemy",
        previewId: module.previewId,
        createdAt: now().toISOString(),
        sourceHash: stableHash(preview)
      }
    };
  }

  return {
    buildModuleDraft,
    buildSharedFiles,
    buildRuntimeFiles,
    buildInstallableFolderDraft,
    scrubText,
    scrubValue
  };
}
