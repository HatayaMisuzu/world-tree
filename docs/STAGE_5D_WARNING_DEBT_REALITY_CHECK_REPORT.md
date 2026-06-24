# Stage 5D Warning Debt Reality Check Report

## Result

| Item | Value |
|---|---|
| Status | **COMPLETE** |
| Branch | `hermes/pre-v2-closure` |
| Base | `4401594` (Stage 5C) |
| Head before Stage 5D | `4401594` |
| Scope | Inventory/report reconciliation + warning debt reality check |

## Reality Check

### Files Read
`docs/STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md`, `docs/TECH_DEBT_INVENTORY.md`, `docs/DOCS_INVENTORY.md`, `docs/TESTS_INVENTORY.md`, `docs/ARCHITECTURE_REALITY_CHECK.md`, `docs/SCRIPTS_AND_CHECKS.md`, `docs/INDEX.md`, `docs/DOCUMENTATION_STATUS.md`, `package.json`, `scripts/validate-asset-inventory.mjs`, `scripts/interface-audit.mjs`

### Commands Run
`git diff --name-status 8e67179..HEAD`, `npm run asset:check`, `npm run interface-audit`, `grep` for OLD workflow refs (confirmed zero post-Stage 5C)

### Assumptions Corrected
- CONFIRMED: Stage 5C OLD directory removal successful — `src/core/workflow/` no longer exists, zero code/test references
- CONFIRMED: TECH_DEBT_INVENTORY had stale fields (P1-1 had duplicate tables, old "Suggested action" lines; P1-2/P1-3 still showed OPEN)
- CONFIRMED: STAGE_5C report had PENDING test results that were actually PASS in final delivery

## Stage 5C Reconciliation

| Doc | Issue | Fix |
|---|---|---|
| `STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md` | Head = "pending commit"; Test table showed 6 rows as PENDING | Head → `4401594`; All PENDING → actual PASS results |
| `TECH_DEBT_INVENTORY.md` | P1-1 had duplicate tables + stale "Suggested action: Investigate"; P1-2/P1-3 still OPEN; P3 D1-D5 all still "Low" | P1-1 cleaned to single table; P1-2/P1-3 → RESOLVED; P3 table upgraded with Status/Stage columns, D1-D5 → RESOLVED, D6 → PARTIAL |
| `ARCHITECTURE_REALITY_CHECK.md` | Already updated in Stage 5C | No further change needed |
| `INDEX.md` | Missing Stage 5D entry | Added |

## Warning Debt Summary

