// wizard-risk-review.js — Risk review for creation wizard blueprints
// Part of M1 Creation Wizard v2 — Data tier: candidate review

const RISK_CHECKS = [
  { id: "no_world_name", check: (b) => !b.worldName || b.worldName === "未命名世界", level: "high", msg: "世界名称为空" },
  { id: "no_genre", check: (b) => !b.genre || b.genre === "未指定", level: "medium", msg: "未指定风格/类型" },
  { id: "no_protagonist", check: (b) => !b.protagonist.name, level: "medium", msg: "未定义主角名称" },
  { id: "no_opening", check: (b) => !b.opening.scene, level: "high", msg: "未定义开场场景" },
  { id: "no_conflict", check: (b) => !b.opening.conflict, level: "low", msg: "未定义初始冲突" },
  { id: "too_vague", check: (b) => Object.values(b.world).every(v => !v), level: "low", msg: "世界信息过于空泛" }
];

export function reviewBlueprint(blueprint) {
  const findings = [];
  for (const rc of RISK_CHECKS) {
    if (rc.check(blueprint)) findings.push({ id: rc.id, level: rc.level, message: rc.msg });
  }
  return {
    passed: findings.filter(f => f.level === "high").length === 0,
    findings,
    highCount: findings.filter(f => f.level === "high").length,
    mediumCount: findings.filter(f => f.level === "medium").length,
    lowCount: findings.filter(f => f.level === "low").length
  };
}

export function isReadyForDelivery(review) { return review.passed && review.highCount === 0; }
