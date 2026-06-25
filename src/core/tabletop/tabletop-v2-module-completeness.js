// Tabletop V2 Module Completeness Validator
// Checks whether an imported adventure module has enough content to start a run.

export const MINIMUM_REQUIREMENTS = {
  title: { required: true, label: "模块标题" },
  "playerBrief.premise": { required: true, label: "开场前提" },
  scenes: { required: true, label: "至少 1 个场景", minCount: 1 },
  startingScene: { required: true, label: "起始场景" },
  allowedActionTypes: { required: true, label: "允许的行动类型" },
  rulesetProfileId: { required: true, label: "规则集" },
};

// ── Main validation ──

export function validateExternalTabletopModuleCompleteness(moduleDraft = {}) {
  if (!moduleDraft || typeof moduleDraft !== "object") {
    return {
      ready: false,
      grade: "incomplete",
      checks: [],
      warnings: [{ code: "NO_MODULE", message: "模块对象为空或无效" }],
      canStart: false,
    };
  }

  const checks = [];
  const warnings = [];

  // 1. Title
  const hasTitle = !!(moduleDraft.title && moduleDraft.title !== "未命名冒险");
  checks.push({
    check: "title",
    passed: hasTitle,
    label: "模块标题",
    detail: hasTitle ? moduleDraft.title : "缺失",
  });
  if (!hasTitle) warnings.push({ code: "MISSING_TITLE", message: "建议提供模块标题" });

  // 2. Premise (playerBrief.premise)
  const hasPremise = !!(moduleDraft.playerBrief?.premise && moduleDraft.playerBrief.premise.length > 10);
  checks.push({
    check: "premise",
    passed: hasPremise,
    label: "开场前提",
    detail: hasPremise ? "已提供" : "过短或缺失",
  });
  if (!hasPremise) warnings.push({ code: "THIN_PREMISE", message: "开场前提太短，建议补充背景信息" });

  // 3. Scenes
  const sceneCount = (moduleDraft.scenes || []).length;
  checks.push({
    check: "scenes",
    passed: sceneCount >= 1,
    label: "场景数量",
    detail: `${sceneCount} 个场景`,
  });
  if (sceneCount === 0) warnings.push({ code: "NO_SCENES", message: "至少需要一个场景" });

  // 4. Starting scene
  const hasStartingScene = !!(moduleDraft.scenes || []).find((s) => s.isStarting);
  checks.push({
    check: "startingScene",
    passed: hasStartingScene,
    label: "起始场景",
    detail: hasStartingScene ? "已标记" : "缺失",
  });
  if (!hasStartingScene) warnings.push({ code: "NO_STARTING_SCENE", message: "未标记起始场景" });

  // 5. Allowed action types
  const allowedActions = moduleDraft.playerBrief?.allowedActions || [];
  const hasAllowedActions = allowedActions.length > 0;
  checks.push({
    check: "allowedActionTypes",
    passed: hasAllowedActions,
    label: "允许行动类型",
    detail: hasAllowedActions ? `${allowedActions.length} 种` : "未定义",
  });
  if (!hasAllowedActions) warnings.push({ code: "NO_ALLOWED_ACTIONS", message: "未定义玩家允许的行动类型" });

  // 6. Ruleset
  const hasRuleset = !!(moduleDraft.rulesetProfileId || moduleDraft.ruleset?.rulesetId);
  checks.push({
    check: "rulesetProfileId",
    passed: hasRuleset,
    label: "规则集",
    detail: moduleDraft.rulesetProfileId || "未定义",
  });
  if (!hasRuleset) warnings.push({ code: "NO_RULESET", message: "未指定规则集" });

  // 7. GM Book quality
  const hasGmBook = !!(moduleDraft.gmBook?.hiddenTruth || moduleDraft.gmBook?.gmScenes?.length || moduleDraft.gmBook?.npcs?.length);
  let gmBookQuality = "none";
  if (hasGmBook) {
    const richness = (moduleDraft.gmBook?.hiddenTruth?.length || 0) + (moduleDraft.gmBook?.gmScenes?.length || 0) * 100 + (moduleDraft.gmBook?.npcs?.length || 0) * 50;
    gmBookQuality = richness > 200 ? "rich" : "thin";
  }

  checks.push({
    check: "gmBook",
    passed: true, // gmBook is optional
    label: "GM 主持书",
    detail: hasGmBook ? `质量: ${gmBookQuality}` : "无 GM 书 (允许开始)",
  });

  if (!hasGmBook || gmBookQuality === "thin") {
    warnings.push({
      code: "THIN_GM_BOOK",
      message: "GM 主持书较薄，建议补充隐藏剧情和 NPC 细节",
      severity: "info",
    });
  }

  // 8. Characters / NPCs
  const characterCount = (moduleDraft.characters || []).length;
  const npcCount = (moduleDraft.characters || []).filter((c) => c.isNpc).length;
  checks.push({
    check: "characters",
    passed: true, // optional
    label: "角色/NPC",
    detail: `${characterCount} 个角色 (${npcCount} NPC)`,
  });

  // Final verdict
  const allRequiredPassed = checks
    .filter((c) => MINIMUM_REQUIREMENTS[c.check]?.required)
    .every((c) => c.passed);

  const grade = allRequiredPassed
    ? (warnings.length === 0 ? "ready" : "ready_with_warnings")
    : "incomplete";

  return {
    ready: allRequiredPassed,
    grade,
    checks,
    warnings,
    canStart: allRequiredPassed,
    gmBookQuality: hasGmBook ? gmBookQuality : "none",
  };
}
