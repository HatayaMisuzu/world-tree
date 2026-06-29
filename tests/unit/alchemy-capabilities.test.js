import test from "node:test";
import assert from "node:assert/strict";
import { getAlchemyCapabilities } from "../../src/server/alchemy-capabilities.js";

test("alchemy capabilities expose required entrypoints and policies", () => {
  const caps = getAlchemyCapabilities();
  assert.equal(caps.status, "ok");
  const ids = caps.entrypoints.map((entry) => entry.id);
  for (const id of ["playable_world", "worldbook", "character", "mechanism", "strategy_sim", "tabletop", "detective"]) {
    assert.ok(ids.includes(id), `missing entrypoint ${id}`);
  }
  for (const entry of caps.entrypoints) {
    assert.ok(entry.id);
    assert.ok(entry.label);
    assert.ok(entry.purpose);
    assert.ok(Array.isArray(entry.deliverTargets));
    assert.ok(Array.isArray(entry.mechanisms));
    assert.equal(entry.requiredUserDecision, true);
  }
  assert.equal(caps.policies.userMustChooseDeliveryTarget, true);
  assert.equal(caps.policies.noQuestionnaireMode, true);
});
