# PRE_V2_BLOCKER_REPAIR_REPORT

## Summary

- Branch: `codex/pre-v2-closure-blocker-repair`
- Head: repair branch tip at delivery (exact commit recorded in Git history and delivery response)
- Base audit head: `0ee1852feb9496755ecc27f722dbe672732c2d65`
- Repair status: **READY_FOR_RE_AUDIT**

## P0 UserData Isolation

- `WORLD_TREE_USER_DATA_DIR` implemented: yes
- All mutable server userData paths routed: yes; final source scan found only the centralized fallback plus logical export/test references
- Integration helper uses temp userData: yes
- Real repo userData hash unchanged after targeted and full tests: yes (4/4 files)
- Previous mutation recovery needed: user decision required; repair does not infer rollback values

## P1 Request Body Contract

| Case | Result |
|---|---|
| oversized Content-Length | targeted PASS |
| streaming oversized body | targeted PASS |
| malformed JSON | targeted PASS |
| array body | targeted PASS |
| null body | targeted PASS |
| scalar body | targeted PASS |
| empty body | targeted PASS |

## P1 creation-forge Authority

- Selected policy: deferred alchemy/workflow producer; not a normal persisted module
- Manifest: remains `PLANNED` and not visible
- Factory: rejects persisted creation-forge
- Server API: returns `MODE_PROJECT_CREATION_DISABLED`
- Tests: targeted unit/integration PASS
- Docs: mode boundary and play guide updated

## P1 Release / Version Truth

- Existing tag: `v0.4.0-pre-v2-closure` at base audit head
- Tag moved? no
- Tag deleted? no
- New tag created? no
- Selected repair version: `0.4.0-pre-v2-closure.1`
- package/runtime/docs/audit gate: aligned and validated

## P2 Repairs Included

- Broken links, route inventory, AI-GUIDE, README root UI structure, Browser QA status, asset classification and security notes updated.
- Final automated counts: unit 444/444, integration 117/117, workflows 66/66.

## Test Results

| Command | Result | Notes |
|---|---|---|
| `node --test tests/integration/user-data-isolation.test.js` | PASS | real userData invariant |
| `node --test tests/unit/http-request.test.js` | PASS | size and JSON-object contract |
| `node --test tests/integration/security.test.js` | PASS | 413 and invalid JSON bodies |
| `node --test tests/unit/multi-mode-entry.test.js` | PASS | deferred mode authority |
| `node --test tests/integration/creation-forge-mode-v1.test.js` | PASS | normal persisted creation rejected |
| `npm run docs:check` | PASS | documentation gate |
| `npm run check` | PASS | syntax/static gate |
| `npm run test:unit` | PASS | 444/444 |
| `npm run test:integration` | PASS | 117/117 |
| `npm run test:workflows` | PASS | 66/66 |
| `npm run real-play:smoke` | PASS | real-play scenarios |
| `npm run asset:check` | PASS | asset gate |
| `npm run interface-audit` | PASS | 149 pass, 0 warnings, 0 errors |
| `npm run preflight` | PASS | aggregate gate |
| `git diff --check` | PASS | no whitespace errors |
| `npm pack --dry-run --json` | PASS | package manifest validated |

No-Gateway health probe also returned HTTP 200, status `ok`, version `0.4.0-pre-v2-closure.1`, with both data and userData roots isolated to temporary directories.

## Remaining Risks

- Browser QA is NOT RUN.
- PNG owner classification remains pending; no assets were deleted.
- Previous local config/connection recovery remains a user decision.

## Recommendation

**READY_FOR_RE_AUDIT** — this repairs the known closure blockers but deliberately does not recreate, move, or bless a release tag.
