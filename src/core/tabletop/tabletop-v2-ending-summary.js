// Tabletop V2 Ending Summary
// Detects ending conditions and builds session/adventure summaries.
// Book-defined templates override default behavior.

// ── Ending detection ──

export function detectEndingAvailable({ module, runState } = {}) {
  if (!module || !runState) return { available: false, reason: "missing module or runState" };

  const endings = [];

  // Check book-defined endings
  const endingPolicy = module.endingPolicy || {};
  if (endingPolicy.conditions?.length) {
    for (const condition of endingPolicy.conditions) {
      if (evaluateEndingCondition(condition, module, runState)) {
        endings.push({
          endingId: condition.id || `ending_${Date.now()}`,
          label: condition.label || "结局条件满足",
          source: "book",
          template: condition.summaryTemplate || null,
        });
      }
    }
  }

  // Check clock-based endings: any filled clock triggers ending check
  const filledClocks = (runState.publicState?.clocks || [])
    .filter((c) => c.filled || c.value >= c.segments);
  for (const clock of filledClocks) {
    endings.push({
      endingId: `clock_${clock.id}`,
      label: `时钟已满: ${clock.label}`,
      source: "clock",
      template: null,
    });
  }

  // Check scene-based endings
  const currentScene = (module.scenes || []).find((s) => s.sceneId === runState.currentSceneId);
  if (currentScene?.isEnding) {
    endings.push({
      endingId: `scene_${currentScene.sceneId}`,
      label: `终局场景: ${currentScene.title}`,
      source: "scene",
      template: currentScene.endingTemplate || null,
    });
  }

  return {
    available: endings.length > 0,
    endings,
  };
}

function evaluateEndingCondition(condition, module, runState) {
  if (!condition) return false;

  // scene requirement
  if (condition.sceneId && runState.currentSceneId !== condition.sceneId) return false;

  // turn minimum
  if (condition.minTurns && (runState.turnIndex || 0) < condition.minTurns) return false;

  // clock requirement
  if (condition.requiredClockId) {
    const clock = [...(runState.publicState?.clocks || []), ...(runState.hiddenGmState?.clocks || [])]
      .find((c) => c.id === condition.requiredClockId);
    if (!clock || !clock.filled) return false;
  }

  return true;
}

// ── Book-defined ending summary ──

export function buildEndingSummary({ module, runState, endingId } = {}) {
  if (!runState) return null;

  // Try to find book-defined template
  const endingPolicy = module?.endingPolicy || {};
  const endingCondition = endingPolicy.conditions?.find((c) => c.id === endingId);
  const template = endingCondition?.summaryTemplate || endingPolicy.summaryTemplate || null;

  if (template) {
    return buildFromTemplate(template, module, runState);
  }

  // Fallback to default
  return buildDefaultSessionSummary(runState);
}

function buildFromTemplate(template, module, runState) {
  // Simple template interpolation
  let result = typeof template === "string" ? template : JSON.stringify(template);

  result = result
    .replace(/\{\{title\}\}/g, module?.title || "")
    .replace(/\{\{turnCount\}\}/g, String(runState.turnIndex || 0))
    .replace(/\{\{sceneTitle\}\}/g, runState.publicState?.sceneTitle || "")
    .replace(/\{\{playerName\}\}/g, runState.publicState?.playerCharacter?.name || "");

  return {
    type: "book_defined",
    endingId: null,
    summary: result,
    sections: [],
  };
}

// ── Default session summary ──

export function buildDefaultSessionSummary(runState) {
  if (!runState) return null;

  const sections = [];

  // Completed objectives
  const completed = runState.reviewCandidates?.filter((c) => c.type === "objective_complete") || [];
  if (completed.length > 0) {
    sections.push({ heading: "已完成目标", items: completed.map((c) => c.description || c.label) });
  }

  // Unresolved hooks
  const hooks = runState.reviewCandidates?.filter((c) => c.type === "unresolved_hook") || [];
  if (hooks.length > 0) {
    sections.push({ heading: "未解决的线索", items: hooks.map((c) => c.description || c.label) });
  }

  // Major choices
  const choices = runState.reviewCandidates?.filter((c) => c.type === "major_choice") || [];
  if (choices.length > 0) {
    sections.push({ heading: "重大选择", items: choices.map((c) => c.description || c.label) });
  }

  // Roll highlights
  const criticals = (runState.rollHistory || []).filter(
    (r) => r.roll?.outcome === "critical_success" || r.roll?.outcome === "critical_failure"
  );
  if (criticals.length > 0) {
    sections.push({
      heading: "关键投骰",
      items: criticals.map((r) => `第${r.turnIndex}轮: ${r.roll.expression} = ${r.roll.total} (${r.roll.outcome})`),
    });
  }

  // Clocks completed
  const filledClocks = (runState.publicState?.clocks || []).filter((c) => c.filled || c.value >= c.segments);
  if (filledClocks.length > 0) {
    sections.push({ heading: "已完成的时钟", items: filledClocks.map((c) => c.label) });
  }

  // Active clocks
  const activeClocks = (runState.publicState?.clocks || []).filter((c) => !c.filled && c.value < c.segments);
  if (activeClocks.length > 0) {
    sections.push({
      heading: "进行中的时钟",
      items: activeClocks.map((c) => `${c.label}: ${c.value}/${c.segments}`),
    });
  }

  // NPC changes
  const npcChanges = runState.reviewCandidates?.filter((c) => c.type === "npc_change") || [];
  if (npcChanges.length > 0) {
    sections.push({ heading: "角色关系变化", items: npcChanges.map((c) => c.description || c.label) });
  }

  // Branches
  const branches = runState.branches || [];
  if (branches.length > 0) {
    sections.push({
      heading: "分支记录",
      items: branches.map((b) => `${b.label || b.branchId} (创建于第${b.divergenceTurnIndex}轮)`),
    });
  }

  // Resources
  if (runState.publicState?.resources && Object.keys(runState.publicState.resources).length > 0) {
    sections.push({
      heading: "资源状况",
      items: Object.entries(runState.publicState.resources).map(([k, v]) => `${k}: ${v}`),
    });
  }

  // Review candidates summary
  if (runState.reviewCandidates?.length > 0) {
    sections.push({
      heading: "待审查事项",
      items: runState.reviewCandidates.map((c) => `[${c.type}] ${c.description || c.label || ""}`),
    });
  }

  const summary = `## 冒险摘要\n\n**模组**: ${runState.moduleId || "未知"}\n**回合数**: ${runState.turnIndex || 0}\n**当前场景**: ${runState.publicState?.sceneTitle || ""}\n\n${
    sections.map((s) => `### ${s.heading}\n${s.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n")
  }`;

  return {
    type: "default",
    endingId: null,
    summary,
    sections,
  };
}

// ── Validator ──

export function validateEndingSummary(summary) {
  const errors = [];
  if (!summary) errors.push("summary is required");
  else {
    if (!summary.type) errors.push("type is required");
    if (!summary.summary) errors.push("summary text is required");
    if (!Array.isArray(summary.sections)) errors.push("sections must be an array");
  }
  return { valid: errors.length === 0, errors };
}
