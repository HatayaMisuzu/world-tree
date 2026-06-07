# World Tree Desktop · CHANGELOG

> 审查记录。AI 无需阅读此文件。

## v1.0.1 — 便携数据根与可用性修复 (2026-06-07)

- 将打包版配置、密钥、缓存迁移到 exe 同目录 `userData/`，避免散落到系统 AppData。
- 将运行时世界与 overlay 数据统一到 exe 同目录 `data/`，修复 asar 内部路径不可写和 `data/data/engine` 双层路径问题。
- 将 `world-tree-console.html` 纳入打包清单，并在打开观测终端时导出到便携根目录。
- 更新菜单中的数据目录/便携根目录入口，确保用户能直接找到真实数据位置。
- 更新 `scripts/check.mjs`，让自检匹配当前 `src/v0-out` 前端结构。

## v1.0.0 — 终端 UI 与便携版刷新 (2026-06-06)

- 主菜单改为玩家入口：开始旅程、读取记忆、世界设定、观测终端。
- 接入透明 Alpha 世界树徽章、角花纹、功能图标和状态栏边框。
- 设置页将模型连接、叙事模式、世界内容放在表面，高级指令和路径信息折叠收纳。
- 观测终端优先展示世界脉象，系统诊断移入高级区域。
- 修复 `path-catalog.js` 跨行字符串导致前端入口导入失败的问题。
- 更新 Electron win-unpacked 便携版结构审计规则。

## v2.0 — 内容系统全面升级 (2026-06-06)

### 新增模块 (15 文件)

**内容系统地基**
- `engine/content-registry.js` — 12种内容类型统一注册表 + 4级变更分级
- `engine/proposal-system.js` — LLM提案→分级→止损确认管道
- `schemas/` — 9个 JSON Schema (character/organization/timeline/worldbook-entry/scene/rule/location/item/faction)

**内容系统升级**
- `data/world-state.js` v2 — 八维状态面板 + 每轮快照
- `data/relations.js` — 角色关系图谱（14种类型，独立于组织）
- `data/timeline-causality.js` — 因果链DAG + 改动影响回溯 + 命运回响
- `engine/guardian.js` v2 — 新增5项检查（人设/世界观/战力/时间线/未授权内容）
- `engine/memory-layers.js` — 五层记忆体系（短期/会话/角色/世界/玩家）

**内容炼金台 (独立模块)**
- `data/alchemy/` — 8文件完整模块（types/classifier/extractor/deduplicator/engine + 3 parsers）

**上下文引擎**
- `engine/context-router.js` — 场景帧→定向查表
- `engine/context-indexer.js` — 加权全文搜索+五机制降噪+聚类
- `engine/context-assembler.js` — Router+Indexer合并去重排序
- `engine/context-engine.js` — 统一入口 + 三模式策略

**创新功能**
- `engine/branch-system.js` — 枝干系统（四态: active/dead/merged/trunk + 嫁接合并）
- `engine/director-modes.js` — 7种叙事导演模式（轻小说/跑团DM/黑暗奇幻/治愈日常/悬疑/战争史诗/沙盒）
- `engine/world-telemetry.js` — 世界脉象（15维度池 + LLM自适应选择 + 趋势追踪 + 三层输出）

### 修改文件
- `world-engine.js` — 三 builder 统一切到 context-engine；注入导演模式 prompt
- `main.cjs` — +38 IPC 通道（84 total）
- `preload.cjs` — +38 API（84 total）

### 审查结论
- 导入路径: 全15核心模块通过
- IPC通道: 84/84 preload↔main 完全匹配
- Null safety: context-engine effectiveStrategy 引用已修复
- Schema 完整性: 9/9 schema 文件就位
- 回归: 旧模块 7/7 不受影响

### 版本: 2.0
