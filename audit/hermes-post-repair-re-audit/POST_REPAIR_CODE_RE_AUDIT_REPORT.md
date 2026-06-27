# Post-Repair Code Re-Audit Report

> **Hermes Pre-V2 Closure Blocker Repair — Code-Level Re-Audit**
> Date: 2026-06-24
> Branch: `hermes/pre-v2-closure-blocker-repair`
> Decision: **READY_TO_MERGE_REPAIR** ✅

## Scope

This re-audit covers all code changes made in the repair branch relative to the audited baseline (`v0.4.0-pre-v2-closure` / commit `0ee1852`).

## P0: UserData Isolation

| Check | Result |
|-------|--------|
| `src/server/user-data-root.js` created | ✅ Provides `getUserDataRoot()` and `userDataPath()` with `WORLD_TREE_USER_DATA_DIR` env support |
| `server.js` userData paths migrated | ✅ All 8+ `join(ROOT, "userData", ...)` replaced with `userDataPath()`/`getUserDataRoot()` |
| `tests/integration/helpers/server-process.js` updated | ✅ Auto-creates temp `.userData` dir; sets `WORLD_TREE_USER_DATA_DIR` |
| `tests/integration/user-data-isolation.test.js` | ✅ 3/3 PASS; verifies real userData hashes unchanged after server + API calls |
| Real userData hashes before/after P0 tests | ✅ All 4 files unchanged |
| Real userData hashes before/after full test suite | ✅ All 4 files unchanged |

## P1: Request-Body Contract

| Check | Result |
|-------|--------|
| `req.destroy()` replaced with `req.resume()` | ✅ No socket destroy on body-too-large |
| `invalidJsonBodyError()` added | ✅ Returns 400 `INVALID_JSON_BODY` |
| `isPlainObject()` added | ✅ Rejects arrays, null, strings, numbers, booleans |
| `createReadBody({ requireObject })` default=true | ✅ Default strict; opt-out for array/scalar routes |
| Unit tests (http-request) | ✅ 10/10 PASS (including new non-object JSON tests) |
| Integration tests (security) | ✅ 8/8 PASS |

## P1: Creation-Forge Authority

| Check | Result |
|-------|--------|
| `module-service.js` early reject | ✅ `mode=creation-forge` → `{ status: "error", code: "MODE_PROJECT_CREATION_DISABLED" }` |
| Unit test (multi-mode-entry) | ✅ 40/40 PASS |
| Integration test (creation-forge-mode-v1) | ✅ 11/11 PASS; new "rejected" test passes |

## P1: Version/Release Truth

| Check | Result |
|-------|--------|
| `package.json` version | ✅ `0.4.0-pre-v2-closure.1` |
| `package-lock.json` versions (both) | ✅ `0.4.0-pre-v2-closure.1` |
| `app-manifest.json` | ✅ `_version: 0.4.0-pre-v2-closure.1` |
| `README.md` / `README.en.md` | ✅ Updated |
| `CHANGELOG.md` | ✅ New entry added |
| `AI-GUIDE.md` | ✅ Updated |
| `docs/RELEASE_SEAL_AUDIT_INVALIDATION_NOTE.md` | ✅ Created |
| `docs/CURRENT_PROJECT_STATE.md` | ✅ Status: AUDIT-INVALIDATED |
| `scripts/audit.mjs` | ✅ Enhanced: pre-release regex, app-manifest check, INDEX link check, port-race check |
| Old tag `v0.4.0-pre-v2-closure` | ✅ NOT moved or deleted |
| New tag created | ✅ None |

## P2: Truth/Gates

| Check | Result |
|-------|--------|
| `docs/INDEX.md` broken links | ✅ Removed (files do not exist) |
| `docs/RELEASE_NOTES` pending removed | ✅ Final commit filled |
| `docs/ASSET_CLASSIFICATION_TODO.md` | ✅ Created (21 PNGs, ~19.6MB) |
| `docs/DEBUGGING_GUIDE.md` port race | ✅ No longer claims "known port race" |

## Test Evidence

| Command | Result |
|---------|--------|
| `npm run audit` | 0 errors ✅ |
| `npm run docs:check` | 24 checks, 0 failures ✅ |
| `npm run check` | PASS ✅ |
| `node --test tests/unit/http-request.test.js` | 10/10 ✅ |
| `npm run test:unit` | 416/0 ✅ |
| `npm run test:integration` | 119/0 ✅ |
| `npm run test:workflows` | 0 fail ✅ |
| `npm run real-play:smoke` | 6/6 ✅ |
| `npm run asset:check` | PASS ✅ |
| `npm run interface-audit` | 149/0 ✅ |
| `git diff --check` | PASS ✅ |
| `npm pack --dry-run --json` | `world-tree@0.4.0-pre-v2-closure.1` ✅ |

## Boundary Confirmation

| Rule | Status |
|------|--------|
| userData committed? | NO ✅ |
| audit committed? | NO ✅ |
| main pushed? | NO ✅ |
| tag moved/deleted? | NO ✅ |
| new tag created? | NO ✅ |
| full V2 implemented? | NO ✅ |
| Browser QA used? | NO ✅ |

## Verdict

**READY_TO_MERGE_REPAIR** ✅

All P0/P1 blockers resolved. All tests pass. Real userData untouched. Old tag preserved. No new tag created. Boundary rules respected.
