# Tabletop V2 外部模组导入格式指南

## 支持的输入格式

World Tree Tabletop V2 支持从以下格式导入跑团模组文本：

| 格式 | 识别方式 | 支持程度 |
|------|---------|---------|
| 结构化 JSON | `{ "title": "...", "playerBrief": {...} }` | 完整 |
| Markdown 文本 | 含 `#` 标题分段 | 高 |
| YAML Frontmatter | `---\ntitle: ...\n---\n# 内容` | 高 |
| 纯文本 | 自然语言描述 | 基础 |

## Markdown 导入规范

按以下标题分段组织内容，系统将自动解析为 Adventure Module：

```markdown
# 模组标题

## 背景（或 Premise / Setting）
故事的背景设定和初始情况

## 目标（或 Objective / Goal）
玩家的任务目标

## 规则（或 Ruleset / Dice）
使用的规则集: d20_fantasy / d100_investigation / 2d6_narrative / dice_pool_pressure / low_dice_story

## 场景（或 Scenes）
- 场景名称
  场景描述，包括环境、NPC、可能的行动选项
- 第二个场景
  ...

## NPC（或 Characters）
- NPC 名称
  角色描述，包括性格、目的、秘密
- 另一个 NPC
  ...

## GM 笔记（或 Hidden / Secrets）
仅 GM 可见的隐藏信息。这部分不会出现在玩家 UI 中。

## 结局（或 Endings）
可能的结局条件或结局描述
```

## 完整性要求

导入模块需要以下字段才能开始跑团：

| 字段 | 必填 | 说明 |
|------|------|------|
| 标题 | 是 | 模组名称 |
| 开场前提 | 是 | 不少于 10 字 |
| 场景 | 是 | 至少 1 个 |
| 起始场景 | 是 | 标记为 `isStarting` 的场景 |
| 允许行动 | 是 | 如 attack, talk, move |
| 规则集 | 是 | 指定使用哪种投骰系统 |

GM Book 可选。缺少时系统会标记 `gmBookQuality: "thin"`，但允许开始。

## 导入流程

1. 粘贴文本到 Control Panel 的"外来模组导入区"
2. 点击"预览"查看解析结果
3. 确认无误后点击"导入"提交
4. 系统生成 Adventure Module 并持久化到 `engine/tabletop-v2/modules/`
5. 导入完成后可立即开始跑团
