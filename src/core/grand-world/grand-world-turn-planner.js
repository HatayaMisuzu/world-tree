const INTENT_KEYWORDS = {
  explore: ["探索", "前往", "去", "走向", "进入", "离开", "travel", "explore", "go"],
  inspect: ["查看", "调查", "检查", "观察", "搜查", "inspect", "look", "examine", "search"],
  talk: ["对话", "交谈", "说", "问", "告诉", "talk", "speak", "ask", "tell"],
  travel: ["移动", "前往", "去", "出发", "travel", "go", "move"],
  act: ["做", "使用", "攻击", "破坏", "建造", "act", "use", "attack", "build", "destroy"],
  reflect: ["回顾", "想起", "思考", "整理", "reflect", "think", "recall"],
  continue: ["继续", "接下来", "然后", "continue", "next", "then"]
};

export function planGrandWorldTurn(input = {}, context = {}, options = {}) {
  const intent = classifyGrandWorldIntent(input, context, options);
  const hooks = createGrandWorldNarrativeHooks(context, options);
  const actions = createGrandWorldActionOptions(context, options);
  return { intent, hooks, actions };
}

export function classifyGrandWorldIntent(input = {}, context = {}, options = {}) {
  const text = String(input.text || "").toLowerCase();
  for (const [kind, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(k => text.includes(k.toLowerCase()))) return { kind, confidence: "medium" };
  }
  return { kind: "unknown", confidence: "low" };
}

export function createGrandWorldNarrativeHooks(context = {}, options = {}) {
  const hooks = [];
  const scene = context.currentScene;
  if (scene) hooks.push({ type: "scene", text: "当前位于：" + (scene.title || "未知") });
  const threats = context.worldState?.activeThreats || [];
  for (const t of threats.slice(0, 2)) hooks.push({ type: "threat", text: "威胁：" + t });
  return hooks;
}

export function createGrandWorldActionOptions(context = {}, options = {}) {
  return ["探索周围环境", "调查当前场景", "与在场角色交谈", "查看当前目标", "回顾世界状态"];
}