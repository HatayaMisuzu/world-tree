# Architecture Map — World Tree Current Baseline

> Scope: current implemented architecture.  
> This document describes the current baseline. It must not describe future V2 plans as implemented systems.

## Status

World Tree is currently a local-first Node HTTP application with a browser console UI.

Current baseline is `0.5.0-product-experience-rebuild.1`.

This is not full V2. Full product-wide V2 is NOT COMPLETE, and product-wide playable closure is NOT COMPLETE.

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
| Browser UI | `browser/`, `world-tree-console.js`, `world-tree-client-core.js`, static files | User interaction, views, controllers, local UI state, client API requests | Server persistence rules, canon authority |
| HTTP entry | `server.js` | server boot, non-V2 route dispatch, API orchestration | Large reusable helpers already moved to `src/server/*` |
| HTTP response boundary | `src/server/http-response.js` | JSON response and error payload contract | Route business logic |
| HTTP request boundary | `src/server/http-request.js` | JSON body parsing, request-size failure | Route business logic |
| Local access boundary | `src/server/local-access.js` | local-only access checks and rate limit helpers | Route business logic |
| Server services | `src/server/*-service.js` | focused server-side domain services | UI rendering |
| Workflow layer | `src/core/workflows/` | workflow types, workflow readiness, workflow adapters | Mode-specific hidden truth |
| Mode capsule layer | `src/core/modes/`, `src/core/v2-ready/` | mode contracts, mode-specific readback, V2-ready sockets | Full mode engines unless explicitly implemented |
| Shared kernel | `src/core/kernel/`, related core services | shared turn/context/proposal support | Direct UI mutation |
| Persistence | local `userData` / `engine/worlds` / `branches` JSON/JSONL | save/load, runtime state, shared files | Direct canon mutation outside approved path |
| Shared infrastructure | `src/shared/` | durable JSON primitives and cross-layer utilities | HTTP routing or domain orchestration |
| Transactions | `src/server/transactions/` | recoverable multi-file commit journals, startup recovery, and the shared config/secrets/connections coordinator | UI state or domain policy |
| Instance runtime | `src/server/app-runtime.js`, `src/server/single-instance-runtime.js` | ordered data-root and user-data-root leases, health-verified existing-instance reuse, safe port startup, and graceful lock release | full root disclosure or arbitrary process control |
| LLM integration | currently routed through server-side config/test/LLM calls | provider call and diagnostics | storage format ownership |
| Tests/scripts | `tests/`, `scripts/` | safety checks, smoke tests, audits | feature implementation |

## Current Server Boundary

The server entry now composes stable runtime boundaries:

```text
src/server/http-response.js
src/server/http-request.js
src/server/local-access.js
src/server/config-runtime.js
src/server/connection-runtime.js
src/server/static-shell.js
src/server/http-api-router.js
src/server/debug-log.js
src/server/app-runtime.js
src/server/single-instance-runtime.js
src/server/transactions/json-file-transaction.js
```

`server.js` retains dependency assembly and domain handlers that still need a later bounded service pass. Ordered data-root and user-data-root instance leases, safe port selection, recoverable connection-state transactions, non-V2 HTTP dispatch, static shell serving, configuration/secrets diagnostics, and connection-profile orchestration are bounded runtime modules. The connection transaction coordinator serializes config, secrets, and connection mutations; startup first recovers its journal, only removes a stale lock after parsing a valid record and confirming its PID is gone, and otherwise fails safe for incomplete or unverifiable locks. Architecture gates prevent the known hotspot files, import fan-out, route filesystem debt, and cross-layer imports from growing beyond the audited baseline.

API dispatch now flows through a bounded router and selected V2 adapter:

```text
server.js
  -> src/server/http-api-router.js
    -> src/server/v2-product-playable-routes.js
    -> worldbook-v2-product-service.js
    -> strategy-sim-v2-product-service.js
    -> tabletop-v2-routes.js
    -> detective-v2-routes.js
    -> single-player-scriptkill-v2-routes.js
    -> character-v2-routes.js
```

Worldbook V2 and Strategy Sim V2 still use their product service handlers. Tabletop V2, Detective V2, Single Player ScriptKill V2, and Character V2 dispatch lives in bounded route modules. Legacy paths retain the same request and response contracts through the new adapter.

## Current Frontend Boundary

`world-tree-console.js` is now a compatibility bootstrap: runtime seed state, app startup, top-level health refresh, and legacy global wiring. Product rendering and interaction code lives in bounded classic-script modules so existing no-build/static delivery remains compatible:

```text
browser/
├─ app/          canonical product presentation registry and navigation
├─ state/        reducer/store for navigation, project, save, and model state
├─ components/   feedback, forms, shared render primitives
├─ views/        core and creation/settings view composition
└─ controllers/  navigation, entry, play, content, settings, Character V2
```

`world-tree-client-core.js` remains the compatibility API/utility client boundary. The browser source manifest lets static audits inspect every extracted file without copying source back into the bootstrap. There is no TypeScript or framework migration.

## Current Machine Baseline

Version, Git HEAD, unit/integration test counts, and npm package counts are generated by `npm run facts:generate`; see [PROJECT_FACTS.md](PROJECT_FACTS.md). Active architecture documents must not hand-maintain these volatile values.

## What Is Explicitly Not Complete

- Full V2 is not implemented.
- Product-wide playable closure is not complete.
- Full mode-specific gameplay engines are not implemented.
- Several legacy domain handlers still live in `server.js`; route dispatch itself is extracted, while later service extraction remains backlog.
- Legacy globals remain for route, DOM, and `data-action` compatibility; a future pass may narrow them after the new controllers are stable.
- Persistence remains JSON/JSONL, now with durable same-path writes, read-modify-write coordination, and recoverable transactions for connection/config/secret state; other multi-file domains have not yet migrated to the transaction coordinator.
- Proposal/canon authority model has not been rewritten.
- LLM adapter has not been deeply split.
- TypeScript migration has not been started.

## Maintenance Rule

Before changing this architecture, read:

```text
AI-GUIDE.md
docs/MAINTENANCE_ENTRY.md
docs/CURRENT_PROJECT_STATE.md
docs/PRE_V2_CLOSURE_GATES.md
docs/API_ROUTE_INVENTORY.md
docs/MODE_BOUNDARY_MAP.md
```
