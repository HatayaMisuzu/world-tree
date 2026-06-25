# Tabletop V2 Product Blueprint

> World Tree Tabletop V2 — 书驱动的单人桌面 GM 运行时

## 定义

Tabletop V2 是 World Tree 的 book-driven single-player tabletop GM runtime。玩家可以自由描述意图，但结果受冒险书/模组、规则集、项目资产、骰子计算和存档分支状态的多层约束。

## 核心不变量

1. **Book first** — 冒险书/模组约束优先于 AI 即兴发挥
2. **Rules first** — 骰子/规则引擎计算结果，LLM 绝不发明骰子结果
3. **Free intent, constrained outcome** — 玩家自由输入意图，但结局必须服从书、规则、场景、资产、角色状态和存档
4. **Module-layer assets** — 消耗和产出均为项目资产（模组/世界书/角色/规则集/场景/时钟/存档/分支/摘要/审查候选）
5. **Start/save/branch/end 是核心生命周期** — 不是事后附加
6. **Hidden GM material stays hidden** — GM 隐藏材料永不在玩家 UI 或普通响应中暴露
7. **Major consequences → review candidates** — 重大永久后果进入审查候选，不直接写世界正史

## 优先级链

```
冒险书/模组约束
> 规则集配置
> 项目资产（世界书/角色/场景）
> 当前存档/分支状态
> LLM 叙事
```

## 骰子/规则/概率：一等系统模块

骰子是系统计算的。LLM 在 `resolveRulingWithoutLlm()` 产出有效裁定后才可叙事。

支持的骰子系统：
- **d20** — 1d20 + 调整值 >= DC，nat20/nat1 暴击
- **d100** — 1d100 <= 目标值，多档阈值（extreme/hard/normal）
- **2d6** — 10+ 成功，7-9 部分成功，6- 失败前进
- **Dice pool** — 计数成功骰 或 取最高值
- **Oracle/随机表** — 查表投骰

每次投骰产出标准化 Roll Record（含 `source: "system_dice_engine"`, `llmGenerated: false`）。

## 规则集配置

可复用、可组合的规则集定义，支持 5 种预设风格：
- d20 奇幻冒险
- d100 调查/恐怖
- 2d6 叙事驱动
- Dice pool 潜入/压力
- 低骰叙事书

规则集定义：骰子类型、公开/隐藏投骰默认值、难度量表、结果带、优劣势等价、失败前进策略、概率显示策略、书覆盖策略。

## 冒险模组/书契约

标准化冒险书容器，支持多种来源：
- 导入的 PDF/文本
- Markdown 冒险书
- JSON/World Tree bundle
- 快速生成短冒险
- 已有项目资产（世界书 + 角色 + 用户前提）

模组 Schema 包含：玩家简报（公开）、GM 书（隐藏）、场景、角色、世界书引用、时钟、随机表、开始/存档/分支/结局策略、约束。

## 模块层资产集成

Tabletop V2 不依赖全局聊天状态，而是通过模块层资产体系运作。所有状态（运行时、存档、分支）可序列化、可审计、可恢复。

关键资产类型：Adventure Module / Ruleset Profile / Run State / Save Slot / Branch。

## 生命周期

```
导入/创建书 → 规范化模组资产 → 选择/规范化规则集
→ 开始冒险 → 玩家意图 → 书约束检查 → 确定性裁定+骰子
→ 叙事包 → 玩家安全输出 → 存档/分支/结局（按需）
```

## 已有书兼容

入口必须接受已有桌面书/材料，不仅仅是新生成的 World Tree bundle。导入预览应分离玩家材料和 GM 隐藏材料，并标注缺失字段的警告。

## 禁止范围

- 不实现完整 D&D/CoC 克隆
- 不复制商业模组内容
- 不支持多人
- 不实现完整战术战斗地图
- 不实现完整角色构建系统
- 不实现完整法术/装备经济
- 不强制 OCR 路径
- 不构建新 LLM 编排框架
- 审查通过的永久后果才可写世界正史