| Source | Count | Exit Code | Blocking? | Nature |
|---|---|---|---|---|
| `npm run asset:check` | 11 | 0 | No | P3 M1-M11 inventory reference gaps |
| `npm run interface-audit` | 8 | 0 | No | shared/*.json write-not-read warnings |
| **Total** | **19** | | | All non-blocking |

## asset:check Warnings (11)

All 11 warnings share the same pattern: "Inventory missing P3 reference: M{X}-{name}".

| # | Warning | Evidence | Safe to fix now? | Action |
|---|---|---|---|---|
| 1 | M1-creation-wizard | `validate-asset-inventory.mjs` checks asset inventory file for P3 references | ✅ Yes — asset inventory file only | Deferred to dedicated asset inventory audit |
| 2 | M2-alchemy-digest | Same pattern | ✅ Yes | Deferred |
| 3 | M3-material-warehouse | Same pattern | ✅ Yes | Deferred |
| 4 | M4-character-kernel-v2 | Same pattern | ✅ Yes | Deferred |
| 5 | M5-cognition-matrix | Same pattern | ✅ Yes | Deferred |
| 6 | M6-faction-graph | Same pattern | ✅ Yes | Deferred |
| 7 | M7-world-rules | Same pattern | ✅ Yes | Deferred |
| 8 | M8-narrative-radar | Same pattern | ✅ Yes | Deferred |
| 9 | M9-random-events | Same pattern | ✅ Yes | Deferred |
| 10 | M10-macros | Same pattern | ✅ Yes | Deferred |
| 11 | M11-observability | Same pattern | ✅ Yes | Deferred |

**Root cause**: `scripts/validate-asset-inventory.mjs` validates against `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`. The inventory file lists P3 mechanisms but the validator expects additional reference links that are missing. This is a documentation inventory gap, not a code defect.

**Why deferred**: The asset inventory file (`WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`) needs targeted investigation to add the correct reference links to each M1-M11 mechanism. This is a documentation task best done with the original asset maturation context. Blindly adding links could create inaccurate references.

## interface-audit Warnings (8)

All 8 warnings share the same pattern: "shared/{mode}.json: createModule 写入但 buildModuleModel 不读取".

| # | Warning | Evidence | Safe to fix now? | Action |
|---|---|---|---|---|
| 1 | `shared/world_rpg.json` | `interface-audit.mjs` checks file I/O calibration | ❌ No — involves module persistence semantics | Deferred to dedicated architecture stage |
| 2 | `shared/world_threads.json` | Same pattern | ❌ No | Deferred |
| 3 | `shared/tabletop.json` | Same pattern | ❌ No | Deferred |
| 4 | `shared/strategy.json` | Same pattern | ❌ No | Deferred |
| 5 | `shared/murder_mystery.json` | Same pattern | ❌ No | Deferred |
| 6 | `shared/mystery.json` | Same pattern | ❌ No | Deferred |
| 7 | `shared/creation_forge.json` | Same pattern | ❌ No | Deferred |
| 8 | `shared/forge_blueprints.json` | Same pattern | ❌ No | Deferred |

**Root cause**: `interface-audit.mjs` detects that these shared JSON files are written by `createModule` but never read by `buildModuleModel`. This could indicate: (a) these files are write-only and intentionally used only by the create-path, (b) a genuine gap where `buildModuleModel` should read them but doesn't, or (c) the audit check is too strict for files that serve as structural scaffolding.

**Why deferred**: Fixing this requires understanding the module persistence architecture — specifically whether `buildModuleModel` should consume these files or whether they exist solely for project file structure. Changing this behavior could affect module loading, world creation, and save/load roundtrips. This needs a dedicated architecture investigation stage, not a documentation cleanup pass.

## Fixes Made

Only documentation fixes — no code touched:

| Fix | File |
|---|---|
| STAGE_5C report Head → `4401594` | `docs/STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md` |
| STAGE_5C test results PENDING → actual PASS | `docs/STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md` |
| TECH_DEBT P1-1 cleaned (duplicate tables removed) | `docs/TECH_DEBT_INVENTORY.md` |
| TECH_DEBT P1-2 → RESOLVED (Stage 5B) | `docs/TECH_DEBT_INVENTORY.md` |
| TECH_DEBT P1-3 → RESOLVED (Stage 5B) | `docs/TECH_DEBT_INVENTORY.md` |
| TECH_DEBT P3 D1-D5 → RESOLVED, D6 → PARTIAL | `docs/TECH_DEBT_INVENTORY.md` |
| TECH_DEBT header + P5 note updated | `docs/TECH_DEBT_INVENTORY.md` |
| INDEX Stage 5D entry added | `docs/INDEX.md` |

## Deferred Items

| Item | Why deferred | Risk if fixed blindly | Proposed dedicated stage |
|---|---|---|---|
| asset:check 11 warnings | Needs targeted asset inventory audit with original M1-M11 context | Creating inaccurate reference links | Future asset inventory reconciliation |
| interface-audit 8 warnings | Involves module persistence architecture — buildModuleModel vs createModule semantics | Breaking module loading, world creation, or save/load roundtrips | Dedicated architecture investigation |

## Tests

| Command | Status | Details |
|---|---|---|
| `npm run docs:check` | ✅ PASS | 24/24 |
| `npm run check` | ✅ PASS | WORLD_TREE_DESKTOP_CHECK PASS |
| `npm run asset:check` | ✅ PASS | 0 errors, 11 warnings (pre-existing) |
| `npm run interface-audit` | ✅ PASS | 141 passes, 8 warnings (pre-existing) |
| `npm run test:workflows` | ✅ PASS | 66/66 |
| `npm run real-play:smoke` | ✅ PASS | 6/6 |
| `git diff --check` | ✅ PASS | Clean |

## Boundary

| Check | Result |
|---|---|
| `src/**` changed? | ❌ No |
| `server.js` changed? | ❌ No |
| `package.json` changed? | ❌ No |
| `scripts/**` changed? | ❌ No |
| `tests/**` changed? | ❌ No |
| Functionality changed? | ❌ No |

## Next Safe Step

Stage 5D reconciles all Pre-V2 Closure documentation — debt inventory statuses, report test results, index entries, and the 19 warning debt reality. The remaining 19 warnings are either documentation inventory gaps (11 asset:check — safe to fix in a dedicated asset inventory pass) or module persistence architecture questions (8 interface-audit — require dedicated architecture investigation before any code change). No warnings block the current pre-v2-closure branch from review.
