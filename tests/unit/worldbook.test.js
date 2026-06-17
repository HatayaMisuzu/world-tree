// tests/unit/worldbook.test.js — 世界书高级匹配单测
// 覆盖：normalize 字段保真、exact/semantic/vector/scene/depth/probability
import { matchEntries, buildVectorIndex } from "../../src/core/data/worldbook.js";
import { normalizeWorldbookEntries } from "../../src/core/cards.js";

const PASS = "PASS";
const FAIL = "FAIL";

function test(name, fn) {
  try { fn(); return PASS; }
  catch (err) { return `${FAIL}: ${name} — ${err.message}`; }
}

const results = [];

// ═══════════════════════════════════════════════════════════════
//  组 1: normalizeWorldbookEntries 字段保真
// ═══════════════════════════════════════════════════════════════

results.push(test("normalize 保留 matchMode", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["魔法"], content: "desc", matchMode: "semantic" }]);
  if (entry.matchMode !== "semantic") throw new Error(`expected semantic, got ${entry.matchMode}`);
}));

results.push(test("normalize 保留 triggerType", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["入口"], content: "d", triggerType: "scene" }]);
  if (entry.triggerType !== "scene") throw new Error(`expected scene, got ${entry.triggerType}`);
}));

results.push(test("normalize 保留 depth", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", depth: "near" }]);
  if (entry.depth !== "near") throw new Error(`expected near, got ${entry.depth}`);
}));

results.push(test("normalize 保留 probability", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", probability: 50 }]);
  if (entry.probability !== 50) throw new Error(`expected 50, got ${entry.probability}`);
}));

results.push(test("normalize 保留 layer", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", layer: "base" }]);
  if (entry.layer !== "base") throw new Error(`expected base, got ${entry.layer}`);
}));

results.push(test("normalize 保留 logic", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", logic: "all" }]);
  if (entry.logic !== "all") throw new Error(`expected all, got ${entry.logic}`);
}));

results.push(test("normalize 兼容旧字段 match_mode", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", match_mode: "vector" }]);
  if (entry.matchMode !== "vector") throw new Error(`expected vector, got ${entry.matchMode}`);
}));

results.push(test("normalize 兼容旧字段 scan_depth", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", scan_depth: "far" }]);
  if (entry.depth !== "far") throw new Error(`expected far, got ${entry.depth}`);
}));

results.push(test("normalize 兼容旧字段 trigger_prob", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", trigger_prob: 30 }]);
  if (entry.probability !== 30) throw new Error(`expected 30, got ${entry.probability}`);
}));

results.push(test("normalize 展开原始字段不丢失自定义属性", () => {
  const [entry] = normalizeWorldbookEntries([{ keys: ["x"], content: "d", customProp: "keep-me" }]);
  if (entry.customProp !== "keep-me") throw new Error(`customProp lost`);
}));

// ═══════════════════════════════════════════════════════════════
//  组 2: exact 精确关键词匹配
// ═══════════════════════════════════════════════════════════════

results.push(test("exact: 关键词命中", () => {
  const entries = normalizeWorldbookEntries([{ keys: ["魔法"], content: "魔法设定", mode: "trigger", matchMode: "exact" }]);
  const hits = matchEntries({ entries }, "我想学习魔法", { mode: "exact", limit: 5 });
  if (hits.length !== 1) throw new Error(`expected 1 hit, got ${hits.length}`);
  if (hits[0].matchType !== "exact") throw new Error(`expected exact, got ${hits[0].matchType}`);
}));

results.push(test("exact: 关键词不命中", () => {
  const entries = normalizeWorldbookEntries([{ keys: ["魔法"], content: "魔法设定" }]);
  const hits = matchEntries({ entries }, "我想学习剑术", { limit: 5 });
  const exactHits = hits.filter(h => h.matchType === "exact");
  if (exactHits.length > 0) throw new Error(`expected 0 exact hits, got ${exactHits.length}`);
}));

// ═══════════════════════════════════════════════════════════════
//  组 3: semantic 语义匹配
// ═══════════════════════════════════════════════════════════════

results.push(test("semantic: 2-gram 重叠命中（query 避开 key 防 exact 抢先）", () => {
  // key="精灵"，query 不含"精灵"，但 2-gram "古老""森林"重叠
  const entries = normalizeWorldbookEntries([{
    keys: ["精灵"], content: "精灵族居住在古老的森林中",
    mode: "trigger", matchMode: "semantic"
  }]);
  const hits = matchEntries({ entries }, "古老的森林深处", { mode: "both", limit: 5 });
  const semanticHits = hits.filter(h => h.matchType === "semantic");
  if (semanticHits.length === 0) throw new Error("expected semantic hit on shared 2-grams 古老/森林");
}));

results.push(test("semantic: 不相关内容不命中", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["龙"], content: "巨龙沉睡在火山深处",
    mode: "trigger", matchMode: "semantic"
  }]);
  const hits = matchEntries({ entries }, "今天天气很好适合散步", { mode: "both", limit: 5 });
  const semanticHits = hits.filter(h => h.matchType === "semantic");
  if (semanticHits.length > 0) throw new Error(`expected 0 semantic hits on unrelated input`);
}));

// ═══════════════════════════════════════════════════════════════
//  组 4: vector 向量匹配
// ═══════════════════════════════════════════════════════════════

results.push(test("vector: 共享英文 token 命中", () => {
  // tokenFreq 按 \W 分 token，英文自然分词；中文需空格/标点分割才能分 token
  const entries = normalizeWorldbookEntries([{
    keys: ["forest"], content: "ancient forest secrets of the elves",
    mode: "trigger", matchMode: "vector"
  }]);
  const vectors = buildVectorIndex(entries);
  const hits = matchEntries({ entries }, "secrets of the ancient ones", { mode: "both", limit: 5, vectors, vectorThreshold: 0.1 });
  const vectorHits = hits.filter(h => h.matchType === "vector");
  if (vectorHits.length === 0) throw new Error("expected vector hit on shared tokens: secrets, ancient");
}));

