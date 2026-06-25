/**
 * Character Capsule V2 export service.
 * Text-first only. No CHARX, no PNG metadata, no image binary.
 */

import fs from "fs";
import path from "path";

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function safeCharacterId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").slice(0, 80);
}

function resolveV2Dir(charactersRoot, characterId) {
  const root = path.resolve(charactersRoot);
  const dir = path.resolve(root, safeCharacterId(characterId), "v2");
  if (!dir.startsWith(root + path.sep) && dir !== root) throw new Error("路径越界");
  return dir;
}

function stripAdvanced(d) {
  if (!d || typeof d !== "object") return d;
  const { advancedSummary, advancedOnly, promptPacketPreview, advancedUi, ...rest } = d;
  return rest;
}

export function exportCharacterV2(charactersRoot, characterId, format, options = {}) {
  const v2Dir = resolveV2Dir(charactersRoot, characterId);
  const manifest = readJson(path.join(v2Dir, "capsule.manifest.json"), null);
  if (!manifest) return { status: "error", code: "CHARACTER_V2_NOT_FOUND" };

  const profile = readJson(path.join(v2Dir, "profile.wt-character.json"), null) || {};
  const sourceMap = readJson(path.join(v2Dir, "source-map.json"), null) || {};
  const runtime = readJson(path.join(v2Dir, "runtime-contract.json"), null) || {};
  const cognition = readJson(path.join(v2Dir, "cognition-boundary.json"), null) || {};
  const performance = readJson(path.join(v2Dir, "performance-fingerprint.json"), null) || {};
  const relationship = readJson(path.join(v2Dir, "relationship.seed.json"), null) || {};
  const uiSummary = readJson(path.join(v2Dir, "ui-summary.json"), null) || {};
  const memoryConfirmed = readJson(path.join(v2Dir, "memory.confirmed.json"), null) || [];
  const relationshipConfirmed = readJson(path.join(v2Dir, "relationship.confirmed.json"), null) || [];

  const name = manifest.displayName || profile.identity?.name || characterId;

  switch (format) {
    case "character_md":
      return {
        status: "ok", format: "character_md",
        content: [
          `# ${name}`,
          "",
          profile.identity?.oneLineSummary || "",
          "",
          "## 关系基线",
          relationship.label || "熟悉但不过界的陪伴关系",
          "",
          "## 运行契约",
          runtime.summary || "",
          "",
          "## 认知边界",
          cognition.summary || "",
          "",
          "## 表现指纹",
          `状态：${performance.status || "seed"}`,
          "",
          `*由 World Tree Character Capsule V2 生成。头像为 UI-only。*`
        ].join("\n")
      };
    case "wt_profile_json":
      return { status: "ok", format: "wt_profile_json", content: JSON.stringify(stripAdvanced(profile), null, 2) };
    case "runtime_summary_json":
      return {
        status: "ok", format: "runtime_summary_json",
        content: JSON.stringify({
          characterId, displayName: name,
          relationship: relationship.baseline || "familiar_companion",
          runtime: runtime.summary || "",
          cognition: cognition.summary || "",
          performance: performance.status || "seed",
          memoryConfirmed: memoryConfirmed.length,
          relationshipConfirmed: relationshipConfirmed.length,
          ...(options.includeAdvancedPromptPreview ? { promptPreviewNote: "advanced only" } : {})
        }, null, 2)
      };
    case "export_bundle_json":
      return {
        status: "ok", format: "export_bundle_json",
        content: JSON.stringify({
          characterId, displayName: name,
          manifest, profile: stripAdvanced(profile), sourceMap,
          runtime, cognition, performance, relationship, uiSummary,
          memoryConfirmed, relationshipConfirmed,
          ...(options.includeAdvancedPromptPreview ? { advancedPromptPreviewAvailable: true } : {})
        }, null, 2)
      };
    default:
      return { status: "error", code: "CHARACTER_V2_EXPORT_FORMAT_UNKNOWN", errorMsg: `不支持的导出格式：${format}` };
  }
}
