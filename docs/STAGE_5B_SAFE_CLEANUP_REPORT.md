# Stage 5B Safe Cleanup Report

## Result

| Item | Value |
|---|---|
| Status | **COMPLETE** |
| Branch | `hermes/pre-v2-closure` |
| Base | `0bd25f3` (Stage 5A) |
| Head | pending commit |
| Scope | Documentation-only cleanup: SCRIPTS_AND_CHECKS fix, INDEX update, ROADMAP_CANDIDATES historical annotation, P1 report archiving, workflow/workflows reference proof |

## Reality Check

### Files Read
- `package.json` — CONFIRMED: authoritative preflight chain (19 sub-commands)
- `docs/SCRIPTS_AND_CHECKS.md` — CONFIRMED: outdated preflight description (5 commands vs 19 actual)
- `docs/INDEX.md` — CONFIRMED: no duplicate milestone lines (already fixed in Stage 5A)
- `docs/ROADMAP_CANDIDATES.md` — CONFIRMED: missing Stage 4 V2-ready Foundation entry
- `docs/DOCUMENTATION_STATUS.md` — CONFIRMED: P1 files classified as `archived-design`, paths outdated after archive
- `docs/ARCHITECTURE_REALITY_CHECK.md` — CONFIRMED: Stage 5A mismatch notes
- `docs/TECH_DEBT_INVENTORY.md` — CONFIRMED: P1-1 (workflow/workflows), P1-2 (SCRIPTS_AND_CHECKS)
- `docs/DOCS_INVENTORY.md` — CONFIRMED: 11 P1 files listed as historical
- `docs/TESTS_INVENTORY.md` — CONFIRMED: test counts and coverage gaps

### Searches Run

| Search | Result |
|---|---|
| `SCRIPTS_AND_CHECKS` references | 10 references in 6 docs — all read-only, no import dependencies |
| `WORLD_TREE_*.md` files in `docs/` | 16 files found; 2 in INDEX.md (kept), 14 not indexed (archived) |
| `WORLD_TREE_.*P1` content references | 8 docs reference P1 files — DOCUMENTATION_STATUS classifies as `archived-design` |
| `src/core/workflow/` files | 2 files: `p3-context-builder.js`, `workflow-context-envelope.js` |
| `src/core/workflows/` files | 19 files (17 code + 2 subdirs) |
| `src/core/workflow` (no 's') references | 7 references — key: `tests/unit/workflow-context-envelope.test.js` imports from OLD dir |
| `p3-context-builder` references | 4 references — only in docs (no code/test imports) |
| `workflow-context-envelope` references | 21 references — dual imports: OLD (1 test) + NEW (3 tests + all workflows index/runner/router) |

### Assumptions Corrected
None. Stage 5A findings confirmed by additional searches.

## Changes Made

### `docs/SCRIPTS_AND_CHECKS.md` — Rewritten
- **Before**: 26 lines, outdated preflight (5 commands), no warnings recorded
- **After**: Full preflight chain (19 sub-commands from `package.json`), 10 scripts listed, test suite summary (595 total), known warnings documented
- **Evidence**: CONFIRMED against `package.json` scripts.preflight

### `docs/INDEX.md` — Updated
- Added `ARCHITECTURE_REALITY_CHECK.md` back to Stage 5A list
- Added `STAGE_5B_SAFE_CLEANUP_REPORT.md` entry
- Updated archive description: "历史设计/执行记录（含 P1 报告）"

### `docs/ROADMAP_CANDIDATES.md` — Historical Annotation
- Renamed "Completed: Real Play Productization 0-3" → "Completed (Historical)" with subsections
- Added "Universal Mode V2-ready Foundation Stage 4 (COMPLETED-PARTIAL, 2026-06-24)" entry
- No new future plans added, no existing candidates modified

### `docs/archive/` — P1 Reports Archived
- Created `docs/archive/p1-reports/`
- Moved 14 `WORLD_TREE_*.md` files (git mv, preserving history)
- Kept 2 files in `docs/` (indexed in INDEX.md as active references):
  - `WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md` — in "给 AI Agent" section
  - `WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_EXECUTION.md` — in "给维护者" section

### `docs/DOCUMENTATION_STATUS.md` — Paths Updated
- Line 43: `docs/WORLD_TREE_*_P1.md` → `docs/archive/p1-reports/`
- Lines 44-45: specific file paths updated to new archive location

