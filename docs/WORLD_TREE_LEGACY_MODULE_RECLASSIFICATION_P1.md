# Legacy Module Reclassification P1

## 1. 为什么需要重分类

Phase A3 (Legacy Module Standardization P1) 为 9 个热路径模块创建了 wrapper。但 `module-manifest.js` 中另有 8 个模块也被标记为 `LEGACY_WRAPPED`（M4/M6/M10/M12/M15/M16/M17/M18），却没有对应的 wrapper 文件。这导致：

- `getModuleGraph()` 报告 `callable: false` 或 `hasWrapper: false`
- `loadWrappersForMode()` 返回 `missingWrappers` 条目
- 进入功能入口开发前需要明确哪些模块真正 ready

本轮修正系统化模块分类，确保 manifest 状态与真实代码一致。

## 2. 旧 M1-M19 当前状态表

| Legacy | Capability ID | 状态 | wrapper | 分类 |
|--------|--------------|------|---------|------|
| M1 | core.world_container | legacy-wrapped | ✅ P1 | ready-wrapper |
| M2 | lore.worldbook_trigger | legacy-wrapped | ✅ P1 | ready-wrapper |
| M3 | core.dynamic_state | legacy-wrapped | ✅ P1 | ready-wrapper |
| M4 | entity.organization | legacy-inline | ❌ | compatibility-only |
| M5 | entity.organization_hierarchy | legacy-inline | ❌ | merge-candidate → M4 |
| M6 | entity.relationship_network | legacy-wrapped | ✅ P2-A | ready-wrapper |
| M7 | entity.key_character | legacy-inline | ❌ | merge-candidate → character.preset |
| M8 | character.preset | legacy-wrapped | ✅ P1 | ready-wrapper |
| M9 | character.cognition | legacy-wrapped | ✅ P1 | ready-wrapper |
| M10 | lore.race_dimension | legacy-inline | ❌ | optional-extension |
| M11 | scene.session | legacy-wrapped | ✅ P1 | ready-wrapper |
| M12 | narrative.story_template | legacy-wrapped | ✅ P2-A | ready-wrapper |
| M13 | narrative.five_layer_engine | legacy-wrapped | ✅ P2-A | ready-wrapper |
| M15 | rule.world_rule | legacy-wrapped | ✅ P2-A | ready-wrapper |
| M15c | audit.narrative_quality | legacy-wrapped | ✅ P1 | ready-wrapper |
| M16 | time.timeline | legacy-inline | ❌ | needs-p2-wrapper |
| M17 | event.random_event | legacy-inline | ❌ | needs-p2-wrapper |
| M18 | prediction.scene_direction | legacy-inline | ❌ | needs-p2-wrapper |
| M19 | character.card_runtime | legacy-wrapped | ✅ P1 | ready-wrapper |
| M-创作 | creation.alchemy | legacy-wrapped | ✅ P1 | ready-wrapper |

## 3. 各 mode 模块就绪状态

| Mode | 所需模块 | 有 wrapper | 缺口 |
|------|---------|-----------|------|
| quick-setting | 7 | 7/7 ✅ | 0 |
| character | 7 | 7/7 ✅ | 0 |
| world-rpg | 19 | 9/19 | M4/M5/M7/M10/M16/M17/M18 |
| creation-forge | 9 | 6/9 | M4/M5/M7 |

## 4. 保留 / 合并 / 降级 / P2 wrapper 建议

- **保留 (ready-wrapper)**: M1/M2/M3/M6/M8/M9/M11/M12/M13/M15/M15c/M19/M-创作 — 13 个
- **降级 (legacy-inline)**: M4/M10/M16/M17/M18 — 无独立 wrapper，功能内联于数据模块，needs-p2-wrapper
- **合并候选**: M5→M4, M7→character.preset
- **可选扩展**: M10 → lore.species_culture (未来方向)

## 5. 不删除旧 M 编号的原因

旧 M1-M19 仍被 `src/core/engine/modules.js` 的 `MODULES`、`MODULE_PRESETS`、`DEFAULT_ENGINE_STATE.activeModules` 使用。`LEGACY_MODULE_MAP` 保持双向映射不变。安全性考虑：删除旧编号会影响 prompt 模板和存档兼容。

## 6. P2 wrapper 优先级

| 优先级 | 模块 | 阻塞 | 原因 |
|--------|------|------|------|
| P2-A ✅ | M13/M12/M15/M6 | character / quick-setting | 本轮已完成 |
| P2-B | M16/M17/M18 | world-rpg | 推迟到 world-rpg vertical slice |
| P2-C | M4/M10 | strategy-sim | 低优先级 |

## 7. 进入功能入口前已补齐

- ✅ M13 narrative.five_layer_engine — character.card_runtime 依赖
- ✅ M12 narrative.story_template — quick-setting / world-rpg 依赖
- ✅ M15 rule.world_rule — world-rpg / review 边界
- ✅ M6 entity.relationship_network — character / world-rpg 关系网络
- ✅ manifest 状态漂移已修正（无 wrapper 的不再标 legacy-wrapped）
