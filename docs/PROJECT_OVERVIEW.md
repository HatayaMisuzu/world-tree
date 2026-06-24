# Project Overview

World Tree 是本地优先的 AI 多模式叙事与创作工作台。它使用共享底座 + 隔离式模式胶囊，让不同类型的叙事/创作项目可以复用同一套项目创建、存档、审核、导入导出和 LLM 调用基础设施。

## V1 核心目标 → 当前架构

- 单人用户优先：用户 = 唯一真实玩家，AI 模拟其他参与者
- 本地优先：不依赖云服务，API Key 用户自行配置
- 多模式入口：8 个功能入口各司其职
- 工作流编排：UI/Console → Server API → Workflow Layer → Prompt Orchestration + P0-P2 Kernel + P3 Services → LLM adapter / fallback → Post-check / Output Router → Candidate/Proposal/Runtime/Safe Debug
- 审核后写入真相源：shared 文件只有 approve proposal 或 initialization write 后才能修改
- 可导出/导入：.worldtree 格式
- AI agent 可维护：统一架构、代码模式、测试覆盖，真相源优先级清晰

## 模式入口

| 入口 | 类型 | 定位 |
| --- | --- | --- |
| quick-setting | consumer | 快速创建设定草稿 |
| character | consumer | 角色卡互动 |
| world-rpg | consumer | 世界书大世界探索（非传统 RPG） |
| tabletop | consumer | 单人桌面叙事 |
| mystery-puzzle | consumer | 单人解谜调查 |
| strategy-sim | consumer | 单人策略模拟 |
| murder-mystery | consumer | 单人剧本杀 |
| creation-forge | producer | 资产生产与转换工厂 |

## 关系图

```
UI → API Router → Route Index → Input Packet → Prompt Builder
                                              → Mode Adapter
                                              → Output Packet
                                              → Proposal Bus / Save System → UI
```
