# Roadmap Candidates

> 来自 UX 和工程审查文档的候选建议。**不代表当前已实现功能。**
> 执行前必须重新检查当前仓库状态。大重构必须单独开执行文件。

## Next: Real Play Productization

- 验证 console workflow panel visible mount
- 新增 real-play smoke scenarios
- 新增 scenario runner
- 验证 creation / alchemy / play-turn 回环
- 生成 REAL_PLAY_PRODUCTIZATION_REPORT

## Soon: Product / UX Enhancements

- LLM 等待进度可视化
- Tabletop 骰子命令 /roll
- Mystery 线索卡与假说板
- Strategy 资源面板
- Narrative proposal 审批 UI
- Chapter recap / story summary
- Character creation 灵魂问题
- Alchemy transformation 阶段动画
- Worldbook explicit relations 编辑器

## Engineering Backlog

- PROPOSAL_STORE 持久化
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