## No Functional Changes

| Check | Status |
|---|---|
| `server.js` unchanged | ✅ CONFIRMED |
| `src/**` unchanged | ✅ CONFIRMED |
| `package.json` unchanged | ✅ CONFIRMED |
| `tests/**` unchanged | ✅ CONFIRMED |
| `scripts/**` unchanged | ✅ CONFIRMED |
| Functionality changed | ❌ No |

## Historical P1 Report Archive Proof

### Candidate Files
16 `WORLD_TREE_*.md` files found in `docs/`.

### References Found
- **INDEX.md**: references 2 files as active — kept in `docs/`
- **DOCUMENTATION_STATUS.md**: classifies P1 files as `archived-design` (not truth sources) — confirms safe to archive
- **LEGACY_REDUNDANCY_AUDIT.md**: references `docs/SCRIPTS_AND_CHECKS.md` and `docs/WORLD_TREE_LEGACY_ASSET_AUDIT_P1.md`
- **LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md**: references `docs/WORLD_TREE_LEGACY_ASSET_RENOVATION_PLAN_P1.md`

### Action Taken
- **Archived (14 files)**: All non-indexed `WORLD_TREE_*.md` files moved to `docs/archive/p1-reports/` via `git mv`
- **Kept (2 files)**: `WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md` and `WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_EXECUTION.md` remain in `docs/` (active INDEX references)
- **Updated references**: `DOCUMENTATION_STATUS.md` paths corrected

### Not Archived: N/A
All candidates that met the "no active truth-source reference" criterion were archived.

## workflow vs workflows Proof

### `src/core/workflow/` (OLD, 2 files)

| File | References |
|---|---|
| `p3-context-builder.js` | Only in docs (ASSET_MATURATION_REPORT, ARCHITECTURE_REALITY_CHECK, TECH_DEBT_INVENTORY). **No code/test imports.** |
| `workflow-context-envelope.js` | **1 active import**: `tests/unit/workflow-context-envelope.test.js` line 3 |

### `src/core/workflows/` (NEW, 19 files)

Key imports using the NEW path:
- `tests/unit/workflow-authority-gate.test.js` → `src/core/workflows/`
- `tests/unit/workflow-spine.test.js` → `src/core/workflows/`
- `src/core/workflows/index.js` → re-exports from `./workflow-context-envelope.js`
- `src/core/workflows/workflow-intent-router.js` → `./workflow-context-envelope.js`
- `src/core/workflows/workflow-runner.js` → `./workflow-context-envelope.js`
- `scripts/validate-workflow-integration.mjs` → checks `src/core/workflows/`

### Risk
- Both `workflow-context-envelope.js` files have different first-line comments: OLD says "Unified workflow context for safe turn orchestration", NEW says "W0 unified envelope"
- OLD directory still has 1 active test import — **cannot delete without updating test**
- `p3-context-builder.js` in OLD dir has zero code/test imports — likely orphaned

### Recommendation for Later Stage
- Stage 5C should: (a) update `tests/unit/workflow-context-envelope.test.js` to import from NEW path, (b) verify behavior equivalence between OLD and NEW `workflow-context-envelope.js`, (c) decide whether to keep or remove `p3-context-builder.js`, (d) remove OLD directory only after all references are migrated.

## Known Warnings

| Source | Count | Status |
|---|---|---|
| `npm run asset:check` | 11 | Pre-existing, non-blocking |
| `npm run interface-audit` | 8 | Pre-existing, non-blocking |
| **Total** | **19** | All pre-existing |

## Tests

| Command | Status | Details |
|---|---|---|
| `npm run docs:check` | PENDING | Will run before commit |
| `npm run check` | PENDING | Will run before commit |
| `git diff --check` | PENDING | Will run before commit |
| `npm run asset:check` | PENDING | Required (files moved) |
| `npm run test:workflows` | PENDING | Recommended |
| `npm run real-play:smoke` | PENDING | Recommended |

## Next Safe Step

Stage 5B is complete. Stage 5C (if pursued) would handle the workflow/workflows directory consolidation — updating the single test import and evaluating `p3-context-builder.js` for removal. **Do not run Stage 5C without a dedicated execution file.**
