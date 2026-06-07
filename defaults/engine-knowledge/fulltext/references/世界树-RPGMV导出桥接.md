# 世界树 → RPG Maker MV 导出桥接

## 概述

将世界树引擎的叙事数据导出为 RPG Maker MV 游戏可读的 JSON，让 HermesAI 插件自动注入 NPC 人设和世界观。

## 数据流

```
世界树引擎                       RPG Maker MV
───────────                     ─────────────
worldbook.json         →        HermesAI 全局系统提示（世界观）
characters_base.json   →        NPC 角色卡（性格/背景/声纹）
world_state.json       →        AI 对话上下文（动态世界状态）
organizations.json     →        AI 对话上下文（组织势力）
runtime.json           →        AI 对话上下文（当前场景/在场角色）
```

## 使用流程

### 第一步：在世界树中创建世界

```
/引擎 new 奇幻大陆
# 创建角色、添加世界条目、推进叙事...
/角色 create 艾琳
/角色 create 团长
/世界书 add 魔法: 魔法分为三系...
```

### 第二步：导出到 RPG Maker MV

```
/引擎 export-rpgmv
```

这会将当前活跃模组的数据导出到：
`D:\RPGMV\NewData\data\worldtree_data.json`

### 第三步：在 RPG Maker MV 中使用

1. 游戏启动时 HermesAI 插件自动加载 `data/worldtree_data.json`
2. 将 NPC 事件的名称设置为与角色名一致（如"艾琳""团长"）
3. 事件中使用插件指令 `AI对话 "玩家说的话"`
4. 插件自动匹配世界树角色卡，注入完整人设作为系统提示

## 导出文件格式

```json
{
  "moduleName": "奇幻大陆",
  "worldSetting": "详细世界观描述...",
  "globalRules": ["规则1", "规则2"],
  "characters": [
    {
      "name": "艾琳",
      "aliases": ["小艾", "艾琳姐"],
      "personality": "温柔但内心坚毅...",
      "background": "曾是帝国骑士...",
      "voice": "轻声细语，但关键处语气坚定",
      "appearance": "深棕色长发...",
      "currentState": "正在寻找失踪的弟弟",
      "relations": [...]
    }
  ],
  "worldStates": {
    "薇兰王国": "沦陷"
  },
  "organizations": [...],
  "currentScene": "王都城门",
  "activeCharacters": ["艾琳", "团长"]
}
```

## NPC 匹配规则

HermesAI 插件按以下优先级匹配 NPC 和世界树角色：

1. **事件名精确匹配** → 事件名称（RPG Maker 编辑器中设置）与角色 `name` 或 `aliases` 完全一致（不区分大小写）
2. **内联设定覆盖** → 如果插件指令手动写了角色设定，会在世界树角色卡后追加
3. **无匹配** → 仅使用内联设定或默认系统提示

## 自动注入的内容

匹配成功后，NPC 的 AI 系统提示自动包含：
- 全局世界观设定（worldSetting）
- 全局世界规则（globalRules）
- NPC 的性格、背景、声纹、外貌、当前状态、人际关系
- NPC 的对话记忆（跨事件/跨地图持久化）

## 插件指令速查

在 RPG Maker MV 中，事件 → 插件指令：

| 指令 | 作用 |
|------|------|
| `AI对话 "玩家说的话"` | 匹配世界树角色的 NPC 自动对话 |
| `AI对话 "..." "临时设定"` | 在世界树角色卡基础上追加临时指示 |
| `WTLoadFile data/worldtree_data.json` | 手动重新加载世界树数据 |
| `WTInfo 10` | 将世界树模组信息存入变量10 |
| `WTSetNPC 11` | 将当前事件匹配的角色名存入变量11 |
| `AISetSystem "..."` | 手动覆盖全局系统提示 |
| `AIClearMemory` | 清空当前 NPC 对话记忆 |
| `AIMemoryToVar 12` | 导出 NPC 记忆到变量12 |

## 技术细节

- HermesAI 插件 v1.2 支持自动加载和手动加载两种模式
- 世界树数据在游戏启动时通过 XMLHttpRequest（NW.js）加载
- 角色名匹配不区分大小写
- 角色别名（aliases）也参与匹配
- 未匹配到世界树角色时，插件独立运行，不影响正常使用
