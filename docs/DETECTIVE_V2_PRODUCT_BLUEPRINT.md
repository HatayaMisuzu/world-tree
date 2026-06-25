# Detective V2 Product Blueprint

> Detective V2 不是 AI 侦探聊天。不是法庭优先。不是 Tabletop V2 换皮。
> Detective V2 是证据链优先的推理引擎。

## 定义

Detective V2 是 World Tree 的证据链优先单人侦探运行环境。真相是固定的。核心线索总是可达的。玩家笔记本是核心机制。案件生成器是战略支柱。

## 核心不变量

1. **Evidence-chain-first** — 推理建立在证据链上，不是对话树
2. **Truth is fixed** — 真相在案件创建时锁定，调查过程中不改变
3. **Core clues are reachable** — 核心线索有至少一条保证可达路径（GUMSHOE 原则）
4. **Player notebook is core** — 玩家主动记录、标注可信度、链接证据
5. **Multi-lock deduction** — 结案不是单一选择题，是多锁推理矩阵
6. **Case generator is strategic pillar** — 不是简单三嫌疑人八线索模板
7. **Hidden truth isolation** — Truth Ledger 永不在玩家视野中出现

## 不是什么的声明

- 不是 AI 侦探聊天 — 玩家主导调查，AI 不替玩家推理
- 不是法庭优先 — 调查阶段远重于结案辩论
- 不是 Tabletop V2 换皮 — 独立命名空间、独立运行时、独立上下文
- 不是"只有凶手说谎" — 支持 8 种欺骗类型

## 优先级链

```
Truth Ledger（隐藏）
> 证据链（核心线索 → 解释线索 → 误导线索）
> 证言可信度（多类型欺骗）
> 玩家笔记本（主动记录/标注/链接）
> 推理锁矩阵（多维度结案）
> AI 叙事（仅辅助呈现）
```

## 案件生成器设计原则

- GUMSHOE：核心线索不被卡死
- Consulting Detective：地点/人物/文档目录
- Obra Dinn：多锁推理矩阵
- Roottrees：可搜索语料库和关系图
- Notebook-first：证据提取
- Anti-speedrun：防速通校验

## 两步路线

- Step 1（本包）：模块资产地基 + 完整案件生成器设计地基 + 隔离契约
- Step 2（后续）：侦探调查运行闭环 + 笔记本 UI + 案件桌面
