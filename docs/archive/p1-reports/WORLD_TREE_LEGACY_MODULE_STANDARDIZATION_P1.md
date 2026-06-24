# Legacy Module Standardization P1

## 1. 本轮范围

P1 为九个公共热路径旧模块增加标准化 wrapper。wrapper 是旁路能力层：可由 registry、loader、测试、debug、metadata 和未来入口调用，但不接管 `world-engine.js` prompt、lifecycle、server chat、DATA_MODES 或旧 M 编号 activeModules。

每个 wrapper 都实现防御式 `buildContext(ctx)`、有长度与脱敏边界的 `buildPromptBlock(ctx)`，以及小型 `getDebugInfo(ctx)`。任何 hook 失败都返回 warnings，不向调用方抛出异常。

## 2. P1 wrapper 清单

| Legacy | Capability ID | Wrapper | 当前能力 | 真实旧函数复用 |
|---|---|---|---|---|
| M1 | `core.world_container` | `core-world-container.wrapper.js` | 项目、分支、dataMode、mode 的只读摘要 | 无；读取已加载 model/runtime |
| M2 | `lore.worldbook_trigger` | `lore-worldbook-trigger.wrapper.js` | 命中、预算、miss/drop 计数与前五条摘要 | `prepareWorldbookInjection()` |
| M3 | `core.dynamic_state` | `core-dynamic-state.wrapper.js` | 场景、时间、变量、情绪、回合与 mode 摘要 | 无；读取已加载 worldState/runtime/engineState |
| M8 | `character.preset` | `character-preset.wrapper.js` | 角色数量、前五个角色与主角色摘要 | 无；读取已加载 characters/cards |
| M9 | `character.cognition` | `character-cognition.wrapper.js` | 人格层、触发线索与情绪梯度可用性 | `parsePersonalityLayers()`、`parseEmotionalGradients()`、`selectEmotionalGradient()` |
| M11 | `scene.session` | `scene-session.wrapper.js` | 当前场景、场景/事件计数与小型上下文窗口 | `getContextWindow()` |
| M15c | `audit.narrative_quality` | `audit-narrative-quality.wrapper.js` | 审查可用性、上次审查摘要；可选旁路 `validateOutput` | `auditNarrative()` |
| M19 | `character.card_runtime` | `character-card-runtime.wrapper.js` | 卡类型、角色、首条消息、场景、关系与叙事提示摘要 | `detectCardType()`、`characterCardMode()`、`cardModeNarrativeHint()` |
| M-创作 | `creation.alchemy` | `creation-alchemy.wrapper.js` | 素材格式、候选提取可用性与审核要求 | `detectFormat()` |

## 3. 摘要与调试边界

M1、M3、M8 只读取调用方已经提供的数据并生成摘要，不执行文件 IO。所有 wrapper 都限制条目数量与文本长度，清理 Windows/macOS/Linux 用户路径、Bearer token、API key 和常见密钥格式。debug 返回 source、短 summary 与 warnings，不返回完整 model/card/worldbook。

M15c 的 `validateOutput` 只在显式调用时运行；主 Guardian 没有改动。M-创作只检测素材格式，不执行 alchemy import、写入或审核采纳。

## 4. Registry 与 Loader

Module graph 现在为每个模块报告：

```text
hasWrapper
callable
hooks
```

`callable=true` 要求 manifest 状态允许调用、真实 wrapper 存在，并至少实现 buildContext 与 buildPromptBlock。只有 manifest capabilities、没有 wrapper 的模块不会再被 graph 误报为 callable。

Loader 新增：

```js
loadModuleWrapper(moduleId)
loadWrappersForMode(modeId)
```

后者返回已存在的 wrappers、missingWrappers、逐模块 hooks 和 warnings。declared-only、prototype-hidden 或 P2/P3 未包装模块只产生可诊断 gap，不导致 mode 加载失败。

## 5. 留给 P2/P3 的模块

本轮未包装：M4、M5、M6、M7、M10、M12、M13、M15、M16、M17、M18。它们保持现有 manifest 状态和运行方式。不得因为存在旧源文件就自动视为 callable。

## 6. 后续入口如何使用

入口 demo 应先调用 `loadWrappersForMode(modeId)`，只对返回的 wrapper 显式调用只读 hook，并把 missingWrappers 当诊断信息。下一轮 character vertical slice 可以复用 M1/M3/M8/M9/M11/M15c/M19；仍应继续走现有 `character_card` dataMode，而不是创建完整 mode runtime。
