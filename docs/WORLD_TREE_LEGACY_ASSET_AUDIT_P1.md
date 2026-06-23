# World Tree 旧资产盘点 P1

## 背景
项目已有 M1-M19 + M-创作共 20+ 个旧模块，以及 RPG/Tabletop/Mystery/Strategy 等专门原型。它们在 module-manifest 中状态不一致，需要盘点后制定统一的处理方案。

## 模块状态说明
- `legacy-wrapped` — 已有 wrapper，可被 module runtime 调用
- `legacy-inline` — 代码存在但散落在运行时编排中，无独立 wrapper
- `prototype-hidden` — 有原型代码但所属 profile 未开放
- `declared-only` — 未来需要，目前仅声明

## 全部资产分类表

### A. 直接复用（已有 wrapper）

| 模块 ID | 中文名 | Legacy | 状态 | wrapper | 被哪些 mode 使用 |
|---------|--------|--------|------|---------|-----------------|
| core.world_container | 世界容器 | M1 | legacy-wrapped | ✅ | quick-setting, character, world-rpg, tabletop, mystery-puzzle, strategy-sim, creation-forge |
| lore.worldbook_trigger | 世界书触发 | M2 | legacy-wrapped | ✅ | quick-setting, world-rpg, tabletop, creation-forge |
| core.dynamic_state | 动态世界状态 | M3 | legacy-wrapped | ✅ | quick-setting, character, world-rpg, tabletop, mystery-puzzle, strategy-sim, creation-forge |
| character.preset | 角色预设 | M8 | legacy-wrapped | ✅ | character, world-rpg, creation-forge, murder-mystery |
| character.cognition | 角色认知 | M9 | legacy-wrapped | ✅ | character, world-rpg, creation-forge |
| scene.session | 场景会话 | M11 | legacy-wrapped | ✅ | quick-setting, character, world-rpg, tabletop, mystery-puzzle |
| narrative.story_template | 故事模板 | M12 | legacy-wrapped | ✅ P2-A | quick-setting, world-rpg |
| narrative.five_layer_engine | 五层叙事引擎 | M13 | legacy-wrapped | ✅ P2-A | quick-setting, world-rpg |
| rule.world_rule | 世界规则 | M15 | legacy-wrapped | ✅ P2-A | world-rpg, tabletop, mystery-puzzle |
| audit.narrative_quality | 叙事质量审查 | M15c | legacy-wrapped | ✅ | quick-setting, character, world-rpg, tabletop, mystery-puzzle, strategy-sim, creation-forge |
| character.card_runtime | 角色卡驱动 | M19 | legacy-wrapped | ✅ | character |
| creation.alchemy | 创作炼金台 | M-创作 | legacy-wrapped | ✅ | creation-forge |
| entity.relationship_network | 关系网络 | M6 | legacy-wrapped | ✅ P2-A | world-rpg, strategy-sim |

**共 13 个，处理：在世界书 V1 和各 mode V1 中调用，不重写。**

### B. 翻新包装（有代码，缺 wrapper）

| 模块 ID | 中文名 | Legacy | 当前状态 | wrapper | 来源文件 |
|---------|--------|--------|---------|---------|---------|
| entity.organization | 组织实体 | M4 | legacy-inline | ❌ | src/core/data/organizations.js |
| entity.organization_hierarchy | 组织层级 | M5 | legacy-inline | ❌ | src/core/data/organizations.js |
| entity.key_character | 关键人物 | M7 | legacy-inline | ❌ | src/core/data/characters.js |
| lore.race_dimension | 种族维度 | M10 | legacy-inline | ❌ | src/core/data/race.js |
| time.timeline | 时间线 | M16 | legacy-inline | ❌ | src/core/data/timeline.js, timeline-causality.js |
| event.random_event | 随机事件 | M17 | legacy-inline | ❌ | src/core/data/random-events.js |
| prediction.scene_direction | 场景走向预测 | M18 | legacy-inline | ❌ | src/core/data/prediction.js, direction-packet.js |

**共 7 个，处理：世界书 V1 优先包装 time.timeline / prediction.scene_direction。其余在对应 mode V1 时包装。**

### C. 合并吸收（归入世界书基础层）

以下模块功能与世界书 V1 的基础层高度重叠，应被统一调度：

