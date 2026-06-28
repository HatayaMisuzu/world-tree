import test from "node:test";
import assert from "node:assert/strict";
import { compileWorldbookContextPack } from "../../src/core/worldbook-v2/worldbook-context-compiler.js";
import { assertNoWorldbookHiddenLeak } from "../../src/core/worldbook-v2/worldbook-visibility-guard.js";

test("compiler slots public entries and filters hiddenTruth for writer", () => {
  const pack = compileWorldbookContextPack({ entries:[ { id:"rule", title:"魔法规则", content:"魔法规则：代价守恒。", keys:["魔法"], contextSlot:"world_rules", sourceRefs:["rule"] }, { id:"secret", title:"幕后黑手", content:"幕后黑手是王子。", keys:["王子"], visibility:"hiddenTruth", sourceRefs:["secret"] } ], userInput:"我研究魔法并询问王子。", audience:"writer", rng:()=>0 });
  assert.equal(pack.slots.world_rules.length, 1);
  assert.ok(pack.omitted.some(x=>x.entryId==="secret"));
  assert.equal(assertNoWorldbookHiddenLeak(pack).ok, true);
});

test("compiler applies slot budget", () => {
  const pack = compileWorldbookContextPack({ entries:[ { id:"a", title:"A", content:"A".repeat(100), keys:["x"], contextSlot:"global_lore", sourceRefs:["t"] }, { id:"b", title:"B", content:"B".repeat(100), keys:["x"], contextSlot:"global_lore", sourceRefs:["t"] } ], userInput:"x", budgets:{ global_lore:120 }, rng:()=>0 });
  assert.equal(pack.slots.global_lore.length, 1);
  assert.ok(pack.omitted.some(x=>x.reason==="budget:slot"));
});
