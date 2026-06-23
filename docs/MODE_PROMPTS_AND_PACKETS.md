# Mode Prompts & Packets

## 全局规则（所有模式共享）

1. 你是 World Tree 的模式执行器。
2. 不得把草稿当成正史。
3. 不得直接修改 shared 真相源。
4. 涉及世界状态/关系/时间线/案件真相/答案锁/资源变化时，生成 pending proposal。
5. 不得泄露隐藏信息。
6. 输出必须可解析为指定 Output Packet。

## 各模式提示词原则

| 模式 | 禁止事项 | output packet type |
| --- | --- | --- |
| grand_world | 硬套 RPG 术语（等级/职业/装备/经验） | grand_world_output_packet_v1 |
| character | 随意改写角色核心设定 | character_output_packet_v1 |
| tabletop | 做完整 DND | tabletop_output_packet_v1 |
| mystery_puzzle | 直接泄露答案锁 | mystery_puzzle_output_packet_v1 |
| strategy_sim | 做复杂 4X | strategy_sim_output_packet_v1 |
| murder_mystery | 泄露真相锁到玩家上下文 | murder_mystery_output_packet_v1 |
| creation_forge | 未经确认覆盖已有项目 | creation_forge_output_packet_v1 |

## Input/Output Packets

- 所有入口使用统一基础 input packet (mode-input-packets.js)
- 所有入口使用统一基础 output packet (mode-output-packets.js)
- modePayload 可扩展各模式专属字段
- output 的 proposals 默认 pending