| 模块 ID | 归属 |
|---------|------|
| lore.worldbook_trigger | → 世界书上下文激活器 |
| core.dynamic_state | → 世界状态层 |
| scene.session | → 场景层 |
| entity.relationship_network | → 关系网络层 |
| time.timeline | → 时间线层 |
| prediction.scene_direction | → 运行上下文建议层 |
| narrative.story_template | → 叙事风格模板 |
| narrative.five_layer_engine | → 叙事引擎管线 |
| rule.world_rule | → 规则边界 |

**保留原名，产品概念上被世界书基础层统一调度。**

### D. 暂缓保留（模式专属原型，不接入世界书 V1）

| 模块 ID | 中文名 | 归属模式 | 何时启用 |
|---------|--------|---------|---------|
| rpg.quest | 任务系统 | world-rpg | World-RPG Full V1 |
| rpg.bond | 羁绊系统 | world-rpg | World-RPG Full V1 |
| rpg.chapter | 章节系统 | world-rpg | World-RPG Full V1 |
| rpg.growth | 成长系统 | world-rpg | World-RPG Full V1 |
| trpg.dice | 跑团骰子 | tabletop | Tabletop Full V1 |
| trpg.check | 跑团检定 | tabletop | Tabletop Full V1 |
| trpg.character_sheet | 跑团角色卡 | tabletop | Tabletop Full V1 |
| trpg.clock | 跑团进度钟 | tabletop | Tabletop Full V1 |
| mystery.case | 案件系统 | murder-mystery | Murder-Mystery Full V1 |
| mystery.phase | 案件阶段 | murder-mystery | Murder-Mystery Full V1 |
| mystery.clue | 线索系统 | murder-mystery/puzzle | Murder-Mystery Full V1 |
| mystery.testimony | 证词系统 | murder-mystery | Murder-Mystery Full V1 |
| mystery.truth_lock | 真相锁 | murder-mystery | Murder-Mystery Full V1 |
| mystery.scoring | 推理评分 | murder-mystery | Murder-Mystery Full V1 |
| strategy.resource | 策略资源 | strategy-sim | Strategy-Sim Full V1 |
| strategy.calendar | 策略日历 | strategy-sim | Strategy-Sim Full V1 |
| strategy.decision | 策略决策 | strategy-sim | Strategy-Sim Full V1 |
| strategy.faction | 策略势力 | strategy-sim | Strategy-Sim Full V1 |
| strategy.diplomacy | 策略外交 | strategy-sim | Strategy-Sim Full V1 |
| strategy.turn | 策略回合 | strategy-sim | Strategy-Sim Full V1 |
| strategy.loyalty | 忠诚度 | strategy-sim | Strategy-Sim Full V1 |

**共 21 个，处理：不接入世界书 V1，各自在对应 mode V1 时启用。**

### E. 未来声明（仅声明，无实现）

| 模块 ID | 说明 |
|---------|------|
| core.memory | 分层记忆 — 声明 |
| core.review | 运行审查 — 声明 |
| core.canon | Canon/Inference/Proposal — 声明 |
| core.debug | 模块调试 — 声明 |
| puzzle.scene | 场景谜题 — 声明 |
| creation.questioning | 创作追问 — 声明 |
| creation.outline | 创作大纲 — 声明 |

**共 7 个，处理：只记录，不接入，后续 V2 讨论。**

## 世界书相关资产清单
直接用于世界书 V1：core.world_container, lore.worldbook_trigger, core.dynamic_state, entity.relationship_network, scene.session, narrative.story_template, narrative.five_layer_engine, rule.world_rule, audit.narrative_quality, time.timeline, prediction.scene_direction — **共 11 个**。

## 各模式专属资产清单
character: character.preset, character.cognition, character.card_runtime (3)
world-rpg: rpg.quest, rpg.bond, rpg.chapter, rpg.growth (4)
tabletop: trpg.dice, trpg.check, trpg.character_sheet, trpg.clock (4)
murder-mystery: mystery.case, mystery.phase, mystery.clue, mystery.testimony, mystery.truth_lock, mystery.scoring (6)
strategy-sim: strategy.resource, strategy.calendar, strategy.decision, strategy.faction, strategy.diplomacy, strategy.turn, strategy.loyalty (7)

## 风险
- M4(entity.organization)/M5/M7/M10 无 wrapper，接入世界书 V1 前需评估包装成本
- time.timeline / prediction.scene_direction 虽标记为翻新包装，但已有完整旧代码，包装成本可控
- 暂缓的原型模块代码（rpg/trpg/mystery/strategy）未测试，启用时可能有 bit-rot
