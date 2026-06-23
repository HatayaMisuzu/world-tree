# 提案与审核系统

## 为什么需要提案

AI 不能直接改 shared 真相源。所有会改变世界状态、关系、时间线、案件真相、答案锁、资源结算的内容，必须先走 proposal gate。

## 提案生命周期

```
pending → 用户查看 → approve → 写入 shared 真相源
                   → reject  → 保留日志，不写入
```

## 提案类型

- world_state_update — 世界状态变更
- scene_transition — 场景切换
- relation_change — 关系变化
- timeline_append — 时间线追加
- world_thread_update — 目标/牵引更新
- character_profile_update — 角色卡更新
- tabletop_clock_update — 时钟推进
- mystery_clue_reveal — 线索揭示
- puzzle_answer_check — 答案校验
- strategy_turn_resolution — 回合结算
- murder_case_accusation — 案件指认
- forge_instantiation — 炼金实例化

## 隐藏信息保护

- murder-mystery truthLock: system_only，不进入玩家可见上下文
- mystery-puzzle answerLock: system_only
- strategy-sim AI 阵营私有计划: 只有局势摘要可展示
- creation-forge 蓝图草稿: 确认前不创建项目
