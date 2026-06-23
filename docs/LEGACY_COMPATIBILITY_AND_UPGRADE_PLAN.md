# Legacy Compatibility and Upgrade Plan

> **Policy: No deletion by default.** 旧文件保留，标注身份，逐步收敛。

## Policy

1. **不删除旧文件**。所有旧资产保留在当前目录结构中。
2. **标注身份**。在本文档和 `LEGACY_REDUNDANCY_AUDIT.md` 中明确每个旧文件的分类。
3. **逐步收敛**。active-compatibility 文件可在后续版本中迁移到新胶囊，但不强制。
4. **不破坏兼容**。修改 bridge 文件前必须跑相关测试和 preflight。

## Compatibility Layers

当前 V1 的兼容层分为三层：

| 层 | 文件 | 状态 |
|----|------|------|
| Engine bridge | `src/core/engine/rpg.js`, `tabletop.js`, `sim.js`, `murder-mystery.js` | active, tested |
| Engine bridge | `src/core/engine/modules.js`, `lifecycle.js`, `context-engine.js` 等 | active, tested |
| Data bridge | `src/core/data/alchemy/`, `character-card.js`, `templates.js` | active, tested |
| Server bridge | `src/server/module-service.js`, `data-import-service.js` | active, tested |
| API bridge | `server.js` world-pack routes | active, tested |

## Legacy Bridges

### Old Engine DM Instructions

| 旧文件 | 新替代 (V1 capsule) | 当前状态 |
|--------|---------------------|----------|
| `src/core/engine/rpg.js` | `src/core/grand-world/` | Re-exported by world-engine.js |
| `src/core/engine/tabletop.js` | `src/core/tabletop/` | Re-exported by world-engine.js |
| `src/core/engine/sim.js` | `src/core/strategy-sim/` | Re-exported by world-engine.js |
| `src/core/engine/murder-mystery.js` | `src/core/murder-mystery/` | Re-exported by world-engine.js |

这些旧文件导出 DM instruction 常量，被 `world-engine.js` 导入并 re-export。新胶囊 `mode-runner.js` 使用 route index + prompt registry，不完全依赖这些旧 DM instruction。但旧 API（world-engine exports）可能仍有外部引用。

**升级策略**: 确认无外部引用后可移除 re-export，DM instruction 保留在旧文件作为 reference。

### Old Data Models

| 旧文件/目录 | 新替代 | 当前状态 |
|-------------|--------|----------|
| `src/core/data/alchemy/` | `src/core/creation-forge/` + V1 parser | 通过 wrapper 桥接 |
| `src/core/data/character-card.js` | `src/core/character/` | world-engine 直接引用 |
| `src/core/data/templates.js` | V1 prompt registry | world-engine 直接引用 |

**升级策略**: alchemy 管道已稳定桥接到 creation-forge。character-card 和 templates 可逐步迁移到新胶囊内部。

### World-Pack Import/Export

| 文件 | 说明 |
|------|------|
| `server.js` `/api/world-pack/export` | 导出 .worldtree 包 |
| `server.js` `/api/world-pack/import` | 导入 .worldtree 包 |
| `src/server/data-import-service.js` | 导入逻辑 |
| `src/core/system/world-tree-save-system.js` | 新 save-system（partial bridge） |

**升级策略**: 新 save-system 的 `exportWorldTreeSave` 已标注为 `status: "partial", kind: "snapshot_bridge"`。完整 .worldtree 打包仍由旧 API 承担。后续可评估是否将 export/import 完全收敛到新 save-system。

### Module Service

`src/server/module-service.js` 包含所有模式的初始化逻辑（world-rpg, tabletop, mystery-puzzle, strategy-sim, murder-mystery, creation-forge, character, quick-setting）。

**升级策略**: 当前稳定。后续可考虑将模式初始化逻辑下沉到各 mode capsule 的 factory 方法中。

## Archived Designs

以下文档是项目历史的宝贵记录，已标记为 `archived-design`：

- P1 执行文档（~12 个 `WORLD_TREE_*_P1.md`）
- 历史审计/报告（`WORLD_TREE_LEGACY_ASSET_AUDIT_P1.md` 等）
- 初始设计文档（`WORLD_TREE_QUICK_SETTING_SLICE.md` 等）

**升级策略**: 不移动、不删除。在 `DOCUMENTATION_STATUS.md` 中标注。当前能力以 `ARCHITECTURE_V1.md` 为准。

## Superseded References

以下文档已被当前文档覆盖：

- 旧设计文档（`context-engine-design-v1.md` 等）→ 替代: `ARCHITECTURE_V1.md`
- 旧审计（`v0.3.0-baseline-audit.md`）→ 替代: 本文档 + current test status
- 旧升级计划（`WORLD_TREE_LEGACY_ASSET_RENOVATION_PLAN_P1.md`）→ 替代: 本文档

**升级策略**: 保留作为历史参考。在 `DOCUMENTATION_STATUS.md` 中标注 `superseded-reference`。

## Upgrade Plan

### Safe Now

以下操作现在就可以安全执行（不删文件，不加功能）：

1. ✅ 创建 `docs/LEGACY_REDUNDANCY_AUDIT.md`（本任务已完成）
2. ✅ 创建 `docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md`（本文档）
3. ✅ 更新 `docs/DOCUMENTATION_STATUS.md` 加入 legacy 状态
4. ✅ 更新 `docs/INDEX.md` 加入 Legacy / Compatibility 章节
5. ✅ 更新 `AI-GUIDE.md` 加入 Legacy 文件处理规则
6. 可选: 给旧 engine 文件加文件头注释

### Later With Confirmation

需要用户确认后才能执行：

1. 旧 engine DM instruction 文件是否可移除 re-export（需要确认无外部引用）
2. orphan-candidate 文件是否可归档到 `docs/archive/`
3. 历史执行文档是否可移动到 `docs/archive/execution/`
4. alchemy → creation-forge 管线是否需要更紧密整合

### Do Not Touch

以下绝对不能改：

1. 旧 engine 文件 (`rpg.js`, `tabletop.js`, `sim.js`, `murder-mystery.js`) — 运行中引用
2. `src/core/data/alchemy/` — creation-forge 依赖
3. `server.js` world-pack routes — 用户数据导入导出依赖
4. `module-service.js` — 项目创建依赖
5. 所有测试文件 — 回归保护
