# Release Notes — World Tree v0.4.0 Pre-V2 Closure

> This release seals the Pre-V2 Closure baseline.  
> It is not full V2 and not v1.0.

## Version

```text
v0.4.0-pre-v2-closure
```

## Status

```text
Pre-V2 Closure baseline: SEALED
Full V2: NOT IMPLEMENTED
```

## Purpose

This release makes World Tree a cleaner, more stable, more maintainable baseline for future V2 design and implementation.

The goal was:

```text
clear old debt
reduce misleading redundancy
preserve current functionality
protect assets
make architecture easier to understand
make failures easier to diagnose
prove the project can run through no-gateway runtime QA
seal current documentation as current facts
```

## Stage 5 Summary — Safety, Debt Cleanup, Redundancy Closure

Completed:

```text
baseline inventory
technical debt inventory
documentation cleanup
legacy workflow cleanup
warning reconciliation
asset inventory reconciliation
asset preservation and integration gate
mode-specific shared readback
final Stage 5 metadata closure
```

Important outcomes:

```text
asset:check warnings reduced to 0
interface-audit warnings reduced to 0
Stage 5 landed on main
asset preservation and anti-orphaning rules documented
```

## Stage 6 Summary — Architecture Slimming, Maintainability, Diagnostics

Completed server runtime boundaries:

```text
src/server/http-response.js
src/server/http-request.js
src/server/local-access.js
```

Completed architecture and maintenance docs:

```text
docs/ARCHITECTURE_MAP.md
docs/MAINTENANCE_GUIDE.md
docs/DEBUGGING_GUIDE.md
docs/API_ROUTE_INVENTORY.md
docs/MODE_BOUNDARY_MAP.md
docs/STAGE_6_ARCHITECTURE_DIAGNOSTICS_CLOSURE_REPORT.md
```

Important outcomes:

```text
server.js infrastructure responsibilities reduced
route inventory documented from current server.js
mode boundaries documented as Pre-V2 baseline
debugging and maintenance entry points documented
```

## Stage 7 Summary — Product Usability Closure and Documentation Sealing

Completed:

```text
docs/USER_QUICKSTART.md
docs/LOCAL_LLM_SETUP.md
docs/PLAY_MODE_GUIDE.md
docs/NO_GATEWAY_RUNTIME_QA_REPORT.md
docs/PRE_V2_CLOSURE_REPORT.md
README links and current-state documentation updates
```

Important outcomes:

```text
No-Gateway Runtime QA completed
Browser gateway QA intentionally not used because gateway is unstable
user-facing startup and usage docs added
current limits documented
V2 misreading protections documented
```

## Test Baseline

Hermes must update this table with the final Stage 7Z run:

| Command | Result |
|---|---|
| `npm run docs:check` | ✅ PASS (24/24) |
| `npm run check` | ✅ PASS |
| `npm run test:unit` | ✅ PASS (437 tests) |
| `npm run test:integration` | ✅ PASS (116 tests) |
| `npm run test:workflows` | ✅ PASS (66 tests) |
| `npm run real-play:smoke` | ✅ PASS (6/6) |
| `npm run asset:check` | ✅ PASS (0/0) |
| `npm run interface-audit` | ✅ PASS (149/0/0) |
| `npm run preflight` | ✅ PASS (all 19 sub-commands, integration 119/0, interface-audit 149/0/0) |
| `git diff --check` | ✅ PASS |

Expected current baseline before final run:

```text
unit: 416
integration: 119
workflows: pass
real-play smoke: 6/6
asset:check: 0/0
interface-audit: 149/0/0
docs:check: 24/24
```

## Current Known Limits

This release does not complete:

```text
full V2
full mode-specific gameplay engines
full route split
world-tree-console.js split
persistence format redesign
proposal/canon rewrite
LLM adapter deep split
browser gateway QA
```

## V2-Ready Connection Points

Future V2 work can build on:

```text
mode capsule contracts
mode-specific shared readback
asset preservation and integration gates
workflow readiness layer
server runtime boundaries
API route inventory
architecture/maintenance/debugging guides
No-Gateway Runtime QA baseline
```

## Misreading Protection

Do not describe this release as:

```text
World Tree V2 complete
World Tree v1.0
all modes fully playable
full game product complete
```

Correct description:

```text
World Tree v0.4.0 Pre-V2 Closure baseline.
A stable, documented, maintainable foundation for future V2 work.
```

## Final Seal

### Original (audit-invalidated)

| Item | Value |
|---|---|
| Final branch | `main` |
| Final commit | `0ee1852` |
| Tag | `v0.4.0-pre-v2-closure` |
| Status | Audit-invalidated; preserved as historical marker |

### Repaired (trusted baseline)

| Item | Value |
|---|---|
| Trusted tag | `v0.4.0-pre-v2-closure.1` |
| Trusted commit / main head | `5cb48da` |
| Runtime/package version | `0.4.0-pre-v2-closure.1` |
| Preflight | PASS (all 19 sub-commands) |
| Integration | 119/0 PASS |
| Interface audit | 149/0/0 PASS |
| Browser QA | NOT RUN |
| Full V2 | NOT IMPLEMENTED |
