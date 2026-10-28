import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SIM_DM_INSTRUCTION } from "../../src/core/engine/sim-dm-instruction.js";
import {
  buildWriterPacket,
  DEFAULT_ENGINE_STATE,
  normalizeEngineState
} from "../../src/core/world-engine.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("SIM_DM_INSTRUCTION is a non-empty Chinese DM prompt", () => {
  assert.equal(typeof SIM_DM_INSTRUCTION, "string");
  assert.ok(SIM_DM_INSTRUCTION.includes("模拟经营"));
  assert.ok(SIM_DM_INSTRUCTION.includes("周期报告"));
});

test("world-engine strategy-sim writer path still embeds SIM_DM_INSTRUCTION", () => {
  const engineState = normalizeEngineState({ ...DEFAULT_ENGINE_STATE, modeId: "strategy-sim" });
  const packet = buildWriterPacket({
    model: {},
    input: "查看资源",
    engineState,
    directionPacket: null
  });
  assert.equal(typeof packet, "string");
  assert.ok(packet.includes(SIM_DM_INSTRUCTION.slice(0, 40)));
  assert.ok(packet.includes("经营报告者"));
});

test("engine/sim.js is archived; no product re-export as sim", () => {
  assert.equal(existsSync(resolve(root, "src/core/engine/sim.js")), false);
  assert.equal(existsSync(resolve(root, "archive/src/core/engine/sim.js")), true);
  const we = readFileSync(resolve(root, "src/core/world-engine.js"), "utf8");
  assert.equal(/export\s*\*\s*as\s+sim\b/.test(we), false);
  assert.equal(/from\s+["']\.\/engine\/sim\.js["']/.test(we), false);
  assert.ok(we.includes('from "./engine/sim-dm-instruction.js"'));
});
