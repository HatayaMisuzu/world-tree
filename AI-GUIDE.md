# World Tree — AI Agent Operating Guide

> 给 Hermes、Codex 及其他 AI agent 的项目工作手册。
> 最后更新: V1 full-closure milestone (0.3.0)

## 不可违反的规则

1. 不要把未完成计划写成已完成功能。
2. 不要绕过 path-security 或 persistence-service。
3. 不要让 AI 直接修改 shared 真相源。
4. 改变世界状态/关系/时间线/案件真相/答案锁/资源结算 → 必须走 proposal。
5. world-rpg 不是传统 RPG → 不做等级/职业/装备/经验值/打怪升级。
6. creation-forge 不是普通玩法模式 → 是资产生产工厂。
7. 不要全局开放隐藏原型。
8. 不要破坏 quick-setting、character、worldbook、grand-world 等已完成入口。
9. 修改前先跑相关测试，完成后跑 preflight。

## 目录地图

```
src/core/
├── system/       路由索引、I/O包、隔离策略、提案总线、存档、运行器
├── prompts/      提示词注册表（8 份 profile）
├── character/    人物卡 parser/profile/prompt/lore/persona/OOC
├── worldbook/    世界书 schema/normalizer/validator/context/proposal
├── grand-world/  大世界模式 adapter/turn planner/state/objectives
├── tabletop/     桌面叙事 (solo tabletop narrative)
├── mystery-puzzle/ 解谜调查
├── strategy-sim/ 策略模拟
├── murder-mystery/ 单人剧本杀
├── creation-forge/ 炼金台
├── modes/        manifest/capsule/contract/factory/runtime/schema
├── modules/      模块清单/orchestrator/wrappers/loader
├── engine/       world-engine/context-engine/modules
├── data/         旧数据文件
server.js
public/          UI 前端
tests/           单元测试 + 集成测试
docs/            文档
scripts/         脚本
```

## AI 修改流程

1. 读取 README.md、docs/INDEX.md、AI-GUIDE.md。
2. 检查相关 mode capsule 文档。
3. 运行 `git status --short`。
4. 定位真实文件，不凭记忆改。
5. 修改最小必要文件。
6. 增加或更新测试。
7. 运行目标测试。
8. 运行 `npm run preflight`。
9. 完成后报告新增文件、修改文件、测试结果、风险、未做事项。

## 模式边界

| modeId | 产品名 | 禁止误解 |
| --- | --- | --- |
| quick-setting | 快速设定 | — |
| character | 人物卡 | — |
| world-rpg | 世界书大世界 | 不是传统 RPG |
| tabletop | 桌面叙事 | 不是完整 DND |
| mystery-puzzle | 解谜调查 | 不是剧本杀 |
| strategy-sim | 策略模拟 | 不是完整 4X |
| murder-mystery | 单人剧本杀 | 不是多人派对 |
| creation-forge | 炼金台 | 不是普通玩法入口 |

## 测试

```bash
npm run test:unit         # 全量单元测试
npm run test:integration  # 全量集成测试
npm run preflight         # audit + check + unit + integration + interface
```
