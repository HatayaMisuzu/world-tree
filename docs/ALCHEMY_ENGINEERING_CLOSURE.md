# 炼金台工程闭环

炼金台是 World Tree 的统一创作入口和本地化导入入口，不是普通的 AI 文本生成框。

## 两条主链路

### 快速创世

用户输入简单想法，系统生成最低可玩的世界框架。用户可以直接开玩，也可以继续完善。

### 本地化导入

用户输入较完整设定，系统提取、整理、补缺，并生成 World Tree 可执行文件夹草案。

## 交互方式

炼金台不使用连续问卷式追问。正确方式是：

1. 用户自由输入。
2. LLM 给功能入口地图。
3. LLM 说明每个入口可用机制。
4. 用户自由补充自己的想法。
5. 用户没想法的部分，LLM 给默认方案。
6. 用户确认最终输出目标。
7. 系统生成预览和本地化草案。
8. 用户确认后才交付。

## 功能入口

- 可玩世界
- Worldbook
- Character
- Mechanism
- Strategy Sim
- Tabletop
- Detective / ScriptKill

## 硬规则

- LLM 可以推荐，不能替用户决定最终入口。
- 用户确认前不能写正式文件。
- 所有 LLM 补充必须标记为 `llm_suggested`。
- 用户明确输入必须标记为 `user_specified` 或 `imported_source`。
- hiddenTruth / gm_only 不得进入玩家可见开场。
- API key、token、本地路径、script/style/html 必须清理。

## 完成标准

- 简单想法能创建可玩世界。
- 完整设定能本地化为 World Tree 文件夹。
- worldbook / character / mechanism 能真实写入。
- strategy spec 能生成并封印。
- 交付有日志。
- 所有链路有测试。
