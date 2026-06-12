// skill-generator.js
// 炼金台 → 角色卡引擎数据：按创生skill VC-3 方法论从文本提炼完整角色人格
// 输出: card.json 可直接被 parseCharacterCard() 消费
// ═══════════════════════════════════════════════════════════════

/**
 * 构建 LLM 人格提炼 Prompt（按创生skill VC-3 方法论）
 * @param {string} text - 用户输入的原始文本
 * @param {Array} items - 炼金台提取的基础 items
 * @returns {Array} [{ role, content }] messages
 */
export function buildCharacterRefineryPrompt(text, items = []) {
  // 从 items 中提取已有信息做上下文
  const chars = items.filter(i => i.typeId === "character").map(i => ({
    name: i.entity,
    role: i.data?.role || "",
    traits: i.data?.traits || [],
    background: i.data?.background || "",
    motivation: i.data?.motivation || ""
  }));
  const names = chars.map(c => c.name).filter(Boolean).join("、") || "未命名角色";
  const charSummary = chars.length ? chars.map(c =>
    `- ${c.name}：${c.role ? `身份:${c.role}` : ""}${c.traits?.length ? ` 性格:${c.traits.join(",")}` : ""}${c.background ? ` 背景:${c.background.slice(0, 100)}` : ""}`
  ).join("\n") : "未提取到结构化角色数据，请从原文自行判断主角。";

  const systemPrompt = `你是一位专业的角色人格分析师，正在对以下文本进行角色提炼。

你的任务是从文本中提取角色的完整人格画像，覆盖以下所有维度。每个维度都要从文本中找到证据，不要编造。

## 输出格式
你只输出一个 JSON 对象，不要包含任何其他内容。JSON 的顶层字段如下：

{
  "名称": "角色名称",
  "描述": "一句话概括角色",
  "人格底盘": {
    "欲望": "角色最深层的欲望",
    "恐惧": "角色最深的恐惧",
    "执念": "绝不妥协的点",
    "情绪默认态": "大多数时候的情绪基调",
    "情绪爆发点": "什么能瞬间改变默认态"
  },
  "表达DNA": {
    "口癖": ["口头禅1", "口头禅2"],
    "语气词密度": "高/中/低",
    "句式偏好": "长句/短句/反问多/感叹多等",
    "称呼习惯": "怎么称呼别人",
    "禁用语感": ["不会说的话1", "不会说的句式2"],
    "签名动作": "标志性身体动作"
  },
  "外貌穿着": "角色的外观描述",
  "场景响应": {
    "初次见面": {"reaction": "典型反应", "gesture": "动作神态", "dialogueStyle": "台词风格"},
    "被夸奖": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "被冒犯挑衅": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "遇到失败": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "亲密暧昧试探": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "看到喜欢的东西": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "被需求帮助": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "孤独低落时": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "世界外知识": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "突破边界": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "被忽视冷落": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "被误会冤枉": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "看到他人受伤": {"reaction": "", "gesture": "", "dialogueStyle": ""},
    "久别重逢": {"reaction": "", "gesture": "", "dialogueStyle": ""}
  },
  "性格权重": {
    "自信骄傲": 25,
    "天然呆": 15,
    "对他人的信赖": 20,
    "表达力/坦率度": 20,
    "攻击性/防御性": 5,
    "内省/自我怀疑": 10,
    "目标指向性": 25,
    "色气/魅惑": 10,
    "责任感/领袖力": 15,
    "回避/逃避倾向": 5,
    "独占欲/醋意": 10
  },
  "关系网络": [
    {"角色": "角色名", "关系": "关系描述", "态度": "态度", "互动模式": "互动方式"}
  ],
  "世界观边界": {
    "可以知道": ["知识1", "知识2"],
    "不应该知道": ["知识1", "知识2"]
  },
  "角色弧光": {
    "当前阶段": "当前默认Phase名称",
    "关键事件": "触发当前阶段的事件",
    "角色成长": "从前到后的性格变化"
  }
}

## 提取原则

1. 每个维度从文本中找直接证据——台词、行为、描述。没有证据的维度置空，不编造。
2. 性格权重的各维度加起来不限100%，每个独立评估。
3. 关系网络只提取文本中明确出现的角色关系。
4. 场景响应中如果文本没有某场景的对应表现，可根据已知性格合理推断（标注 inferred）。
5. 世界观边界根据文本中的世界设定推断角色「应该知道」和「不应该知道」的内容。`;

  const userPrompt = `## 源文本
${text.slice(0, 8000)}

## 炼金台已提取的角色信息
${charSummary}

请输出完整的角色人格 JSON。`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

/**
 * 解析 LLM 返回的 JSON 字符串（容错处理）
 */
export function parseRefineryResponse(raw) {
  // 尝试直接解析
  try { return JSON.parse(raw); } catch {}
  // 尝试从代码块中提取
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1].trim()); } catch {}
  }
  // 尝试找第一个 { 到最后一个 }
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  return null;
}

