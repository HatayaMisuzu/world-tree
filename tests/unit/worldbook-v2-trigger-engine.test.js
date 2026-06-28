import test from "node:test";
import assert from "node:assert/strict";
import { activateWorldbookEntries } from "../../src/core/worldbook-v2/worldbook-trigger-engine.js";

test("trigger supports keyword regex filters", () => {
  const entries = [
    { id:"capital", title:"王都", content:"王都是大陆中心。", keys:["王都"], filters:{ requiredAny:["贵族","议会"] }, sourceRefs:["manual"] },
    { id:"weather", title:"雨季", content:"雨季会影响道路。", regexKeys:["/暴雨|雨季/"], sourceRefs:["manual"] }
  ];
  const r = activateWorldbookEntries(entries, { input:"我去王都拜访贵族，途中遇到暴雨。" }, { rng:()=>0 });
  assert.equal(r.activations.length, 2);
});

test("inclusion groups select most specific", () => {
  const entries = [
    { id:"a", title:"A", content:"A 内容", keys:["歌"], inclusionGroups:["song"], priority:10, insertionOrder:10, sourceRefs:["t"] },
    { id:"b", title:"B", content:"B 内容", keys:["歌","幽灵"], inclusionGroups:["song"], priority:10, insertionOrder:20, sourceRefs:["t"] }
  ];
  const r = activateWorldbookEntries(entries, { input:"唱一首幽灵之歌" }, { rng:()=>0 });
  assert.equal(r.activations.length, 1);
  assert.equal(r.activations[0].entryId, "b");
});

test("probability filters activation", () => {
  const r = activateWorldbookEntries([{ id:"rare", title:"稀有事件", content:"稀有事件。", keys:["事件"], probability:10, sourceRefs:["t"] }], { input:"事件" }, { rng:()=>0.5 });
  assert.equal(r.activations.length, 0);
});
