# Workflow Service Deepening Report

> 替代 WORKFLOW_INTEGRATION_REPORT (79fa10f) 中的旧 Remaining Limitations。

## Result: PASS

## Commit Chain

| Commit | Content |
|--------|---------|
| `6bfb302` | Service Deepening — character/mystery/strategy use real M4-M8 |
| `84b4374` | result-schema ok fix + runner deps + output-router errors |
| `7aea1dc` | server.js workflow HTTP endpoints (/api/workflow/run/types/status) |
| `397e35c` | LLM adapter wired to server config + console workflow panel |

## Services Deepened

| Service | Before | After | Mechanisms Used |
|---------|--------|-------|-----------------|
| character | stub | real | M4 Character Kernel v2 + M5 Cognition + M8 Radar |
| mystery | stub | real | M5 Cognition + M7 Rules + M8 Radar + truth lock |
| strategy | stub | real | M6 Faction Graph + M7 Rules + M8 Radar |
| play-turn | prompt-only | real | LLM adapter (real/fake/fallback) + radar post-check |

## Server / API

- `POST /api/workflow/run` — returns normalized workflow results via safe adapter
- `GET /api/workflow/types` — returns active workflow types (prototype/declared hidden)
- `GET /api/workflow/status` — returns workflowLayer, services, preflightProtected

## Console / UI

- `renderWorkflowPanel()` — workflow debug panel with status resume, services list
- API status loading via `updateHealth()`
- Visible mount verification deferred to productization

## Safety

| Check | Result |
|-------|:---:|
| Normal workflow canon write blocked | PASS |
| hiddenTruth / private / system_only redacted | PASS |
| Major changes become proposal/candidate | PASS |
| LLM adapter fallback on failure | PASS |
| Prototype/declared not exposed | PASS |

## Remaining Productization Work

- Console workflow panel visible mount verify
- Real-play smoke scenarios
- Scenario runner
- Complete creation/alchemy/play-turn loop validation

## Historical Note

WORKFLOW_INTEGRATION_REPORT (79fa10f) listed these as remaining limitations — all now resolved:
- "character/mystery/strategy are stubs" → deepened with real M4-M8
- "play-turn doesn't call real LLM" → LLM adapter with real/fake/fallback
- "server.js has no workflow API" → /api/workflow/run/types/status
- "console has no workflow panel" → renderWorkflowPanel + data loading
