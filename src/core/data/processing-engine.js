export const PROCESSING_STEPS = [
  "逻辑检查",
  "矛盾检测",
  "流畅度",
  "创新性",
  "读者观感",
  "整体性",
  "综合"
];

export function scoreMaterial(text = "") {
  const length = String(text || "").length;
  return PROCESSING_STEPS.map((name, index) => ({
    step: index + 1,
    name,
    score: Math.max(10, Math.min(40, Math.round(length / 120) + 24)),
    notes: `${name} 已完成桌面端初评，深度补全交由 LLM 标记段输出。`
  }));
}

export function createProcessingPackage(name, material = "") {
  return {
    id: `package-${Date.now()}`,
    name: name || "未命名设定包",
    material,
    report: scoreMaterial(material),
    createdAt: new Date().toISOString()
  };
}
