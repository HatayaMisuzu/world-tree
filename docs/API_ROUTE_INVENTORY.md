# API Route Inventory — World Tree Pre-V2 Closure Baseline

> This inventory reflects `server.js` in the `0.4.0-pre-v2-closure.1` repair candidate. It is not a future router design.
> Coverage: **84 method/path rows across 76 unique path patterns**, including the debug-only logs route. The inventory is source-grounded but route dispatch remains monolithic.

## Status

`server.js` still owns API route dispatch. Stage 6 did not split routes. Three infrastructure modules were extracted: `http-response.js`, `http-request.js`, `local-access.js`.

## Route Groups

| Group | Purpose | Current Owner |
|---|---|---|
| config | local config, secrets, LLM setup checks | `server.js` |
| examples/import | built-in examples and file import | `server.js`, import services |
| modules | module list/create/delete/finalize/build model | `server.js`, `module-service` |
| workflow | workflow status/readiness/adapters | `server.js`, `src/core/workflows` |
| kernel/proposal | kernel telemetry/proposals/state frame | `server.js`, kernel services |
| alchemy/materials | alchemy preview/material library/review | `server.js`, alchemy/mechanism services |
| character | character card CRUD, import, backup | `server.js` |
| worldbook | worldbook edit/test | `server.js` |
| turn | turn debug, status frames | `server.js` |
| export/import | world-pack, data export/import | `server.js` |
| debug/diagnostics | health, status, engine manifest | `server.js` |
| static | console and static assets | `server.js` |

## Inventory Table

