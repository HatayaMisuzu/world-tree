import { existsSync, readFileSync } from "node:fs";

const failures = [];
const server = readFileSync("server.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const apiInventory = readFileSync("docs/API_ROUTE_INVENTORY.md", "utf8");

if (!existsSync("src/server/v2-product-playable-routes.js")) failures.push("missing V2 product route adapter");
if (!server.includes("handleV2ProductPlayableRoute")) failures.push("server.js does not call V2 product route adapter");
const adapterCallCount = (server.match(/handleV2ProductPlayableRoute/g) || []).length;
if (adapterCallCount < 2 || adapterCallCount > 3) failures.push(`unexpected V2 route adapter wiring count: ${adapterCallCount}`);
for (const dep of ["react", "vue", "svelte", "typescript"]) {
  if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) failures.push(`forbidden frontend/migration dependency added: ${dep}`);
}
if (!apiInventory.includes("/api/worldbook-v2/load") || !apiInventory.includes("/api/strategy-sim-v2/start")) failures.push("API inventory missing new product routes");
for (const file of ["docs/reports/llm-prompt-inventory.md", "docs/reports/architecture-debt-reduction-report.md"]) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}
if ((readFileSync("src/core/features/feature-alias-registry.js", "utf8").match(/id:/g) || []).length > 20) {
  failures.push("feature alias registry unexpectedly expanded");
}

if (failures.length) {
  console.error("Architecture debt audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Architecture debt audit: PASS");
