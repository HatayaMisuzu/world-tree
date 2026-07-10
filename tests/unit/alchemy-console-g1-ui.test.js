import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBrowserSource } from "../../scripts/lib/browser-source.mjs";

const ui = readBrowserSource();
const clientCore = readFileSync("world-tree-client-core.js", "utf8");

test("client core exposes G1 alchemy API methods", () => {
  assert.match(clientCore, /alchemyCapabilities\(\)/);
  assert.match(clientCore, /alchemyPlan\(data\)/);
  assert.match(clientCore, /alchemyGeneratePreview\(data\)/);
  assert.match(clientCore, /alchemyLocalize\(data\)/);
  assert.match(clientCore, /alchemyDeliver\(data\)/);
});

test("console renders G1 creation map and target selection UI", () => {
  assert.match(ui, /function renderAlchemyG1Panel/);
  assert.match(ui, /创作地图/);
  assert.match(ui, /选择最终输出目标/);
  assert.match(ui, /data-alchemy-g1-target/);
});

test("console wires G1 actions", () => {
  assert.match(ui, /alchemy-g1-plan/);
  assert.match(ui, /alchemy-g1-generate-preview/);
  assert.match(ui, /alchemy-g1-localize/);
  assert.match(ui, /alchemy-g1-deliver/);
  assert.match(ui, /function alchemyG1Plan/);
  assert.match(ui, /function alchemyG1GeneratePreview/);
  assert.match(ui, /function alchemyG1Localize/);
  assert.match(ui, /function alchemyG1Deliver/);
});
