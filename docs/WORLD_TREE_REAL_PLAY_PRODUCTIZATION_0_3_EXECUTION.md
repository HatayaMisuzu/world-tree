# World Tree v0.3.1 Real Play Productization 0-3

> 仓库内执行入口。外部执行计划：`WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_CODEX_EXECUTION_PLAN(1).md`。
> 分支：`codex/real-play-productization-0-3`。

## 目标

在 v0.3.0 kernel、prompt、asset、workflow 与 service-deepening 基线上，完成可测试、可见、可回退的真实游玩产品化薄切片。

## 范围

1. 阶段 0：确认仓库、测试基线和边界。
2. 阶段 1：验证 Workflow 真实 LLM 接线、可见挂载、proposal 持久化、非致命日志与 API 路由。
3. 阶段 2：离线 real-play scenarios、等待进度、Tabletop 骰子、Mystery 线索板、Strategy 资源板。
4. 阶段 3：叙事化 proposal 审批、章节回顾、目标追踪、节奏标签。

## 不做

- 不启动完整 Worldbook V2 或 Character Capsule V2。
- 不引入 embedding、SQLite、TypeScript、前端框架、SSE 或插件生态。
- 不大规模拆分 `server.js`，不重写现有 proposal / authority gate。
- 不让 AI 输出、玩法状态或候选内容直接写入 shared canon。

## 验收

- 每个完成项有测试或报告证据。
- `npm run check`、`test:unit`、`test:integration`、`test:workflows`、`workflow:check`、`interface-audit` 通过。
- 最终运行 `npm run preflight` 与 `git diff --check`。
- `docs/REAL_PLAY_PRODUCTIZATION_REPORT.md` 诚实区分完成、部分完成、限制和风险。

## 修改前基线（2026-06-24）

- `npm run check`：PASS。
- `npm run test:unit`：PASS（110 tests）。
- `npm run test:integration`：PASS（107 tests）。
- `npm run workflow:check`：PASS（0 errors, 0 warnings）。
- `npm run test:workflows`：FAIL（60 tests 中 1 个既有失败：mystery truth warning 不稳定）。

该失败属于本轮阶段 1 的安全边界阻断项，先修复再叠加产品化功能。
