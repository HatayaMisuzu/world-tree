# M-叙事一致性雷达

> world-tree v12.19 创新升级模块。定位：每轮输出后的静默质量雷达，不向 user 展示面板，除非发现阻断级矛盾。

## 核心目标

在叙事写回前，用 5 个维度快速检测本轮是否偏离已确认事实、角色基线、世界规则、时间线和节奏。它不是审稿人，也不是风格评价器；它是运行时防串戏雷达。

## 五维雷达

| 维度 | 检查问题 | 数据来源 | 阻断条件 |
|------|----------|----------|----------|
| 事实一致 | 本轮内容是否违背 confirmed | `canon_state.json` + 正式状态文件 | 明确推翻 confirmed 且无上帝模式 |
| 角色一致 | 角色行为是否越过人格/认知边界 | M8/M9/M19 角色资料 | 角色知道不该知道的信息 |
| 时间连续 | 场景时间是否跳跃或倒退 | M16 + `timeline-tree.json` | 未存档/未切分支却倒退事实 |
| 世界规则 | 行为是否绕过代价/规则 | M15 + 世界规则 | 重大改变无代价 |
| 叙事节奏 | 是否停滞、重复或过度推进 | 场景摘要链 + Tracking | 连续 3 轮无状态变化或一次越过关键选择 |

## 输出策略

- 正常：不向 user 显示雷达结果，只用于内部修正。
- 轻微问题：自然改写输出，不显示“检查失败”。
- 严重问题：本轮输出前提示一句“这里和已确认事实冲突，需要先确认”。
- 阻断问题：不写回 `confirmed`，只写入 `proposed/conflicts`。

## 数据写入

建议写入 `branches/<active_branch>/tracking/narrative_radar.json`：

```json
{
  "last_turn": 42,
  "status": "ok",
  "warnings": [],
  "blocked_reason": "",
  "checked_dimensions": ["facts", "character", "time", "rules", "rhythm"]
}
```

## 与 quality-toolkit 的关系

叙事一致性雷达是 world-tree 的运行时专用规则；当雷达发现结构化错误或多轮修复失败时，调用 quality-toolkit 的验证修复器或诊断流水线。
