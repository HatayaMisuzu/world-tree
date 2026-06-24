# UserData Isolation Report

> **P0 Fix — World Tree Pre-V2 Blocker Repair**

## Problem

The integration test suite wrote into real `userData/config.json` and `userData/connections.json` because the server had no mechanism to redirect userData writes to a temp directory during tests.

## Solution

### 1. New module: `src/server/user-data-root.js`

Provides `getUserDataRoot(env)` and `userDataPath(...segments)`:
- Reads `WORLD_TREE_USER_DATA_DIR` env var for test isolation
- Falls back to `ROOT/userData` in normal operation

### 2. Migrated all paths in `server.js`

Replaced 8+ occurrences of `join(ROOT, "userData", ...)` with `userDataPath(...)` / `getUserDataRoot()`:
- `configPath()`, `secretsPath()`
- `CONNECTIONS_PATH()`, `REVIEW_QUEUE_PATH()`
- `PLUGINS_DIR()`, `TURN_DEBUG_DIR()`
- `plugins-state.json`, write-probe, ensureDir

### 3. Updated test helper

`tests/integration/helpers/server-process.js`: when `dataDir` is provided, auto-creates temp `.userData` directory and sets `WORLD_TREE_USER_DATA_DIR`.

### 4. New isolation test

`tests/integration/user-data-isolation.test.js` verifies:
- Real userData hashes unchanged after server start + API calls
- Test writes go to temp directory, not real userData

## Verification

| File | SHA256 (before) | SHA256 (after P0) | SHA256 (after full suite) |
|------|----------------|-------------------|--------------------------|
| config.json | `69174350...` | `69174350...` ✅ | `69174350...` ✅ |
| connections.json | `45576cfd...` | `45576cfd...` ✅ | `45576cfd...` ✅ |
| secrets.json | `85da36d8...` | `85da36d8...` ✅ | `85da36d8...` ✅ |
| corrupt-files.jsonl | `57420519...` | `57420519...` ✅ | `57420519...` ✅ |

All 4 files unchanged throughout repair and full test suite.
