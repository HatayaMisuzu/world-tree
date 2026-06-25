# Current Project State

> 当前真相源。任何 AI agent 接手时必须先读本文件。
> 本文件在 `docs/` 和 `AI-GUIDE` 中被引用为优先阅读入口。

## Trusted Baseline

| Item | Value |
|------|-------|
| **Current trusted baseline** | `v0.4.0-pre-v2-closure.1` |
| **Main head** | `5cb48da` |
| **Status** | **TRUSTED_PRE_V2_CLOSURE_SEALED** |
| **Old tag** `v0.4.0-pre-v2-closure` | Audit-invalidated historical marker at `0ee1852` |
| **Full V2** | Not implemented |
| **Browser QA** | Not run (gateway unstable; runtime QA used) |
| **Preflight** | PASS (all 19 sub-commands) |
| **userData isolation** | PASS (real userData unchanged before/after full suite) |

## Status Table

| Layer | Status | Evidence |
|-------|:---:|------|
| P0 Living World Kernel | COMPLETE | `npm run test:p0` 7/7 |
| P1 Experience Stability Kernel | COMPLETE | `npm run test:p1` 8/8 |
| P2 Long Play Kernel | COMPLETE | `npm run test:p2` 40/40 |
| Prompt Orchestration Layer v1 | COMPLETE | 22 prompt blocks, 8 mode profiles, 9 task contracts, test:prompts 42/42 |
| P3 M1-M11 Legacy Mechanism Kernel | COMPLETE | 11 mechanisms, test:legacy-mechanisms 22/22 |
| Asset Maturation Stage 0-4 | COMPLETE | test:assets, test:authority, test:legacy-modernization, test:workflow-readiness |
| Real Workflow Integration W0-W4 | COMPLETE | test:workflows, workflow:check 0 errors |
| Service Deepening Core | COMPLETE | character/mystery/strategy use real M4-M8, play-turn has LLM adapter |
| Workflow HTTP Baseline | COMPLETE | POST /api/workflow/run, GET /api/workflow/types, GET /api/workflow/status |
| Console Workflow Panel | COMPLETE | 真实 chat surface 可见挂载；desktop/mobile browser QA；interface-audit |
| Real Play Scenario Runner | COMPLETE | 6 个离线 scenarios；`npm run real-play:smoke` |
| Mode Productization Slices | COMPLETE-PARTIAL | tabletop dice、mystery clue board、strategy resources 均可运行；不是完整 DND/推理引擎/4X |
| Narrative Experience Slices | COMPLETE-PARTIAL | immersive proposal UI、fallback recap、goal tracker、rhythm tag；不等同长期记忆或 quest engine |
| Universal Mode V2-ready Foundation | COMPLETE-PARTIAL | universal metadata/visibility/lifecycle/capability；8 模式 normalizer/fixture/test；V2 Entry Closure (sealed) 系统 |

## What Is Current

- 工作流层完整的创建/导入/游玩/角色/推理/策略/观测管线
- V2-ready foundation：通用 metadata/visibility/lifecycle/capability contracts 已建立
- 8 个模式入口均有 V2-ready normalizer、fixture、test
- quick-setting 支持 DeepSeek 风格原始设定 intake，保留原文
- strategy 保留固定状态面板 + 数值/概率底座
- 所有 V2-ready 能力遵守 runtime/candidate/proposal/shared canon 边界
- Server workflow HTTP 端点可调用
- LLM adapter 支持真实/离线/测试三种模式
- 所有 workflow 默认 candidate-only，不直接写 shared canon
- Console workflow panel 已在真实 chat surface 可见挂载
- 离线 scenario runner 覆盖 workflow/creation/alchemy/play/character/mystery/strategy

## What Is Historical

- WORKFLOW_INTEGRATION_REPORT — 已被 Service Deepening 替代
- v0.3.0 审查建议 — 进入 ROADMAP_CANDIDATES，不代表当前能力
- v0.4.0-pre-v2-closure (tag at `0ee1852`) — audit-invalidated; superseded by `v0.4.0-pre-v2-closure.1` at `5cb48da`

## Pre-V2 Closure — Stages Completed

| Stage | Summary |
|-------|---------|
| 5A-5Z | Safe baseline & inventory: docs cleanup, legacy removal, warning reconciliation, asset gate, mode-specific readback |
| 6 | Architecture & diagnostics: server runtime boundary extraction, architecture map, maintenance/debugging guides, route/mode inventories |
| 7 | Product usability closure: user quickstart, LLM setup guide, play mode guide, no-gateway runtime QA, Pre-V2 Closure report |

## Blocker Repair

P0/P1 blockers found in audit were repaired on `hermes/pre-v2-closure-blocker-repair` and merged to `main`:

| Blocker | Fix |
|---------|-----|
| P0: userData test pollution | `WORLD_TREE_USER_DATA_DIR` env var; `src/server/user-data-root.js`; integration helper auto-creates temp dir |
| P1: request-body contract | `req.resume()` replaces `req.destroy()`; `INVALID_JSON_BODY` for non-object JSON; `requireObject` default |
| P1: creation-forge authority | `POST /api/modules/create` rejects `mode=creation-forge` with `MODE_PROJECT_CREATION_DISABLED` |
| P1: version truth conflict | Unified to `0.4.0-pre-v2-closure.1` across package/lock/manifest/README/CHANGELOG/AI-GUIDE |

## Current Guarantees

- `npm run audit`: 0 errors
- `npm run check`: PASS
- `npm run docs:check`: 24/24
- `npm run asset:check`: 0 errors, 0 warnings
- `npm run interface-audit`: 149 passes, 0 warnings
- `npm run test:unit`: 416 pass
- `npm run test:integration`: 119 pass
- `npm run preflight`: PASS (all 19 sub-commands)
- userData isolation verified: real `userData/` files unchanged before/after full test suite

## Current Limitations

- Tabletop 不是完整 DND；Mystery 不是完整推理引擎；Strategy 不是完整 4X
- Chapter recap 以 deterministic fallback 为基线，LLM summary 不是已验证能力
- 目标追踪是轻量 runtime UI，不是完整 quest engine
- 完整 Worldbook V2 / Character Capsule V2 仍未实现
- `server.js` still owns route dispatch (monolithic if-chain)
- `world-tree-console.js` is a monolithic ES module
- Browser QA was not performed (gateway unstable)
- No TypeScript migration; no automated browser testing

## Boundary

- This is not full V2
- This does not implement complete mode-specific gameplay engines
- No persistence format rewrite
- No proposal/canon rewrite
- No LLM adapter rewrite
- Old tag `v0.4.0-pre-v2-closure` preserved as historical audit-invalidated marker
- Trusted seal is `v0.4.0-pre-v2-closure.1` at `5cb48da`

## V2 Entry Closure (基准提交 9b35bbf)

四个 V2 入口已完成闭环。详见 V2_ENTRY_COMPLETION_STATUS.md。
