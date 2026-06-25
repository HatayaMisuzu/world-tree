// Tabletop V2 Server Routes Dedup Test
// Asserts no duplicate route registrations for Tabletop V2 API paths.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "..", "server.js");
const servicePath = join(__dirname, "..", "..", "src", "server", "tabletop-v2-service.js");
const detectiveServicePath = join(__dirname, "..", "..", "src", "server", "detective-v2-service.js");
const characterServicePath = join(__dirname, "..", "..", "src", "server", "character-capsule-service.js");

const serverContent = readFileSync(serverPath, "utf-8");
const serviceContent = readFileSync(servicePath, "utf-8");

// ALL expected Tabletop V2 API routes (single source of truth)
const TABLETOP_V2_ROUTES = [
  "/api/tabletop-v2/import-preview",
  "/api/tabletop-v2/import-commit",
  "/api/tabletop-v2/start",
  "/api/tabletop-v2/turn",
  "/api/tabletop-v2/save",
  "/api/tabletop-v2/branch",
  "/api/tabletop-v2/end-summary",
  "/api/tabletop-v2/runs",
  "/api/tabletop-v2/load-run",
  "/api/tabletop-v2/restore-save",
  "/api/tabletop-v2/switch-branch",
  "/api/tabletop-v2/export-run",
];

test("server.js: /api/tabletop-v2/start appears exactly once as route handler", () => {
  const matches = [...serverContent.matchAll(/\/api\/tabletop-v2\/start["']\s*&&\s*method/g)];
  assert.equal(matches.length, 1, `Expected 1 route registration for /api/tabletop-v2/start, found ${matches.length}`);
});

test("server.js: each Tabletop V2 API path is registered exactly once", () => {
  for (const route of TABLETOP_V2_ROUTES) {
    // Count occurrences of the route path followed by " && method"
    const escaped = route.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const regex = new RegExp(`${escaped}["']\\s*&&\\s*method`, 'g');
    const matches = [...serverContent.matchAll(regex)];
    assert.equal(matches.length, 1, `Route ${route} should appear exactly once, found ${matches.length}`);
  }
});

test("server.js: no Tabletop V2 route path appears without handler", () => {
  // Each path in TABLETOP_V2_ROUTES must be paired with an import from tabletop-v2-service
  for (const route of TABLETOP_V2_ROUTES) {
    assert.ok(
      serverContent.includes(route),
      `Route ${route} must appear in server.js`
    );
  }
});

test("tabletop-v2-service.js: all handler functions exist as named exports", () => {
  const expectedExports = [
    "previewTabletopV2Import",
    "commitTabletopV2Import",
    "startTabletopV2Run",
    "handleTabletopV2Turn",
    "saveTabletopV2Run",
    "branchTabletopV2Run",
    "endTabletopV2Run",
    "listTabletopV2Runs",
    "loadTabletopV2Run",
    "restoreTabletopV2Save",
    "switchTabletopV2Branch",
    "exportTabletopV2Run",
  ];

  for (const fnName of expectedExports) {
    const exportRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\b`, 'm');
    assert.ok(
      exportRegex.test(serviceContent),
      `Expected export async function ${fnName} in tabletop-v2-service.js`
    );
  }
});

test("no Detective/Character service calls Tabletop V2 service (reverse dependency check)", () => {
  if (readFileSync(detectiveServicePath, "utf-8").includes("tabletop-v2-service")) {
    assert.fail("Detective V2 service must not import Tabletop V2 service");
  }
  if (readFileSync(characterServicePath, "utf-8").includes("tabletop-v2-service")) {
    assert.fail("Character V2 service must not import Tabletop V2 service");
  }
  assert.ok(true, "No reverse dependencies detected");
});

test("tabletop-v2-service.js: all handler functions reference engine/tabletop-v2 paths only", () => {
  // Verify that tabletop-v2-service does not write to detective-v2 or character paths
  const forbiddenPaths = ["detective-v2", "character"];
  for (const fp of forbiddenPaths) {
    // Only check write paths (not comments)
    const writeRefs = [...serviceContent.matchAll(new RegExp(`engine[/\\\\]${fp}[/\\\\]`, 'gi'))];
    assert.equal(writeRefs.length, 0, `tabletop-v2-service.js must not reference engine/${fp}/`);
  }
});
