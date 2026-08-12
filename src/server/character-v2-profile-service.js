import fs from "node:fs";
import path from "node:path";
import { buildCharacterV2RuntimeContext, validateCharacterV2RuntimeContext } from "../core/character/character-v2-runtime-context.js";
import { commitCharacterProfileTransaction, withCharacterProfileRecovery } from "./character-v2-profile-transaction.js";

const MAX = Object.freeze({ name: 80, summary: 500, block: 1200, item: 240, items: 20 });

function safeId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff_-]{1,80}$/.test(id) ? id : "";
}

function profileError(code, logicalName, cause) {
  const error = new Error(`${logicalName} is corrupt`, { cause });
  error.code = code;
  error.logicalName = logicalName;
  return error;
}

function readRequiredJson(file, logicalName) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (cause) {
    throw profileError("CHARACTER_PROFILE_SOURCE_CORRUPT", logicalName, cause);
  }
}

function readOptionalJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return readRequiredJson(file, path.basename(file));
}

function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function list(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,，\n]/);
  return values.map((item) => text(item, MAX.item)).filter(Boolean).slice(0, MAX.items);
}

function contextFiles(charactersRoot, characterId) {
  const id = safeId(characterId);
  if (!id) return null;
  const root = path.resolve(charactersRoot);
  const characterDir = path.resolve(root, id);
  if (!characterDir.startsWith(`${root}${path.sep}`) || !fs.existsSync(characterDir)) return null;
  const v2Dir = path.join(characterDir, "v2");
  if (!fs.existsSync(v2Dir)) return null;
  return {
    id, characterDir, v2Dir,
    card: path.join(characterDir, "card.json"),
    manifest: path.join(v2Dir, "capsule.manifest.json"),
    profile: path.join(v2Dir, "profile.wt-character.json"),
    runtime: path.join(v2Dir, "runtime-contract.json"),
    cognition: path.join(v2Dir, "cognition-boundary.json"),
    fingerprint: path.join(v2Dir, "performance-fingerprint.json"),
    relationship: path.join(v2Dir, "relationship.seed.json"),
    memory: path.join(v2Dir, "memory.seed.json"),
    longTerm: path.join(v2Dir, "long-term-state.json"),
    uiSummary: path.join(v2Dir, "ui-summary.json")
  };
}

function readProfileSources(files) {
  return {
    manifest: readRequiredJson(files.manifest, "capsule.manifest.json"),
    profile: readRequiredJson(files.profile, "profile.wt-character.json"),
    runtimeContract: readRequiredJson(files.runtime, "runtime-contract.json"),
    cognitionBoundary: readRequiredJson(files.cognition, "cognition-boundary.json"),
    performanceFingerprint: readRequiredJson(files.fingerprint, "performance-fingerprint.json"),
    relationship: readRequiredJson(files.relationship, "relationship.seed.json"),
    memorySeed: readRequiredJson(files.memory, "memory.seed.json"),
    longTermState: readOptionalJson(files.longTerm, null),
    uiSummary: readRequiredJson(files.uiSummary, "ui-summary.json"),
    card: readRequiredJson(files.card, "card.json")
  };
}

function errorResult(error) {
  return { status: "error", code: error?.code || "CHARACTER_PROFILE_LOAD_FAILED", errorMsg: error?.message || String(error) };
}

function editableFrom(files, sources) {
  const { manifest, profile, runtimeContract, cognitionBoundary, performanceFingerprint, relationship } = sources;
  return {
    status: "ok",
    characterId: files.id,
    editable: {
      displayName: manifest.displayName || profile.identity?.name || files.id,
      oneLineSummary: profile.identity?.oneLineSummary || "",
      relationshipLabel: relationship.label || "",
      relationshipAllows: relationship.allows || [],
      relationshipForbids: relationship.forbids || [],
      runtimeSummary: runtimeContract.summary || "",
      outputGuidance: runtimeContract.outputGuidance || [],
      cognitionSummary: cognitionBoundary.summary || "",
      commonKnowledgeExamples: cognitionBoundary.commonKnowledgeExamples || [],
      depthLimitedExamples: cognitionBoundary.depthLimitedExamples || [],
      catchphrases: performanceFingerprint.voice?.catchphrases || [],
      speechHabits: performanceFingerprint.voice?.speechHabits || [],
      gestures: performanceFingerprint.nonverbal?.gestures || [],
      expressions: performanceFingerprint.nonverbal?.expressions || [],
      appearanceAnchors: performanceFingerprint.appearance?.anchors || []
    },
    updatedAt: manifest.updatedAt || null
  };
}

