# Strategy Sim V2 设计想法方案 v0.2

状态：设计文档，不代表全部已完成  
当前阶段：通用 sealed spec runtime 工程底座  
明确不做：快速开始、archetype library、预制模板、运行时自动补全

## 1. 总定义

Strategy Sim V2 是一个运行 sealed StrategySimSpec 的回合制模拟经营/策略 runtime。

- 炼金台未来负责：抽取、补全、平衡、可见性设计、用户确认、封印规则。
- Strategy Sim 负责：读取 sealed spec、创建 run state、推进回合、真实概率、数值安全、隐藏隔离、报告上下文。
- LLM 负责：解析玩家意图、生成报告文案。LLM 不负责掷骰、不负责改规则、不负责直接写状态。

一句话：

> 炼金台设计游戏，Strategy Sim 运行游戏。

## 2. 当前阶段边界

当前阶段只建立通用规则结构与运行时能力。

不做：

- 快速开始
- 预制 sealed spec
- 电竞经理/公司经营/足球经理等 archetype
- 具体玩法模板
- archetype library
- 运行时自动补全

## 3. sealed StrategySimSpec

StrategySimSpec 是规则包。进入 runtime 前必须 sealed。

sealed spec 包含：

- resources
- variables
- mechanisms
- probabilityRules
- eventDecks
- visibilityPolicy
- balanceProfile
- panelSchema
- reportPolicy
- sealMetadata

进入 runtime 后：

- spec 不可变
- run state 可变
- turn log append-only

## 4. 真实概率

概率必须由代码计算和真实抽取。

每次 roll 必须生成：

- baseChance
- modifiers
- finalChance
- rngSeed
- rngCounter
- roll
- result
- visibility
- publicDisclosure

LLM 不得编造概率、不决定成功失败。

## 5. 可见性

统一四级：

- public：玩家可见，可显示精确值
- partial：玩家可见趋势或提示，不显示精确值
- hidden：玩家不可见，但可影响结算，可通过安全提示表达
- secret：玩家不可见，也不能直接报告

Report Writer LLM 只能收到 public view，不能收到 hiddenState、secretState、rawRoll、finalChance、rngSeed、rngCounter。

## 6. 数值安全

数值必须约束：

- min/max
- maxDeltaPerTurn
- safeRange
- warningRange
- collapseRange
- recoveryActions

目标是防止：

- 正反馈滚雪球
- 负反馈死亡螺旋
- 数值通胀
- 一回合无理由崩溃

## 7. 回合制

Strategy Sim V2 使用 strict mixed pipeline：

1. parse action
2. mechanism resolution
3. probability resolution
4. event resolution
5. public view scrub
6. report context build
7. turn log append

每一步可以 no-op，但顺序固定。

## 8. 后续扩展

后续可以统一补充：

- archetype library
- 炼金台自动补全
- 快速开始
- 具体模拟经营模板
- UI 动态面板

这些不属于当前工程包。
