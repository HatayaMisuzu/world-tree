# Multi-Mode Entry Closure P1

## 1. 为什么先做多模式最小闭环

World Tree 的三层架构（Mode / Module / Runtime）在 Core Architecture Completion 阶段已就绪。进入功能入口开发后，如果只做一个 character 入口，其他 6 个模式（除 creation-forge）全部空置，架构层的很多能力（module graph、wrapper orchestration、mode state envelope、project factory）就没有被充分验证。

因此本轮（Phase F1）一次性激活 5 个新模式：world-rpg、mystery-puzzle、tabletop、strategy-sim、murder-mystery。每个模式都走统一的底层链路（Mode Project Factory → moduleRuntimePacket → modeStateEnvelope → world.json/state.json → .worldtree roundtrip），用最少的介入成本验证架构泛用性。

## 2. 本轮包含哪些入口

### 已完成最小闭环（7 个）

| Mode | 入口名称 | 状态 | dataMode | 专属 shared 文件 |
|------|---------|------|----------|-----------------|
| quick-setting | 预设/设定 | active | preset | — |
| character | 人物卡 | active | character_card | shared/characters.json |
| world-rpg | 世界冒险 | active (beta) | worldbook | shared/world_rpg.json |
| mystery-puzzle | 解谜推理 | active (experimental) | worldbook | shared/mystery.json |
| tabletop | 跑团 | active (experimental) | worldbook | shared/tabletop.json |
| strategy-sim | 策略模拟 | active (experimental) | worldbook | shared/strategy.json |
| murder-mystery | 剧本杀 | active (experimental) | shared/murder_mystery.json | worldbook |

### 保持 deferred（1 个）

| Mode | 状态 | 原因 |
|------|------|------|
| creation-forge | planned / not visible | 跨模式产物工厂，需先稳定消费端契约 |

## 3. 为什么 creation-forge 放到最后

creation-forge 不是普通创作入口。它的真实定位是**跨模式产物工厂（Mode Artifact Forge）**——把用户灵感、素材、碎片设定炼成能被其他功能入口直接消费的可运行产物。

之所以最后做，不是因为它功能简单或优先级低，而是因为：

1. **必须先稳定消费端入口**：每个消费端入口需要什么 shared 文件、什么 sourceType、什么最小结构，必须在 creation-forge 之前就明确。
2. **creation-forge 的输出是产物**：它生成的 artifact 必须能被 character / world-rpg / tabletop 等入口"拿起来就能用"。如果消费端入口还没稳定，creation-forge 生成的产物就没有准确定义。
3. **实现顺序决定了依赖方向**：creation-forge → 消费端入口（单向依赖），不应该反过来让消费端入口依赖 creation-forge。

## 4. 每个入口的第一版定位

| Mode | P1 定位 | P1 能做什么 |
|------|---------|-----------|
| world-rpg | 自由 GM 叙事 | 粘贴世界设定 → AI 以 GM 方式回应 → 聊天持久化 |
| mystery-puzzle | 谜题主持人引导 | 粘贴谜题/悬疑 → AI 以谜题主持人方式引导 → 聊天持久化 |
| tabletop | 自由规则跑团 | 粘贴跑团背景 → AI 以 GM 方式回应 → 聊天持久化 |
| strategy-sim | 策略顾问推演 | 粘贴局势 → AI 以策略顾问方式回应 → 聊天持久化 |
| murder-mystery | 案件主持人引导 | 粘贴案件设定 → AI 以主持人方式引导 → 聊天持久化 |

注意：所有新模式在 P1 都复用 `dataMode=worldbook` 管线，不做专属引擎。

## 5. 每个入口明确未做什么

| Mode | P1 未做 |
|------|--------|
| world-rpg | 任务系统、战斗系统、成长系统、随机事件系统、时间推进 |
| mystery-puzzle | 真相锁、复杂线索图、自动推理判定 |
| tabletop | 骰子系统、角色属性、检定 DC、战斗回合、完整规则引擎 |
| strategy-sim | 数值模拟、资源经济、自动回合结算、阵营 AI |
| murder-mystery | 真相锁、嫌疑人证词一致性、线索发放系统、阶段推进、推理评分 |

## 6. 每个入口的最小 shared 文件

所有入口共享基础文件（world.json / runtime/state.json / runtime/source.txt / shared/worldbook.json 等），额外：

| Mode | 专属 shared 文件 | 核心字段 |
|------|-----------------|---------|
| world-rpg | shared/world_rpg.json | gmMode, currentSceneId, playerState |
| mystery-puzzle | shared/mystery.json | hostRole, clues, solutionLock |
| tabletop | shared/tabletop.json | gmMode, ruleset, diceSystem, party |
| strategy-sim | shared/strategy.json | simulationStyle, turn, factions, resources |
| murder-mystery | shared/murder_mystery.json | hostRole, suspects, clues, truthLock |

