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
