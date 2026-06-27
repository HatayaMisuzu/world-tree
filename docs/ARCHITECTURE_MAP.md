# Architecture Map — World Tree Pre-V2 Closure Baseline

> Scope: current implemented architecture after Stage 5 Closure and Stage 6 server runtime boundary extraction.  
> This document describes the current baseline. It must not describe future V2 plans as implemented systems.

## Status

World Tree is currently a local-first Node HTTP application with a browser console UI.

This is not full V2. It is the Pre-V2 Closure baseline.

## Top-Level Runtime

```text
Browser UI
  ↓ HTTP
server.js
  ↓
src/server/* services and helpers
  ↓
src/core/* engines, workflows, mode capsules, v2-ready substrate
  ↓
local JSON / JSONL persistence
```

## Layer Map

| Layer | Current Location | Owns | Must Not Own |
|---|---|---|---|
| Browser UI | `world-tree-console.js`, static files | User interaction, panels, client requests | Server persistence rules, canon authority |
| HTTP entry | `server.js` | server boot, route dispatch, API orchestration | Large reusable helpers already moved to `src/server/*` |
| HTTP response boundary | `src/server/http-response.js` | JSON response and error payload contract | Route business logic |
| HTTP request boundary | `src/server/http-request.js` | JSON body parsing, request-size failure | Route business logic |
| Local access boundary | `src/server/local-access.js` | local-only access checks and rate limit helpers | Route business logic |
| Server services | `src/server/*-service.js` | focused server-side domain services | UI rendering |
| Workflow layer | `src/core/workflows/` | workflow types, workflow readiness, workflow adapters | Mode-specific hidden truth |
| Mode capsule layer | `src/core/modes/`, `src/core/v2-ready/` | mode contracts, mode-specific readback, V2-ready sockets | Full mode engines unless explicitly implemented |
| Shared kernel | `src/core/kernel/`, related core services | shared turn/context/proposal support | Direct UI mutation |
| Persistence | local `userData` / `engine/worlds` / `branches` JSON/JSONL | save/load, runtime state, shared files | Direct canon mutation outside approved path |
| LLM integration | currently routed through server-side config/test/LLM calls | provider call and diagnostics | storage format ownership |
| Tests/scripts | `tests/`, `scripts/` | safety checks, smoke tests, audits | feature implementation |

## Current Server Boundary

Stage 6 extracted three stable server runtime boundaries:

```text
src/server/http-response.js
src/server/http-request.js
src/server/local-access.js
```

`server.js` still owns route dispatch and business orchestration. This is intentional.

## Current Warnings Baseline

As of Stage 6 Local Access Boundary:

```text
npm run asset:check       -> 0 warnings
npm run interface-audit   -> 0 warnings
npm run docs:check        -> 24 checks
npm run test:unit         -> 437 tests
npm run test:integration  -> 116 tests
npm run test:workflows    -> 66 tests
```

Update this section whenever the real command output changes.

## What Is Explicitly Not Complete

- Full V2 is not implemented.
- Full mode-specific gameplay engines are not implemented.
- `server.js` route dispatch is not fully split.
- `world-tree-console.js` is not yet split.
- Persistence format has not been redesigned.
- Proposal/canon authority model has not been rewritten.
- LLM adapter has not been deeply split.

## Maintenance Rule

Before changing this architecture, read:

```text
AI-GUIDE.md
docs/MAINTENANCE_ENTRY.md
docs/CURRENT_PROJECT_STATE.md
docs/archive/stage-reports/PRE_V2_CLOSURE_GATES.md
docs/API_ROUTE_INVENTORY.md
docs/MODE_BOUNDARY_MAP.md
```
