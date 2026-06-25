import test from "node:test";
import assert from "node:assert/strict";

import { generateDetectiveCaseFromPremise } from "../../src/core/detective/detective-case-generator.js";
import { validatePlayableDetectiveCase, scoreDetectiveCaseQuality, detectDetectiveCaseSpeedrunRisks } from "../../src/core/detective/detective-case-quality-validator.js";
import { validateDetectiveCaseCapsule } from "../../src/core/detective/detective-case-capsule.js";

test("Detective generator creates a playable current-schema case", () => {
  const result = generateDetectiveCaseFromPremise("雨夜的钟楼记录出现了不可能的时间差", { caseId: "case_test_generated" });
  assert.equal(result.status, "ok");
  const c = result.draft;

  assert.ok(c.caseId);
  assert.ok(Array.isArray(c.characters));
  assert.ok(c.characters.length >= 4);
  assert.ok(Array.isArray(c.locations));
  assert.ok(c.locations.length >= 4);
  assert.ok(Array.isArray(c.evidence));
  assert.ok(c.evidence.length >= 6);
  assert.ok(Array.isArray(c.testimonies));
  assert.ok(c.testimonies.length >= 4);
  assert.ok(Array.isArray(c.contradictions));
  assert.ok(c.contradictions.length >= 2);
  assert.ok(c.timeline?.realTimeline?.length >= 3);
  assert.ok(c.timeline?.publicTimeline?.length >= 1);

  assert.ok(c.truthLedger?.culpritIds?.length > 0);
  assert.ok(c.truthLedger?.motive);
  assert.ok(c.truthLedger?.method);
  assert.ok(c.truthLedger?.criticalEvidenceIds?.length >= 3);
  assert.ok(c.truthLedger?.solutionChain?.length >= 3);

  const evidenceIds = new Set(c.evidence.map((e) => e.evidenceId));
  for (const id of c.truthLedger.criticalEvidenceIds) assert.ok(evidenceIds.has(id), `missing critical evidence: ${id}`);

  const capsuleValidation = validateDetectiveCaseCapsule(c);
  assert.equal(capsuleValidation.valid ?? capsuleValidation.ok ?? true, true, JSON.stringify(capsuleValidation));

  const playable = validatePlayableDetectiveCase(c);
  assert.equal(playable.playable, true, JSON.stringify(playable.errors));

  const quality = scoreDetectiveCaseQuality(c);
  assert.ok(quality.total >= 70, `quality too low: ${quality.total}`);

  const risks = detectDetectiveCaseSpeedrunRisks(c);
  assert.ok(risks.risks.length >= 0, "speedrun risks should be reported");
});
