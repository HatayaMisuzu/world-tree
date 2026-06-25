# Tabletop V2 用户指南

## 快速开始

1. 打开 World Tree Console，切换到 Tabletop V2 面板
2. 粘贴模组文本（JSON、Markdown 或纯文本）
3. 点击"预览"查看解析结果
4. 点击"快速开始"立即开始冒险，或"导入并保存"持久化模组

## 桌面功能

Tabletop V2 桌面提供 6 个标签页：

- **场景**：查看当前场景描述、输入角色行动、查看投骰结果
- **队伍**：查看队伍状态（HP、金币等）
- **NPC**：可交互的 NPC 列表，含友好/中立/敌对标识
- **时钟**：公开的倒计时和进度条
- **道具**：背包物品管理
- **存档**：存档槽位和分支管理

## 导入模组格式

支持 JSON Adventure Module、Markdown 文本、YAML Frontmatter。
详见 `EXTERNAL_MODULE_IMPORT_FORMAT.md`。

## 跑团流程

1. **导入或创建模组** → 生成 Adventure Module
2. **开始跑团** → 系统创建 run state
3. **每回合**：输入行动 → 系统分类 → 规则验证 → 投骰（如需）→ GM 叙事 → 状态更新
4. **存档/分支**：随时保存进度，从存档点分叉
5. **结局**：触发结局条件后查看结局摘要
6. **导出**：导出完整跑团记录为 JSON

## GM 隐藏信息

- `gmBook.hiddenTruth` 仅 GM 可见
- 隐藏时钟不会出现在玩家 UI
- NPC 秘密存储在 `hiddenGmState` 中
- 所有 API 响应自动剥离隐藏状态
