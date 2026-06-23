# World Tree V1 系统架构

## 共享底座 + 隔离式模式胶囊

```
共享底座 (Shared Kernel)
├── 项目创建 (mode-project-factory)
├── 路由索引 (world-tree-route-index)
├── 提示词注册 (mode-prompt-registry)
├── 输入包 (mode-input-packets)
├── 输出包 (mode-output-packets)
├── 隔离策略 (mode-isolation-policy)
├── 提案总线 (proposal-bus)
├── 存档系统 (world-tree-save-system)
├── 模式运行器 (mode-runner)
├── API 路由 (server.js)
├── 模块管理 (module-runtime-orchestrator)
└── 保守 UI (public/)
    ↓
模式胶囊 (Mode Capsules)
├── quick-setting    快速设定
├── character        人物卡
├── grand-world      世界书大世界
├── tabletop         桌面叙事
├── mystery-puzzle   解谜调查
├── strategy-sim     策略模拟
├── murder-mystery   单人剧本杀
└── creation-forge   炼金台
```

## Turn 流程

```
UI → API → Route Index → Input Packet + Isolation Filter
       → Prompt Builder → Mode Adapter → Output Packet
       → Validate → Write chat.jsonl + cache + proposals → UI
```

## 关键规则

1. shared = 项目真相源，只读除非 approve proposal
2. runtime/cache = 可重建缓存
3. runtime/*-proposals.jsonl = 待审核提案日志
4. 隐藏信息（truthLock/answerLock）不得进入玩家可见上下文
5. creation-forge 实例化必须用户确认

## Unified Kernel Turn Context

```text
buildModuleModel -> normalizeEngineState -> resolve active branch
  -> P0 Living World Packet -> P1 Experience Stability Packet
  -> P2 Telemetry / optional Auto-light preview
  -> hidden-field filter + prompt budget -> Writer sidecar
  -> persist branch-local runtime hooks
```

`kernel-turn-context.js` 是 LLM server turn 与 `mode-runner` 的共同入口。公开 summary 会删除项目路径；完整 context 只在服务端用于选定 branch root 和 prompt-safe sidecar。`persistTurn()` 将 chat/state/scene summary/telemetry/proposal tracking/Growth Tree/inertia 写入活动分支；只有已批准 proposal 可修改该分支的 `shared/`。
