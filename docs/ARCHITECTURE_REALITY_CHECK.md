# Architecture Reality Check

> Stage 5A: 当前真实架构地图。基于实际文件读取和目录扫描，不做理想化设计。
> 如果某模块在代码中存在但在本文未提及，请以其真实存在为准。

## Entry Flow

```
Browser → http://127.0.0.1:3000
  → server.js (HTTP, 3209 lines)
    → Static: world-tree-console.html + .css + .js
    → API Routes:
      ├── /api/status, /api/health, /api/config, /api/secrets, /api/llm
      ├── /api/workflow/* (run/types/status)
      ├── /api/modules/*, /api/projects/:id/*
      ├── /api/characters/*, /api/worldbook/*
      ├── /api/creation-forge/*
      ├── /api/alchemy/*, /api/mechanisms/*, /api/review/*
      ├── /api/overlay/*, /api/chat/*, /api/debug/*
      ├── /api/kernel/*, /api/engine/*
      ├── /api/world-pack/*, /api/data/*
      └── /api/connections
    → Core Layer:
      server.js imports from src/core/ and src/server/
```

## Server Layer (`server.js`)

- 3209 行单体 HTTP 服务器
- 所有路由、中间件（rate limiting, CORS, body parsing）、请求处理都在同一文件
- 导入 40+ 个模块从 `src/server/` 和 `src/core/`
- Rate limiting: 120 req/min API, 300 req/min static
- Body limit: 20 MB (configurable via `WORLD_TREE_MAX_BODY_BYTES`)
- `--debug` flag 启用调试日志缓冲区
- 安全：仅接受本地请求

**重要：server.js 未做路由拆分。任何路由修改必须小心。**

## Console Layer

| File | Lines | Role |
|---|---|---|
| `world-tree-console.html` | 59 | HTML shell: sidebar + topbar + main + debug panel + toast host |
| `world-tree-console.css` | 272 | CSS variables theme, layout, components |
| `world-tree-console.js` | 2360 | Single-file frontend: API client, navigation, all views (workbench/chat/library/worlds/observe/settings) |

前端是单体 JS 文件，未做 ES module 拆分。deferred plugin system 默认关闭。

## Core Layer (`src/core/`)

200+ 文件，主要模块组：

### Mode Capsules (8 modes)

| Mode | Directory | Key Files |
|---|---|---|
| quick-setting | `src/core/quick-setting/` | `raw-setting-intake.js` |
| character | `src/core/character/` | `character-kernel-v2.js`, `character-card-parser.js`, `character-ooc-checker.js`, `emotional-inertia.js` |
| worldbook/world-rpg | `src/core/worldbook/` | `index.js`, `worldbook-candidate-detector.js`, `worldbook-growth-tree.js`, `worldbook-trigger-engine.js` |
| grand-world | `src/core/grand-world/` | `grand-world-mode-adapter.js`, `grand-world-turn-planner.js`, `grand-world-state.js` |
| tabletop | `src/core/tabletop/` | `tabletop-mode-adapter.js`, `dice.js`, `tabletop-state.js` |
| mystery-puzzle | `src/core/mystery-puzzle/` | `mystery-puzzle-mode-adapter.js`, `clue-board.js`, `mystery-puzzle-state.js` |
| strategy-sim | `src/core/strategy-sim/` | `strategy-sim-mode-adapter.js`, `resource-panel.js`, `strategy-sim-state.js` |
| murder-mystery | `src/core/murder-mystery/` | `murder-mystery-mode-adapter.js`, `murder-mystery-state.js` |
| creation-forge | `src/core/creation-forge/` | 15+ files: intake, blueprint, instantiate, validator, exporter, schema, questioning, module-integration |

### V2-ready Substrate (`src/core/v2-ready/`)

8 个模块文件：
- `universal-metadata.js` — 通用 metadata normalizer (12 fields)
- `visibility-policy.js` — 可见性过滤 (5 levels)
- `lifecycle-state.js` — 生命周期/canon gate
- `mode-capability-contract.js` — 8 模式能力声明
- `relation-record.js` — 轻量关系记录
- `time-binding.js` — 轻量时间绑定
- `v2-ready-normalizer.js` — 聚合 normalizer
- `v2-ready-validator.js` — 安全校验

### Workflow Layer (`src/core/workflows/`)

主目录 17 文件：
- `workflow-types.js`, `workflow-result-schema.js`, `workflow-context-envelope.js`
- `workflow-intent-router.js`, `workflow-authority-gate.js`, `workflow-output-router.js`
- `workflow-observability.js`, `workflow-runner.js`, `index.js`
- `adapters/`: `server-workflow-adapter.js`, `llm-workflow-adapter.js`, `console-workflow-adapter.js`
- `services/`: `creation-*`, `alchemy-*`, `play-turn-*`, `character-*`, `mystery-*`, `strategy-*`, `direction-*`

⚠️ 存在 `src/core/workflow/` 旧目录（2 文件：`p3-context-builder.js`, `workflow-context-envelope.js`），可能是 `workflows/` 的残留。

### Persistence / Save Boundary

| Component | Location |
|---|---|
| Save system | `src/core/system/world-tree-save-system.js` |
| Proposal bus | `src/core/system/proposal-bus.js` |
| Engine snapshot | engine state persistence via `src/core/engine/state-persistence.js` |
| Overlay store | `src/core/engine/overlay-store.js` |
| Proposal logs | JSONL files in world directories |
| Data export/import | `src/server/data-import-service.js`, `/api/world-pack/*` |
| Path security | `src/server/path-security.js` |
| FS utils | `src/server/fs-utils.js` |

Runtime/Candidate/Shared Canon 边界由 `workflow-authority-gate.js` + `lifecycle-state.js` + `canon_runtime_candidate_policy` 联合维护。

