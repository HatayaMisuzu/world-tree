import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.js", "utf8");

test("server wires alchemy planner to real LLM JSON adapter", () => {
  assert.match(server, /function parseAlchemyLlmJson/);
  assert.match(server, /async function runAlchemyLlmJson/);
  assert.match(server, /runLlmJson:\s*runAlchemyLlmJson/);
  assert.doesNotMatch(server, /runAlchemyLlmJson not wired/);
});

test("server exposes G1 alchemy generation route", () => {
  assert.match(server, /\/api\/alchemy\/generate-preview/);
  assert.match(server, /alchemyGenerationService\.generate/);
});

test("server exposes protected G1 alchemy routes", () => {
  const routeContracts = [
    ["GET", "/api/alchemy/capabilities", /getAlchemyCapabilities\(\)/],
    ["POST", "/api/alchemy/plan", /alchemyPlannerService\.plan/],
    ["POST", "/api/alchemy/generate-preview", /alchemyGenerationService\.generate/],
    ["POST", "/api/alchemy/localize", /alchemyLocalizerService\.buildInstallableFolderDraft/],
    ["POST", "/api/alchemy/deliver", /alchemyDeliveryService\.deliver/],
    ["GET", "/api/alchemy/deliveries", /alchemyDeliveryService\.listDeliveries/]
  ];

  for (const [method, path, handlerPattern] of routeContracts) {
    assert.match(server, new RegExp(`path === "${path}" && method === "${method}"`));
    assert.match(server, handlerPattern);
  }
});

test("server injects readJsonlTail into delivery service", () => {
  assert.match(server, /readJsonlTail/);
  assert.match(server, /alchemyDeliveryService\s*=\s*createAlchemyDeliveryService/);
});
