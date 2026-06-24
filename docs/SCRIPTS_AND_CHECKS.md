# Scripts & Checks

## Source of Truth

`package.json` is the authoritative source for all scripts. This document is a convenience reference and may be out of date — always verify against `package.json` for the canonical list.

## Common Commands

| Command | Purpose |
|---|---|
| `npm start` | Start local server (port 3000) |
| `npm run check` | Project syntax & structure check |
| `npm run docs:check` | Documentation completeness check |
| `npm run asset:check` | Asset inventory validation |
| `npm run test:unit` | All unit tests (416 tests) |
| `npm run test:integration` | All integration tests (119 tests) |
| `npm run test:workflows` | Workflow tests |
| `npm run workflow:check` | Workflow structure validation |
| `npm run real-play:smoke` | 6 offline scenario smoke tests |
| `npm run interface-audit` | API + file I/O interface audit (149 checks) |
| `npm run preflight` | Full pre-commit gate (19 sub-commands) |

## Full Preflight Chain

`npm run preflight` runs the following commands in order (from `package.json`):

1. `npm run audit` — dependency security audit
2. `npm run check` — project syntax & structure
3. `npm run docs:check` — documentation completeness (24 checks)
4. `npm run asset:check` — asset inventory validation
5. `npm run test:p0` — P0 Living World Kernel (7 tests)
6. `npm run test:p1` — P1 Experience Stability Kernel (8 tests)
7. `npm run test:p2` — P2 Long Play Kernel (40 tests)
8. `npm run test:kernel` — Kernel integration tests
9. `npm run test:prompts` — Prompt orchestration tests (42 tests)
10. `npm run test:legacy-mechanisms` — P3 M1-M11 tests (22 tests)
11. `npm run test:assets` — Asset status matrix tests
12. `npm run test:authority` — Authority policy tests
13. `npm run test:legacy-modernization` — Legacy modernization tests
14. `npm run test:workflow-readiness` — Workflow readiness tests
15. `npm run workflow:check` — Workflow structure validation
16. `npm run test:workflows` — Workflow unit + integration tests
17. `npm run test:unit` — All unit tests (416 tests)
18. `npm run test:integration` — All integration tests (119 tests)
19. `npm run interface-audit` — Interface audit (149 checks)

## Test Suite Summary

| Suite | Tests | Command |
|---|---|---|
| Unit | 416 | `npm run test:unit` |
| Integration | 119 | `npm run test:integration` |
| Workflows | dynamic | `npm run test:workflows` |
| **Total** | **619** | |

## Scripts Directory

| Script | Purpose |
|---|---|
| `scripts/check.mjs` | Project syntax & structure check |
| `scripts/test.mjs` | Main test entry (usage: `npm test`) |
| `scripts/audit.mjs` | Dependency security audit |
| `scripts/interface-audit.mjs` | API + file I/O interface audit (149 checks) |
| `scripts/check-docs.mjs` | Documentation completeness check (24 checks) |
| `scripts/validate-workflow-integration.mjs` | Workflow structure validation |
| `scripts/validate-asset-inventory.mjs` | Asset inventory validation |
| `scripts/check-legacy-status.mjs` | Legacy status check |
| `scripts/real-play-scenarios.mjs` | Offline scenario runner (6 scenarios) |
| `scripts/generate-knowledge-cards.mjs` | Knowledge card generation |

## Known Non-blocking Warnings

| Source | Count | Description |
|---|---|---|
| `npm run asset:check` | 0 | **RESOLVED in Stage 5E.** P3 M1-M11 exact references added to asset inventory. |
| `npm run interface-audit` | 0 | **RESOLVED in Stage 5H.** Mode-specific shared files now read back into `moduleData.modeSpecific`. |

All warnings are non-blocking (exit code 0).

As of Pre-V2 Closure Stage 5Z, `npm run preflight` passed on `hermes/pre-v2-closure`.
