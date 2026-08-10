import fs from "node:fs";
import path from "node:path";
import { buildCharacterV2RuntimeContext, validateCharacterV2RuntimeContext } from "../core/character/character-v2-runtime-context.js";

const MAX = Object.freeze({ name: 80, summary: 500, block: 1200, item: 240, items: 20 });

function safeId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9一-鿿぀-ゟ゠-ヿ_-]{1,80}$/.test(id) ? id : "";
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

export function loadCharacterV2EditableProfile(charactersRoot, characterId) {
  const files = contextFiles(charactersRoot, characterId);
  if (!files) return { status: "error", code: "CHARACTER_NOT_FOUND", errorMsg: "未找到可编辑的 V2 角色。" };
  const manifest = readJson(files.manifest, {});
  const profile = readJson(files.profile, {});
  const runtimeContract = readJson(files.runtime, {});
  const cognitionBoundary = readJson(files.cognition, {});
  const performanceFingerprint = readJson(files.fingerprint, {});
  const relationship = readJson(files.relationship, {});
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

export function saveCharacterV2EditableProfile(charactersRoot, characterId, input = {}) {
  const files = contextFiles(charactersRoot, characterId);
  if (!files) return { status: "error", code: "CHARACTER_NOT_FOUND", errorMsg: "未找到可编辑的 V2 角色。" };
  const displayName = text(input.displayName, MAX.name);
  const oneLineSummary = text(input.oneLineSummary, MAX.summary);
  if (!displayName) return { status: "error", code: "CHARACTER_NAME_REQUIRED", errorMsg: "角色名不能为空。" };
  if (!oneLineSummary) return { status: "error", code: "CHARACTER_SUMMARY_REQUIRED", errorMsg: "角色简介不能为空。" };

  const manifest = readJson(files.manifest, {});
  const profile = readJson(files.profile, {});
  const runtimeContract = readJson(files.runtime, {});
  const cognitionBoundary = readJson(files.cognition, {});
  const fingerprint = readJson(files.fingerprint, {});
  const relationship = readJson(files.relationship, {});
  const card = readJson(files.card, {});
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

  const runtimeContext = buildCharacterV2RuntimeContext({
    manifest, profile, runtimeContract, cognitionBoundary, performanceFingerprint: fingerprint,
    relationship, memorySeed: readJson(files.memory, null), longTermState: readJson(files.longTerm, null),
    uiSummary: readJson(files.uiSummary, null), characterId: files.id
  });
  const validation = validateCharacterV2RuntimeContext(runtimeContext);
  if (!validation.ok) return { status: "error", code: "CHARACTER_V2_PROFILE_INVALID", errorMsg: validation.errors.join("；"), validation };

  writeJson(files.manifest, manifest);
  writeJson(files.profile, profile);
  writeJson(files.runtime, runtimeContract);
  writeJson(files.cognition, cognitionBoundary);
  writeJson(files.fingerprint, fingerprint);
  writeJson(files.relationship, relationship);
  writeJson(files.card, card);
  writeJson(files.uiSummary, {
    title: displayName, subtitle: oneLineSummary, badges: ["Text-first", "已保存"],
    lines: [`关系：${relationship.label || "已配置"}`, "高级字段已同步到角色运行上下文"], safeForNormalUi: true
  });
  return { status: "ok", characterId: files.id, updatedAt, editable: loadCharacterV2EditableProfile(charactersRoot, files.id).editable };
}
