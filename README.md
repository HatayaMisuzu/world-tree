# World Tree Desktop

本地优先的 AI 叙事引擎控制台。Electron 桌面应用，可独立运行或配合 Hermes Agent 使用。

**Current version: v1.0.1** 🎉

## 快速开始

```powershell
npm install
npm start
```

## 五模式

| 模式 | DM 角色 | 引擎 | 适用场景 |
|------|---------|------|----------|
| **经典** | 完整 DM | 双段式管线（Director→Writer→Guardian） | 长篇叙事、GM 主持 |
| **剧本杀** | 主持人（信息管制） | 独立案件状态机 | 侦探推理 |
| **角色卡** | 隐退（纯 RP） | 用户括号提示驱动 | 一对一角色扮演 |
| **预设** | 轻量 | 简化管线 | 快速原型 |
| *跑团* 🙈 | 完整 DM | 骰子引擎（隐藏 WIP） | TRPG |
| *RPG* 🙈 | 引导 | 章节/任务/羁绊（隐藏 WIP） | JRPG |
| *经营* 🙈 | 报告者 | 资源/时间/决策（隐藏 WIP） | 模拟经营 |

🙈 = 引擎完成，UI 隐藏。用户决定何时暴露。

## 双段式叙事管线（v1.0.1）

```
用户输入
  → Director DM（JS/LLM 混合）→ Direction Packet
  → Story Writer（LLM）→ 【叙事】+【状态建议】+【情绪反馈】
  → Guardian（JS 优先，<50 分自动 LLM 修正）→ completeTurn → 自动存档
```

### 管线进化（v0.8.0→v1.0.1）

| 能力 | 版本 | 说明 |
|------|:---:|------|
| 健康检查 | v0.8.0 | 5 项纯 JS 扫描（缺失字段/重复ID/断裂引用/时间线冲突/关键词冲突） |
| 写入管控 | v0.8.0 | 三级权限 + 待确认队列（3 轮未确认自动清理） |
| 自动纠错 | v0.8.5 | JS 检测→注入 canon 事实→LLM 修正→重新校验（最多 2 轮） |
| 记忆可追溯 | v0.9.0 | 每条记忆标注 _why（触发原因+因果链）+ _provenance（来源+可信度） |
| 多模型分工 | v0.9.5 | Director/Writer/Guardian 可各自指定模型和 API 端点，404 自动回退 |

## Director 层

Director 位于用户输入和 LLM 之间，管理：

- **情绪状态机**：4 维玩家模型（engagement/tension/fatigue/curiosity）
- **叙事者风格**：8 种预设，影响事件调度（疲劳保护 > 剧情连续性 > 玩家情绪 > 叙事者 > 风格）
- **事件评分**：核心事件走判断评分，环境事件走概率
- **节奏分析**：检测过紧/过松，疲劳时阻止新事件
- **预测缓存**：边界事件（20-50 分）缓存后自然冒泡
- **全局记忆**：跨模组快照检索（关键词 + 情绪 + 时效 + 因果链加分）

## LLM Director 模式

| 模式 | Token 消耗 | 说明 |
|------|:---:|------|
| 纯 JS | 0 | 确定性方向包 |
| 混合 ⭐ | 150-250 | LLM 分析语义 + JS 守卫决策。性价比最优 |
| LLM Director | 全量 | 完整 JSON 方向包。解析失败自动回退 JS |

## 剧本杀

独立案件引擎，不走叙事管线：

- **状态机**：开场→选角→阅读→调查(×N)→讨论(×N)→指认→揭晓→评分
- **信息管制**：线索不调查不揭示，嫌疑人审讯才回答
- **多人适配**：AI 模拟其他玩家发言，凶手自动误导
- `defaults/cases/镜中人之死.json` — 6 角色、12 线索、完整的密室本格推理

## 可选 Hermes 集成

Settings 中配置 API Base URL + Token。配置后对话面板可创建 session 并发送消息。

## 直连 LLM 游戏模式

Game 标签页可直连 OpenAI 兼容 `/chat/completions` API。

### 🆕 多模型分工（v0.9.5）

每个角色可独立指定模型和 API：

```json
{
  "llmModel": "gpt-4o",
  "llmModelDirector": "deepseek-chat",
  "llmModelWriter": "claude-sonnet-4",
  "llmModelGuardian": "deepseek-chat"
}
```

推荐：Director/Guardian 用便宜快速模型，Writer 用最强创意模型。约节省 50-70% 成本。

## 质量保障

```powershell
npm run preflight    # audit + test 一键跑通
npm run audit        # 版本一致性 / 危险路径 / 目录结构
npm run test         # 54 项集成测试（语法→导入→功能→集成）
```

## 核心模块

| 模块 | 内容 |
|------|------|
| M1 | 世界书隔离容器 |
| M2 | 触发式条目（精确/语义/向量匹配） |
| M3-M10 | 世界状态、组织、角色、认知、种族 |
| M11 | 场景会话管理 |
| M12 | 故事模板 |
| M13 | 五层叙事引擎 |
| M15 | 世界规则 + 叙事质量审查 |
| M16-M18 | 时间、随机事件、场景预测 |
| M19 | 角色卡驱动模式 |
| M-创作 | 六阶段创作向导（全模块覆盖） |

## 源码结构

```
src/
  main.cjs             Electron 主进程 + IPC（配置/秘密/世界/健康检查/采纳）
  preload.cjs          contextBridge API
  adapters/llm.js      多模型分工 LLM 适配器 + 双段式管线
  core/
    world-engine.js     模式 Prompt 构建 + Guardian 校验包
    engine/
      guardian.js       M1 守门人 + JS 叙事校验
      guardian-llm.js   LLM 事实注入 + 自动修正
      global-memory.js  全局记忆 v2（_why + 溯源标记）
      health-check.js   世界健康检查（5 项）
      overlay-store.js  Overlay 写入 + Pending 队列
      lifecycle.js      prepareTurn / completeTurn
      director.js       Director 层（情绪/事件/缓存）
      storytellers.js   8 种叙事者风格
      murder-mystery.js 剧本杀案件引擎
      tabletop.js       跑团（🙈）
      rpg.js            RPG（🙈）
      sim.js            经营（🙈）
    data/               角色卡/规则/预测/场景/邻近
  ui/                   渲染进程（视图/样式/i18n）
scripts/
  audit.mjs             项目审计
  test.mjs              54 项集成测试
defaults/
  engine-profile/       直连 LLM 运行时适配器
  engine-knowledge/     全文可搜索知识库
  world-profiles/       子类型配置
  cases/                剧本杀案例
```

## 打包

```powershell
npm run dist    # electron-builder → Windows portable
```