所有专属文件都标记 `status: "minimal"`，表明当前只是占位结构。

## 7. Mode Artifact Consumption Contract

以下是 creation-forge 未来生成 artifact 时必须遵守的消费端契约。本轮仅做文档记录，不做代码层实现。

### 7.1 world-rpg

```
targetMode: world-rpg
sourceType: world_rpg_seed
dataMode: worldbook / worldSubType: classic
required files: world.json, runtime/state.json, runtime/source.txt, shared/worldbook.json, shared/scenes.json, shared/world_state.json, shared/world_rpg.json
minimum artifact: title, sourceText, openingSceneSeed, playerRoleSeed, worldPremise
P1 deferred: quest/combat/growth/random-event/timeline
```

### 7.2 mystery-puzzle

```
targetMode: mystery-puzzle
sourceType: mystery_puzzle_seed
dataMode: worldbook / worldSubType: classic
required files: world.json, runtime/state.json, runtime/source.txt, shared/worldbook.json, shared/scenes.json, shared/mystery.json
minimum artifact: title, sourceText, premise, openingScene, clueSeeds, knownFacts
P1 deferred: truth-lock, solution-enforcement, clue-graph, auto-deduction
```

### 7.3 tabletop

```
targetMode: tabletop
sourceType: tabletop_seed
dataMode: worldbook / worldSubType: classic
required files: world.json, runtime/state.json, runtime/source.txt, shared/worldbook.json, shared/scenes.json, shared/tabletop.json
minimum artifact: title, sourceText, setting, openingScene, rulesetPreference, playerActionPrompt
P1 deferred: dice, character-sheet, attributes, DC-checks, combat-turns, ruleset-engine
```

### 7.4 strategy-sim

```
targetMode: strategy-sim
sourceType: strategy_sim_seed
dataMode: worldbook / worldSubType: classic
required files: world.json, runtime/state.json, runtime/source.txt, shared/worldbook.json, shared/organizations.json, shared/world_state.json, shared/timeline.json, shared/strategy.json
minimum artifact: title, sourceText, situation, factionSeeds, resourceSeeds, firstTurnPrompt
P1 deferred: numeric-simulation, resource-economy, auto-turn-resolution, faction-AI
```

### 7.5 murder-mystery

```
targetMode: murder-mystery
sourceType: murder_mystery_seed
dataMode: worldbook / worldSubType: classic
required files: world.json, runtime/state.json, runtime/source.txt, shared/worldbook.json, shared/scenes.json, shared/characters.json, shared/murder_mystery.json
minimum artifact: title, sourceText, casePremise, openingScene, suspectSeeds, clueSeeds
P1 deferred: truth-lock, culprit-lock, testimony-consistency, clue-release, phase-progression, deduction-scoring
```

## 8. 当前测试覆盖

| 层级 | 文件 | 覆盖 |
|------|------|------|
| 单元 | multi-mode-entry.test.js | 41 tests：5 模式 visible/draft/files/schema/creation-forge 拒绝 |
| 集成 | multi-mode-projects.test.js | 5 tests：每模式创建 → world.json/state.json/shared file/roundtrip |
| 集成 | multi-mode-first-turn.test.js | 5 tests：每模式 mock chat 持久化验证 |
| 回归 | character-project.test.js | 2 tests |
| 回归 | quick-project.test.js | 2 tests |

## 9. 剩余风险

- 5 个新模式均复用 `dataMode=worldbook` 管线，没有专属 LLM prompt。交互质量取决于通用 worldbook prompt + source text 的质量。
- 专属 shared 文件（world_rpg.json 等）当前是占位结构，只有被各自的 P2 wrapper/engine 消费后才有实际作用。
- module-service.js 的部分落盘逻辑（shared 文件写入）仍直接写在 createModule 中，未完全通过 factory 的 createModeProjectFiles 抽象。当前标记为 "acceptable for P1 hardening, can be refactored later"。

## 10. 下一步建议

1. **Mode Artifact Contract P1**：把本文档中的 Mode Artifact Consumption Contract 提炼为代码层 schema / validator / summary。
2. **Creation Forge Artifact Factory P1**：让 creation-forge 读取 targetMode contract，生成可被消费端入口直接使用的 artifact draft。
3. 各模式 P2 深功能（world-rpg 任务系统 / tabletop 骰子 / strategy 数值模拟等）按需启动。
