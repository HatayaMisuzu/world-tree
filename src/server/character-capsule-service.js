/**
 * Server-side helper for Character Capsule V2-1 persistence.
 * Keep this service small and character-owned. It must not call LLM or write canon/proposals.
 */

import fs from "fs";
import path from "path";

import {
  createCharacterCapsuleDraft,
  validateCharacterCapsuleDraft,
  buildCharacterCapsuleSummary
} from "../core/character/character-v2-capsule-creation.js";

import {
  buildCharacterV2RuntimeContext,
  validateCharacterV2RuntimeContext,
  summarizeCharacterV2RuntimeContext
} from "../core/character/character-v2-runtime-context.js";

import {
  buildCharacterV2RuntimeMvp,
  validateCharacterV2RuntimeMvp
} from "../core/character/character-v2-runtime-mvp.js";

const SAFE_AVATAR_MAX_CHARS = 700000; // roughly <= 512KB base64 plus header

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function safeCharacterId(value) {
  const raw = String(value || "").trim();
  const safe = raw.replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return safe || `char_${Date.now()}`;
}

function resolveCharacterDir(charactersRoot, characterId) {
  const root = path.resolve(charactersRoot);
  const dir = path.resolve(root, safeCharacterId(characterId));
  if (!dir.startsWith(root + path.sep) && dir !== root) {
    throw new Error("角色路径越界，已拒绝写入。");
  }
  return dir;
}

function isConfirmed(body = {}) {
  return body.confirmed === true || body.userConfirmed === true || body.commit === true;
}

export function stripUnsafeUiSummary(summary = {}) {
  return {
    title: summary.title || "未命名角色",
    subtitle: summary.subtitle || "",
    badges: Array.isArray(summary.badges) ? summary.badges.slice(0, 8) : [],
    lines: Array.isArray(summary.lines) ? summary.lines.slice(0, 12) : [],
    safeForNormalUi: true
  };
}

function validateAvatarForPersistence(avatar) {
  if (!avatar) return { ok: true };
  if (avatar.uiOnly !== true) return { ok: false, error: "头像必须是 UI-only 资产。" };
  if (avatar.participatesInPrompt || avatar.participatesInCognition) {
    return { ok: false, error: "头像不得参与 prompt 或角色认知。" };
  }
  if (avatar.ref && String(avatar.ref).length > SAFE_AVATAR_MAX_CHARS) {
    return { ok: false, error: "头像数据过大，请使用更小图片或改用头像链接。" };
  }
  return { ok: true };
}

export function buildLegacyCardFromDraft(draft) {
  return {
    schemaVersion: 1,
    dataMode: "character_card",
    id: draft.characterId,
    name: draft.displayName,
    description: draft.identity?.oneLineSummary || "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    worldTreeV2: {
      capsuleEnabled: true,
      schemaVersion: draft.schemaVersion,
      uiSummary: stripUnsafeUiSummary(buildCharacterCapsuleSummary(draft))
    }
  };
}

export function buildV2Sidecars(draft) {
  const summary = stripUnsafeUiSummary(buildCharacterCapsuleSummary(draft));
  const now = new Date().toISOString();
  return {
    "capsule.manifest.json": {
      schemaVersion: "character-capsule.v2.manifest.1",
      characterId: draft.characterId,
      displayName: draft.displayName,
      status: "created",
      textFirst: true,
      multimodal: false,
      avatar: draft.avatar ? { ...draft.avatar, metadataParsed: false, uiOnly: true } : null,
      createdAt: draft.createdAt || now,
      updatedAt: now
    },
    "profile.wt-character.json": {
      schemaVersion: "world-tree-character-profile.v2.seed.1",
      characterId: draft.characterId,
      identity: draft.identity,
      source: draft.source,
      relationshipBaseline: draft.relationship?.baseline || "familiar_companion",
      requiresUserConfirmationForMajorChanges: true
    },
    "source-map.json": {
      schemaVersion: "character-source-map.v2.seed.1",
      source: draft.source,
      inferredFieldsMustBeMarked: true,
      rawSourcePreserved: true
    },
    "runtime-contract.json": draft.runtimeContract,
    "cognition-boundary.json": draft.cognitionBoundary,
    "performance-fingerprint.json": draft.performanceFingerprint,
    "relationship.seed.json": draft.relationship,
    "memory.seed.json": {
      schemaVersion: "character-memory.v2.seed.1",
      characterId: draft.characterId,
      memories: [],
      note: "V2-1 does not write long-term memory during creation."
    },
    "ui-summary.json": summary
  };
}

