# Current Project State

> 当前真相源。任何 AI agent 接手时必须先读本文件。
> 本文件在 `docs/` 和 `AI-GUIDE` 中被引用为优先阅读入口。

## Current Milestone

World Tree 已完成 kernel、prompt、asset、workflow 和 service-deepening 基线。下一阶段是 Real Play Productization。

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
| Workflow HTTP Baseline | COMPLETE | POST /api/workflow/run/types, GET /api/workflow/status |
| Console Workflow Panel | NEAR-COMPLETE | renderWorkflowPanel() + API loading confirmed; visible mount verification deferred to productization |
| Real Play Productization | NEXT | scenario runner, real-play smoke scenarios, UX verification |

## What Is Current

- 工作流层完整的创建/导入/游玩/角色/推理/策略/观测管线
- Server workflow HTTP 端点可调用
- LLM adapter 支持真实/离线/测试三种模式
- 所有 workflow 默认 candidate-only，不直接写 shared canon
- Console workflow panel 适配器与数据加载完成

## What Is Historical

- WORKFLOW_INTEGRATION_REPORT (79fa10f) — 已被 Service Deepening 替代
- v0.3.0 审查建议 — 进入 ROADMAP_CANDIDATES，不代表当前能力

## What Is Roadmap Candidate

见 `docs/ROADMAP_CANDIDATES.md`。所有候选均不代表已实现。

## Next Recommended Pass

`WORLD_TREE_REAL_PLAY_PRODUCTIZATION_PASS_EXECUTION.md`
