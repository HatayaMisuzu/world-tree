# Prompt Orchestration Layer

> World Tree Prompt Orchestration Layer v1 — 提示词编排与边界治理层

## 概述

Prompt Orchestration Layer 为 World Tree 的所有 LLM 调用提供统一的提示词治理。它确保 LLM 在每次生成前明确知道：

1. 当前在哪个模式（mode）
2. 当前执行哪个任务（task）
3. 可以使用哪些上下文
4. 哪些信息不能说（hidden truth / answer lock / private）
5. 哪些变化只能通过 proposal
6. 哪些内容只是 candidate
7. 输出什么格式
8. 不确定时该怎么停

## 架构

```
src/core/prompts/
├── prompt-contract.js       — 数据模型（Block/Contract/全局规则）
├── prompt-blocks.js         — 22 个 Prompt Block（全局+8模式+9任务）
├── prompt-budget.js         — Token 预算管理
├── prompt-builder.js        — 构建 prompt 编排包
├── prompt-activation-log.js — 激活追踪 + 哈希
├── prompt-output-schemas.js — 输出契约 + JSON schemas
├── prompt-visibility-policy.js — 隐藏字段过滤
├── prompt-inspector.js      — Debug 视图
├── prompt-orchestrator.js   — 统一入口 + 向後兼容
├── mode-prompt-registry.js  — 升级版 profile registry
└── index.js                 — 统一导出
```

## 与 P0-P2 Kernel 的关系

- P0 (Living World): 提供上下文来源（Proximity/Scene/Tracking/Worldbook）
- P1 (Experience Stability): 提供稳定与节奏约束（Context/Director/Inertia/Growth）
- P2 (Long Play): 提供分支/遥测/素材候选状态

Prompt Layer 只读 P0-P2，不绕过它们写 canon。Prompt Layer 注入在 LLM system prompt 最前面，在 hardcoded role prompts 之前生效。

## 模式覆盖

| 模式 | Block ID | 关键保护 |
|------|----------|---------|
| quick-setting | `mode.quick_setting.identity` | 不生成完整世界书、不替用户决策 |
| world-rpg | `mode.world_rpg.identity` | Proximity/proposal 边界、无 RPG 数值 |
| character | `mode.character.identity` | Emotional Inertia、OOC 防护 |
| tabletop | `mode.tabletop.identity` | 主持人/轻量裁判、无复杂 DND |
| mystery-puzzle | `mode.mystery_puzzle.*` | 答案锁分级、不直接泄露 |
| murder-mystery | `mode.murder_mystery.*` | 最高优先级真相锁、嫌疑人视角 |
| strategy-sim | `mode.strategy_sim.*` | 因果链深度限制、proposal 门 |
| creation-forge | `mode.creation_forge.*` | 反自动创建、candidate 仅候选 |

## 任务覆盖

| 任务 | 类型 | 输出格式 |
|------|------|---------|
| writer | text | 【叙事】+ sections |
| director | json | directorPlan |
| guardian | json | audit report |
| proposal-extractor | json | candidates array |
| scene-summary | json | scene summary |
| worldbook-candidate | json | candidates array |
| processing-extractor | json | structured candidates |
| emotional-inertia | json | updates array |
| telemetry-explanation | text | summary text |

## 安全边界

- **Final Guard**: 每次 writer 生成前在最后位置注入，再次检查 OOC/越权/泄密
- **Hidden Truth 过滤**: `deepFilterHiddenFields()` 递归过滤所有 hiddenTruth/answerLock/truthLock 字段
- **Budget 机制**: optional blocks 超预算时移除，required blocks 永不移除
- **Prompt Inspector**: debug 模式下可见完整 prompt + 激活日志，普通用户只看到摘要

## 如何调试

```js
const { buildPromptOrchestrationPacket, buildPromptInspector } = require("./src/core/prompts/prompt-orchestrator.js");
const packet = buildPromptOrchestrationPacket({ modeId: "murder-mystery", taskId: "writer", userInput: "test" });
const inspector = buildPromptInspector(packet, { includePromptText: true });
console.log(inspector);
// { modeId, taskId, blocks: [...], omittedBlocks: [...], promptPreview: "...", finalGuardIncluded: true, ... }
```

## 防止 OOC / 幻觉 / 闲聊 / 越权

1. 每个 LLM 调用从全局 executor identity block 开始：明确 "你是执行器，不闲聊、不 OOC"
2. Canon/Runtime/Candidate 三级数据区分
3. 每个模式有自己的禁止事项列表
4. Final Guard 作为最后一道防线
5. 创建类操作（creation-forge）有专门的反自动创建 block
6. 真相锁（murder-mystery, mystery-puzzle）有专门的 block + visibility policy
7. Proposal 提取任务有专门 JSON contract，不写正文
