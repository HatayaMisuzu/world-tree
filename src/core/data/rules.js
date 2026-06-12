// ===== M15 世界规则引擎 + M15c 叙事质量审查 =====

export function checkFeasibility(action = "", worldState = {}, rules = {}) {
  const violations = [];
  const text = String(action || "");

  // === 第一阶段：可行性 ===
  // 物理规则检查
  if (/瞬移|传送|闪现/.test(text) && !JSON.stringify(rules || {}).includes("传送")) {
    violations.push("传送类能力需在世界规则中定义。");
  }
  if (/复活|重生/.test(text) && !JSON.stringify(rules || {}).includes("复活")) {
    violations.push("复活类事件违反不可逆法则。需要魔法规则许可或上帝模式{}。");
  }
  if (/一拳打穿|徒手撕开|肉身挡子弹/.test(text)) {
    violations.push("物理约束：此类行为需要超能力或规则内能力支撑。");
  }
  if (/从(?:十|九|八)楼跳|跳下悬崖|跳楼/.test(text)) {
    violations.push("物理约束：高处坠落会造成致命伤害，不是叙事选择而是物理必然。");
  }

  // 社会规则检查
  if (/命令(?:市长|校长|CEO|总统)/.test(text)) {
    violations.push("社会规则约束：无权命令上级。需要通过正确渠道或叙事手段。");
  }
  if (/走进银行金库|偷|抢银行/.test(text)) {
    violations.push("社会规则约束：违反法律的行为会有刑事后果。");
  }

  // 魔法规则检查（如有规则定义）
  if (rules.magic && (/禁咒|五阶/.test(text))) {
    violations.push("魔法规则：高阶级法术需要极大代价，确认角色满足条件。");
  }

  // === 第二阶段：代价隐含提示 ===
  const costHints = [];
  if (/杀死|消灭/.test(text)) costHints.push("死亡不可逆。角色需承受心理/社会/法律后果。");
  if (/消失|离开/.test(text)) costHints.push("离开一个场景/地点意味着放弃当前叙事线。");
  if (/背叛|出卖/.test(text)) costHints.push("背叛破坏信任关系，修复需要漫长叙事。");

  return {
    pass: violations.length === 0,
    violations,
    costHints,
    strictness: "normal"
  };
}

export function auditNarrative(narrative = "", model = {}) {
  const warnings = [];
  const text = String(narrative);

  // 四维审查

  // (1) 角色一致性
  const chars = model.moduleData?.characters || [];
  if (chars.length === 0 && text.length > 0) {
    // 没有角色数据但叙事有内容，低优先级
  }
  if (text.length < 20 && model.selected) {
    warnings.push({ dimension: "consistency", level: "warning", detail: "叙事过短，可能缺少角色行为反馈。" });
  }

  // (2) 场景连续性
  if (model.selected && !text.trim()) {
    warnings.push({ dimension: "continuity", level: "error", detail: "LLM 未返回叙事正文。" });
  }

  // (3) 叙事节奏
  if (text.length > 3000) {
    warnings.push({ dimension: "pacing", level: "info", detail: "叙事较长，注意节奏控制。关键时刻需要慢镜头，过渡段需要简洁。" });
  }
  if (text.length < 80 && model.selected) {
    warnings.push({ dimension: "pacing", level: "info", detail: "叙事偏短，考虑增加环境/角色细节。" });
  }

  // (4) 风格一致性
  // 此维度主要通过 LLM 输出标记段时的【状态】段来检查

  return {
    consistency: warnings.filter((w) => w.dimension === "consistency").length ? "needs-review" : "ok",
    continuity: warnings.filter((w) => w.dimension === "continuity").length ? "check" : "ok",
    pacing: warnings.filter((w) => w.dimension === "pacing").length ? "review" : "normal",
    style: "world-tree",
    warnings,
    generatedAt: new Date().toISOString()
  };
}
