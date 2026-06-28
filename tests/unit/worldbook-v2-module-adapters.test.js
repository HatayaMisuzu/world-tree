import test from "node:test";
import assert from "node:assert/strict";
import { alchemyCandidateToWorldbookCandidate, materialWarehouseCandidateToWorldbookCandidate, characterProfileToWorldbookEntry, cognitionMatrixToWorldbookEntries, factionGraphToWorldbookEntries, worldRulesToWorldbookEntries, randomEventToWorldbookCandidate } from "../../src/core/worldbook-v2/worldbook-module-adapters.js";

test("adapters preserve authority and visibility", () => {
  const a = alchemyCandidateToWorldbookCandidate({ id:"cand1", materialId:"mat1", type:"factionCandidate", title:"白塔", summary:"白塔是组织。", source:{ hash:"h" } });
  assert.equal(a.authority, "candidate");
  assert.equal(a.draftEntry.contextSlot, "active_factions");

  const char = characterProfileToWorldbookEntry({ characterId:"c1", canonProfile:{ name:"林娜", identity:"骑士" } });
  assert.equal(char.contextSlot, "active_characters");

  const cog = cognitionMatrixToWorldbookEntries({ characterId:"c1", entries:[{ fact:"密道存在", state:"forbidden" }] });
  assert.equal(cog[0].visibility, "forbidden");

  const faction = factionGraphToWorldbookEntries({ factions:{ f1:{ id:"f1", name:"白塔", knownToPlayer:true } }, relations:[{ from:"f1", to:"f2", type:"secret", publicKnown:false }] });
  assert.ok(faction.some(e=>e.visibility==="hiddenTruth"));

  const rules = worldRulesToWorldbookEntries({ rules:[{ id:"r1", title:"代价守恒", rule:"魔法需要代价", visibility:"hidden" }] });
  assert.equal(rules[0].visibility, "system_only");

  const ev = randomEventToWorldbookCandidate({ id:"e1", title:"政变", impactLevel:"major", proposalRequired:true });
  assert.equal(ev.riskLevel, "major");
  assert.equal(ev.requiresApproval, true);

  const mw = materialWarehouseCandidateToWorldbookCandidate({ id:"mw1", title:"王都", summary:"王都是中心", sourceId:"src1" });
  assert.equal(mw.sourceType, "material-warehouse");
});