export async function loadCharacterV2EditableProfile(charactersRoot, characterId) {
  const files = contextFiles(charactersRoot, characterId);
  if (!files) return { status: "error", code: "CHARACTER_NOT_FOUND", errorMsg: "Character V2 profile not found." };
  try {
    return await withCharacterProfileRecovery(files.v2Dir, async () => editableFrom(files, readProfileSources(files)));
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveCharacterV2EditableProfile(charactersRoot, characterId, input = {}, options = {}) {
  const files = contextFiles(charactersRoot, characterId);
  if (!files) return { status: "error", code: "CHARACTER_NOT_FOUND", errorMsg: "Character V2 profile not found." };
  const displayName = text(input.displayName, MAX.name);
  const oneLineSummary = text(input.oneLineSummary, MAX.summary);
  if (!displayName) return { status: "error", code: "CHARACTER_NAME_REQUIRED", errorMsg: "Character name is required." };
  if (!oneLineSummary) return { status: "error", code: "CHARACTER_SUMMARY_REQUIRED", errorMsg: "Character summary is required." };

  try {
    return await withCharacterProfileRecovery(files.v2Dir, async () => {
      const sources = readProfileSources(files);
      const manifest = structuredClone(sources.manifest);
      const profile = structuredClone(sources.profile);
      const runtimeContract = structuredClone(sources.runtimeContract);
      const cognitionBoundary = structuredClone(sources.cognitionBoundary);
      const fingerprint = structuredClone(sources.performanceFingerprint);
      const relationship = structuredClone(sources.relationship);
      const card = structuredClone(sources.card);
      const updatedAt = new Date().toISOString();

      manifest.displayName = displayName;
      manifest.updatedAt = updatedAt;
      profile.identity = { ...(profile.identity || {}), name: displayName, oneLineSummary };
      runtimeContract.summary = text(input.runtimeSummary, MAX.block) || runtimeContract.summary || "";
      runtimeContract.outputGuidance = list(input.outputGuidance);
      cognitionBoundary.summary = text(input.cognitionSummary, MAX.block) || cognitionBoundary.summary || "";
      cognitionBoundary.commonKnowledgeExamples = list(input.commonKnowledgeExamples);
      cognitionBoundary.depthLimitedExamples = list(input.depthLimitedExamples);
      relationship.label = text(input.relationshipLabel, MAX.summary) || relationship.label || "";
      relationship.allows = list(input.relationshipAllows);
      relationship.forbids = list(input.relationshipForbids);
      fingerprint.voice = { ...(fingerprint.voice || {}), catchphrases: list(input.catchphrases), speechHabits: list(input.speechHabits) };
      fingerprint.nonverbal = { ...(fingerprint.nonverbal || {}), gestures: list(input.gestures), expressions: list(input.expressions) };
      fingerprint.appearance = { ...(fingerprint.appearance || {}), anchors: list(input.appearanceAnchors) };
      card.name = displayName;
      card.description = oneLineSummary;
      const uiSummary = {
        title: displayName, subtitle: oneLineSummary, badges: ["Text-first", "Saved"],
        lines: [`Relationship: ${relationship.label || "configured"}`, "Advanced fields are synchronized to runtime context."], safeForNormalUi: true
      };

      const runtimeContext = buildCharacterV2RuntimeContext({
        manifest, profile, runtimeContract, cognitionBoundary, performanceFingerprint: fingerprint,
        relationship, memorySeed: sources.memorySeed, longTermState: sources.longTermState,
        uiSummary, characterId: files.id
      });
      const validation = validateCharacterV2RuntimeContext(runtimeContext);
      if (!validation.ok) return { status: "error", code: "CHARACTER_V2_PROFILE_INVALID", errorMsg: validation.errors.join("; "), validation };

      await commitCharacterProfileTransaction(files.characterDir, {
        "v2/capsule.manifest.json": manifest,
        "v2/profile.wt-character.json": profile,
        "v2/runtime-contract.json": runtimeContract,
        "v2/cognition-boundary.json": cognitionBoundary,
        "v2/performance-fingerprint.json": fingerprint,
        "v2/relationship.seed.json": relationship,
        "card.json": card,
        "v2/ui-summary.json": uiSummary
      }, options);
      return { status: "ok", characterId: files.id, updatedAt, editable: editableFrom(files, { ...sources, manifest, profile, runtimeContract, cognitionBoundary, performanceFingerprint: fingerprint, relationship }).editable };
    });
  } catch (error) {
    return errorResult(error);
  }
}
