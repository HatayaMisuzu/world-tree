# Current Project State

> 当前真相源。任何 AI agent 接手时必须先读本文件。
> 本文件在 `docs/` 和 `AI-GUIDE` 中被引用为优先阅读入口。

## Current Milestone

World Tree 已完成 kernel、prompt、asset、workflow、service-deepening、Real Play Productization 0-3 与 Universal Mode V2-ready Foundation（阶段 4）。

## Status Table

| Layer | Status | Evidence |
|-------|:---:|------|
| P0 Living World Kernel | COMPLETE | `npm run test:p0` 7/7 |
| P1 Experience Stability Kernel | COMPLETE | `npm run test:p1` 8/8 |
| P2 Long Play Kernel | COMPLETE | `npm run test:p2` 40/40 |
| Prompt Orchestration Layer v1 | COMPLETE | 22 prompt blocks, 8 mode profiles, 9 task contracts, test:prompts 42/42 |
| P3 M1-M11 Legacy Mechanism Kernel | COMPLETE | 11 mechanisms, test:legacy-mechanisms 22/22 |
| Asset Maturation Stage 0-4 | COMPLETE | test:assets, test:authority, test:legacy-modernization, test:workflow-readiness |
| Real Workflow Integration W0-W4 | COMPLETE | test:workflows 44/44, workflow:check 0 errors |
| Service Deepening Core | COMPLETE | character/mystery/strategy use real M4-M8, play-turn has LLM adapter |
| Workflow HTTP Baseline | COMPLETE | POST /api/workflow/run, GET /api/workflow/types, GET /api/workflow/status |
| Console Workflow Panel | COMPLETE | 真实 chat surface 可见挂载；desktop/mobile browser QA；interface-audit |
| Real Play Scenario Runner | COMPLETE | 6 个离线 scenarios；`npm run real-play:smoke` |
| Mode Productization Slices | COMPLETE-PARTIAL | tabletop dice、mystery clue board、strategy resources 均可运行；不是完整 DND/推理引擎/4X |
| Narrative Experience Slices | COMPLETE-PARTIAL | immersive proposal UI、fallback recap、goal tracker、rhythm tag；不等同长期记忆或 quest engine |
| Universal Mode V2-ready Foundation | COMPLETE-PARTIAL | universal metadata/visibility/lifecycle/capability；8 模式 normalizer/fixture/test 67 项；strategy numeric/probability substrate；不是完整 V2 系统 |

## What Is Current

- 工作流层完整的创建/导入/游玩/角色/推理/策略/观测管线
- V2-ready foundation：通用 metadata/visibility/lifecycle/capability contracts 已建立
- 8 个模式入口均有 V2-ready normalizer、fixture、test
- quick-setting 支持 DeepSeek 风格原始设定 intake，保留原文
- strategy 保留固定状态面板 + 数值/概率底座 (clamp/soft cap/maxDelta/exact/range/hint/hidden)
- 所有 V2-ready 能力遵守 runtime/candidate/proposal/shared canon 边界
- Server workflow HTTP 端点可调用
- LLM adapter 支持真实/离线/测试三种模式
- 所有 workflow 默认 candidate-only，不直接写 shared canon
- Console workflow panel 已在真实 chat surface 可见挂载
- 离线 scenario runner 覆盖 workflow/creation/alchemy/play/character/mystery/strategy
- 等待阶段 UI 不伪装 streaming；真实后端 `_progress` 作为完成证据
- `/roll`、线索/假设、策略资源、章节回顾、目标和节奏均写 runtime/candidate，不直接写 shared canon

## What Is Historical

- WORKFLOW_INTEGRATION_REPORT (79fa10f) — 已被 Service Deepening 替代
- v0.3.0 审查建议 — 进入 ROADMAP_CANDIDATES，不代表当前能力

## What Is Roadmap Candidate

见 `docs/ROADMAP_CANDIDATES.md`。所有候选均不代表已实现。

## Current Limitations

- Tabletop 不是完整 DND；Mystery 不是完整推理引擎；Strategy 不是完整 4X。
- Chapter recap 当前以 deterministic fallback 为可测试基线，LLM summary 不是已验证能力。
- 目标追踪是轻量 runtime UI，不是完整 quest engine 或长期记忆。
- 完整 Worldbook V2 / Character Capsule V2 仍未实现。
- V2-ready Foundation：UI 轻量预览未实现；Prompt builder v2-ready context 接入未做；各模式 normalizer 是薄切片不是完整 V2；strategy numeric/probability substrate 不是完整策略游戏。

## Pre-V2 Closure Status

Status: **COMPLETE-ON-MAIN**

Stage 5 closure branch was merged onto `main`; Stage 6 server runtime boundary cleanup and architecture diagnostics are continuing on `main`.

Scope: 8 stages of baseline inventory, documentation cleanup, legacy removal, warning reconciliation, asset integration gate, and mode-specific shared readback integration.

| Stage | Summary | Commit |
|---|---|---|
| 5A | Baseline & Inventory | `0bd25f3` |
| 5B | Safe Documentation Cleanup | `8e67179` |
| 5C | Legacy Workflow Directory Removal | `4401594` |
| 5D | Inventory Reconciliation & Warning Proof | `2089c81` |
| 5E | Asset Inventory Warning Resolution | `8eb2547` |
| 5F | Interface-Audit Proof & Closure Gates | `a8a67f7` |
| 5G | Maintenance Entry & Asset Integration Gate | `e07d5aa` |
| 5H | Mode-Specific Shared Readback | `349f99d` |
| 5Z | Final Audit & Merge Readiness | `2ef932a` |

Current guarantees:
- `npm run asset:check`: 0 errors, 0 warnings
- `npm run interface-audit`: 0 warnings (149 passes)
- `npm run preflight`: PASS (115/116, 1 known flaky: character-project port race)
- All 8 mode-specific shared seed files integrated into `moduleData.modeSpecific`
- Maintenance entry: `docs/MAINTENANCE_ENTRY.md`
- Asset Preservation & Integration Gate: `docs/PRE_V2_CLOSURE_GATES.md`
- Mode-specific shared files read back into `moduleData.modeSpecific`
- No assets deleted, detached, or downgraded

Boundary:
- This is not full V2.
- This does not implement complete mode-specific gameplay engines.
- This does not merge the branch into main yet.

## Stage 6 Status

Stage 6 has completed server runtime boundary extraction and architecture diagnostics closure.

Completed:
- `src/server/http-response.js`
- `src/server/http-request.js`
- `src/server/local-access.js`
- `docs/ARCHITECTURE_MAP.md`
- `docs/MAINTENANCE_GUIDE.md`
- `docs/DEBUGGING_GUIDE.md`
- `docs/API_ROUTE_INVENTORY.md`
- `docs/MODE_BOUNDARY_MAP.md`

Boundary:
- Stage 6 does not implement full V2.
- Stage 6 does not fully split API routes.
- Stage 6 does not change persistence, proposal/canon, LLM adapter, or mode business behavior.
