import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkflowAction } from "../src/core/workflows/workflow-runner.js";
import { getWorkflowStatus, getWorkflowTypesResponse } from "../src/core/workflows/adapters/server-workflow-adapter.js";
import { buildRealPlayTurnContext } from "../src/core/real-play/turn-context.js";

function ensure(condition, message) { if (!condition) throw new Error(message); }

const SCENARIOS = {
  async "workflow-health"() {
    const status = getWorkflowStatus();
    const types = getWorkflowTypesResponse();
    ensure(status.workflowLayer === "active", "workflow layer is not active");
    ensure(status.services.length > 0, "workflow services list is empty");
    ensure(types.types.length > 0, "workflow types list is empty");
    return { services: status.services.length, workflowTypes: types.types.length, preflightProtected: status.preflightProtected };
  },
  async "creation-alchemy-play-loop"() {
    const creation = await runWorkflowAction({ explicitWorkflowType: "creation.start", modeId: "creation-forge", userInput: "建立一座雾港" });
    const alchemy = await runWorkflowAction({ explicitWorkflowType: "alchemy.digest", modeId: "creation-forge", userInput: "雾港素材摘要" });
    const play = await runWorkflowAction({ explicitWorkflowType: "play.turn", modeId: "world-rpg", userInput: "进入港口", options: { disableNetwork: true } });
    ensure(creation.canonWrites.length === 0 && alchemy.canonWrites.length === 0 && play.canonWrites.length === 0, "scenario attempted direct canon write");
    ensure(creation.candidates.length + alchemy.candidates.length + play.runtimeUpdates.length > 0, "scenario produced no candidate/runtime output");
    return { creationCandidates: creation.candidates.length, alchemyCandidates: alchemy.candidates.length, playRuntimeUpdates: play.runtimeUpdates.length, candidateOnly: true };
  },
  async "play-turn-offline"() {
    const play = await runWorkflowAction({ explicitWorkflowType: "play.turn", modeId: "world-rpg", userInput: "继续", options: { disableNetwork: true } });
    ensure(play.ok && play.runtimeUpdates.length > 0, "offline play turn failed");
    ensure(play.canonWrites.length === 0, "offline play turn wrote canon");
    return { visibleText: play.visibleText, runtimeUpdates: play.runtimeUpdates.length, canonWrites: 0 };
  },
  async "character-first-chat"() {
    const result = await runWorkflowAction({ explicitWorkflowType: "character.chat", modeId: "character", userInput: "你好，我们第一次见面。" });
    ensure(result.ok && result.canonWrites.length === 0, "character chat broke candidate-only boundary");
    ensure(result.runtimeUpdates.length > 0, "character chat did not emit runtime update");
    return { runtimeUpdates: result.runtimeUpdates.length, proposals: result.proposals.length, canonWrites: 0 };
  },
  async "mystery-minimal-loop"() {
    const context = buildRealPlayTurnContext({ modeId: "mystery-puzzle", input: "/clue 窗边泥脚印" });
    const result = await runWorkflowAction({ explicitWorkflowType: "mystery.investigate", modeId: "mystery-puzzle", userInput: "检查窗边线索" });
    ensure(context.publicState.mystery.discoveredClues.length === 1, "visible clue was not recorded");
    ensure(!JSON.stringify(context).includes("hiddenTruth"), "hidden truth leaked into scenario context");
    ensure(result.canonWrites.length === 0, "mystery loop wrote canon");
    return { discoveredClues: 1, candidates: result.candidates.length, hiddenTruthFiltered: true };
  },
  async "strategy-minimal-loop"() {
    const context = buildRealPlayTurnContext({ modeId: "strategy-sim", input: "/invest_military" });
    const result = await runWorkflowAction({ explicitWorkflowType: "strategy.turn", modeId: "strategy-sim", userInput: "整备防线" });
    ensure(context.commandResult?.authority === "runtime", "strategy resources did not stay in runtime");
    ensure(result.proposals.length > 0 && result.canonWrites.length === 0, "strategy proposal boundary failed");
    return { military: context.publicState.strategy.resources.military.value, proposals: result.proposals.length, canonWrites: 0 };
  }
};

export async function runScenario(name) {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`unknown scenario: ${name}`);
  const startedAt = Date.now();
  try { return { name, status: "PASS", durationMs: Date.now() - startedAt, details: await scenario() }; }
  catch (error) { return { name, status: "FAIL", durationMs: Date.now() - startedAt, error: error.message }; }
}

export async function runAllScenarios(names = Object.keys(SCENARIOS)) { return Promise.all(names.map(runScenario)); }
export function listScenarios() { return Object.keys(SCENARIOS); }

async function main() {
  const args = process.argv.slice(2);
  const scenarioIndex = args.indexOf("--scenario");
  const names = scenarioIndex >= 0 ? [args[scenarioIndex + 1]] : listScenarios();
  const results = await runAllScenarios(names);
  if (args.includes("--json")) console.log(JSON.stringify({ ok: results.every(item => item.status === "PASS"), results }, null, 2));
  else for (const result of results) console.log(`${result.status === "PASS" ? "✓" : "✗"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  if (results.some(item => item.status === "FAIL")) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
