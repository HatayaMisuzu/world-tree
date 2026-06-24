import test from "node:test";
import assert from "node:assert/strict";
import { listScenarios, runAllScenarios, runScenario } from "../../scripts/real-play-scenarios.mjs";

test("real-play scenario runner covers required offline loops", async () => {
  assert.deepEqual(listScenarios(), ["workflow-health", "creation-alchemy-play-loop", "play-turn-offline", "character-first-chat", "mystery-minimal-loop", "strategy-minimal-loop"]);
  const results = await runAllScenarios();
  assert.equal(results.every(item => item.status === "PASS"), true, JSON.stringify(results, null, 2));
});
test("real-play scenario runner supports a selected scenario", async () => {
  const result = await runScenario("workflow-health");
  assert.equal(result.status, "PASS");
  assert.equal(result.details.preflightProtected, true);
});
