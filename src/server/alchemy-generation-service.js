import {
  buildQuickCreatePrompt,
  buildLocalizationPrompt,
  buildUserSupplementMergePrompt
} from "./alchemy-prompt-templates.js";

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

function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compactText(value, max = 1000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function slugName(value = "alchemy-world", fallback = "alchemy-world") {
  const clean = String(value || fallback)
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function inferMode({ text = "", plan = {}, explicitMode = "" } = {}) {
  if (explicitMode === "quick_create" || explicitMode === "localize_existing") return explicitMode;
  if (plan.intakeType === "localize_existing") return "localize_existing";
  if (plan.intakeType === "quick_create") return "quick_create";
  if (String(text || "").length >= 800) return "localize_existing";
  return "quick_create";
}

function scrubPublicText(value, max = 5000) {
  return String(value ?? "")
    .replace(/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Za-z]:\\[^\s<>:"|?*]+|\/(?:Users|home|var|tmp)\/[^\s]+/g, "[LOCAL_PATH]")
    .replace(/<\/?(?:script|style)[^>]*>/gi, "")
    .replace(/\bhiddenTruth\b|\bgm_only\b|\bsystem_only\b/gi, "[HIDDEN]")
    .slice(0, max);
}

function normalizeWorldbookEntry(entry = {}, index = 0) {
  const title = compactText(entry.title || entry.name || `炼金条目 ${index + 1}`, 160);
  return {
    id: entry.id || `alchemy-entry-${index + 1}`,
    title,
    keys: arr(entry.keys || entry.keywords || [title]).map((item) => compactText(item, 80)).slice(0, 12),
    content: scrubPublicText(entry.content || entry.description || title, 5000),
    visibility: ["public", "player_known", "hiddenTruth", "gm_only"].includes(entry.visibility) ? entry.visibility : "public",
    authority: entry.authority || "candidate",
    source: entry.source || entry.sourceState || "llm_suggested"
  };
}

function normalizeCharacter(character = {}, index = 0) {
  const name = compactText(character.name || character.title || `角色 ${index + 1}`, 120);
  return {
    id: character.id || slugName(name, `character-${index + 1}`),
    name,
    description: scrubPublicText(character.description || character.summary || "", 4000),
    role: scrubPublicText(character.role || "", 800),
    personality: scrubPublicText(character.personality || "", 1200),
    relationshipToPlayer: scrubPublicText(character.relationshipToPlayer || character.relationship || "", 1200),
    source: character.source || character.sourceState || "llm_suggested"
  };
}

function normalizeMechanism(draft = {}, index = 0) {
  return {
    id: draft.id || `alchemy-mechanism-${index + 1}`,
    name: compactText(draft.name || draft.title || `机制 ${index + 1}`, 120),
    type: draft.type || "custom",
    description: scrubPublicText(draft.description || "", 1500),
    scope: ["world", "save", "session"].includes(draft.scope) ? draft.scope : "save",
    stateSchema: draft.stateSchema && typeof draft.stateSchema === "object" ? draft.stateSchema : {},
    visualHint: draft.visualHint && typeof draft.visualHint === "object"
      ? draft.visualHint
      : { preferredType: "status_list", showToPlayer: true },
    source: draft.source || draft.sourceState || "llm_suggested",
    selected: draft.selected !== false
  };
}

function mechanismSuggestionsFromPlan(plan = {}) {
  return arr(plan.entrypointMap)
    .flatMap((entry) => arr(entry.mechanismSuggestions))
    .map((item, index) => normalizeMechanism({
      id: item.id,
      name: item.label || item.id,
      type: "custom",
      description: item.defaultDesign || item.reason || "",
      source: item.state || "llm_suggested"
    }, index))
    .slice(0, 8);
}

function fallbackPreview(body = {}) {
  const text = String(body.text || body.userText || "").trim();
  const plan = body.plan || {};
  const selectedTargets = normalizeTargets(body.selectedTargets);
  const mode = inferMode({ text, plan, explicitMode: body.mode });
  const title = compactText(plan.summary?.title || text.split(/[。！？\n]/).find(Boolean) || "炼金世界", 80);
  const worldName = slugName(title, "alchemy-world");

  const worldbookEntries = [
    normalizeWorldbookEntry({
      title,
      keys: [title],
      content: text || title,
      source: "user_specified",
      authority: "candidate"
    }, 0)
  ];

  return {
    status: "ok",
    previewVersion: mode === "localize_existing"
      ? "alchemy-localization-preview.v1"
      : "alchemy-quick-create-preview.v1",
    previewId: `alchemy-preview-${Date.now()}`,
    mode,
    title,
    playableWorld: {
      world: {
        name: worldName,
        displayName: title,
        dataMode: "worldbook",
        subType: mode === "localize_existing" ? "localized_import" : "alchemy_quick_create",
        preset: "custom"
      },
      opening: {
        scene: scrubPublicText(plan.summary?.userIntent || text || "故事开始。", 1000),
        playerRole: "玩家",
        initialGoal: "探索当前世界并推进第一幕。",
        firstPrompt: scrubPublicText(`${plan.summary?.userIntent || text || "故事开始。"}\n\n你将如何行动？`, 1500)
      }
    },
    worldbookEntries,
    characters: [],
    mechanismDrafts: mechanismSuggestionsFromPlan(plan),
    strategySimSpecDraft: null,
    tabletopModuleDraft: null,
    detectiveCaseDraft: null,
    scriptkillCaseDraft: null,
    deliveryPlan: selectedTargets.map((target) => ({
      target,
      enabled: true,
      requiresUserConfirmation: true,
      summary: `交付到 ${target}`
    })),
    warnings: ["LLM 不可用或输出不可解析，已使用本地 fallback 生成最低可用预览。"]
  };
}

function normalizeTargets(value) {
  return [...new Set(arr(value).filter((target) => DELIVERY_TARGETS.has(target)))];
}

function normalizePreview(raw = {}, body = {}) {
  const fallback = fallbackPreview(body);
  const input = raw && typeof raw === "object" ? raw : {};
  const selectedTargets = normalizeTargets(body.selectedTargets);
  const mode = inferMode({ text: body.text, plan: body.plan, explicitMode: input.mode || body.mode });
  const title = compactText(input.title || fallback.title || "炼金世界", 100);

  const playableWorld = {
    ...fallback.playableWorld,
    ...(input.playableWorld || {}),
    world: {
      ...fallback.playableWorld.world,
      ...(input.playableWorld?.world || {}),
      name: slugName(input.playableWorld?.world?.name || fallback.playableWorld.world.name, "alchemy-world"),
      displayName: compactText(input.playableWorld?.world?.displayName || title, 120)
    },
    opening: {
      ...fallback.playableWorld.opening,
      ...(input.playableWorld?.opening || {}),
      scene: scrubPublicText(input.playableWorld?.opening?.scene || fallback.playableWorld.opening.scene, 1000),
      firstPrompt: scrubPublicText(input.playableWorld?.opening?.firstPrompt || fallback.playableWorld.opening.firstPrompt, 1500)
    }
  };

  return {
    ...fallback,
    ...input,
    status: "ok",
    previewVersion: mode === "localize_existing"
      ? "alchemy-localization-preview.v1"
      : "alchemy-quick-create-preview.v1",
    previewId: input.previewId || input.id || fallback.previewId,
    mode,
    title,
    playableWorld,
    worldbookEntries: arr(input.worldbookEntries).length
      ? arr(input.worldbookEntries).map(normalizeWorldbookEntry)
      : fallback.worldbookEntries,
    characters: arr(input.characters).map(normalizeCharacter),
    mechanismDrafts: arr(input.mechanismDrafts).length
      ? arr(input.mechanismDrafts).map(normalizeMechanism)
      : fallback.mechanismDrafts,
    strategySimSpecDraft: input.strategySimSpecDraft || null,
    tabletopModuleDraft: input.tabletopModuleDraft || null,
    detectiveCaseDraft: input.detectiveCaseDraft || null,
    scriptkillCaseDraft: input.scriptkillCaseDraft || null,
    deliveryPlan: arr(input.deliveryPlan).length
      ? arr(input.deliveryPlan)
      : selectedTargets.map((target) => ({
          target,
          enabled: true,
          requiresUserConfirmation: true,
          summary: `交付到 ${target}`
        })),
    warnings: arr(input.warnings)
  };
}

export function createAlchemyGenerationService({
  runLlmJson,
  now = () => new Date()
} = {}) {
  async function generate(body = {}) {
    const text = String(body.text || body.userText || "").trim();
    if (!text) {
      return {
        status: "error",
        code: "ALCHEMY_GENERATE_TEXT_REQUIRED",
        errorMsg: "请输入想法或设定。"
      };
    }

    const selectedTargets = normalizeTargets(body.selectedTargets);
    if (!selectedTargets.length) {
      return {
        status: "error",
        code: "ALCHEMY_GENERATE_TARGET_REQUIRED",
        errorMsg: "请先选择至少一个输出目标。"
      };
    }

    const plan = body.plan || {};
    const mode = inferMode({ text, plan, explicitMode: body.mode });
    const prompt = mode === "localize_existing"
      ? buildLocalizationPrompt({
          userText: text,
          plan,
          selectedTargets,
          userSupplements: body.userSupplements || body.userSupplement || ""
        })
      : buildQuickCreatePrompt({
          userText: text,
          plan,
          selectedTargets,
          userSupplements: body.userSupplements || body.userSupplement || ""
        });

    if (typeof runLlmJson === "function") {
      try {
        const raw = await runLlmJson(prompt, {
          purpose: mode === "localize_existing" ? "alchemy-localization-preview" : "alchemy-quick-create-preview",
          responseFormat: "json"
        });
        return normalizePreview(raw, { ...body, text, plan, mode, selectedTargets });
      } catch (err) {
        const fallback = fallbackPreview({ ...body, text, plan, mode, selectedTargets });
        return {
          ...fallback,
          warnings: [
            ...(fallback.warnings || []),
            `LLM 预览生成失败，已使用本地 fallback：${err?.message || "unknown error"}`
          ]
        };
      }
    }

    return fallbackPreview({ ...body, text, plan, mode, selectedTargets });
  }

  async function mergeSupplement(body = {}) {
    if (typeof runLlmJson !== "function") {
      return {
        status: "error",
        code: "ALCHEMY_SUPPLEMENT_LLM_REQUIRED",
        errorMsg: "用户补充合并需要 LLM。"
      };
    }
    const prompt = buildUserSupplementMergePrompt({
      previousPlan: body.previousPlan || body.plan || null,
      previousPreview: body.previousPreview || body.preview || null,
      userSupplement: body.userSupplement || body.userSupplements || ""
    });
    return await runLlmJson(prompt, { purpose: "alchemy-supplement-merge", responseFormat: "json" });
  }

  return {
    generate,
    mergeSupplement,
    normalizePreview,
    fallbackPreview
  };
}
