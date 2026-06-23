# Module Runtime Orchestrator P1

## 1. 本轮为什么需要 Module Runtime Orchestrator

Phase A3 完成了 P1 legacy wrapper 标准化——9 个 wrapper 实现了 `buildContext` / `buildPromptBlock` / `getDebugInfo` hooks。Phase B1 完成了 Mode Runtime Core，使所有 mode 能生成 runtime packet。但这些 wrapper 当前只能被 registry / loader / test 单独查询，没有一个统一入口来**按 mode 批量调用它们**并聚合输出。

Module Runtime Orchestrator 填补了这个空白：给定 `modeId + ctx`，自动加载 mode 需要的所有 wrapper，依次调用三个 hook，聚合为 JSON-safe `moduleRuntimePacket`。

## 2. Orchestrator 与 Mode Runtime Core 的关系

两者暂时并列，不强行合并：

- **Mode Runtime Packet**（Phase B1）：mode metadata / moduleGraph / wrapperGraph / initialState — 回答"这个 mode 是什么、有哪些模块"
- **Module Runtime Packet**（Phase C1）：wrapper hook outputs / contextBlocks / promptBlocks / debugInfo — 回答"这些模块在当前上下文下能产出什么"

如果未来需要组合，可新增 `createRuntimeArchitecturePacket(modeId, ctx)` 合并两者，但不推荐本轮做以避免扩大范围。

## 3. moduleRuntimePacket 结构

```js
createModuleRuntimePacket(modeId, ctx) → {
  modeId,
  requested,         // mode 需要的 module id 列表
  wrapperCount,      // 实际加载的 wrapper 数量
  missingWrappers,   // 缺少 wrapper 的 module id 列表
  contextBlocks: [{  // buildContext 输出聚合
    moduleId, legacyId, ok, skipped, data, warnings
  }],
  promptBlocks: [{   // buildPromptBlock 输出聚合
    moduleId, legacyId, ok, text, warnings
  }],
  debugInfo: [{      // getDebugInfo 输出聚合
    moduleId, legacyId, ok, skipped, data, warnings
  }],
  warnings,          // loader 级警告
  errors             // hook 失败收集
}
```

## 4. buildContext / buildPromptBlock / getDebugInfo 如何被调用

Orchestrator 内部通过 `runWrapperHook(wrapper, hookName, ctx)` 安全调用每个 hook：

1. 检查 hook 是否为函数 → 不是则返回 `skipped: true`
2. try-catch 包裹调用 → 抛错不中断，返回 `ok: false` + 脱敏后的错误信息
3. 聚合所有结果到对应 blocks 数组

`runWrappersHook(wrappers, hookName, ctx)` 提供批量调用便捷入口。

## 5. 为什么本轮不调用 validateOutput / extractProposals / applyConfirmedChange

这三个 hook 涉及：
- **validateOutput**：叙事输出审查，与 Guardian 联动
- **extractProposals**：提案提取，涉及世界书/角色卡写入
- **applyConfirmedChange**：状态变更，涉及 runtime/state 落盘

它们属于后续 Review / Proposal Contract 或 lifecycle 编排阶段。本轮仅限只读的旁路 hook：`buildContext` / `buildPromptBlock` / `getDebugInfo`。

## 6. 为什么 promptBlocks 不注入主 LLM prompt

`buildPromptBlock` 的输出是 wrapper 基于当前 ctx 生成的**诊断性摘要文本**，用于 debug 和架构验证。它不是经过 prompt engineering 设计的叙事指令，直接注入主 prompt 可能导致：
- 上下文窗口浪费
- 多个 wrapper 的摘要互相冲突
- 未经测试的 prompt 行为改变

promptBlocks 在当前阶段是纯粹的旁路产出。未来如果需要将 wrapper 信息注入 prompt，应在 Review / Proposal Contract 阶段通过独立的 prompt assembly pipeline 完成。

## 7. hidden mode 结构生成与 UI 暴露的区别

`createModuleRuntimePacket` 对所有 mode 一视同仁——hidden mode（murder-mystery / tabletop / strategy-sim）也能完整生成 packet。但生成 packet ≠ 改变 mode visibility。UI 可见性仍由 `mode-manifest.js` 的 `status`（HIDDEN）和 `defaultVisibility`（false）控制，本轮不改动。

## 8. 下一步 Mode State Schema

本轮完成后，下一步（Phase D1）是 Mode State Schema：定义统一 `modeState` / `moduleState` / `runtimeFlags` / `reviewPolicy` 基础 schema，使后续 Mode Project Factory 和 Review / Proposal Contract 有稳定落盘结构。