/**
 * 将提炼结果转换为 parseCharacterCard 可消费的扁平 JSON
 */
export function flattenToCardJson(refined) {
  if (!refined) return null;
  const c = refined;

  // 人格底盘
  const chassis = c["人格底盘"] || {};
  // 表达DNA
  const dna = c["表达DNA"] || {};
  // 场景响应
  const scenes = c["场景响应"] || {};
  // 关系
  const relations = c["关系网络"] || [];
  // 知识边界
  const boundary = c["世界观边界"] || {};
  // 角色弧光
  const arc = c["角色弧光"] || {};

  return {
    名称: c["名称"] || "未命名角色",
    描述: c["描述"] || "",
    欲望: chassis["欲望"] || "",
    恐惧: chassis["恐惧"] || "",
    执念: chassis["执念"] || "",
    情绪默认态: chassis["情绪默认态"] || "",
    情绪爆发点: chassis["情绪爆发点"] || "",
    口癖: Array.isArray(dna["口癖"]) ? dna["口癖"] : [],
    语气词密度: dna["语气词密度"] || "中频",
    句式偏好: dna["句式偏好"] || "",
    称呼习惯: dna["称呼习惯"] || "",
    禁用语感: Array.isArray(dna["禁用语感"]) ? dna["禁用语感"] : [],
    签名动作: dna["签名动作"] || "",
    外貌: c["外貌穿着"] || "",
    初次见面: scenes["初次见面"] || { reaction: "", gesture: "", dialogueStyle: "" },
    被夸奖: scenes["被夸奖"] || { reaction: "", gesture: "", dialogueStyle: "" },
    被冒犯: scenes["被冒犯挑衅"] || { reaction: "", gesture: "", dialogueStyle: "" },
    遇到失败: scenes["遇到失败"] || { reaction: "", gesture: "", dialogueStyle: "" },
    亲密试探: scenes["亲密暧昧试探"] || { reaction: "", gesture: "", dialogueStyle: "" },
    喜欢的东西: scenes["看到喜欢的东西"] || { reaction: "", gesture: "", dialogueStyle: "" },
    被需求帮助: scenes["被需求帮助"] || { reaction: "", gesture: "", dialogueStyle: "" },
    孤独低落时: scenes["孤独低落时"] || { reaction: "", gesture: "", dialogueStyle: "" },
    世界外知识: scenes["世界外知识"] || { reaction: "", gesture: "", dialogueStyle: "" },
    突破边界: scenes["突破边界"] || { reaction: "", gesture: "", dialogueStyle: "" },
    被忽视冷落: scenes["被忽视冷落"] || { reaction: "", gesture: "", dialogueStyle: "" },
    被误会冤枉: scenes["被误会冤枉"] || { reaction: "", gesture: "", dialogueStyle: "" },
    看到他人受伤: scenes["看到他人受伤"] || { reaction: "", gesture: "", dialogueStyle: "" },
    久别重逢: scenes["久别重逢"] || { reaction: "", gesture: "", dialogueStyle: "" },
    性格权重: c["性格权重"] || {},
    关系: relations.map(r => ({
      name: r["角色"] || "",
      relation: r["关系"] || "",
      attitude: r["态度"] || "",
      interaction: r["互动模式"] || ""
    })),
    可以知道: Array.isArray(boundary["可以知道"]) ? boundary["可以知道"] : [],
    不应该知道: Array.isArray(boundary["不应该知道"]) ? boundary["不应该知道"] : [],
    成长阶段: arc["当前阶段"] || "",
    核心经历: arc["关键事件"] || "",
    角色弧光: arc["角色成长"] || "",
    source: "alchemy_refinery",
    format: "character_card",
    createdAt: new Date().toISOString()
  };
}
