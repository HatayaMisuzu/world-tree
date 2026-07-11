import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readServerSource } from "./lib/server-source.mjs";

const failures = [];
const server = readFileSync("server.js", "utf8");
const serverRuntime = readServerSource();
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const apiInventory = readFileSync("docs/API_ROUTE_INVENTORY.md", "utf8");

if (!existsSync("src/server/v2-product-playable-routes.js")) failures.push("missing V2 product route adapter");
if (!server.includes("createHttpApiRouter") || !serverRuntime.includes("handleV2ProductPlayableRoute")) failures.push("server entry does not delegate through bounded API/V2 route adapters");
if (!server.includes("listenOnAvailablePort") || !server.includes("createJsonFileTransaction")) failures.push("server composition root must delegate port selection and recoverable transactions");
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

const lineCaps = {
  "server.js": 2877,
  "src/adapters/llm.js": 863,
  "src/core/engine/director.js": 798,
  "src/server/tabletop-v2-service.js": 710,
  "src/core/engine/guardian.js": 708,
  "src/server/http-api-router.js": 665,
  "browser/controllers/play-controller.js": 641
};
for (const [file, cap] of Object.entries(lineCaps)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/).length - 1;
  if (lines > cap) failures.push(`${file} grew beyond architecture debt cap (${lines} > ${cap})`);
}

const importFanOut = (server.match(/^import\s/gm) || []).length;
if (importFanOut > 52) failures.push(`server.js import fan-out grew (${importFanOut} > 52)`);

function jsFiles(root, result = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) jsFiles(path, result);
    else if (entry.isFile() && entry.name.endsWith(".js")) result.push(path);
  }
  return result;
}

for (const file of jsFiles("src/core")) {
  const source = readFileSync(file, "utf8");
  if (/from\s+["'][^"']*(?:browser|server)[^"']*["']/.test(source)) failures.push(`core layer imports server/browser layer: ${file}`);
}

const routerSource = readFileSync("src/server/http-api-router.js", "utf8");
const directFsCalls = (routerSource.match(/\b(?:readFileSync|writeFileSync)\s*\(/g) || []).length;
if (directFsCalls > 6) failures.push(`http-api-router direct filesystem debt grew (${directFsCalls} > 6)`);

if (failures.length) {
  console.error("Architecture debt audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Architecture debt audit: PASS");
