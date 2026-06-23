# Character Capsule Full V1

## 验收摘要

### 已实现
- ✅ **Parser**: plain_text / V1 JSON / V2 JSON / CHARACTER.md / unknown_json。保留 raw/extensions/unknownFields
- ✅ **Profile**: World Tree Character Profile schema（personality/expressionDNA/appearance/lore/persona/quality 7 区）
- ✅ **Prompt Packet**: permanent/opening/instructions/lore/persona/module sourceMap。selectGreeting, estimateBudget
- ✅ **Lore**: character_book → shared/character_lore.json。keyword+budget active entry selection
- ✅ **Persona**: default/active persona, knownFacts, loreRefs
- ✅ **Module Runtime Integration**: 消费现有 7 个基础模块，sourceMap/selectedPromptBlocks/debugSummary
- ✅ **OOC Checker**: meta language, forbiddenDrift, appearance drift, name check
- ✅ **Engine Adapter**: turn context → prompt packet pipeline, mockable runCharacterTurn
- ✅ **Exporter**: V2 JSON / WT Profile / prompt-card.md
- ✅ **Tests**: 31 unit + 4 integration + roundtrip
- ✅ **共享底座**: LLM provider, persistence, project lifecycle, path security 不变
- ✅ **创建流程**: world.json mode=character, runtime/state.json dataMode=character_card, runtime/source.txt

### 明确未做 (V2 backlog)
- ❌ PNG metadata 导入/导出
- ❌ 完整 SillyTavern 复刻
- ❌ 长期记忆 / 多角色群聊 / 角色市场
- ❌ 复杂 OOC 评分 / 自动蒸馏 / dialogue regression
- ❌ creation-forge / Artifact Factory

### 测试覆盖
| 文件 | tests | 范围 |
|------|-------|------|
| character-v1-services.test.js | 27 | parser/profile/lore/persona/ooc/exporter |
| character-module-integration.test.js | 9 | module runtime integration + required check |
| character-roundtrip.test.js | 2 | V2 import→profile→export 全链 + .worldtree roundtrip |
| character-mode.test.js | 13 | mode visibility + factory |
| character-project.test.js | 2 | project creation + metadata |
| character-capsule-registry | * | capsule registry already tested |

### 下一步
- Character Capsule V1 → Character Import Compatibility (PNG/SillyTavern)
- 或 World-RPG Capsule Full V1
