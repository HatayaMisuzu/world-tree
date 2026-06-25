import test from "node:test";
import assert from "node:assert/strict";
import { planCaseCapsuleFromPremise, createCaseComplexityProfile, validateAntiSpeedrunDesign, validateCaseGeneratorBlueprint } from "../../src/core/detective/detective-case-generator-blueprint.js";

test("planCaseCapsuleFromPremise: returns scaffold, not full case", () => {
  const plan = planCaseCapsuleFromPremise("A murder at the lighthouse");
  assert.equal(plan.premise, "A murder at the lighthouse");
  assert.equal(plan._planOnly, true);
  assert.ok(plan.complexityProfile);
  assert.ok(plan.cluePlan);
  assert.ok(plan.testimonyPlan);
  assert.ok(plan.deductionLocks.length >= 4);
});

test("planCaseCapsuleFromPremise: difficulty affects counts", () => {
  const easy = planCaseCapsuleFromPremise("x", { difficulty: "easy" });
  const hard = planCaseCapsuleFromPremise("x", { difficulty: "hard" });
  assert.ok(hard.complexityProfile.suspectCount > easy.complexityProfile.suspectCount);
});

test("planCaseCapsuleFromPremise: empty premise returns error", () => {
  assert.ok(planCaseCapsuleFromPremise("").error);
});

test("validateAntiSpeedrunDesign: catches too-few suspects", () => {
  const plan = planCaseCapsuleFromPremise("test", { difficulty: "standard" });
  plan.complexityProfile.suspectCount = 3;
  const result = validateAntiSpeedrunDesign(plan);
  assert.ok(result.warnings.some(w => w.includes("suspectCount")));
});

test("validateAntiSpeedrunDesign: catches too-few locks", () => {
  const plan = planCaseCapsuleFromPremise("test");
  plan.complexityProfile.deductionLocks = 3;
  const result = validateAntiSpeedrunDesign(plan);
  assert.ok(result.warnings.some(w => w.includes("deductionLocks")));
});

test("validateAntiSpeedrunDesign: passes well-formed plan", () => {
  const plan = planCaseCapsuleFromPremise("Complex mystery with many suspects and twists", { difficulty: "hard" });
  const result = validateAntiSpeedrunDesign(plan);
  // hard difficulty with 5 suspects, 7 locks should pass
  assert.equal(result.passed, true);
});
