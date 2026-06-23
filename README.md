# World Tree

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

本地优先的 AI 多模式叙事与创作工作台。

> **包版本**: v0.3.0 | **当前版本: v0.3.0** | 功能里程碑: V1 完整闭环
> world-rpg 是历史内部 ID，产品语义 = 世界书大世界模式，不是传统 RPG。

## 简介

World Tree 是一个本地优先的 AI 叙事与创作工作台。它把角色卡、世界书、大世界探索、桌面叙事、解谜调查、策略模拟、单人剧本杀和炼金台组织成一组隔离的模式胶囊，并通过统一的路由、提示词、输入包、输出包、存档系统和提案审核机制运行。目标不是做一个单一聊天页面，而是让用户可以创建、运行、保存、审核、导出和继续多个类型的 AI 叙事项目。

## 模式入口

| 入口 | modeId | 定位 | V1 状态 |
| --- | --- | --- | --- |
| 快速设定 | quick-setting | 粘贴设定快速创建草稿项目 | active |
| 人物卡 | character | 角色资料、人格、表达风格和互动边界 | active |
| 世界书大世界 | world-rpg | 基于世界书的持续探索与世界反馈 | active |
| 桌面叙事 | tabletop | 单人跑团/主持人式叙事、轻量检定、时钟 | active |
| 解谜调查 | mystery-puzzle | 场景调查、线索、假说、答案锁、提示 | active |
| 策略模拟 | strategy-sim | 单人阵营、资源、回合、外交和局势变化 | active |
| 单人剧本杀 | murder-mystery | 案件、嫌疑人、证词、真相锁、指认 | active |
| 炼金台 | creation-forge | 把灵感炼成可运行资产和项目包 | active（producer） |

## 核心架构

- **共享底座**: 项目创建、路由索引、模式运行器、提示词注册、输入/输出包、存档、提案审核、导入导出、API。
- **模式胶囊**: 每个入口有独立状态文件、缓存目录、提案日志、模块调用和运行包。
- **shared = 项目真相源**, runtime/cache = 可重建缓存, proposals = 待审核变更。
- AI 不能直接改 shared 真相源，必须通过 proposal gate。

## 快速开始

```bash
npm install
npm start
```

- Node.js >= 18
- 本地服务 http://localhost:3000
- 需要用户自行配置 LLM API

## 常用命令

| 命令 | 说明 |
| --- | --- |
| npm start | 启动本地服务 |
| npm test | 运行主集成/语法测试 |
| npm run test:unit | 运行单元测试 |
| npm run test:integration | 运行集成测试 |
| npm run audit | 项目审计 |
| npm run interface-audit | API 与文件 IO 联动检查 |
| npm run preflight | 发布/提交前总检查 |

## 数据存储

```
{project}/
├── world.json
├── shared/（项目真相源）
│   ├── worldbook.json / characters.json / scenes.json
│   ├── world_state.json / timeline.json / relations.json
│   ├── world_threads.json
│   ├── tabletop.json / mystery_puzzle.json / strategy_sim.json
│   ├── murder_mystery.json / creation_forge.json
└── runtime/
    ├── state.json / source.txt / chat.jsonl
    ├── cache/（各模式可重建缓存）
    └── *-proposals.jsonl（各模式待审核提案）
```

## API

完整 API 见 docs/API_REFERENCE.md。核心端点：/api/routes, /api/projects/:id/summary, /api/projects/:id/turn, /api/projects/:id/proposals, /api/world-pack/export, /api/world-pack/import, /api/health。

## 许可与安全

本地优先。不依赖云服务。API Key 由用户自行配置，不会提交到仓库。重大世界变化必须走 proposal gate 审核后才写入 shared 真相源。
