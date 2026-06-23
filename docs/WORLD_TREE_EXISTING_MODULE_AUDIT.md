# World Tree 现有模块审计

## 审计结论

当前模块系统不是废弃系统，而是需要标准化的兼容基础。旧 M1-M19（含 M15c 与 M-创作）继续服务于 `MODULES`、`MODULE_PRESETS`、`DATA_MODES`、`activeModules`、prompt 和 lifecycle；新的 capability module 层先提供登记、查询、映射、依赖图和审计能力，不立即重写现有功能。

状态含义见 `WORLD_TREE_MODE_MODULE_ARCHITECTURE.md`。表中“直接”表示当前已有可定位的函数 API；“内联”表示能力由 world-engine/lifecycle 等共同编排；“声明”表示旧模块名或 prompt 仍在使用，但没有统一调用接口。

## M1-M19 总表

| Legacy ID | Legacy Name | New Module ID | Status | Source Files | Current Usage | Future Role | Notes |
|---|---|---|---|---|---|---|---|
| M1 | 世界书隔离容器 | `core.world_container` | legacy-inline | `world-engine.js`; `data-store.js`; `world-manager.js` | 内联运行时基础 | 世界实例与数据隔离边界 | 保留旧 activeModules ID |
| M2 | 触发式条目系统 | `lore.worldbook_trigger` | legacy-wrapped | `data/worldbook.js`; `runtime/worldbook-runtime.js` | 直接：匹配、注入、诊断 | 标准 lore 上下文提供者 | 已有清晰 API |
| M3 | 动态世界状态 | `core.dynamic_state` | legacy-wrapped | `data/world-state.js`; `state-persistence.js` | 直接 + lifecycle 编排 | 状态快照与持久化能力 | 不迁移现有状态格式 |
| M4 | 组织实体 | `entity.organization` | legacy-wrapped | `data/organizations.js` | 直接：标准化与摘要 | 组织实体能力 | — |
| M5 | 组织层级 | `entity.organization_hierarchy` | legacy-inline | `data/organizations.js`; organization schema | 数据/声明为主 | 独立层级查询能力 | 尚无独立 wrapper |
| M6 | 关系网络 | `entity.relationship_network` | legacy-wrapped | `data/relations.js` | 直接：关系图与变更 | 通用关系能力 | — |
| M7 | 关键人物 | `entity.key_character` | legacy-inline | `data/characters.js`; `data/character-card.js` | 内联选择与 prompt 注入 | 关键人物筛选能力 | 不等同 character mode |
| M8 | 角色预设系统 | `character.preset` | legacy-wrapped | `data/character-card.js`; `data/templates.js` | 直接：解析与预设 | 可复用角色预设 | — |
| M9 | 角色认知层 | `character.cognition` | legacy-wrapped | `data/cognition.js`; `data/character-card.js` | 直接：认知边界 | 角色视角过滤能力 | — |
| M10 | 种族维度 | `lore.race_dimension` | legacy-wrapped | `data/race.js` | 直接：维度、关系与张力 | 可选 lore 维度 | 当前 8 个默认映射未直接使用 |
| M11 | 场景会话管理 | `scene.session` | legacy-wrapped | `data/scenes.js`; `context-router.js` | 直接 + lifecycle | 通用场景会话能力 | — |
| M12 | 故事模板 | `narrative.story_template` | legacy-wrapped | `data/templates.js` | 直接：预设摘要与风格 | 叙事模板提供者 | — |
| M13 | 叙事引擎五层 | `narrative.five_layer_engine` | legacy-inline | `world-engine.js`; `lifecycle.js`; `director.js` | 内联 prompt/运行编排 | 未来拆分叙事管线 | 本阶段不重写 prompt |
| M15 | 世界规则 | `rule.world_rule` | legacy-wrapped | `data/rules.js`; `guardian.js` | 直接：可行性与规则检查 | 通用规则能力 | — |
| M15c | 叙事质量审查 | `audit.narrative_quality` | legacy-wrapped | `data/rules.js`; `guardian.js`; `guardian-llm.js` | 直接：审计与纠正 | 标准输出审查能力 | — |
| M16 | 时间模块 | `time.timeline` | legacy-wrapped | `data/timeline.js`; `timeline-causality.js` | 直接：事件与因果 | 通用时间线能力 | — |
| M17 | 随机性模块 | `event.random_event` | legacy-wrapped | `data/random-events.js` | 直接：提案与历史 | 事件提案能力 | 不改变现有触发策略 |
| M18 | 场景走向预测 | `prediction.scene_direction` | legacy-wrapped | `data/prediction.js`; `direction-packet.js` | 直接 + director 编排 | 可审计的走向建议 | — |
| M19 | 角色卡驱动模式 | `character.card_runtime` | legacy-wrapped | `data/character-card.js`; `world-engine.js` | 直接 + 专用 prompt | 角色卡运行能力 | 不把 character 变成巨型模块 |
| M-创作 | 世界书创作工具箱 | `creation.alchemy` | implemented | `data/alchemy/alchemy-engine.js`; `alchemy-preview-service.js` | 直接且已有测试 | 创作素材导入能力 | 仍保留旧 ID |

## 后续建议

1. 选择一个 mode 做纵向切片，为其所需的 legacy-inline 模块补 wrapper 和调用测试。
2. wrapper 稳定后再把状态提升为 `legacy-wrapped` 或 `implemented`，不要只凭存在源文件升级状态。
3. 继续让旧 M 编号承担兼容入口，直到 prompt、profile、lifecycle 和存档迁移有独立计划与回滚策略。
