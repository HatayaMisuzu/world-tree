import test from "node:test";
import assert from "node:assert/strict";
import { buildKnowledgeBoundaryContext, validateSimulatedPlayerSpeech, buildSimulatedPlayerPromptContext } from "../../src/core/modules/scriptplay/scriptplay-knowledge-boundary.js";
import { createSinglePlayerScriptKillPackage } from "../../src/core/single-player-scriptkill/single-player-scriptkill-package.js";
import { createSinglePlayerScriptKillRun } from "../../src/core/single-player-scriptkill/single-player-scriptkill-runtime-state.js";
import fixture from "../fixtures/single-player-scriptkill-v2/ready-package.json" with { type: "json" };

test("simulated player speech cannot leak OOC/meta", () => {
  const pkg = createSinglePlayerScriptKillPackage(fixture);
  const run = createSinglePlayerScriptKillRun(pkg, { realPlayerRoleId: "role_writer" });
  const context = buildKnowledgeBoundaryContext({ packageData: pkg, runState: run, roleId: "role_doctor" });
  const bad = validateSimulatedPlayerSpeech("我是AI玩家，根据DM手册我知道真正凶手。", { ...context, channel: "public" });
  assert.equal(bad.ok, false);
});

test("prompt context separates simulated player and role but output rules enforce role-first", () => {
  const pkg = createSinglePlayerScriptKillPackage(fixture);
  const run = createSinglePlayerScriptKillRun(pkg, { realPlayerRoleId: "role_writer" });
  const simulatedPlayer = run.simulatedPlayers.find(p => p.assignedRoleId === "role_doctor");
  const ctx = buildSimulatedPlayerPromptContext({ packageData: pkg, runState: run, simulatedPlayer });
  assert.equal(ctx.role.roleName, "沈医生");
  assert.ok(ctx.outputRules.some(r => r.includes("不要泄露")));
  assert.ok(!JSON.stringify(ctx).includes("playerDisplayName"));
});
