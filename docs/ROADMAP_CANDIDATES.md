# Roadmap Candidates

> 来自 UX 和工程审查文档的候选建议。**不代表当前已实现功能。**
> 执行前必须重新检查当前仓库状态。大重构必须单独开执行文件。

## Completed: Real Play Productization 0-3

- Console workflow panel visible mount：已完成并经 desktop/mobile browser QA。
- Real-play smoke scenarios / scenario runner：已完成，6 个离线 scenario。
- Creation / alchemy / play-turn 回环：已验证 candidate-only。
- LLM 等待进度、Tabletop 骰子、Mystery 线索板、Strategy 资源板：已完成薄切片。
- Narrative proposal UI、fallback recap、goal tracker、rhythm tags：已完成薄切片。
- 证据见 `docs/REAL_PLAY_PRODUCTIZATION_REPORT.md`。

## Soon: Product / UX Enhancements

- Chapter recap 的真实 LLM summary（当前只有 deterministic fallback 基线）
- Tabletop 更完整但仍轻量的 fail-forward / scene clock
- Mystery evidence chain / hint ladder（不得泄露 hidden truth）
- Strategy 更完整但有界的外交与回合结算
- Character creation 灵魂问题
- Alchemy transformation 阶段动画
- Worldbook explicit relations 编辑器

## Engineering Backlog

- Proposal persistence 的多进程/异常恢复压力测试（当前主链已由 engine snapshot + JSONL 持久化）
- Empty catch 日志补齐
- JSONL reverse seek 优化
- 更多 route handler 集成测试
- JSDoc typedef 与 // @ts-check 覆盖
- Onboarding wizard

## Deferred / High-risk Refactors

- server.js 大路由拆分
- 前端 full ES module split
- Global error handling 迁移
- TypeScript 迁移
- SQLite 可选后端

## Rules

- 不得在本文件未更新的情况下声称候选已实现。
- 每项候选必须有独立的执行文件 + 测试 + 验证后才能标为完成。
- 高风险重构不得在文档收口类任务中启动。
