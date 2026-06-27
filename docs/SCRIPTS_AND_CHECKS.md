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
| `npm run test:unit` | All unit test files under `tests/unit/*.test.js` |
| `npm run test:integration` | All integration test files under `tests/integration/*.test.js` |
| `npm run test:workflows` | Workflow tests |
| `npm run workflow:check` | Workflow structure validation |
| `npm run real-play:smoke` | 6 offline scenario smoke tests |
| `npm run interface-audit` | API + file I/O interface audit (149 checks) |
| `npm run preflight` | Full pre-commit gate (19 sub-commands) |

## Full Preflight Chain

`npm run preflight` runs the following commands in order (from `package.json`):

1. `npm run audit` — local project/release audit (`scripts/audit.mjs`)
2. `npm run check` — project syntax & structure
3. `npm run docs:check` — documentation completeness (24 checks)
4. `npm run asset:check` — asset inventory validation
5. `npm run test:p0` — P0 Living World Kernel (7 tests)
6. `npm run test:p1` — P1 Experience Stability Kernel (8 tests)
7. `npm run test:p2` — P2 Long Play Kernel (40 tests)
8. `npm run test:kernel` — Kernel integration tests
9. `npm run test:prompts` — Prompt orchestration tests
10. `npm run test:feature-alias` — Feature alias registry tests
11. `npm run test:llm-routing` — LLM routing contract tests
12. `npm run ux:check` — UX coherence audit
13. `npm run test:legacy-mechanisms` — P3 M1-M11 tests
14. `npm run test:assets` — Asset status matrix tests
15. `npm run test:authority` — Authority policy tests
16. `npm run test:legacy-modernization` — Legacy modernization tests
17. `npm run test:workflow-readiness` — Workflow readiness tests
18. `npm run workflow:check` — Workflow structure validation
19. `npm run test:workflows` — Workflow unit + integration tests
20. `npm run test:unit` — All unit test files under `tests/unit/*.test.js`
21. `npm run test:integration` — All integration test files under `tests/integration/*.test.js`
22. `npm run test:world-tree-v2-entries` — V2 entry closure tests
23. `npm run test:single-player-scriptkill-v2` — Single-player ScriptKill V2 tests
24. `npm run test:single-player-scriptkill-v2-audit` — Single-player ScriptKill V2 closure audit
25. `npm run test:project-complete-audit` — Complete project audit
26. `npm run interface-audit` — Interface audit

## Test Suite Summary

| Suite | Tests | Command |
|---|---|---|
| Unit files | dynamic | `npm run test:unit` |
| Unit cases | dynamic | `npm run test:unit 2>&1 \| grep -E '^# (tests\|pass\|fail)'` |
| Integration files | dynamic | `npm run test:integration` |
| Integration cases | dynamic | `npm run test:integration 2>&1 \| grep -E '^# (tests\|pass\|fail)'` |
| Workflows | dynamic | `npm run test:workflows` |
| **Total** | dynamic | Use command output; test files and test cases are different counts. |

## Scripts Directory

| Script | Purpose |
|---|---|
| `scripts/check.mjs` | Project syntax & structure check |
| `npm test` | Node.js native test runner (`node --test`) |
| `scripts/audit.mjs` | Local project/release audit: version facts, key files, directory structure, open-source hygiene, and docs/version drift |
| `scripts/interface-audit.mjs` | API + file I/O interface audit |
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

As of `v0.4.1-v2-entry-closure.0`, `npm run preflight` is the authoritative local gate. Its exact subcommands come from `package.json`; this document intentionally avoids hardcoded pass totals.

### V2 Gates: test:world-tree-v2-entries, test:single-player-scriptkill-v2, test:project-complete-audit
