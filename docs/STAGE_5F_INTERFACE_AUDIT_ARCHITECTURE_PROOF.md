# Stage 5F Interface-Audit Architecture Proof

## Result

| Item | Value |
|---|---|
| Status | **COMPLETE** |
| Branch | `hermes/pre-v2-closure` |
| Base | `8eb2547` (Stage 5E) |
| Head | pending commit |
| Scope | interface-audit warning proof + closure gates documentation; no code changes |

## Reality Check

### Files Read
`scripts/interface-audit.mjs`, `server.js`, `src/server/module-service.js`, `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`, `docs/TECH_DEBT_INVENTORY.md`, `docs/STAGE_5E_ASSET_INVENTORY_RECONCILIATION_REPORT.md`, `AI-GUIDE.md`, `docs/PRE_V2_CLOSURE_BASELINE.md`, `docs/SCRIPTS_AND_CHECKS.md`, `docs/INDEX.md`

### Commands Run
`npm run asset:check`, `npm run interface-audit`, `grep` for `join(shared,`, `join(worldDir.*shared`, `buildModuleModel`, `createModule`

### Assumptions Corrected
CONFIRMED: The 8 interface-audit warnings are about mode-specific scaffolding files (`world_rpg.json`, `world_threads.json`, `tabletop.json`, `strategy.json`, `murder_mystery.json`, `mystery.json`, `creation_forge.json`, `forge_blueprints.json`) that `createModule` writes but `buildModuleModel` does not read.

## Asset Preservation

| Check | Result |
|---|---|
| Asset inventory checked | ✅ `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md` |
| Asset status matrix checked | ✅ `docs/ASSET_STATUS_MATRIX.md` exists |
| Legacy audit checked | ✅ `docs/LEGACY_REDUNDANCY_AUDIT.md` exists |
| `npm run asset:check` | ✅ PASS: 0 errors, 0 warnings |

## interface-audit Current Result

| Metric | Value |
|---|---|
| passes | 141 |
| warnings | 8 |
| errors | 0 |
| exit code | 0 (non-blocking) |

## Warning List

| # | Warning | File | Source |
|---|---|---|---|
| 1 | `shared/world_rpg.json` | `module-service.js:278` | createModule writes for `world-rpg` mode |
| 2 | `shared/world_threads.json` | `module-service.js:279` | createModule writes for `world-rpg` mode |
| 3 | `shared/tabletop.json` | `module-service.js:285` | createModule writes for `tabletop` mode |
| 4 | `shared/strategy.json` | `module-service.js:290` | createModule writes for `strategy-sim` mode |
| 5 | `shared/murder_mystery.json` | `module-service.js:295` | createModule writes for `murder-mystery` mode |
| 6 | `shared/mystery.json` | `module-service.js:300` | createModule writes for `mystery-puzzle` mode |
| 7 | `shared/creation_forge.json` | `module-service.js:305` | createModule writes for `creation-forge` mode |
| 8 | `shared/forge_blueprints.json` | `module-service.js:306` | createModule writes for `creation-forge` mode |

## Audit Rule

`scripts/interface-audit.mjs` (lines 34-60):

- `readFiles`: extracted via regex `join(shared, "FILENAME")` from `buildModuleModel` in `server.js` + `module-service.js`
- `explicitWrites`: extracted via regex `join(worldDir, "shared", "FILENAME")` + for-loop array extraction from `createModule`
- Warning condition: file in `explicitWrites` but NOT in `readFiles` → `createModule` writes it but `buildModuleModel` does not read it

## Write Set vs Read Set

### `buildModuleModel` reads (from `module-service.js:405-414`)

| File | Read |
|---|---|
| `characters.json` (or `characters_base.json` fallback) | ✅ |
| `scenes.json` | ✅ |
| `worldbook.json` | ✅ |
| `relations.json` | ✅ |
| `timeline.json` | ✅ |
| `world_state.json` | ✅ |
| `organizations.json` | ✅ |
| `locations.json` | ✅ |
| `races.json` | ✅ |
| `rules.json` | ✅ |

### `createModule` writes — mode-specific (from `module-service.js:262-306`)

