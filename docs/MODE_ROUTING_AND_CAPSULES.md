# Mode Routing & Capsules

## 路由索引

所有模式入口由 src/core/system/world-tree-route-index.js 统一管理。

| modeId | productName | role | modeMeaning | cacheNS |
| --- | --- | --- | --- | --- |
| quick-setting | 快速设定 | consumer | quick_setting | quick-setting |
| character | 人物卡 | consumer | character | character |
| world-rpg | 世界书大世界 | consumer | grand_world | worldbook |
| tabletop | 桌面叙事 | consumer | solo_tabletop_narrative | tabletop |
| mystery-puzzle | 解谜调查 | consumer | solo_mystery_puzzle | mystery-puzzle |
| strategy-sim | 策略模拟 | consumer | solo_strategy_sim | strategy-sim |
| murder-mystery | 单人剧本杀 | consumer | solo_murder_mystery | murder-mystery |
| creation-forge | 炼金台 | producer | artifact_factory | creation-forge |

## 模式胶囊

每个 capsule 拥有:
- 独立 state namespace
- 独立 cache namespace
- 独立 proposal log
- 独立 mode adapter
- 独立 prompt profile
- 独立 input/output packet type

## 隔离规则

- 每个模式只能写自己的 runtime/cache
- shared 真相源只能通过 proposal approve 写入
- truthLock / answerLock 相关字段不进入玩家可见上下文
