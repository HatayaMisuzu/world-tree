import test from "node:test";
import assert from "node:assert/strict";
import { compileWorldbookContextPack } from "../../src/core/worldbook-v2/worldbook-context-compiler.js";
import { worldbookContextToPromptBlocks } from "../../src/core/worldbook-v2/worldbook-prompt-adapter.js";
import { buildPromptOrchestrationPacket } from "../../src/core/prompts/prompt-builder.js";

test("context pack converts to prompt blocks", () => {
  const pack = compileWorldbookContextPack({ entries:[{ id:"capital", title:"王都", content:"王都是大陆中心。", keys:["王都"], sourceRefs:["manual"] }], userInput:"我去王都。", modeId:"world-rpg", taskId:"writer", rng:()=>0 });
  const blocks = worldbookContextToPromptBlocks(pack, { modeId:"world-rpg", taskId:"writer" });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].layer, "worldbook");
});

test("prompt-builder consumes worldbookContext", () => {
  const pack = compileWorldbookContextPack({ entries:[{ id:"capital", title:"王都", content:"王都是大陆中心。", keys:["王都"], sourceRefs:["manual"] }], userInput:"王都在哪里？", modeId:"world-rpg", taskId:"writer", rng:()=>0 });
  const packet = buildPromptOrchestrationPacket({ modeId:"world-rpg", taskId:"writer", userInput:"王都在哪里？", worldbookContext:pack, overrideBudget:20000 });
  assert.equal(packet.ok, true);
  assert.ok(packet.blocks.some(b=>b.layer==="worldbook"));
  assert.match(packet.promptText, /王都/);
});
