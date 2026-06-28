import test from "node:test";
import assert from "node:assert/strict";
import { createWorldbookCandidateLedger, appendWorldbookCandidate, transitionWorldbookCandidate } from "../../src/core/worldbook-v2/worldbook-candidate-ledger.js";
import { createWorldbookStore, applyConfirmedWorldbookCandidate, upsertWorldbookEntry } from "../../src/core/worldbook-v2/worldbook-store.js";

test("candidate ledger appends and confirms without canon write", () => {
  const ledger = createWorldbookCandidateLedger({ worldId:"w1" });
  const added = appendWorldbookCandidate(ledger, { candidateId:"c1", sourceRefs:["turn-1"], draftEntry:{ title:"王都", content:"王都是大陆中心。", keys:["王都"], sourceRefs:["turn-1"] } });
  assert.equal(added.ok, true);
  assert.equal(ledger.candidates[0].status, "pending");
  const confirmed = transitionWorldbookCandidate(ledger, "c1", "confirm");
  assert.equal(confirmed.candidate.status, "confirmed");
});

test("canon store rejects unconfirmed candidate", () => {
  const store = createWorldbookStore({ worldId:"w1" });
  const result = applyConfirmedWorldbookCandidate(store, { candidateId:"c1", status:"pending", sourceRefs:["turn-1"], draftEntry:{ title:"王都", content:"王都是大陆中心。", keys:["王都"], sourceRefs:["turn-1"] } });
  assert.equal(result.ok, false);
  assert.equal(result.error, "candidate_not_confirmed");
});

test("canon store applies confirmed candidate and versions updates", () => {
  const store = createWorldbookStore({ worldId:"w1" });
  const first = applyConfirmedWorldbookCandidate(store, { candidateId:"c1", status:"confirmed", sourceRefs:["turn-1"], draftEntry:{ entryId:"capital", title:"王都", content:"王都是大陆中心。", keys:["王都"], sourceRefs:["turn-1"] } });
  assert.equal(first.ok, true);
  const second = upsertWorldbookEntry(store, { entryId:"capital", title:"王都", content:"王都是大陆政治中心。", keys:["王都"], sourceRefs:["turn-2"] });
  assert.equal(second.entry.version, 2);
});
