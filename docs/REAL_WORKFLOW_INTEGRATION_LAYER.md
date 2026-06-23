# Real Workflow Integration Layer

> World Tree — 真实用户动作编排层
> 在 P0-P2 Kernel + Prompt Orchestration v1 + P3 M1-M11 + Asset Maturation 基础上建立

## 目的

让真实用户动作（创建世界、导入素材、游玩回合、角色互动、调查盘问、策略回合、继续推进、调试观测）走统一的 workflow envelope → authority gate → prompt/context bridge → mechanism service → post-check → candidate/proposal/runtime routing → safe observability 管线。

## 非目标

- 不新增世界机制（M12/P4）
- 不重写 server.js / proposal-bus / mode-module-map
- 不暴露 prototype-hidden / declared-only
- 不让普通 workflow 直接写 canon

## 架构

```
User Action
  ↓
workflow-intent-router → workflow type (22 types)
  ↓
workflow-context-envelope → unified input (mode, context, authority, visibility)
  ↓
workflow-authority-gate → decide canWriteCanon / candidateOnly / initializationWriteAllowed
  ↓
workflow services (8 services)
  ├── creation-workflow-service → M1 wizard
  ├── alchemy-workflow-service → M2 digest + M3 warehouse
  ├── play-turn-workflow-service → prompt bridge + post-check
  ├── character-workflow-service → M4 kernel + M5 cognition
  ├── mystery-workflow-service → truth-lock + clue visibility
  ├── strategy-workflow-service → M6 factions + M7 rules
  ├── direction-workflow-service → M9 events + auto-light
  └── observability-workflow-service → M11 debug
  ↓
workflow-output-router → normalize → validate → route (candidates/proposals/runtime/canon)
  ↓
workflow-observability → safe trace (redacted paths, hidden fields)
```

## Workflow Type 表

| 类型 | 模式 | 触发 |
|------|------|------|
| creation.start | creation-forge | 新建/创建 |
| creation.refine | creation-forge | 回答向导问题 |
| creation.instantiate | creation-forge | 确认创建 |
| alchemy.import | creation-forge | 导入素材 |
| alchemy.digest | creation-forge | 消化素材 |
| alchemy.deliver | creation-forge | 投递候选 |
| play.turn | world-rpg/tabletop | 普通输入 |
| play.continue | any | 继续/下一幕 |
| play.auto_light | any | 自动推进 |
| character.chat | character | 角色对话 |
| mystery.investigate | mystery-puzzle | 调查/搜索 |
| mystery.interrogate | murder-mystery | 盘问/审问 |
| strategy.turn | strategy-sim | 策略回合 |
| debug.inspect | any | 调试查看 |

## Authority 表

| Workflow | canWriteCanon | candidateOnly | 条件 |
|----------|:---:|:---:|------|
| creation.instantiate | ✅ | ❌ | userConfirmed=true |
| proposal.approve | ✅ | ❌ | proposalApproved=true |
| debug.inspect | ❌ | ❌ | read-only |
| 其他全部 | ❌ | ✅ | default |

## 安全规则

- Canon 写入仅在 creation.instantiate + userConfirmed 或 proposal.approve 时允许
- 所有素材/炼金台/游玩输出为 candidate-only
- 观测输出 redact 绝对路径和 hidden/private/system_only
- Macro 安全上下文阻止 hidden/private 解析
- Prototype/declared 模块不被 workflow 暴露

## 测试

```
npm run test:workflows → 41 tests PASS
npm run workflow:check → 0 errors
npm run preflight → 全绿 (21 stages)
```

## 分阶段上线计划

| Stage | 状态 | 内容 |
|-------|:---:|------|
| W0 | ✅ | Workflow Spine (8 core files) |
| W1 | ✅ | Creation + Alchemy (真实 M1-M3) |
| W2 | ✅ | Play Turn + Post-check (prompt bridge) |
| W3 | ✅ | Character / Mystery / Strategy (stubs) |
| W4 | ✅ | Direction / Observability (stubs) |
