# Mode Runtime Core P1

## 1. 本轮为什么要抽象 Mode Runtime Core

Phase A 完成了 Mode/Module 调用骨架、quick-setting 纵向切片和 Legacy Module Standardization P1。quick-setting 是第一个真实使用 Mode/Module 架构的入口，但它内部有较多专属 helper 逻辑（`createQuickSettingMetadata` / `createQuickSettingInitialState` / `summarizeQuickSettingGraph` 等）。

如果后续每个 mode（character / world-rpg / creation-forge 等）都各自写一套 metadata/initialState/runtime 逻辑，会导致大量重复代码和不一致的接口。因此本轮把 quick-setting 中已验证的结构能力**上提**为通用 Mode Runtime Core。

## 2. quick-setting 原有逻辑如何上提

quick-setting 原来的三个核心函数：

- `createQuickSettingMetadata` → 委托 `createModeMetadata("quick-setting", options)`
- `createQuickSettingInitialState` → 委托 `createModeInitialState("quick-setting", options)`
- `summarizeQuickSettingGraph` → 委托 `summarizeModeModuleGraph(loadResult)`

同时新增 `buildQuickSettingWrapperGraph` 和 `summarizeQuickSettingWrappers`，提供 wrapper 维度的查询能力。所有旧 API 保持不变，向后兼容。

## 3. ModeRuntimePacket 结构

```js
createModeRuntimePacket(modeId, options) → {
  mode,           // modeId
  metadata,       // 来自 createModeMetadata
  initialState,   // 来自 createModeInitialState
  engineStatePatch, // 来自 createModeEngineStatePatch
  moduleGraph,    // JSON-safe 模块图摘要
  wrapperGraph,   // JSON-safe wrapper 图摘要
  warnings        // 聚合所有 warning
}
```

## 4. ModeMetadata 结构

```js
createModeMetadata(modeId, options) → {
  mode,            // modeId
  modeVersion,     // 1
  displayName,     // "预设/设定" 等
  createdAt,       // ISO 时间戳
  sourceType,      // "pasted_text" / "character_card" / "worldbook" / "creation"
  dataMode,        // "preset" / "character_card" / "worldbook"
  worldSubType,    // "classic"
  status,          // "active" / "planned" / "hidden"
  defaultVisibility, // boolean
  moduleGraph,     // summarizeModeModuleGraph 摘要
  wrapperGraph     // summarizeModeWrapperGraph 摘要
}
```

## 5. ModeInitialState 结构

```js
createModeInitialState(modeId, options) → {
  mode,
  modeMetadata: { modeVersion, displayName, createdAt, sourceType, dataMode, worldSubType, status, defaultVisibility },
  moduleGraph,
  wrapperGraph,
  engineStatePatch: { dataMode, worldSubType, ...modeSpecific }
}
```

## 6. moduleGraph / wrapperGraph 如何摘要

- `summarizeModeModuleGraph`: 输入 `loadModulesForMode` 返回的 graph，过滤掉函数对象、循环引用、绝对路径和密钥，保留 id/legacyId/category/status/callable/hasWrapper/hooks 等 JSON-safe 字段。
- `summarizeModeWrapperGraph`: 输入 `loadWrappersForMode` 返回的 wrapper 集合，只保留 id/legacyId/status/hooks，不保存 wrapper 函数对象。

## 7. 为什么本轮不做新入口

当前处于 Core Architecture Completion 阶段，目标是先把底层架构契约做完，再回头做功能入口。character / world-rpg / creation-forge 等 mode 本轮只要求**结构上能生成 runtime packet**，不要求 UI 入口、创建流程或实际可玩性。Mode Runtime Core 是后续 Module Runtime Orchestrator、Mode Project Factory 等阶段的基础。

## 8. 为什么 hidden mode 可以结构生成但不能 UI 暴露

`createModeRuntimePacket` 对所有 mode（包括 hidden 状态的 murder-mystery / tabletop / strategy-sim）均一视同仁——都能生成完整的 runtime packet。但生成 packet ≠ 改变 mode 的 visibility 状态。UI 可见性由 `mode-manifest.js` 的 `status` 和 `defaultVisibility` 字段控制，本轮不改动这些字段。hidden mode 的结构 packet 仅供测试和架构验证使用。

## 9. 下一步 Module Runtime Orchestrator

本轮完成后，下一步（Phase C1）是 Module Runtime Orchestrator：给定 `modeId + model + input`，统一调用 wrappers 的 `buildContext` / `buildPromptBlock` / `getDebugInfo`，生成 `moduleRuntimePacket`，但仍不接管主 LLM prompt。只有完成 Mode Runtime Core + Module Runtime Orchestrator + Mode State Schema + Mode Project Factory + Review/Proposal Contract + Architecture Test Matrix 全部六个阶段后，才回到功能入口 demo。
