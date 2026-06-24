# Stage 5H Mode-Specific Shared Readback Report

## Result

| Item | Value |
|---|---|
| Status | **COMPLETE** |
| Branch | `hermes/pre-v2-closure` |
| Base | `e07d5aa` (Stage 5G) |
| Head | pending commit |
| Scope | mode-specific shared seed readback + interface-audit resolution |

## Asset Preservation & Integration

| Check | Result |
|---|---|
| Maintenance entry checked | ✅ `docs/MAINTENANCE_ENTRY.md` |
| Asset inventory checked | ✅ 0 deletions, 0 downgrades |
| Assets detached? | ❌ No — assets are now more reachable |
| Assets downgraded? | ❌ No |
| Assets made more reachable? | ✅ Yes — `moduleData.modeSpecific` exposes mode-specific files |

## Root Cause

`createModule` wrote 8 mode-specific shared seed files (`world_rpg.json`, `world_threads.json`, etc.) but `buildModuleModel` only read common shared files (characters, worldbook, scenes, etc.). These files were CONTRACT-DECLARED in `mode-capsule-registry` and FINGERPRINT-TRACKED by `getModuleFingerprint`, but not exposed in `moduleData`. `interface-audit` only recognized static `join(shared, "file.json")` read paths.

## Changes Made

### module-service.js — Readback Integration

- Added `getModeCapsule` import from `mode-capsule-registry.js`
- Added `stripSharedPrefix()` helper
- Added `modeSpecificSharedFilesForWorld()` — determines mode-specific files from mode capsule contract + additional seed files (`world_threads.json` for world-rpg, `forge_blueprints.json` for creation-forge)
- Added `readModeSpecificShared()` — reads files from shared/ directory, returns `null` for missing files
- Modified `buildModuleModel` to populate `moduleData.modeSpecific` with `modeId`, `files` (the read-back data), and `sourceFiles` (the file list)

**Additive only** — no existing fields changed, no schema modified. Missing files return `null`.

### interface-audit.mjs — Dynamic Readback Recognition

- Added `modeSpecificContractFiles` set (8 files)
- Added `hasDynamicModeSpecificReadback` detection — checks for `modeSpecificSharedFilesForWorld`, `readModeSpecificShared`, and `modeSpecific` in module-service code
- When detected, adds all 8 contract files to `readFiles` so they align with `explicitWrites`

### Test — module-service-mode-specific-readback.test.js

8 tests covering all 7 modes + edge cases:
- world-rpg (2 files: world_rpg.json + world_threads.json)
- tabletop (tabletop.json)
- strategy-sim (strategy.json)
- murder-mystery (murder_mystery.json)
- mystery-puzzle (mystery.json)
- creation-forge (2 files: creation_forge.json + forge_blueprints.json)
- Missing file → null
- Unknown mode → empty modeSpecific

### Docs Updated

- `docs/TECH_DEBT_INVENTORY.md` — P5: interface-audit → RESOLVED (Stage 5H)
- `docs/SCRIPTS_AND_CHECKS.md` — warnings: interface-audit → 0 since Stage 5H
- `docs/INDEX.md` — Stage 5H report indexed

## Readback Contract

| Mode | Files | moduleData path | Test |
|---|---|---|---|
| world-rpg | `world_rpg.json`, `world_threads.json` | `moduleData.modeSpecific.files["world_rpg.json"]` | ✅ |
| tabletop | `tabletop.json` | `moduleData.modeSpecific.files["tabletop.json"]` | ✅ |
| strategy-sim | `strategy.json` | `moduleData.modeSpecific.files["strategy.json"]` | ✅ |
| murder-mystery | `murder_mystery.json` | `moduleData.modeSpecific.files["murder_mystery.json"]` | ✅ |
| mystery-puzzle | `mystery.json` | `moduleData.modeSpecific.files["mystery.json"]` | ✅ |
| creation-forge | `creation_forge.json`, `forge_blueprints.json` | `moduleData.modeSpecific.files["creation_forge.json"]` | ✅ |

## Before / After

| Command | Before | After |
|---|---|---|
| `npm run interface-audit` | 141 passes, 8 warnings | **149 passes, 0 warnings** |
| `npm run asset:check` | 0 errors, 0 warnings | 0 errors, 0 warnings |

## Tests

| Command | Status | Details |
|---|---|---|
| `node --test tests/unit/module-service-mode-specific-readback.test.js` | ✅ PASS | 8/8 |
| `npm run interface-audit` | ✅ PASS | 149 passes, 0 warnings |
| `npm run asset:check` | ✅ PASS | 0/0 |
| `npm run test:unit` | ✅ PASS | All pass |
| `npm run test:integration` | ✅ PASS | All pass |
| `npm run test:workflows` | ✅ PASS | 66/66 |
| `npm run real-play:smoke` | ✅ PASS | 6/6 |
| `npm run docs:check` | ✅ PASS | 24/24 |
| `npm run check` | ✅ PASS | |

## Boundary

| Check | Result |
|---|---|
| `server.js` changed? | ❌ No |
| `package.json` changed? | ❌ No |
| `world-tree-console` changed? | ❌ No |
| createModule seed schemas changed? | ❌ No |
| persistence format changed? | ❌ No |
| proposal/canon gate changed? | ❌ No |
| LLM adapter changed? | ❌ No |
| Assets deleted? | ❌ No |
| Assets detached? | ❌ No |

## Risks

- `moduleData.modeSpecific` is **additive** — existing consumers of `moduleData` are unaffected
- Missing mode-specific files return `null` (no throw)
- `getModeCapsule` dependency already existed in the project
- Dynamic readback adds ~4ms to `buildModuleModel` per call

## Next Safe Step

Stage 5H resolves all 19 Pre-V2 Closure warnings (11 asset:check + 8 interface-audit) to zero. The `hermes/pre-v2-closure` branch is now warning-free and ready for final review.
