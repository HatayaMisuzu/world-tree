// ===== M18 场景走向预测 =====
// 基于当前局势生成可能走向，注入上下文作为叙事惯性

export function predictDirections(model = {}, input = "") {
  const sceneName = model.moduleData?.scenes?.[0]?.title || "当前场景";
  const chars = model.moduleData?.characters || [];
  const tracking = model.moduleData?.tracking || [];
  const canon = model.moduleData?.canon || {};

  // 从当前场景状态生成预测
  const directions = [];

  // 基础预测：基于场景
  directions.push(`${sceneName} 中的局势将因玩家行动产生直接变化。`);

  // 基于角色关系：如果有多个角色在场
  if (chars.length >= 2) {
    const inScene = chars.filter((c) => c.location && sceneName.includes(c.location));
    if (inScene.length >= 2) {
      directions.push(`${inScene.map((c) => c.name).join(" 和 ")} 之间的互动可能揭示隐藏意图或关系变化。`);
    }
  }

  // 基于伏笔
  const foreshadowing = tracking.find((t) => t.name?.includes("伏笔") || t.name?.includes("foreshadowing"));
  if (foreshadowing && foreshadowing.count > 0) {
    directions.push(`存在 ${foreshadowing.count} 个活跃伏笔，其中一个可能在近期回收。`);
  }

  // 基于世界状态：有未解决的矛盾
  if (canon && typeof canon === "object") {
    const conflicts = canon.conflicts || [];
    if (conflicts.length > 0) {
      directions.push(`世界存在未解决冲突，其中至少一个可能升级或获得新线索。`);
    }
  }

  // 确保至少有2条预测
  while (directions.length < 2) {
    directions.push("当前世界的某个隐藏线索可能在叙事中浮现。");
  }
  // 不超过3条
  const next = directions.slice(0, 3);

  return {
    next,
    basis: String(input || "").slice(0, 160),
    scene: sceneName,
    confidence: next.length >= 3 ? "high" : "medium",
    generatedAt: new Date().toISOString()
  };
}
