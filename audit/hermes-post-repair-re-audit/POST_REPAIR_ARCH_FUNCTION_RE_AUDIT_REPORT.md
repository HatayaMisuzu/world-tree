# Post-Repair Architecture & Function Re-Audit Report

> **Hermes Pre-V2 Closure Blocker Repair — Architecture & Function Re-Audit**
> Decision: **READY_TO_MERGE_REPAIR** ✅

## Architecture Impact Assessment

### user-data-root.js (NEW)

- **Layer**: Server infrastructure (alongside http-request.js, http-response.js, path-security.js)
- **Dependency direction**: server.js → user-data-root.js (correct: infrastructure consumed by entry point)
- **No new runtime deps**: Only `node:path` and `node:url` (Node built-ins)
- **Test isolation**: `WORLD_TREE_USER_DATA_DIR` env var provides clean separation from real userData
- **Backward compat**: Default behavior unchanged when env var absent (falls back to `ROOT/userData`)

### http-request.js (MODIFIED)

- **Breaking change**: `readJsonBody` and `createReadBody` now default `requireObject=true`
- **Risk**: Any route that previously accepted array/scalar bodies in JSON POST would now get `INVALID_JSON_BODY`
- **Mitigation**: All current routes expect JSON objects; `requireObject: false` opt-out available
- **Socket safety**: `req.destroy()` → `req.resume()` prevents response socket disruption

### server.js (MODIFIED)

- **Changed paths**: 8+ userData path constructions migrated to `userDataPath()`
- **No behavioral change**: Same paths computed; env var simply redirects to temp dir
- **No new imports beyond user-data-root.js**

### module-service.js (MODIFIED)

- **Added gate**: Early return at `createModule()` for `mode=creation-forge`
- **Impact**: Server API no longer persists creation-forge modules
- **Consistency**: Aligns with `mode-manifest.js` PLANNED status and `assertModeProjectCanBeCreated()`

## Functional Verification

| Function | Pre-repair | Post-repair |
|----------|-----------|-------------|
| userData isolation | ❌ Tests polluted real userData | ✅ Temp dir isolation |
| oversized body | ❌ `fetch failed` (socket destroy) | ✅ 413 JSON |
| malformed JSON | ❌ Not checked | ✅ 400 INVALID_JSON |
| non-object JSON | ⚠️ Not checked | ✅ 400 INVALID_JSON_BODY |
| creation-forge create | ❌ Allowed (contradicts PLANNED) | ✅ Rejected with code |
| version truth | ❌ 0.3.1 vs v0.4.0 tag conflict | ✅ Unified 0.4.0-pre-v2-closure.1 |
| audit regex | ❌ Couldn't match pre-release versions | ✅ Enhanced |

## No Regression Detected

- All existing unit tests (416) continue to pass
- All integration tests (119) pass after version update in health.test.js
- Workflow tests, smoke tests, asset check, interface audit all pass
- Real userData files unchanged (hash-verified before/after)

## Verdict

**READY_TO_MERGE_REPAIR** ✅ — Architecture boundaries respected. No new P0/P1 issues introduced.