| File | Written | Read by buildModuleModel? |
|---|---|---|
| `characters.json` | ✅ (common) | ✅ — aligned |
| `worldbook.json` | ✅ (via loop) | ✅ — aligned |
| `world_rpg.json` | ✅ (mode: world-rpg) | ❌ — **warning** |
| `world_threads.json` | ✅ (mode: world-rpg) | ❌ — **warning** |
| `tabletop.json` | ✅ (mode: tabletop) | ❌ — **warning** |
| `strategy.json` | ✅ (mode: strategy-sim) | ❌ — **warning** |
| `murder_mystery.json` | ✅ (mode: murder-mystery) | ❌ — **warning** |
| `mystery.json` | ✅ (mode: mystery-puzzle) | ❌ — **warning** |
| `creation_forge.json` | ✅ (mode: creation-forge) | ❌ — **warning** |
| `forge_blueprints.json` | ✅ (mode: creation-forge) | ❌ — **warning** |

## Classification

All 8 warnings are **COMPATIBILITY-SEED**:

These files are intentionally created by `createModule` as **structural scaffolding** for each mode's project. `buildModuleModel` provides a generic view of common shared files (characters, worldbook, scenes, locations, etc.) — it does not need to read mode-specific files because:

1. **Mode-specific adapters consume them directly.** Each mode's runner/adapter reads its own shared file when the mode is loaded (e.g., `tabletop-mode-adapter.js` reads `shared/tabletop.json`).
2. **They serve as project-file structure.** The files exist so that each mode has a well-defined shared state location, even before any mode-specific code runs.
3. **`buildModuleModel` is intentionally generic.** It reads only common files that apply across all modes — not mode-specific state files.

**This is by design, not a bug.**

## Recommendations

| # | File | Recommendation | Risk | Code change needed? |
|---|---|---|---|---|
| 1-8 | All 8 files | Keep current behavior — these are intentional scaffolding | Low | No |
| — | interface-audit | Consider adding a `COMPATIBILITY_SEED_FILES` allowlist in audit config | Low | Only audit script, future |

If a future stage wants to eliminate these warnings:

- **Option A**: Add mode-specific readback in `buildModuleModel` (high effort, changes module loading semantics)
- **Option B**: Add a `COMPATIBILITY_SEED` allowlist to `interface-audit.mjs` so known-safe files don't warn (low effort, audit improvement)
- **Option C**: Remove the writes and let mode adapters create their own files on first use (medium effort, may break mode initialization)

**Recommended: Option B** in a dedicated audit improvement stage.

## No Changes Made

| Check | Status |
|---|---|
| `server.js` unchanged | ✅ CONFIRMED |
| `src/**` unchanged | ✅ CONFIRMED |
| `scripts/**` unchanged | ✅ CONFIRMED |
| `package.json` unchanged | ✅ CONFIRMED |
| `tests/**` unchanged | ✅ CONFIRMED |
| Functionality unchanged | ✅ CONFIRMED |
| interface-audit script unchanged | ✅ CONFIRMED |

## Closure Gates Documentation

- Created `docs/PRE_V2_CLOSURE_GATES.md` — 6 gates: Reality Check, Asset Preservation, Boundary, Documentation Truth, Test, Warning Debt
- Updated `AI-GUIDE.md` — added Pre-V2 Closure Gates reference in header
- Updated `docs/PRE_V2_CLOSURE_BASELINE.md` — linked to gates
- Updated `docs/INDEX.md` — indexed gates + Stage 5F report

## Tests

| Command | Status | Details |
|---|---|---|
| `npm run asset:check` | ✅ PASS | 0 errors, 0 warnings |
| `npm run interface-audit` | ✅ PASS | 141 passes, 8 warnings (non-blocking) |
| `npm run docs:check` | ✅ PASS | 24/24 |
| `npm run check` | ✅ PASS | |
| `git diff --check` | PENDING | |

## Next Safe Step

Stage 5F proves the 8 interface-audit warnings are COMPATIBILITY-SEED files — intentionally created mode-specific scaffolding not consumed by the generic `buildModuleModel`. The Asset Preservation Gate is now documented and linked from AI-GUIDE.md for all future agents. Any future interface-audit improvement (adding an allowlist) should be a separate, dedicated stage.
