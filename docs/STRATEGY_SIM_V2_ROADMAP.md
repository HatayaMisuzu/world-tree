# Strategy Sim V2 路线图

## 当前包目标

完成通用 sealed spec runtime 工程闭环。

## 当前包必须完成

- StrategySimSpec
- StrategyRunState
- seeded RNG + ProbabilityRollRecord
- numeric safety
- turn engine
- public view scrubber
- report context
- mode adapter V2 path + legacy fallback
- unit tests
- docs

## 当前包不做

- 快速开始
- 预制模板
- archetype library
- 具体玩法
- 运行时自动补全

## 后续路线

### Phase A：炼金台补全模块

- scenario extractor
- completion engine
- mechanism compiler
- visibility planner
- balance static check
- user confirmation
- spec sealer

### Phase B：archetype library

统一设计并测试典型类型：

- 公司经营
- 电竞经理
- 足球经理
- 工厂经营
- 殖民地经营
- 派系/组织/政权经营

### Phase C：快速开始

只有在 archetype 和 sealed spec 稳定后再做快速开始。

### Phase D：动态 UI 面板

固定标签骨架 + spec-driven 内容。
