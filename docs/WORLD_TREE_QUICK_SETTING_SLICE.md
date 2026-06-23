# Quick-setting 最小纵向切片

## 1. quick-setting 是什么

`quick-setting` 是现有“粘贴设定，快速开始”产品入口的标准 mode ID。它面向直接提供角色、世界观、开场片段或短规则并立即开始互动叙事的用户。它不是新的大引擎，也不是八模式首页。

用户从工作台提交设定后，现有 `POST /api/modules/create` 创建真实本地草稿世界，原文写入 `runtime/source.txt`，聊天继续使用既有 LLM、持久化、审核、存档和导入导出链路。

## 2. 为什么复用 preset dataMode

Mode 表示入口语义与用户体验契约，`dataMode` 表示现有运行管线。quick-setting 需要轻量 DM、简洁标记段和快速叙事，因此映射为：

```text
mode = quick-setting
engineState.dataMode = preset
engineState.worldSubType = classic
engineState.preset = preset
```

本切片没有向 `DATA_MODES` 新增 quick-setting，也没有修改旧 `activeModules` 的 M 编号兼容行为。

## 3. module graph 如何使用

`src/core/modes/quick-setting.js` 调用 `loadModulesForMode("quick-setting")`，再将 graph 转换为无函数、无循环引用的 JSON 摘要。摘要包含 requested、resolved、missing、warnings，以及每个模块的 ID、legacy ID、分类、状态与 callable 标记。

本阶段 graph 只用于 metadata、诊断和未来接线，不会动态执行全部模块，也不会因为非 callable 状态阻断现有 preset 对话。

## 4. metadata 写在哪里

创建成功后，稳定真相源 `world.json` 保存：

```text
mode
modeMetadata
moduleGraph
```

`runtime/state.json` 同时保存同一份 mode/module 摘要和 preset-compatible engineState，且每轮持久化会保留这些字段。`.worldtree` 默认包含 `world.json`，现有导入逻辑会保留扩展 metadata；runtime state 仍按原有导出选项决定是否包含。

## 5. 本轮没有开放八模式入口

控制台只增强现有创建区，将其明确命名为“预设/设定：粘贴设定，快速开始 AI 互动”。没有创建模式大厅、模式路由器或八张入口卡。

## 6. 本轮没有开放 hidden 模式

`murder-mystery`、`tabletop`、`rpg`、`sim`、`strategy-sim` 的 profile 和 UI 可见性保持不变。本切片不调用其原型逻辑，也不把它们显示给用户。

## 7. 后续纵向扩展方式

后续仍应一次只做一个纵向切片：

1. `character`：复用 `character_card` dataMode 与现有人物卡解析/对话能力。
2. `world-rpg`：复用 `worldbook` dataMode，再逐项包装任务、羁绊、章节与成长原型。
3. `creation-forge`：复用炼金台与审核流，先定义内容生产 metadata，再决定可调用模块。

每个切片都应先生成 module graph、保存安全 metadata、复用现有运行管线并补独立测试；不要一次激活所有 mode。
