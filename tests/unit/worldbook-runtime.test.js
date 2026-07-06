import assert from "node:assert/strict";
import test from "node:test";

import { buildVectorIndex, matchEntries } from "../../src/core/data/worldbook.js";
import { prepareWorldbookInjection } from "../../src/core/runtime/worldbook-runtime.js";

test("worldbook runtime returns selected hits with reasons and budget diagnostics", () => {
  const worldbook = {
    entries: [
      { id: "base", title: "Base", mode: "persistent", content: "世界基础设定", layer: "base" },
      { id: "magic", title: "Magic", keys: ["魔法"], content: "魔法由星辉驱动。", priority: 120 },
      { id: "long", title: "Long", keys: ["古书"], content: "x".repeat(5000), priority: 80 }
    ]
  };
  const runtime = prepareWorldbookInjection({
    worldbook,
    input: "我翻开古书研究魔法。",
    engineState: { contextBudget: "tiny" },
    messages: [{ role: "user", content: "刚刚提到了魔法和古书。" }]
  });

  assert.ok(runtime.injectedWorldbook.length >= 1);
  assert.ok(runtime.injectedWorldbook.some((entry) => entry.reason));
  assert.equal(runtime.diagnostics.budget.budgetUnit, "estimated_tokens");
  assert.ok(runtime.diagnostics.budget.worldbookTokens > 0);
  assert.ok(runtime.diagnostics.budget.worldbookChars > 0);
  assert.ok(Array.isArray(runtime.diagnostics.droppedByBudget));
});

test("vector index handles Chinese bigrams through the same matcher", () => {
  const entries = [
    { id: "dragon", keys: ["龙族"], content: "古老龙族守护星火山脉", matchMode: "vector" }
  ];
  const vectors = buildVectorIndex(entries);
  const hits = matchEntries({ entries }, "星火山脉的守护者", {
    mode: "both",
    vectors,
    vectorThreshold: 0.1
  });

  assert.equal(hits.length, 1);
  assert.equal(hits[0].matchType, "vector");
  assert.match(hits[0].reason, /^vector:/);
});

test("worldbook runtime scans recent assistant history for pronoun followups", () => {
  const runtime = prepareWorldbookInjection({
    worldbook: {
      entries: [
        { id: "fogbell", title: "雾铃塔", keys: ["雾铃塔"], content: "雾铃塔会在云桥尽头回响。", priority: 100 }
      ]
    },
    input: "继续观察它。",
    engineState: { contextBudget: "tiny" },
    messages: [
      { role: "assistant", content: "你刚刚看见雾铃塔在雨里发光。" }
    ]
  });

  assert.equal(runtime.injectedWorldbook.some((entry) => entry.id === "fogbell"), true);
});

test("worldbook matcher supports recursive depth 1 activation", () => {
  const hits = matchEntries({
    entries: [
      { id: "cult", title: "银月教团", keys: ["银月教团"], content: "教团的圣女伊蕾娜掌管月井。", priority: 100 },
      { id: "saint", title: "圣女伊蕾娜", keys: ["圣女伊蕾娜"], content: "伊蕾娜只在满月时现身。", priority: 90 }
    ]
  }, "调查银月教团", { limit: 4 });

  assert.deepEqual(hits.map((entry) => entry.id), ["cult", "saint"]);
  assert.match(hits.find((entry) => entry.id === "saint").matchType, /^recursive:/);
});

test("worldbook matcher supports regex and whole-word keys without migrating old JSON", () => {
  const hits = matchEntries({
    entries: [
      { id: "regex", title: "Mist Tower", keys: ["re:/mist\\s+tower/i"], content: "Regex trigger." },
      { id: "word", title: "Cat", keys: ["w:cat"], content: "Whole word trigger." },
      { id: "legacy", title: "Legacy", keys: ["/silver gate/i"], content: "Legacy slash regex." }
    ]
  }, "MIST TOWER catalog cat near SILVER GATE", { limit: 5 });

  assert.equal(hits.some((entry) => entry.id === "regex"), true);
  assert.equal(hits.some((entry) => entry.id === "word"), true);
  assert.equal(hits.some((entry) => entry.id === "legacy"), true);

  const miss = matchEntries({ entries: [{ id: "word", keys: ["w:cat"], content: "Whole word trigger." }] }, "catalog", { limit: 5 });
  assert.equal(miss.length, 0);
});

test("worldbook selection ranks hit count before priority and then trims by budget", () => {
  const runtime = prepareWorldbookInjection({
    worldbook: {
      entries: [
        { id: "low", title: "Low", keys: ["月井"], content: "长".repeat(1200), priority: 80 },
        { id: "high", title: "High", keys: ["月井"], content: "短条目", priority: 140 }
      ]
    },
    input: "月井",
    engineState: { contextBudget: "emergency" }
  });

  assert.equal(runtime.injectedWorldbook[0].id, "high");
  assert.ok(runtime.diagnostics.droppedByBudget.some((entry) => entry.id === "low"));
});
