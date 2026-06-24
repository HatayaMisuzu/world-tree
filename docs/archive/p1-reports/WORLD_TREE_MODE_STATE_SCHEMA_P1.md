# Mode State Schema P1

## 1. 为什么需要 Mode State Schema

Phase A-C 完成了 Mode Runtime Core（metadata/graph/initialState）和 Module Runtime Orchestrator（wrapper hook 聚合），但现在还缺少统一的**运行时状态契约**。如果直接做功能入口，quick-setting / character / world-rpg / creation-forge 各写一套 state → 难维护、难审计、难共享。

Mode State Schema 定义了四个通用状态容器，使后续所有 mode 都有一致的落盘结构：

- `modeState` — mode 自己的运行状态
- `moduleState` — 各 module 的运行状态
- `runtimeFlags` — 运行时结构开关
- `reviewPolicy` — 审核策略基础契约

## 2. Mode State Envelope 结构

```js
createModeStateEnvelope(modeId) → {
  schemaVersion: 1,
  mode: "quick-setting",
  modeVersion: 1,
  modeState: {
    status: "initialized",
    turnCount: 0,
    lastActiveAt: null,
    sourceType: "pasted_text",
    dataMode: "preset",
    worldSubType: "classic"
  },
  moduleState: {
    "core.world_container": { status, updatedAt, data, warnings },
    ...
  },
  runtimeFlags: {
    modeRuntimeReady, moduleRuntimeReady, stateSchemaReady,
    projectFactoryReady, reviewContractReady, importExportReady,
    visibleToUser
  },
  reviewPolicy: {
    policyVersion, defaultDisposition, allowAutoApply,
    requireUserConfirmation, proposalTypes, protectedScopes, notes
  },
  createdAt, updatedAt
}
```

## 3. modeState / moduleState / runtimeFlags / reviewPolicy

| 组件 | 职责 | 关键约束 |
|------|------|---------|
| `modeState` | mode 自身运行状态（status/turnCount/sourceType/dataMode/worldSubType），各 mode 可附加占位字段 | 不填复杂业务逻辑 |
| `moduleState` | 每个 module（由 `getModulesForMode` 生成 keys）的默认状态容器 | 每个 key 有 `{status, updatedAt, data, warnings}` |
| `runtimeFlags` | 结构就绪开关，`visibleToUser` 必须来自 mode manifest | 禁止通过 flags 打开 hidden mode |
| `reviewPolicy` | 未来 Review/Proposal 契约的占位，默认 `manual_review` / `allowAutoApply=false` | 不改变现有审核行为 |

## 4. 为什么本轮不迁移现有 runtime/state.json

当前 `runtime/state.json` 承载了 `engineState`（dataMode/preset/activeModules 等）、`emotionState` 和 `moduleGraph` 等字段，由 `persistTurn` 每轮覆盖写入。强行迁移可能破坏：

- quick-setting 创建流程
- `.worldtree` 导入导出
- 旧 preset 管线兼容性

本轮只定义 schema 结构并通过 unit tests 验证，为后续 Mode Project Factory 提供落地基础。迁移路径在 Project Factory 阶段规划。

## 5. 为什么 hidden mode 可以生成 envelope 但不能 visible

`createModeStateEnvelope` 对所有 mode 均一视同仁——hidden mode 也能生成完整 envelope（包括 `moduleState` 的所有模块键）。但 `runtimeFlags.visibleToUser` 和 `validateModeStateEnvelope` 强制检查 hidden mode 不能设 `visibleToUser=true`。UI 可见性决策路径不变。

## 6. reviewPolicy 的保守默认值

| 字段 | 默认值 | 原因 |
|------|--------|------|
| `defaultDisposition` | `"manual_review"` | 所有变更默认需人工审核 |
| `allowAutoApply` | `false` | 禁止 AI 自动写入 confirmed canon |
| `requireUserConfirmation` | `true` | 用户确认是最终闸门 |
| `protectedScopes` | `world.json`, `shared/`, `runtime/state.json` | 核心文件受保护 |

这些默认值是安全底线，未来各 mode 可通过 reviewPolicy 定制，但核心保护范围不可缩减。

## 7. 与 Mode Runtime Core / Module Runtime Orchestrator 的关系

三者在当前阶段并列互补：

- **Mode Runtime Core**（B1）：mode metadata / moduleGraph / wrapperGraph / initialState
- **Module Runtime Orchestrator**（C1）：wrapper hook outputs / contextBlocks / promptBlocks / debugInfo
- **Mode State Schema**（D1）：modeState / moduleState / runtimeFlags / reviewPolicy

三者尚未合并为一个统一 runtime packet，这是 Mode Project Factory (D2) 的职责。

## 8. 下一步 Mode Project Factory P1

基于 Mode Runtime Core + Module Runtime Orchestrator + Mode State Schema，抽象统一 `createProjectFromMode(modeId, input)` 结构。完成后停止纯底层任务，开始功能入口开发（character/world-rpg/creation-forge vertical slice）。
