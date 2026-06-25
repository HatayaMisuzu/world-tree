# Tabletop V2 完整功能闭环报告

## 已完成功能

### 服务器端
- ✅ 12 个 Tabletop V2 API 端点（含 import-commit, runs, load-run, restore-save, switch-branch, export-run）
- ✅ 无重复路由注册
- ✅ 所有 API 响应自动剥离 hiddenGmState

### 模块导入
- ✅ 支持 JSON / Markdown / YAML Frontmatter / 纯文本导入
- ✅ 自动提取标题、背景、目标、场景、NPC、道具、规则集等
- ✅ 完整性校验（至少需要标题+前提+场景+行动类型+规则集）
- ✅ GM 隐藏信息永不进入 playerBrief

### 运行态
- ✅ 10 步 GM 循环（分类→验证→投骰→状态变更→叙事→LLM润色→泄露扫描→持久化→返回）
- ✅ 状态变更引擎（场景过渡、时钟推进、物品管理、NPC 状态）
- ✅ 存档/分支/恢复/切换
- ✅ Hidden leak scanner

### UI
- ✅ 完整跑团桌面：场景/队伍/NPC/时钟/道具/存档 6 标签
- ✅ 导入预览面板
- ✅ 行动输入与投骰结果展示

### 资产隔离
- ✅ 资产引用只读快照
- ✅ 不写回源资产
- ✅ 命名空间隔离（runtime/cache/save/branch/llm）

### 测试
- ✅ 67 基础测试 (foundation)
- ✅ 43 运行时测试 (runtime)  
- ✅ 6 路由去重测试 (server-routes)
- ✅ 21 导入器测试 (module-importer)
- ✅ 7 状态变更测试 (state-mutation)
- ✅ 7 泄露扫描测试 (hidden-leak)
- ✅ 7 GM 循环测试 (gm-loop)
- ✅ 10 资产解析测试 (asset-resolver)
- **合计: 168 tests**

## API 端点

| Method | Path | Handler |
|--------|------|---------|
| POST | /api/tabletop-v2/import-preview | previewTabletopV2Import |
| POST | /api/tabletop-v2/import-commit | commitTabletopV2Import |
| GET | /api/tabletop-v2/runs | listTabletopV2Runs |
| POST | /api/tabletop-v2/start | startTabletopV2Run |
| POST | /api/tabletop-v2/load-run | loadTabletopV2Run |
| POST | /api/tabletop-v2/turn | handleTabletopV2Turn |
| POST | /api/tabletop-v2/save | saveTabletopV2Run |
| POST | /api/tabletop-v2/restore-save | restoreTabletopV2Save |
| POST | /api/tabletop-v2/branch | branchTabletopV2Run |
| POST | /api/tabletop-v2/switch-branch | switchTabletopV2Branch |
| POST | /api/tabletop-v2/end-summary | endTabletopV2Run |
| POST | /api/tabletop-v2/export-run | exportTabletopV2Run |
