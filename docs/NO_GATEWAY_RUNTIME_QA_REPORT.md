# No-Gateway Runtime QA Report — Repair Candidate

## Status

The Stage 7 report previously claimed a sealed PASS. The full local audit invalidated that aggregate claim because integration/preflight failed and tests mutated real `userData/`.

Current candidate: `0.4.0-pre-v2-closure.1`.

## Repair Validation Scope

- No browser gateway is used.
- Loopback HTTP root, health, status and config probes are permitted.
- Automated unit, integration, workflow, smoke, asset, interface and preflight gates are required.
- Repository-root `userData/config.json`, `connections.json`, `secrets.json` and `corrupt-files.jsonl` must retain their pre-test hashes.

## Static Runtime Truth

| File | Status |
|---|---|
| `world-tree-console.html` | root UI shell |
| `world-tree-console.css` | root UI styles |
| `world-tree-console.js` | root UI behavior |
| `index.html` | not present / not required |

## Current Evidence

The isolated No-Gateway probe returned HTTP 200, status `ok`, and runtime version `0.4.0-pre-v2-closure.1`. Both runtime data roots were temporary. The full automated sequence, including preflight, passed; the four protected real `userData/` files remained unchanged. Detailed results are recorded in `docs/PRE_V2_BLOCKER_REPAIR_REPORT.md`. Browser/visual QA remains `NOT RUN` in `docs/BROWSER_QA_REPORT.md`.

## Conclusion

This file does not claim a trusted seal. The repaired candidate is **READY_FOR_RE_AUDIT** because all required commands passed and userData hash invariance was proven; a future release seal still requires a separate audit decision.
