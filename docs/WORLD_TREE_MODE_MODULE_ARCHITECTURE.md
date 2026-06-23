# World Tree Mode × Module 调用层

## 1. Mode 与 Module

Mode 是玩法入口、运行协议和用户体验契约；Module 是可被多个 mode 复用的数据、规则或引擎能力。`character`、`tabletop`、`world-rpg` 是 mode，不是巨型 module；角色认知、场景会话、规则审查、骰子和任务才是 module。

当前已经建立架构骨架、quick-setting 纵向切片和 P1 热路径 wrappers。wrapper 仍是旁路能力层：不会把 hidden 模式暴露给用户，不会让 LLM 自动调用所有模块，也不会接管完整玩法或 lifecycle。

## 2. 为什么暂不补齐具体能力

旧 M1-M19 仍被 preset、profile、prompt、lifecycle 和 `activeModules` 使用。直接替换会同时改变运行协议、存档兼容与用户体验。本层先让系统能回答“有哪些模块、状态如何、mode 依赖什么、依赖是否缺失”，后续才能逐项迁移并独立验证。

## 3. 模块状态

| 状态 | 含义 |
|---|---|
| `implemented` | 有明确实现和测试，可由新层安全登记 |
| `legacy-wrapped` | 旧能力已有明确函数边界，可由 wrapper/manifest 标准化 |
| `legacy-inline` | 能力存在，但仍散落在运行时编排中 |
| `prototype-hidden` | 有原型代码，但所属 profile 未开放 |
| `declared-only` | 未来需要，目前仅声明 |
| `deprecated` | 仅保留兼容，不建议继续使用 |
| `missing` | mode 或依赖图引用了 manifest 中不存在的 ID |

## 4. 八个 mode 的默认 uses

| Mode | Status | Uses |
|---|---|---|
| `quick-setting` | active | `core.world_container`, `lore.worldbook_trigger`, `core.dynamic_state`, `scene.session`, `narrative.story_template`, `narrative.five_layer_engine`, `audit.narrative_quality` |
| `character` | planned | `core.world_container`, `character.preset`, `character.cognition`, `character.card_runtime`, `scene.session`, `audit.narrative_quality`, `core.dynamic_state` |
| `murder-mystery` | hidden | `mystery.case`, `mystery.phase`, `mystery.clue`, `mystery.testimony`, `mystery.truth_lock`, `mystery.scoring`, `character.preset` |
| `tabletop` | hidden | 核心/世界书/状态/场景/规则/审计/时间/事件/预测，以及 `trpg.dice`, `trpg.check`, `trpg.character_sheet`, `trpg.clock` |
| `mystery-puzzle` | planned | 核心容器、场景、`puzzle.scene`、线索、规则、审计、动态状态 |
| `world-rpg` | planned | 世界运行基础、关系与角色、叙事规则、时间事件预测，以及 `rpg.quest`, `rpg.bond`, `rpg.chapter`, `rpg.growth` |
| `strategy-sim` | hidden | 世界状态、组织关系、时间事件，以及 resource/calendar/decision/faction/diplomacy/turn/loyalty |
| `creation-forge` | planned | 世界容器、炼金台、追问、大纲、世界书、角色预设与认知、动态状态、审计 |

完整且可执行的映射以 `src/core/modes/mode-module-map.js` 为准。

## 5. ModuleRegistry

Registry 负责标准 ID 与 legacy ID 查询、筛选、依赖展开、缺失项保留、module graph 和状态/分类统计。依赖展开按依赖优先排序、去重；缺失依赖进入 `missing` 和 `warnings`，不会抛错终止。P1 后 graph 还报告 `hasWrapper`、真实 `hooks` 和 wrapper-backed `callable`，避免把只有 manifest 声明的模块误报为可调用。

## 6. ModuleLoader

Loader 根据 mode 的 `uses` 生成 graph，或直接加载一组 module ID。`loadModuleWrapper()` 与 `loadWrappersForMode()` 可显式取得 P1 wrappers；缺 wrapper 只进入 missingWrappers/warnings。Loader 不会自动执行 hook，也不会将 wrapper 输出注入主 prompt。

## 7. M1-M19 兼容策略

`src/core/engine/modules.js` 继续是旧运行时兼容注册表。新 module ID 不替换 `MODULES`、`MODULE_PRESETS`、`DATA_MODES` 或 `DEFAULT_ENGINE_STATE.activeModules`；profile 中的旧编号也不迁移。`LEGACY_MODULE_MAP` 只提供双向理解中的 legacy → capability 查询。

## 8. 后续开发方式

每次选择一个 mode 和一个可验证纵向切片：先读取 graph 与 warnings，再为一个 `legacy-inline`/`prototype-hidden` 能力建立 wrapper、契约测试和集成测试，最后才评估状态提升。所有依赖达到可调用条件后，再单独规划 UI 可见性与 profile 激活。

## 9. 禁止事项

- 不开放 hidden profile 或新增 8 个 UI 入口。
- 不把 `DATA_MODES` 改造成新 mode manifest。
- 不删除旧 M1-M19，不迁移现有 activeModules。
- 不把原型或仅声明模块标为 implemented。
- 不引入前端框架、插件市场、远程 loader 或 sandbox。
- 不借本任务重写 prompt、玩法、导入导出或世界书数据格式。

## 10. 验收标准

六个核心/模式 JS 文件可通过 `node --check`；legacy M2/M19 可解析到标准 ID；八个 mode 均有映射；planned 与 hidden mode 都能生成 graph；declared-only 只产生 warning；missing 不抛错；单元测试与项目 preflight 通过；现有三个 `DATA_MODES` 和 hidden profile 状态保持不变。
