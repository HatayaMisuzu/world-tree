// Tabletop V2 import service: preview and commit external adventure modules.
// Split out of tabletop-v2-service.js (behavior unchanged); re-exported from there.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeAdventureModule, validateAdventureModule } from "../core/tabletop/tabletop-v2-adventure-module.js";
import {
  buildTabletopImportPreview,
  createAdventureModuleDraftFromExternalText,
} from "../core/tabletop/tabletop-v2-module-importer.js";
import { validateExternalTabletopModuleCompleteness } from "../core/tabletop/tabletop-v2-module-completeness.js";
import { moduleDir, ensureDir } from "./tabletop-v2-paths.js";

// ── Import preview ──

export async function previewTabletopV2Import(body = {}, deps = {}) {
  try {
    const { text, module, options } = body;

    // If a structured module object is provided, normalize and preview it
    if (module && typeof module === "object") {
      const normalized = normalizeAdventureModule(module);
      return {
        status: "ok",
        moduleDraft: normalized,
        preview: {
          title: normalized.title,
          sourceType: normalized.sourceType,
          rulesetProfileId: normalized.rulesetProfileId,
          playerBrief: {
            premise: normalized.playerBrief?.premise || "",
            objective: normalized.playerBrief?.objective || "",
            setting: normalized.playerBrief?.setting || "",
          },
          sceneCount: (normalized.scenes || []).length,
          characterCount: (normalized.characters || []).length,
          clockCount: (normalized.clocks || []).length,
          hasHiddenGmBook: !!(normalized.gmBook?.hiddenTruth || normalized.gmBook?.gmScenes?.length),
          warnings: (!normalized.title || normalized.title === "未命名冒险") ? [{ code: "MISSING_TITLE", message: "未提供标题" }] : [],
        },
      };
    }

    // Text input: use the full importer pipeline
    if (text && typeof text === "string") {
      const result = buildTabletopImportPreview(text, options || {});
      if (result.status === "error") return result;
      const draftResult = createAdventureModuleDraftFromExternalText(text, options || {});
      if (draftResult.error) return { status: "error", code: draftResult.error, errorMsg: draftResult.message || "无法创建模组草稿" };
      return {
        status: "ok",
        moduleDraft: draftResult.draft,
        preview: {
          title: result.title,
          sourceType: result.type,
          rulesetProfileId: result.rulesetProfileId,
          playerBrief: {
            premise: result.playerBriefPreview?.premise || "",
            objective: result.playerBriefPreview?.objective || "",
            setting: result.playerBriefPreview?.setting || "",
          },
          sceneCount: (result.sceneNames || []).length,
          characterCount: (result.characterNames || []).length,
          clockCount: result.clockCount || 0,
          hasHiddenGmBook: result.hasGmBook || false,
          warnings: result.warnings || [],
          extractedSections: result.extractedSections || [],
        },
      };
    }

    return { status: "error", code: "NO_INPUT", errorMsg: "提供 text 或 module" };
  } catch (err) {
    return { status: "error", code: "PREVIEW_FAILED", errorMsg: err.message };
  }
}

// ── Import commit ──

export async function commitTabletopV2Import(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    let draft;

    // Accept module object, text string, or pre-built draft
    if (body.module && typeof body.module === "object") {
      draft = normalizeAdventureModule(body.module);
    } else if (body.text && typeof body.text === "string") {
      const result = createAdventureModuleDraftFromExternalText(body.text, body.options || {});
      if (result.error) return { status: "error", code: result.error, errorMsg: result.message };
      draft = result.draft;
    } else if (body.draft && typeof body.draft === "object") {
      draft = normalizeAdventureModule(body.draft);
    } else {
      return { status: "error", code: "NO_INPUT", errorMsg: "提供 module, text, 或 draft" };
    }

    // Validate completeness
    const completeness = validateExternalTabletopModuleCompleteness(draft);
    if (!completeness.ready) {
      return {
        status: "needs_completion",
        code: "INCOMPLETE_MODULE",
        missing: completeness.checks.filter((c) => !c.passed).map((c) => c.label),
        warnings: completeness.warnings,
        draftPreview: {
          title: draft.title,
          sceneCount: (draft.scenes || []).length,
          characterCount: (draft.characters || []).length,
        },
      };
    }

    // Validate
    const validation = validateAdventureModule(draft);
    if (!validation.valid) {
      return { status: "error", code: "INVALID_MODULE", errorMsg: validation.errors.join("; ") };
    }

    // Persist committed module
    const mDir = moduleDir(dataRoot, draft.moduleId);
    ensureDir(mDir);
    writeFileSync(join(mDir, "module.json"), JSON.stringify(draft, null, 2));

    // Write metadata
    writeFileSync(join(mDir, "import-meta.json"), JSON.stringify({
      importedAt: new Date().toISOString(),
      sourceType: draft.sourceType || "external",
      originalTitle: draft.title,
      moduleId: draft.moduleId,
    }, null, 2));

    return {
      status: "ok",
      moduleId: draft.moduleId,
      title: draft.title,
      sceneCount: (draft.scenes || []).length,
      characterCount: (draft.characters || []).length,
      clockCount: (draft.clocks || []).length,
      gmBookQuality: completeness.gmBookQuality,
    };
  } catch (err) {
    return { status: "error", code: "IMPORT_COMMIT_FAILED", errorMsg: err.message };
  }
}
