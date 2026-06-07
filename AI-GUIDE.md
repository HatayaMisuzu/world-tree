# World Tree Desktop — AI 开发指南

> 本文档供 AI agent / LLM 阅读，快速理解项目架构和修改规则。

## 项目定位

独立 Electron 桌面应用，将 world-tree skill v12.19+ 完整移植为脱离 Hermes Agent 的独立引擎。直连任意 OpenAI-compatible LLM 运行叙事/角色扮演。

**工作目录**: `D:\\工作台\\world-tree-desktop`

## 运行方式

```powershell
cd D:\\工作台\\world-tree-desktop
npm install        # 首次
npm start          # 开发运行
npm run dist       # 打包便携版
```

## 文件地图

```
src/
├── main.cjs              ← Electron 主进程（文件IO/配置/秘密/引擎状态/IPC路由/世界系统IPC）
├── preload.cjs           ← IPC 桥（暴露45+个API到渲染进程，含世界系统6个API）
├── core/
│   ├── engine/           ← 引擎核心
│   │   ├── direction-packet.js  🆕 方向包数据结构
│   │   ├── director.js          🆕 导演层 + 方向包生成 + 混合模式
│   │   ├── emotion-state.js     🆕 四维情绪状态机
│   │   ├── global-memory.js     🆕 全局记忆快照
│   │   ├── guardian.js          🔄 叙事内容校验 + JS Guard
│   │   ├── simulator.js         🆕 模拟运行器
│   │   ├── archive-state.js     🆕 存档运行时快照
│   │   ├── world-manager.js     🆕 世界管理器（Minecraft式）
│   │   ├── lifecycle.js         ← 每轮生命周期（方向包串联）
│   │   ├── output-parser.js     ← LLM标记段解析器（含新标记段）
│   │   ├── commands.js          ← 23组斜杠命令 + 世界命令
│   │   ├── modules.js           ← M1-M19模块注册表
│   │   ├── overlay-store.js     ← 写入策略/签名/权限
│   │   ├── context-budget.js    ← 四档上下文预算
│   │   └── runtime.js           ← 状态机
│   ├── data/              ← 数据模块（M1-M19的JS实现）
│   │   ├── worldbook.js        7步匹配引擎
│   │   ├── character-card.js   角色卡+情绪梯度
│   │   ├── templates.js        M12预设系统
│   │   ├── proximity-scope.js  邻近环系统
│   │   ├── creation-wizard.js  M-创作六阶段
│   │   ├── random-events.js    M17事件模板池
│   │   ├── race.js             M10种族
│   │   ├── rules.js            M15规则审查
│   │   ├── prediction.js       M18场景预测
│   │   └── ...
│   ├── world-engine.js    ← 引擎入口 + 三角色Packet Builder
│   └── ...
├── adapters/
│   └── llm.js             ← 三角色LLM调用 + 双段式主流程

defaults/
├── engine-profile/        ← Layer 2 知识卡
├── engine-knowledge/      ← Layer 3 全文库
└── world-profiles/        ← 🆕 世界书子类型配置（classic/tabletop/rpg/sim）

design/
└── director-layer-v1.md   ← 设计文档
```

## 核心架构：双段式叙事管道

```
用户输入
   ↓
prepareTurn (JS)
  → 情绪更新 → 记忆检索 → 节奏分析 → 事件评分 + 缓存
   ↓
Director (JS/LLM 混合)
  → 方向包: { pacing, pressure, mustInclude, mustNotInclude }
   ↓
Story Writer (LLM)
  → 【叙事】+ 【状态建议】+ 【情绪反馈】
   ↓
Guardian (JS 优先)
  → must_include/泄露/回应/约束 四维校验
   ↓
completeTurn
  → 解析标记段 → 规则审查 → 记忆快照 → overlay写入
  → 自动保存 runtime.json 到当前世界文件夹
```

## 世界系统（Minecraft 式存档）

```
_desktop_engine/worlds/<世界名>/
├── world.json       元数据（含 subType/branchGeneration）
├── runtime.json     实时状态（每轮自动保存）
├── cache.json       事件预测缓存
├── shared/          世界书/角色/规则
├── branches/        叙事分支
└── memory/          记忆快照

世界复制 = cpSync 深拷贝整个文件夹 = Galgame 式分歧
```

### API（UI 可直接调用）

```js
worldList()     → [{ name, displayName, subType, turnCount, ... }]
worldNew({name, subType}) → 创建新世界
worldLoad({name}) → 恢复完整运行时（情绪/缓存/记忆）
worldCopy({source, target, label}) → 深拷贝世界
worldDelete({name})
worldBranch({worldName}) → 分支树
worldProfiles() → [{ id, name, status, ... }]
```

## 四种世界书子类型

| ID | 名称 | 状态 | 说明 |
|:---|:-----|:----|:-----|
| classic | 经典 | ✅ active | 标准世界树叙事模式 |
| tabletop | 跑团 | 📋 placeholder | 骰子判定/自由探索/战斗 |
| rpg | RPG | 📋 placeholder | 剧情驱动/角色成长/任务 |
| sim | 模拟经营 | 📋 placeholder | 资源管理/决策/时间推进 |

## 修改规则

1. **语法检查**: `node --check <file>` 通过后再提交
2. **导入链**: 新增文件要确认所有 import 路径正确
3. **模式区分**: 改引擎逻辑时检查三种模式是否都正确处理
4. **命令路由**: 新增命令组同步更新 `classifyWorldTreeInput` (main.cjs 和 commands.js 各一份)
5. **IPC 完整**: 新增主进程功能需同时更新 preload.cjs 暴露API
6. **知识卡同步**: 修改模块行为后更新对应 knowledge card
7. **版本号**: 改动后更新 CHANGELOG.md 和 package.json
8. **世界隔离**: 切换世界时调用 `resetPredictionCache()` + `resetEventCache()` + `resetEmotionState()`
9. **子类型**: 新增世界书子类型 → `defaults/world-profiles/<id>.json` + 更新 `listWorldProfiles()`
