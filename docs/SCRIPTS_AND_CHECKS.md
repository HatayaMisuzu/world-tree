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
| `npm run test:unit` | All unit tests |
| `npm run test:integration` | All integration tests |
| `npm run test:workflows` | Workflow tests |
| `npm run workflow:check` | Workflow structure validation |
| `npm run real-play:smoke` | 6 offline scenario smoke tests |
| `npm run audit` | Project/release audit (local, not `npm audit`) |
| `npm run interface-audit` | API + file I/O interface audit |
| `npm run preflight` | Full pre-commit gate |

## Test Counts vs File Counts

Test file counts and test case/pass counts are different. The output of `npm run test:unit` and `npm run test:integration` is the authoritative source for current test case/pass counts — do not hardcode numbers in this document that will go stale.

- Unit files: `find tests/unit -maxdepth 1 -name '*.test.js'`
- Integration files: `find tests/integration -maxdepth 1 -name '*.test.js'`
- Unit case/pass counts: output of `npm run test:unit`
- Integration case/pass counts: output of `npm run test:integration`

## Full Preflight Chain

`npm run preflight` runs the full preflight chain from `package.json`. The exact command list is defined by `package.json` — the count of sub-commands may change as scripts are added or reorganized.

## Scripts Directory

| Script | Purpose |
|---|---|
| `scripts/check.mjs` | Project syntax & structure check |
| `scripts/test.mjs` | Main test entry (usage: `npm test`) |
| `scripts/audit.mjs` | Local project/release audit for version facts, key files, directory structure, open-source hygiene, and docs/version drift. It is not `npm audit` and does not perform dependency vulnerability scanning. |
| `scripts/interface-audit.mjs` | API + file I/O interface audit |
| `scripts/check-docs.mjs` | Documentation completeness check |
| `scripts/validate-workflow-integration.mjs` | Workflow structure validation |
| `scripts/validate-asset-inventory.mjs` | Asset inventory validation |
| `scripts/check-legacy-status.mjs` | Legacy status check |
| `scripts/real-play-scenarios.mjs` | Offline scenario runner (6 scenarios) |
| `scripts/generate-knowledge-cards.mjs` | Knowledge card generation |
| `scripts/verify-audit-reality.mjs` | Cross-platform audit reality checker |

## Known Non-blocking Warnings

| Source | Count | Description |
|---|---|---|
| `npm run asset:check` | 0 | **RESOLVED in Stage 5E.** P3 M1-M11 exact references added to asset inventory. |
| `npm run interface-audit` | 0 | **RESOLVED in Stage 5H.** Mode-specific shared files now read back into `moduleData.modeSpecific`. |

All warnings are non-blocking (exit code 0).

## V2 Gates

- `npm run test:world-tree-v2-entries`
- `npm run test:single-player-scriptkill-v2`
- `npm run test:single-player-scriptkill-v2-audit`