| Method | Path | Group | Reads | Writes | Proposal/Canon Sensitive | Local Only | Handler |
|---|---|---|---|---|---|---|---|
| GET | `/api/config` | config | config.json | — | no | yes | `loadConfig` |
| POST | `/api/config` | config | config.json | config.json | no | yes | `saveConfig` |
| GET | `/api/secrets` | config | secrets.json | — | no | yes | `getSecretState` |
| POST | `/api/secrets/llm` | config | secrets.json | secrets.json | no | yes | `saveLlmSecret` |
| GET | `/api/secrets/llm-value` | config | secrets.json | — | no | yes | `getActiveLlmValue` |
| POST | `/api/llm/test` | config | secrets, config | — | no | yes | `testLlmConnection` |
| POST | `/api/llm/chat` | config | config, secrets | chat.jsonl | no | yes | `handleLlmChat` |
| GET | `/api/connections` | config | connections store | — | no | yes | `handleConnections` |
| POST | `/api/connections` | config | connections store | connections.json | no | yes | `handleConnections` |
| GET | `/api/modules` | modules | engine/worlds/ | — | no | yes | `listModules` |
| POST | `/api/modules/create` | modules | — | engine/worlds/ | no | yes | `createModule` |
| POST | `/api/modules/finalize-draft` | modules | engine/worlds/ | engine/worlds/ | no | yes | `finalizeDraftModule` |
| POST | `/api/modules/delete` | modules | engine/worlds/ | engine/worlds/ | no | yes | `deleteModule` |
| POST | `/api/modules/load` | modules | engine/worlds/ | — | no | yes | `buildModuleModel` |
| GET | `/api/modules/{id}/history` | modules | chat.jsonl | — | no | yes | `handleModuleHistory` |
| GET | `/api/examples` | examples | manifest.json | — | no | yes | `listExamples` |
| POST | `/api/examples/install` | examples | manifest.json | engine/worlds/ | no | yes | `installExample` |
| POST | `/api/workflow/run` | workflow | config, secrets | — | no | yes | `handleWorkflowApiRequest` |
| GET | `/api/workflow/types` | workflow | — | — | no | yes | `getWorkflowTypesResponse` |
| GET | `/api/workflow/status` | workflow | — | — | no | yes | `getWorkflowStatus` |
| GET | `/api/projects/{id}/kernel/summary` | kernel | shared/, runtime/ | — | no | yes | `getKernelSummary` |
| GET | `/api/projects/{id}/branches` | kernel | runtime/ | — | no | yes | `handleBranchOperation` |
| POST | `/api/projects/{id}/branches/create` | kernel | runtime/ | runtime/ | no | yes | `handleBranchOperation` |
| POST | `/api/projects/{id}/branches/{bid}/switch` | kernel | runtime/ | runtime/ | no | yes | `handleBranchOperation` |
| POST | `/api/projects/{id}/branches/{bid}/archive` | kernel | runtime/ | runtime/ | no | yes | `handleBranchOperation` |
| GET/POST | `/api/projects/{id}/branches/{bid}/diff` | kernel | runtime/ | — | no | yes | `handleBranchOperation` |
| GET | `/api/projects/{id}/telemetry/latest` | kernel | telemetry | — | no | yes | `getLatestKernelTelemetry` |
| POST | `/api/projects/{id}/telemetry/refresh` | kernel | telemetry | telemetry | no | yes | `refreshKernelTelemetry` |
| POST | `/api/projects/{id}/advance/auto-light` | kernel | — | — | no | yes | `previewAutoLight` |
| GET | `/api/projects/{id}/proposals/stop-loss` | kernel | proposals | — | yes | yes | `getKernelStopLoss` |
| POST | `/api/projects/{id}/proposals/{pid}/approve` | kernel | proposals | shared/ | yes | yes | `approveKernelProposal` |
| POST | `/api/projects/{id}/proposals/{pid}/reject` | kernel | proposals | — | yes | yes | `rejectKernelProposal` |
| POST | `/api/projects/{id}/proposals/{pid}/reverse` | kernel | proposals | proposals | yes | yes | `reverseKernelProposal` |
| POST | `/api/projects/{id}/processing/ingest` | kernel | — | processing | no | yes | `ingestProcessingMaterial` |
| GET | `/api/projects/{id}/processing/candidates` | kernel | processing | — | no | yes | `listProcessingCandidates` |
| POST | `/api/projects/{id}/processing/candidates/{cid}/deliver` | kernel | processing | processing | no | yes | `deliverProcessingById` |
| POST | `/api/alchemy/import` | alchemy | — | alchemy previews | no | yes | `handleAlchemyImport` |
| POST | `/api/alchemy/preview` | alchemy | — | alchemy previews | no | yes | `handleAlchemyPreviewAction` |
| POST | `/api/alchemy/refine` | alchemy | alchemy previews | alchemy previews | no | yes | `handleAlchemyPreviewAction` |
| POST | `/api/alchemy/commit` | alchemy | alchemy previews | review queue | no | yes | `handleAlchemyPreviewAction` |
| POST | `/api/alchemy/digest` | alchemy | — | — | no | yes | `handleAlchemyDigest` |
| GET | `/api/alchemy/review` | alchemy | review queue | — | no | yes | `handleAlchemyReview` |
| POST | `/api/alchemy/review` | alchemy | review queue | review queue | no | yes | `handleAlchemyReview` |
| POST | `/api/mechanisms/draft/from-alchemy` | alchemy | alchemy previews | mechanism drafts | no | yes | `handleMechanismDraftFromAlchemy` |
| GET | `/api/mechanisms/library` | alchemy | mechanism library | — | no | yes | `handleMechanismLibrary` |
| GET | `/api/mechanisms/world` | alchemy | mechanism world | — | no | yes | `handleMechanismWorld` |
| POST | `/api/mechanisms/world/commit-drafts` | alchemy | mechanism drafts | mechanism world | no | yes | `handleMechanismCommitDrafts` |
| GET | `/api/review/pending` | alchemy | review queue | — | no | yes | `handleReviewFacts` |
| POST | `/api/review/pending` | alchemy | review queue | review queue | no | yes | `handleReviewFacts` |
| POST | `/api/review/adopt` | alchemy | review queue | review queue | yes | yes | `handleReviewFacts` |
| POST | `/api/review/edit-and-adopt` | alchemy | review queue | review queue | yes | yes | `handleReviewFacts` |
| POST | `/api/review/reject` | alchemy | review queue | review queue | yes | yes | `handleReviewFacts` |
| GET | `/api/review/log` | alchemy | review log | — | no | yes | `handleReviewLog` |
| GET | `/api/characters` | character | engine/characters/ | — | no | yes | `listCharacters` |
| POST | `/api/characters/import` | character | — | engine/characters/ | no | yes | `handleCharacterImport` |
| POST | `/api/characters/update` | character | engine/characters/ | engine/characters/ | no | yes | `handleCharacterUpdate` |
| POST | `/api/characters/load` | character | engine/characters/ | — | no | yes | `parseCharacterCard` |
| POST | `/api/characters/delete` | character | engine/characters/ | engine/characters/ | no | yes | `handle` inline |
| POST | `/api/characters/backup` | character | engine/characters/ | characters-archive/ | no | yes | `handle` inline |
| GET | `/api/worldbook` | worldbook | engine/worlds/ | — | no | yes | `handleWorldbook` |
| POST | `/api/worldbook` | worldbook | — | engine/worlds/ | no | yes | `handleWorldbook` |
| POST | `/api/worldbook/test` | worldbook | — | — | no | yes | `handleWorldbookTest` |
| POST | `/api/chat/message` | turn | chat.jsonl | chat.jsonl | no | yes | `handleChatMessage` |
| GET | `/api/turn/debug` | turn | turn debug | — | no | yes | `handleTurnDebug` |
| GET | `/api/status/turn/latest` | turn | status frames | — | no | yes | `handleLatestTurnState` |
| GET | `/api/status/turns` | turn | status frames | — | no | yes | `handleTurnStateIndex` |
| GET | `/api/status/turn/{turnId}` | turn | status frames | — | no | yes | `handleTurnStateById` |
| GET | `/api/world-pack/export` | export | engine/worlds/ | — | no | yes | `handleWorldPackExport` |
| POST | `/api/world-pack/export` | export | engine/worlds/ | — | no | yes | `handleWorldPackExport` |
| POST | `/api/world-pack/import` | export | — | engine/worlds/ | no | yes | `handleWorldPackImport` |
| GET | `/api/data/export` | export | engine/worlds/ | — | no | yes | handler inline |
| POST | `/api/data/import` | import | — | engine/worlds/ | no | yes | handler inline |
| GET | `/api/overlay/pending` | debug | overlay queue | — | no | yes | `handleOverlayPending` |
| POST | `/api/overlay/pending` | debug | overlay queue | overlay queue | no | yes | `handleOverlayPending` |
| GET | `/api/dashboard/telemetry` | debug | engine/worlds/ | — | no | yes | `handleDashboardTelemetry` |
| GET | `/api/dashboard/entities` | debug | engine/worlds/ | — | no | yes | `handleDashboardEntities` |
| GET | `/api/dashboard/narrative` | debug | engine/worlds/ | — | no | yes | `handleDashboardNarrative` |
| GET | `/api/engine/manifest` | debug | engine modules | — | no | yes | handler inline |
| GET | `/api/worlds` | debug | engine/worlds/ | — | no | yes | handler inline |
| GET | `/api/status` | debug | — | — | no | yes | handler inline |
| GET | `/api/health` | debug | — | — | no | yes | handler inline |
| GET | `/api/plugins` | debug | plugins/ | — | no | yes | `handlePlugins` |
| POST | `/api/plugins` | debug | — | plugins/ | no | yes | `handlePlugins` |
| GET | `/api/debug/logs` | debug | in-memory debug buffer | — | no | yes | handler inline; requires `--debug` |

## Route Boundary Rule

Do not split these routes into files until this inventory is complete enough to answer:

- Which group owns the route?
- Does it read or write persistence?
- Does it touch proposal/canon?
- Does it affect assets?
- Which test proves behavior?

## Future Work

Future route extraction may create route group files, but that is not implemented in Stage 6 Closure.

### V2 Routes: /api/tabletop-v2/* /api/detective-v2/* /api/characters/v2/* /api/single-player-scriptkill-v2/*