results.push(test("vector: 无共享词不命中", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["forest"], content: "deep forest mystery",
    mode: "trigger", matchMode: "vector"
  }]);
  const vectors = buildVectorIndex(entries);
  const hits = matchEntries({ entries }, "ocean treasure hunt", { mode: "both", limit: 5, vectors, vectorThreshold: 0.3 });
  const vectorHits = hits.filter(h => h.matchType === "vector");
  if (vectorHits.length > 0) throw new Error("expected 0 vector hits on unrelated tokens");
}));

results.push(test("vector: 空 query 不崩溃", () => {
  const entries = normalizeWorldbookEntries([{ keys: ["x"], content: "test content", matchMode: "vector" }]);
  const vectors = buildVectorIndex(entries);
  const hits = matchEntries({ entries }, "", { mode: "both", limit: 5, vectors });
  if (!Array.isArray(hits)) throw new Error("expected array result");
}));

// ═══════════════════════════════════════════════════════════════
//  组 5: scene trigger 场景变化触发
// ═══════════════════════════════════════════════════════════════

results.push(test("scene: 场景变化触发（query 不含 key，防止被 exact 抢先）", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["酒馆"], content: "王都酒馆的描述",
    mode: "trigger", triggerType: "scene", matchMode: "exact"
  }]);
  // query 故意不含 "酒馆"，让 exact 不命中 → 步骤4 scene trigger 接管
  const hits = matchEntries({ entries }, "继续前进", {
    mode: "exact", limit: 5,
    sceneName: "王都酒馆", previousScene: "城门"
  });
  const sceneHits = hits.filter(h => h.matchType === "scene");
  if (sceneHits.length === 0) throw new Error("expected scene trigger on scene change");
}));

results.push(test("scene: 场景未变化不触发", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["酒馆"], content: "酒馆描述",
    mode: "trigger", triggerType: "scene"
  }]);
  const hits = matchEntries({ entries }, "继续", {
    mode: "exact", limit: 5,
    sceneName: "王都酒馆", previousScene: "王都酒馆"
  });
  const sceneHits = hits.filter(h => h.matchType === "scene");
  if (sceneHits.length > 0) throw new Error("expected 0 scene triggers when scene unchanged");
}));

// ═══════════════════════════════════════════════════════════════
//  组 6: scanDepth 扫描深度
// ═══════════════════════════════════════════════════════════════

results.push(test("depth: near 只扫描前 3 条消息", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["魔法"], content: "魔法设定",
    mode: "trigger", matchMode: "exact", depth: "near"
  }]);
  // matchEntries 中 scanMessages.slice(0, range) 取前 N 条（按传入顺序）
  // 把 "魔法" 放在前 3 条内，模拟"最近消息含关键词"
  const scanMessages = [
    "今天学了魔法", "天气不错", "我们来探索",
    "无关对话", "更早的无关"
  ];
  const hits = matchEntries({ entries }, "魔法", {
    mode: "exact", limit: 5, scanMessages
  });
  if (hits.length === 0) throw new Error("expected hit: 魔法 in first 3 scanMessages (near range)");
}));

results.push(test("depth: global 不受 scanMessages 限制", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["魔法"], content: "魔法设定",
    mode: "trigger", matchMode: "exact", depth: "global"
  }]);
  const hits = matchEntries({ entries }, "魔法不存在于对话中", {
    mode: "exact", limit: 5, scanMessages: []
  });
  // global 深度：scanMessages 为空也允许（L146: !scanMessages.length → return entry）
  if (hits.length === 0) throw new Error("expected hit: global depth bypasses scanMessages");
}));

// ═══════════════════════════════════════════════════════════════
//  组 7: probability 触发概率
// ═══════════════════════════════════════════════════════════════

results.push(test("probability: 100 必触发", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["魔法"], content: "魔法设定",
    mode: "trigger", matchMode: "exact", probability: 100
  }]);
  const hits = matchEntries({ entries }, "魔法", { mode: "exact", limit: 5 });
  if (hits.length !== 1) throw new Error(`probability=100 must always trigger`);
}));

results.push(test("probability: 0 永不触发", () => {
  const entries = normalizeWorldbookEntries([{
    keys: ["魔法"], content: "魔法设定",
    mode: "trigger", matchMode: "exact", probability: 0
  }]);
  const hits = matchEntries({ entries }, "魔法", { mode: "exact", limit: 5 });
  if (hits.length > 0) throw new Error(`probability=0 must never trigger`);
}));

// ═══════════════════════════════════════════════════════════════
//  组 8: 常驻条目
// ═══════════════════════════════════════════════════════════════

results.push(test("persistent: 常驻条目始终注入", () => {
  const entries = normalizeWorldbookEntries([{
    keys: [], content: "世界基本设定", mode: "persistent"
  }]);
  const hits = matchEntries({ entries }, "随便什么输入", { mode: "exact", limit: 5 });
  if (hits.length !== 1) throw new Error(`persistent entry must always inject`);
  if (hits[0].matchType !== "persistent") throw new Error(`expected persistent matchType`);
}));

// ═══════════════════════════════════════════════════════════════
//  输出结果
// ═══════════════════════════════════════════════════════════════

let passed = 0, failed = 0;
for (const r of results) {
  if (r === PASS) passed++;
  else { console.error(`  ❌ ${r}`); failed++; }
}
console.log(`\nworldbook 测试: ${passed + failed} 项, ${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
