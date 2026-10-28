import test from "node:test";
import assert from "node:assert/strict";

import { confirmWorldFact, queryWorldFacts } from "../../src/core/engine/memory-layers.js";
import { exportEngineState, resetEngineState } from "../../src/core/engine/state-persistence.js";
import { WorldSession } from "../../src/core/engine/world-session.js";

test("WorldSession resets to fresh state when snapshot restore is invalid", async () => {
  resetEngineState();
  confirmWorldFact("A_ONLY_MEMORY_SHOULD_NOT_LEAK", "test", "confirmed", "event");
  assert.equal(queryWorldFacts("A_ONLY_MEMORY").length, 1);

  const session = new WorldSession("world:B");
  const { result, restore } = await session.finalizeWithSnapshot({ broken: true }, () => {
    assert.equal(queryWorldFacts("A_ONLY_MEMORY").length, 0);
    return {
      overlayPatch: {
        _engineState: exportEngineState({ turnCount: 0 })
      }
    };
  });

  assert.equal(result.overlayPatch._engineState.version, 1);
  assert.equal(restore.ok, false);
  assert.equal(restore.warning.code, "WORLD_SESSION_SNAPSHOT_INVALID");
  // S2 ③: world B's reset happens inside B's own scope; the outer (default) scope is neither
  // leaked into B (asserted above) nor wiped by B's restore.
  assert.equal(queryWorldFacts("A_ONLY_MEMORY").length, 1);
  assert.equal(session.inScope(() => queryWorldFacts("A_ONLY_MEMORY").length), 0);
  resetEngineState();
});
