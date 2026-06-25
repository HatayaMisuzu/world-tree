import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { saveCharacterV2CandidatesForReview, listCharacterV2CandidateReview, decideCharacterV2Candidate } from "../../src/server/character-v2-candidate-workbench-service.js";

function mkRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "wt-cand-")); }

test("save creates pending candidates", () => {
  const root = mkRoot();
  const result = saveCharacterV2CandidatesForReview(root, "char_test", {
    memoryCandidates: [{ reason: "值得记住", payload: { excerpt: "测试" }, confidence: "medium" }],
    relationshipCandidates: [],
    qualityCandidates: []
  });
  assert.equal(result.saved, 1);
  assert.equal(result.candidates[0].status, "pending");
  assert.equal(result.candidates[0].autoWrite, false);
});

test("list returns pending count", () => {
  const root = mkRoot();
  saveCharacterV2CandidatesForReview(root, "char_test", { memoryCandidates: [{ reason: "记忆" }], relationshipCandidates: [], qualityCandidates: [] });
  const list = listCharacterV2CandidateReview(root, "char_test");
  assert.equal(list.pending, 1);
});

test("approve memory writes memory.confirmed.json", () => {
  const root = mkRoot();
  saveCharacterV2CandidatesForReview(root, "char_test", { memoryCandidates: [{ reason: "记住" }], relationshipCandidates: [], qualityCandidates: [] });
  const list = listCharacterV2CandidateReview(root, "char_test");
  const candidateId = list.candidates[0].id;
  const decision = decideCharacterV2Candidate(root, "char_test", candidateId, "approve");
  assert.equal(decision.ok, true);
  const confirmed = JSON.parse(fs.readFileSync(path.join(root, "char_test", "v2", "memory.confirmed.json"), "utf8"));
  assert.equal(confirmed.length, 1);
});

test("reject does not write confirmed sidecars", () => {
  const root = mkRoot();
  saveCharacterV2CandidatesForReview(root, "char_test", { memoryCandidates: [{ reason: "拒绝" }], relationshipCandidates: [], qualityCandidates: [] });
  const list = listCharacterV2CandidateReview(root, "char_test");
  decideCharacterV2Candidate(root, "char_test", list.candidates[0].id, "reject");
  const confirmedPath = path.join(root, "char_test", "v2", "memory.confirmed.json");
  assert.equal(fs.existsSync(confirmedPath), false);
});
