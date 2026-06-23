// scripts/validate-asset-inventory.mjs
// Stage 0: validates module manifest, mode-module-map, inventory, and asset registry consistency
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Dynamic imports for ESM compatibility
const { MODULE_MANIFEST } = await import("../src/core/modules/module-manifest.js");
const { MODE_MODULE_MAP } = await import("../src/core/modes/mode-module-map.js");
const { MODULE_STATUS } = await import("../src/core/modules/module-contract.js");
const { buildAssetStatusRegistry, MATURATION_STATUS, classifyModuleAsset } = await import("../src/core/assets/asset-status-registry.js");

let errors = 0, warnings = 0;

function error(msg) { console.error(`❌ ${msg}`); errors++; }
function warn(msg) { console.warn(`⚠️ ${msg}`); warnings++; }
function ok(msg) { console.log(`✅ ${msg}`); }

// 1. Ensure every module in mode-module-map exists in module-manifest
ok("Checking mode-module-map module existence...");
for (const [modeId, modules] of Object.entries(MODE_MODULE_MAP)) {
  for (const modId of modules) {
    if (!MODULE_MANIFEST[modId]) {
      error(`mode ${modeId} references missing module: ${modId}`);
    }
  }
}

// 2. Build registry
ok("Building asset status registry...");
const p3Assets = [
  { id: "M1-creation-wizard", name: "Creation Wizard v2", sourcePath: "src/core/creation-wizard/", tested: true },
  { id: "M2-alchemy-digest", name: "Alchemy Digest Candidate Flow", sourcePath: "src/core/alchemy/alchemy-digest.js", tested: true },
  { id: "M3-material-warehouse", name: "Material Learning Warehouse", sourcePath: "src/core/materials/material-warehouse.js", tested: true },
  { id: "M4-character-kernel-v2", name: "Character Kernel v2", sourcePath: "src/core/character/character-kernel-v2.js", tested: true },
  { id: "M5-cognition-matrix", name: "Character Cognition Matrix", sourcePath: "src/core/cognition/cognition-matrix.js", tested: true },
  { id: "M6-faction-graph", name: "Organization / Faction Graph", sourcePath: "src/core/factions/faction-graph.js", tested: true },
  { id: "M7-world-rules", name: "World Rules Engine", sourcePath: "src/core/world-rules/world-rules-engine.js", tested: true },
  { id: "M8-narrative-radar", name: "Narrative Consistency Radar", sourcePath: "src/core/narrative-radar/narrative-consistency-radar.js", tested: true },
  { id: "M9-random-events", name: "Random Event Pool", sourcePath: "src/core/events/random-event-pool.js", tested: true },
  { id: "M10-macros", name: "Macro System", sourcePath: "src/core/macros/macro-registry.js", tested: true },
  { id: "M11-observability", name: "Observability Terminal", sourcePath: "src/core/observability/observability-packet.js", tested: true }
];
const promptAssets = [
  { id: "prompt-orchestration", name: "Prompt Orchestration Layer", sourcePath: "src/core/prompts/", tested: true }
];
const kernelAssets = [
  { id: "P0-living-world", name: "P0 Living World Kernel", sourcePath: "src/core/living-world/", tested: true },
  { id: "P1-experience-stability", name: "P1 Experience Stability Kernel", sourcePath: "src/core/experience-stability/", tested: true },
  { id: "P2-long-play", name: "P2 Long Play Kernel", sourcePath: "src/core/timeline/", tested: true }
];

const registry = buildAssetStatusRegistry({ moduleManifest: MODULE_MANIFEST, modeModuleMap: MODE_MODULE_MAP, p3Assets, promptAssets, kernelAssets });
ok(`Registry built: ${registry.summary.total} assets`);

// 3. Check prototype/declared are not user-exposed
const prototypes = registry.assets.filter(a => a.maturationStatus === MATURATION_STATUS.PROTOTYPE_HOLD);
const declared = registry.assets.filter(a => a.maturationStatus === MATURATION_STATUS.DECLARED_HOLD);
ok(`Prototype-hold: ${prototypes.length}, Declared-hold: ${declared.length}`);
for (const a of prototypes) {
  if (a.userExposureAllowed) error(`prototype ${a.id} marked userExposureAllowed=true`);
}
for (const a of declared) {
  if (a.userExposureAllowed) error(`declared ${a.id} marked userExposureAllowed=true`);
}

// 4. Check P3 M1-M11 all present
for (const p3 of p3Assets) {
  const found = registry.assets.find(a => a.id === p3.id);
  if (!found) error(`P3 asset missing from registry: ${p3.id}`);
}
ok("P3 M1-M11: all present");

// 5. Inventory coverage check
const inventoryPath = join(ROOT, "docs", "WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md");
if (existsSync(inventoryPath)) {
  const text = readFileSync(inventoryPath, "utf8");
  ok("Inventory file exists");
  for (const p3 of p3Assets) {
    if (!text.includes(p3.id)) warn(`Inventory missing P3 reference: ${p3.id}`);
  }
} else {
  error("Inventory file missing: docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md");
}

// 5. Summary
console.log(`\n=== Result: ${errors} errors, ${warnings} warnings ===`);
if (errors > 0) {
  console.log("STATUS: FAIL");
  process.exit(1);
}
console.log("STATUS: PASS");