### LLM Adapter Boundary

- `src/core/workflows/adapters/llm-workflow-adapter.js`：真实 LLM / 离线 fallback / 测试 mock
- 真实 LLM 仅在 `llmConfig + apiKey` 同时存在时注入
- Workflow HTTP 端点通过 `server-workflow-adapter.js` 调用
- Prompt orchestration: `src/core/prompts/` (11 files)

### System Layer (`src/core/system/`)

- `index.js` — 系统入口
- `world-tree-route-index.js` — 路由索引 (8 routes)
- `mode-runner.js` — 模式运行器
- `mode-isolation-policy.js` — 模式隔离策略
- `mode-input-packets.js`, `mode-output-packets.js` — I/O 包
- `proposal-bus.js` — 提案总线
- `world-tree-save-system.js` — 存档系统

### Other Core Modules

| Layer | Path | Files |
|---|---|---|
| Director/Guardian | `src/core/director/` | `director-layer.js`, `director-policy.js`, `director-plan-schema.js`, `director-guardian.js` |
| Context Engine | `src/core/context/` | `context-engine.js`, `context-assembler.js`, `context-budget.js`, `context-policy.js`, `context-router.js` |
| Modules | `src/core/modules/` | `module-manifest.js`, `wrappers/` (15 wrapper files) |
| Modes | `src/core/modes/` | `mode-manifest.js`, `mode-module-map.js`, `mode-project-factory.js`, `world-profile-loader.js`, `world-profile-schema.js`, `module-composer.js` |
| Engine | `src/core/engine/` | `world-manager.js`, legacy: `rpg.js`, `sim.js`, `tabletop.js`, `murder-mystery.js` |
| Kernel | `src/core/kernel/` | `kernel-turn-context.js` |
| Processing | `src/core/processing/` | `material-ingest.js`, `material-extractor.js`, `material-scorer.js`, `processing-policy.js`, `completion-proposal.js`, `processing-delivery.js` |
| Telemetry | `src/core/telemetry/` | `world-telemetry.js`, `telemetry-digest.js`, `telemetry-policy.js` |
| Timeline | `src/core/timeline/` | `branch-manager.js`, `timeline-tree.js`, `branch-policy.js`, `branch-diff-summary.js` |
| Content | `src/core/content/` | `content-registry.js`, `content-proposal-extensions.js`, `reversible-change.js`, `stop-loss-window.js`, `change-impact-classifier.js` |
| Scene | `src/core/scene/` | `scene-summary-chain.js` |
| Real Play | `src/core/real-play/` | `turn-context.js` |
| Narrative | `src/core/narrative/` | `rhythm-tags.js`, `quest-tracker.js`, `chapter-recap.js` |
| Tracking | `src/core/tracking/` | `tracking-store.js`, `tracking-digest.js` |
| P3 Legacy | `src/core/` | M1 creation-wizard, M2 alchemy, M3 materials, M4 character, M5 cognition, M6 factions, M7 world-rules, M8 narrative-radar, M9 events, M10 macros, M11 observability |

### Server-side Services (`src/server/`)

| File | Role |
|---|---|
| `persistence-service.js` | Overlay write 持久化 |
| `data-import-service.js` | 数据导入验证 |
| `module-service.js` | 模块创建/加载/删除 |
| `path-security.js` | 路径安全 |
| `fs-utils.js` | JSON/JSONL 文件操作 |
| `alchemy-preview-service.js` | 炼金预览 |
| `mechanism-service.js` | 机制草案管理 |
| `turn-state-frame-service.js` | Turn 状态帧 |
| `kernel-service.js` | Kernel API 聚合 |

## High-risk Files

任何后续清理/重构前必须谨慎处理的文件：

| File | Reason |
|---|---|
| `server.js` (3209 lines) | 单体路由，改动可能静默破坏 API 契约 |
| `world-tree-console.js` (2360 lines) | 单体前端，所有视图耦合 |
| `src/core/workflows/workflow-authority-gate.js` | Canon write 授权 |
| `src/server/path-security.js` | 路径穿越防护 |
| `src/core/v2-ready/visibility-policy.js` | Hidden truth 过滤 |
| `src/core/v2-ready/lifecycle-state.js` | Canon gate |
| `src/core/system/proposal-bus.js` | Proposal 持久化 |
| `src/core/system/world-tree-save-system.js` | 存档格式 |

## Reality Check Mismatches

执行文件假设与真实项目不一致之处：

| Assumption | Reality |
|---|---|
| 执行文件列出 `src/core/quick-setting/` 等目录 | ✅ 确认存在 |
| 执行文件列出 `src/core/v2-ready/` | ✅ 确认存在 |
| 执行文件假设 `tests/fixtures/v2-ready/` 存在 | ✅ 确认存在（8 fixture files） |
| 执行文件提到 `docs/archive/` | ✅ 确认存在但仅 1 个文件 |
| 执行文件假设 `src/core/worldbook/` 存在 | ✅ 确认存在 |
| `docs/SCRIPTS_AND_CHECKS.md` preflight 顺序与 `package.json` 不符 | ⚠️ 文档过时 |
| `docs/INDEX.md` 顶部未列 Stage 4 | ⚠️ 文档过时 |

## Key Architecture Numbers

| Metric | Value |
|---|---|
| Source files in `src/core/` | 200+ |
| Test files | 82 (59 unit + 23 integration) |
| Script files | 10 |
| Docs files | 56 |
| NPM test scripts | 18 unique |
| Total passing tests | 595 (unit 416 + integration 116 + workflow 63) |
| Pre-existing warnings | 19 (asset:check 11 + interface-audit 8) |
| server.js lines | 3,209 |
| world-tree-console.js lines | 2,360 |
