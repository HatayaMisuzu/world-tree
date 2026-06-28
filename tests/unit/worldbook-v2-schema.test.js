import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorldbookEntry, validateWorldbookEntry, normalizeWorldbookCandidate } from "../../src/core/worldbook-v2/worldbook-entry-schema.js";

test("entry normalizes ST-like fields", () => {
  const e = normalizeWorldbookEntry({ id:"e1", comment:"白塔议会", keys:["白塔","/禁术/i"], content:"白塔议会是北境法师教育与禁术审查组织。", order:250, probability:50, group:"factions", layer:"factions" });
  assert.equal(e.title, "白塔议会");
  assert.equal(e.triggerProbability, 0.5);
  assert.equal(e.inclusionGroups[0], "factions");
  assert.equal(e.contextSlot, "active_factions");
});

test("entry warns when content is not self-contained", () => {
  const r = validateWorldbookEntry({ id:"e2", title:"白塔议会", keys:["白塔"], content:"控制禁术审查。", sourceRefs:["manual"] });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some(w=>/self-contained/.test(w)));
});

test("candidate is candidate authority", () => {
  const c = normalizeWorldbookCandidate({ id:"c1", title:"王都", content:"王都是大陆中心。", sourceModule:"alchemy-digest" });
  assert.equal(c.authority, "candidate");
  assert.equal(c.draftEntry.authority, "candidate");
});
