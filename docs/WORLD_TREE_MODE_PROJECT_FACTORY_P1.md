# Mode Project Factory P1

## 1. 为什么需要 Mode Project Factory

Phase A-D1 完成了四块底座：Mode Runtime Core（metadata/graph）、Module Runtime Orchestrator（wrapper hook 聚合）、Mode State Schema（状态契约）。但它们各自独立——还没有一个统一入口来**创建完整项目草案**，聚合三者并生成落盘文件结构。

如果直接做 character 入口，可能出现四套互相独立的项目创建逻辑（quick-setting / character / world-rpg / creation-forge 各写各的）。Mode Project Factory 解决了这个问题：`createModeProjectDraft(modeId, input)` 统一聚合三层底座，产出 JSON-safe 项目草案和文件 map。

## 2. createModeProjectDraft 与 createProjectFromMode 的区别

| 函数 | 用途 | 是否写文件 | 权限检查 |
|------|------|-----------|---------|
| `createModeProjectDraft` | 纯结构草案，聚合三层底座 | ❌ | ❌ |
| `createProjectFromMode` | 统一入口，含权限门控 | 可选（persist:true 返回 files） | ✅ |

`createProjectFromMode("character", input, { persist: true })` 默认拒绝——planned mode 不可真实创建，只返回 draft + 错误原因。

## 3. ProjectDraft 结构

```js
createModeProjectDraft(modeId, input) → {
  mode, title, sourceType, sourceText, dataMode, worldSubType, createdAt,
  modeRuntimePacket,      // 来自 Mode Runtime Core
  moduleRuntimePacket,    // 来自 Module Runtime Orchestrator
  modeStateEnvelope,      // 来自 Mode State Schema
  worldJsonDraft: {
    title, mode, modeMetadata, moduleGraph, createdAt, updatedAt
  },
  runtimeStateDraft: {
    engineState, mode, modeMetadata, moduleGraph, wrapperGraph, modeStateEnvelope
  },
  warnings
}
```

## 4. ProjectFiles 结构

```js
createModeProjectFiles(draft) → {
  "world.json": { title, mode, modeMetadata, moduleGraph, ... },
  "runtime/state.json": { engineState, mode, modeMetadata, moduleGraph, wrapperGraph, modeStateEnvelope },
  "runtime/source.txt": "...",
  "shared/worldbook.json": { entries: [] },
  "shared/characters.json": [],
  ... (10 files total)
}
```

所有文件内容 JSON-safe，不直接写盘。

## 5. 为什么 planned/hidden mode 默认不可真实创建

`assertModeProjectCanBeCreated` 按以下规则判断：

- **quick-setting**（active + visible）→ `allowed: true`
- **planned**（character / world-rpg / creation-forge）→ `allowed: false`，除非 `options.allowPlannedModeDraft=true`
- **hidden**（murder-mystery / tabletop / strategy-sim）→ `allowed: false`

draft 生成不受限——任何 mode 都可以生成结构草案用于架构验证。但 `persist:true` 请求在权限不足时返回 `ok:false` + 明确错误原因。

## 6. 为什么本轮只接入 quick-setting（P1a，不接 module-service）

直接改 `module-service.js` 接入 factory 的创建流程可能破坏 quick-project 集成测试（涉及真实文件 IO 和 worldpack roundtrip）。本轮采用 P1a 策略：新增纯结构 factory + 完整测试 + 文档，不修改 server.js / module-service.js。quick-setting 现有创建流程保持不变，后续 functional entry 阶段再评估接线。

## 7. 为什么 moduleRuntimePacket 不进入主 prompt

`moduleRuntimePacket` 的 `promptBlocks` 是 wrapper `buildPromptBlock` 的诊断性摘要输出——未经 prompt engineering 设计，直接注入主 prompt 会浪费上下文窗口并可能导致多个 wrapper 输出互相冲突。本阶段保持旁路定位。

## 8. 为什么 modeStateEnvelope 是兼容叠加不是迁移

`runtimeStateDraft` 同时包含旧 `engineState` 和新 `modeStateEnvelope`，不删除不替换。旧 engineState 仍有 dataMode/worldSubType/preset 等字段被现有 preset 管线消费。modeStateEnvelope 是未来状态管理的基础，与 engineState 并行存在。

## 9. 下一步：开始功能入口开发

Core Architecture Completion（Phase A-D2）已完成。下一阶段按执行文档应开始：

```
character vertical slice →
  复用 Mode Project Factory
  复用 character_card dataMode
  第一轮角色对话可保存
```

这是 World Tree 从纯底层架构向可玩功能迈出的第一步。
