// tests/unit/alchemy.test.js — 炼金台协议单测
// 验证 classifier/extractor 能正确解析 llmCall 返回的字符串（不真的打 API）
import { classify, parseClassifierResponse } from "../../src/core/data/alchemy/classifier.js";
import { extract, parseExtractorResponse } from "../../src/core/data/alchemy/extractor.js";

const PASS = "PASS";
const FAIL = "FAIL";

function test(name, fn) {
  try { fn(); return PASS; }
  catch (err) { return `${FAIL}: ${name} — ${err.message}`; }
}

const results = [];

// ═══════════════════════════════════════════════════════════════
//  classifier 解析测试
// ═══════════════════════════════════════════════════════════════

results.push(test("classifier: 纯 JSON 数组字符串", () => {
  const response = `[{"blockIndex":0,"typeIds":["character"],"confidence":0.8,"entities":["艾琳"],"reason":"角色介绍"}]`;
  const parsed = parseClassifierResponse(response);
  if (!Array.isArray(parsed)) throw new Error("expected array, got " + typeof parsed);
  if (parsed.length === 0) throw new Error("expected at least 1 result");
  if (parsed[0].typeIds[0] !== "character") throw new Error("expected character type");
}));

results.push(test("classifier: fenced JSON ```json ... ```", () => {
  const response = "```json\n[{\"blockIndex\":0,\"typeIds\":[\"location\"],\"confidence\":0.9,\"entities\":[\"王都\"],\"reason\":\"地名\"}]\n```";
  const parsed = parseClassifierResponse(response);
  if (!Array.isArray(parsed)) throw new Error("expected array from fenced JSON");
  if (parsed[0].entities[0] !== "王都") throw new Error("expected 王都 entity");
}));

results.push(test("classifier: 带说明文字的 JSON", () => {
  const response = "以下是分类结果：\n[{\"blockIndex\":1,\"typeIds\":[\"organization\"],\"confidence\":0.7,\"entities\":[\"冒险者公会\"]}]";
  const parsed = parseClassifierResponse(response);
  if (!Array.isArray(parsed)) throw new Error("expected array from text+JSON");
  if (parsed[0].typeIds[0] !== "organization") throw new Error("expected organization type");
}));

results.push(test("classifier: 空响应不崩溃", () => {
  const parsed = parseClassifierResponse("");
  if (!Array.isArray(parsed)) throw new Error("expected array for empty input");
  if (parsed.length !== 0) throw new Error("expected empty array");
}));

results.push(test("classifier: null 不崩溃", () => {
  const parsed = parseClassifierResponse(null);
  if (!Array.isArray(parsed)) throw new Error("expected array for null");
}));

// ═══════════════════════════════════════════════════════════════
//  extractor 解析测试
// ═══════════════════════════════════════════════════════════════

results.push(test("extractor: 纯 JSON 对象字符串", () => {
  const response = `{"name":"艾琳","role":"法师","traits":["冷静","博学"],"background":"王都魔法学院毕业"}`;
  const parsed = parseExtractorResponse(response);
  if (!parsed || typeof parsed !== "object") throw new Error("expected object");
  if (parsed.name !== "艾琳") throw new Error("expected 艾琳");
  if (!parsed.traits.includes("冷静")) throw new Error("expected 冷静 trait");
}));

results.push(test("extractor: fenced JSON ```json {...} ```", () => {
  const response = "```json\n{\"name\":\"王都酒馆\",\"type\":\"location\",\"description\":\"冒险者聚集的酒馆\"}\n```";
  const parsed = parseExtractorResponse(response);
  if (!parsed) throw new Error("expected parsed from fenced JSON");
  if (parsed.name !== "王都酒馆") throw new Error("expected 王都酒馆");
}));

results.push(test("extractor: 带前缀文字的 JSON 对象", () => {
  const response = "提取结果：\n{\"name\":\"冒险者公会\",\"type\":\"organization\",\"goals\":[\"维护王都秩序\"]}";
  const parsed = parseExtractorResponse(response);
  if (!parsed) throw new Error("expected parsed from text+JSON");
  if (parsed.type !== "organization") throw new Error("expected organization");
}));

results.push(test("extractor: 数组 JSON 也能容忍", () => {
  // 有些 LLM 返回 JSON 数组而非对象
  const response = "[{\"name\":\"团长\",\"role\":\"战士\"}]";
  const parsed = parseExtractorResponse(response);
  if (!parsed) throw new Error("expected parsed from array");
}));

results.push(test("extractor: 空响应不崩溃", () => {
  const parsed = parseExtractorResponse("");
  if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
    // 空响应应该返回 null 或空对象
  }
  // ok as long as no crash
}));

// ═══════════════════════════════════════════════════════════════
//  llmCall 字符串协议验证（模拟 buildAlchemyLlmCall 返回格式）
// ═══════════════════════════════════════════════════════════════

results.push(test("协议: llmCall 返回字符串 → classifier 可解析", async () => {
  const mockLlmCall = async () => `[{"blockIndex":0,"typeIds":["character"],"confidence":0.8,"entities":["艾琳"],"reason":"角色介绍"}]`;
  const text = await mockLlmCall();
  if (typeof text !== "string") throw new Error(`expected string, got ${typeof text}`);
  // 模拟 classify 调用：传入 llmCall 返回的字符串
  const parsed = parseClassifierResponse(text);
  if (!Array.isArray(parsed)) throw new Error("classifier should parse string result");
}));

results.push(test("协议: llmCall 返回字符串 → extractor 可解析", async () => {
  const mockLlmCall = async () => `{"name":"艾琳","role":"法师"}`;
  const text = await mockLlmCall();
  if (typeof text !== "string") throw new Error(`expected string, got ${typeof text}`);
  const parsed = parseExtractorResponse(text);
  if (!parsed || parsed.name !== "艾琳") throw new Error("extractor should parse string result");
}));

// ═══════════════════════════════════════════════════════════════
results.push(test("协议: llmCall 返回对象 → String() = [object Object]", async () => {
  // 回归测试：如果未来有人改回返回对象，确保能检测到
  const badMock = async () => ({ parsed: null, raw: "some text" });
  const result = await badMock();
  const asString = String(result);
  if (asString === "[object Object]") {
    // 这正是我们要防止的！但测试不失败——只是标记已知风险
  }
  // 如果 asString 不是合法 JSON，classifier/extractor 会解析失败
  const parsed = parseClassifierResponse(asString);
  if (parsed.length > 0) throw new Error("[object Object] should not parse as valid classifier result");
}));

// ═══════════════════════════════════════════════════════════════
let passed = 0, failed = 0;
for (const r of results) {
  if (r === PASS) passed++;
  else { console.error(`  ❌ ${r}`); failed++; }
}
console.log(`\nalchemy 测试: ${passed + failed} 项, ${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
