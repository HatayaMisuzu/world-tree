import test from "node:test";
import assert from "node:assert/strict";
import { prepareWorldbookV2Injection } from "../../src/core/worldbook-v2/worldbook-runtime.js";

test("runtime compiles context and usage record", () => {
  const result = prepareWorldbookV2Injection({ worldbook:{ entries:[{ id:"capital", title:"王都", content:"王都是大陆中心。", keys:["王都"], sourceRefs:["manual"] }] }, input:"我去王都。", modeId:"world-rpg", taskId:"writer", rng:()=>0 });
  assert.equal(result.ok, true);
  assert.equal(result.worldbookContextPack.diagnostics.activatedCount, 1);
  assert.equal(result.usageRecord.activatedCount, 1);
});