export function createOrPreviewCharacterCapsule(body = {}, deps = {}) {
  const charactersRoot = deps.charactersRoot;
  if (!charactersRoot) throw new Error("charactersRoot is required");

  const incomingDraft = body.draft && typeof body.draft === "object"
    ? body.draft
    : createCharacterCapsuleDraft(body.input || body, { seed: body.seed || "server" }).draft;

  const draft = {
    ...incomingDraft,
    characterId: safeCharacterId(incomingDraft.characterId || incomingDraft.displayName)
  };

  const validation = validateCharacterCapsuleDraft(draft);
  if (!validation.ok) {
    return { status: "error", code: "CHARACTER_V2_DRAFT_INVALID", errorMsg: validation.errors.join("；"), validation };
  }

  const avatarValidation = validateAvatarForPersistence(draft.avatar);
  if (!avatarValidation.ok) {
    return { status: "error", code: "CHARACTER_V2_AVATAR_INVALID", errorMsg: avatarValidation.error };
  }

  const summary = stripUnsafeUiSummary(buildCharacterCapsuleSummary(draft));
  if (!isConfirmed(body)) {
    return { status: "preview", draft, summary, wrote: false, requiresUserConfirmation: true };
  }

  const characterDir = resolveCharacterDir(charactersRoot, draft.characterId);
  const v2Dir = path.join(characterDir, "v2");
  ensureDir(v2Dir);

  const legacyCard = buildLegacyCardFromDraft(draft);
  writeJson(path.join(characterDir, "card.json"), legacyCard);

  const sidecars = buildV2Sidecars(draft);
  for (const [filename, data] of Object.entries(sidecars)) {
    writeJson(path.join(v2Dir, filename), data);
  }

  return {
    status: "ok",
    characterId: draft.characterId,
    displayName: draft.displayName,
    summary,
    wrote: true,
    paths: deps.includePaths ? { characterDir, v2Dir } : undefined
  };
}

export function loadCharacterCapsuleSummary(charactersRoot, characterId) {
  const characterDir = resolveCharacterDir(charactersRoot, characterId);
  const v2Dir = path.join(characterDir, "v2");
  const manifest = readJson(path.join(v2Dir, "capsule.manifest.json"), null);
  const uiSummary = readJson(path.join(v2Dir, "ui-summary.json"), null);
  if (!manifest && !uiSummary) return null;
  return {
    characterId: manifest?.characterId || safeCharacterId(characterId),
    displayName: manifest?.displayName || uiSummary?.title || "未命名角色",
    textFirst: manifest?.textFirst !== false,
    avatar: manifest?.avatar ? { label: manifest.avatar.label, ref: manifest.avatar.ref, uiOnly: true } : null,
    summary: stripUnsafeUiSummary(uiSummary || { title: manifest?.displayName })
  };
}

export function loadCharacterCapsuleRuntimeContext(charactersRoot, characterId) {
  const characterDir = resolveCharacterDir(charactersRoot, characterId);
  const v2Dir = path.join(characterDir, "v2");
  const manifest = readJson(path.join(v2Dir, "capsule.manifest.json"), null);
  if (!manifest) return null;

  const context = buildCharacterV2RuntimeContext({
    manifest,
    profile: readJson(path.join(v2Dir, "profile.wt-character.json"), null),
    runtimeContract: readJson(path.join(v2Dir, "runtime-contract.json"), null),
    cognitionBoundary: readJson(path.join(v2Dir, "cognition-boundary.json"), null),
    performanceFingerprint: readJson(path.join(v2Dir, "performance-fingerprint.json"), null),
    relationship: readJson(path.join(v2Dir, "relationship.seed.json"), null),
    memorySeed: readJson(path.join(v2Dir, "memory.seed.json"), null),
    longTermState: readJson(path.join(v2Dir, "long-term-state.json"), null),
    uiSummary: readJson(path.join(v2Dir, "ui-summary.json"), null),
    characterId
  });

  const validation = validateCharacterV2RuntimeContext(context);
  if (!validation.ok) {
    return {
      available: false,
      characterId,
      displayName: manifest.displayName || characterId,
      error: validation.errors.join("；"),
      readOnly: true,
      llmInjectionEnabled: false
    };
  }

  return summarizeCharacterV2RuntimeContext(context);
}

export function loadCharacterCapsuleRuntimeMvp(charactersRoot, characterId, options = {}) {
  const runtimeContext = loadCharacterCapsuleRuntimeContext(charactersRoot, characterId);
  if (!runtimeContext?.available) return null;

  const mvp = buildCharacterV2RuntimeMvp(runtimeContext, options);
  const validation = validateCharacterV2RuntimeMvp(mvp);

  if (!validation.ok) {
    return {
      available: false,
      characterId,
      displayName: runtimeContext.displayName || characterId,
      error: validation.errors.join("；"),
      previewOnly: true,
      readOnly: true,
      llmInjectionEnabled: false
    };
  }

  return {
    available: true,
    characterId: mvp.characterId,
    displayName: mvp.displayName,
    previewOnly: true,
    readOnly: true,
    llmInjectionEnabled: false,
    normalSummary: mvp.normalSummary,
    promptPacketSummary: mvp.promptPacketSummary,
    firstTurnDraftTemplate: mvp.firstTurnDraftTemplate,
    candidates: {
      normalSummary: mvp.candidates.normalSummary,
      memoryCount: mvp.candidates.memoryCandidates.length,
      relationshipCount: mvp.candidates.relationshipCandidates.length,
      qualityCount: mvp.candidates.qualityCandidates.length
    },
    advancedSummary: mvp.advancedSummary
  };
}

export { SAFE_AVATAR_MAX_CHARS };
