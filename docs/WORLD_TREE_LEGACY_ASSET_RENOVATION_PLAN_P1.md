# World Tree 旧资产翻新合并计划 P1

## 1. 直接复用清单（13 个）

| 模块 | 在世界书 V1 中的角色 |
|------|-------------------|
| core.world_container | 提供项目/分支/模式摘要 |
| lore.worldbook_trigger | 世界书条目命中与注入 |
| core.dynamic_state | 场景/时间/变量/情绪摘要 |
| entity.relationship_network | 关系网络读取 |
| scene.session | 当前场景与上下文窗口 |
| narrative.story_template | 风格提示 |
| narrative.five_layer_engine | 引擎管线状态摘要 |
| rule.world_rule | 规则边界检查 |
| audit.narrative_quality | 叙事输出审查 |
| character.preset | 角色预设（character 模式专用） |
| character.cognition | 角色认知（character 模式专用） |
| character.card_runtime | 角色卡驱动（character 模式专用） |
| creation.alchemy | 炼金台（creation-forge 专用） |

**处理：在世界书 V1 / Character V1 / 各 mode V1 中调用，不重写。**

## 2. 翻新包装清单（7 个）

| 模块 | 优先级 | 包装计划 |
|------|--------|---------|
| time.timeline | P2-A | 世界书 V1 优先包装：createTimelineEvent, traceCauses |
| prediction.scene_direction | P2-A | 世界书 V1 优先包装：predictScene, buildDirectionPacket |
| entity.key_character | P2-B | World-RPG V1 时包装 |
| entity.organization | P2-B | Strategy-Sim V1 时包装 |
| entity.organization_hierarchy | P2-C | 合并到 entity.organization |
| lore.race_dimension | P2-C | 作为可选扩展 |
| event.random_event | P2-B | World-RPG V1 时包装 |

**处理：保留旧代码，补 wrapper + summary + debugInfo，补测试，接入对应 mode V1。**

## 3. 合并吸收清单（9 个）

归入世界书基础层统一调度的模块，保留原名：

- lore.worldbook_trigger → 世界书上下文激活器
- core.dynamic_state → 世界状态层
- scene.session → 场景层
- entity.relationship_network → 关系网络层
- time.timeline → 时间线层
- prediction.scene_direction → 运行上下文建议层
- narrative.story_template → 叙事风格模板
- narrative.five_layer_engine → 叙事引擎管线
- rule.world_rule → 规则边界

**处理：不删除，由 Worldbook Module Integration 统一调用。**

## 4. 暂缓保留清单（21 个）

全部属于具体玩法入口，不接入世界书 V1：
rpg.quest/bond/chapter/growth, trpg.dice/check/character_sheet/clock,
mystery.case/phase/clue/testimony/truth_lock/scoring,
strategy.resource/calendar/decision/faction/diplomacy/turn/loyalty

**处理：保留，不开放，等对应 mode Full V1 时逐个启用。**

## 5. 未来声明清单（7 个）

core.memory, core.review, core.canon, core.debug, puzzle.scene, creation.questioning, creation.outline

**处理：只记录，后续 V2 讨论。**

## 6. 世界书 V1 如何使用现有模块

世界书 V1 通过 `worldbook-module-integration.js` 统一调用现有模块：

```
createWorldbookModuleRuntimePacket(project, input)
  → createModuleRuntimePacket("quick-setting" | "world-rpg", ctx)
  → 收集 contextBlocks / promptBlocks / debugInfo
  → 收集 warnings / errors
  → 生成 sourceMap
  → 由 World Context Packet 选择哪些进入提示词
```

优先调用 9 个直接复用模块，可选轻量读取 time.timeline / prediction.scene_direction。

## 7. 哪些模块不允许在世界书 V1 中启用

以下模块明确禁止在世界书 V1 中启用：
- 所有暂缓保留清单的模块（rpg/trpg/mystery/strategy 专属原型）
- 未来声明模块（core.memory/review/canon/debug 等）
- creation-forge 相关模块（creation.alchemy 仅 creation-forge 模式使用）

## 8. 后续入口 V1 如何逐步启用隐藏原型

| Mode | 何时启用 | 启用哪些原型 |
|------|---------|------------|
| World-RPG V1 | 世界书 V1 完成后 | rpg.quest, rpg.bond, rpg.chapter |
| Tabletop V1 | — | trpg.dice, trpg.check |
| Strategy-Sim V1 | — | strategy.resource, strategy.turn, strategy.faction |
| Murder-Mystery V1 | — | mystery.case, mystery.clue, mystery.truth_lock |
| Mystery-Puzzle V1 | — | mystery.clue (复用) |

## 9. 世界书 V1 接入原则

1. 不重建已有模块
2. 不删除旧模块
3. 不把隐藏原型强行启用
4. 不让旧 wrapper 直接接管主提示词
5. 由世界书适配器读取模块输出
6. 由世界书上下文包决定哪些内容进入提示词
7. shared 文件是真相源
8. runtime/cache 是可重建缓存
9. 重大世界变化走提案，不直接改正史
