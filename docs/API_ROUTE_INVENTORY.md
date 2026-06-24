# API Route Inventory

> 当前 `server.js` 的路由清单，生成基线：2026-06-24。本文记录现状，不是未来 API 规划。

所有端点仅允许本机请求；带写操作的端点继续受路径安全、authority、proposal/review 或显式确认边界约束。

## Health, Config and LLM

- `GET /api/status`, `GET /api/health`
- `GET|POST /api/config`
- `GET /api/secrets`, `GET /api/secrets/llm-value`, `POST /api/secrets/llm`
- `POST /api/llm/test`, `POST /api/llm/chat`
- `GET|POST /api/connections`

`/api/secrets/llm-value` 只返回掩码状态；真实 key 仅在服务端调用链使用。

## Workflow

- `POST /api/workflow/run` — 执行 creation/alchemy/play/character/mystery/strategy 等 workflow；真实 LLM 仅在服务端配置和 key 同时存在时注入。
- `GET /api/workflow/types` — 当前可用 workflow 类型。
- `GET /api/workflow/status` — layer、service count 与 preflight 保护状态。

覆盖：`tests/integration/workflow-server-api.test.js`、`tests/integration/workflow-real-llm-adapter.test.js`、`tests/integration/real-play-scenarios.test.js`。

## Modules and Projects

- `GET /api/modules`
- `POST /api/modules/create`, `/api/modules/load`, `/api/modules/delete`, `/api/modules/finalize-draft`
- `GET /api/modules/:id/history`
- `GET /api/examples`, `POST /api/examples/install`
- `GET /api/worlds`

## Kernel Project Routes

动态前缀：`/api/projects/:projectId/`。

- `GET kernel/summary`, `GET branches`, `POST branches/create`
- `POST branches/:branchId/switch`, `POST branches/:branchId/archive`, `GET|POST branches/:branchId/diff`
- `GET telemetry/latest`, `POST telemetry/refresh`
- `POST advance/auto-light`
- `GET proposals/stop-loss`
- `POST proposals/:proposalId/approve`, `POST proposals/:proposalId/reject`, `POST proposals/:proposalId/reverse`
- `POST processing/ingest`, `GET processing/candidates`, `POST processing/candidates/:candidateId/deliver`

Approve 可写入受控 shared patch；reject/delay 不写 shared；reverse 只生成新的待审逆操作。

## Alchemy, Mechanisms and Review

- `POST /api/alchemy/import`, `/api/alchemy/preview`, `/api/alchemy/refine`, `/api/alchemy/commit`, `/api/alchemy/digest`
- `GET|POST /api/alchemy/review`
- `POST /api/mechanisms/draft/from-alchemy`
- `GET /api/mechanisms/library`, `GET /api/mechanisms/world`, `POST /api/mechanisms/world/commit-drafts`
- `GET|POST /api/review/pending`
- `POST /api/review/adopt`, `/api/review/edit-and-adopt`, `/api/review/reject`
- `GET /api/review/log`
- `GET|POST /api/overlay/pending`

## Character and Worldbook

- `GET /api/characters`
- `POST /api/characters/import`, `/api/characters/load`, `/api/characters/update`, `/api/characters/backup`, `/api/characters/delete`
- `GET|POST /api/worldbook`, `POST /api/worldbook/test`

## Chat, Status and Observability

- `POST /api/chat/message`
- `GET /api/turn/debug`, `GET /api/debug/logs`
- `GET /api/status/turn/latest`, `GET /api/status/turns`, `GET /api/status/turn/:turnId`
- `GET /api/dashboard/entities`, `/api/dashboard/narrative`, `/api/dashboard/telemetry`
- `GET /api/engine/manifest`

## Import and Export

- `GET|POST /api/world-pack/export`, `POST /api/world-pack/import`
- `GET /api/data/export`, `POST /api/data/import`

默认安全导出排除 chat、memory、state、debug、proposal/review/session、密钥和本地运行态；显式 runtime 导出仍需调用方主动选择。

## Historical / Deferred Candidates

当前 inventory 未声明 embedding、SQLite、plugin marketplace、SSE 或 V2 schema 路由。这些不属于本轮 active API。
