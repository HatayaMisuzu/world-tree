# 存档系统与 .worldtree

## 项目结构

```
{{project}}/
├── world.json            # 项目元信息（mode, metadata）
├── shared/               # 项目真相源
│   ├── worldbook.json    # 世界书条目
│   ├── scenes.json       # 场景
│   ├── world_state.json  # 世界状态
│   ├── timeline.json     # 时间线
│   ├── relations.json    # 关系网络
│   ├── world_threads.json# 叙事牵引/目标
│   └── *_mode.json       # 各模式专属文件
└── runtime/              # 运行时数据
    ├── state.json        # 引擎状态
    ├── source.txt        # 原始输入
    ├── chat.jsonl        # 对话记录
    ├── cache/            # 可重建缓存
    └── *-proposals.jsonl # 待审核提案
```

## shared vs runtime

- shared = 项目真相源，只能通过 proposal approve 修改
- runtime = 对话、缓存、提案、日志
- cache = 可重建，不是真相源
- proposals = 待审核变更，pending 不生效

## .worldtree 导出/导入

导出: `POST /api/world-pack/export` → .worldtree 文件
导入: `POST /api/world-pack/import` → 新项目

规则:
- 敏感信息（API Key 等）不导出
- runtime 私密内容默认不导出
- mode metadata 必须保留
- shared 文件全部导出

## Branch-local saves

启用时间线分支后，活动存档根为 `branches/<activeBranchId>/`，其下拥有独立 `shared/` 与 `runtime/`。真实回合的 chat、state、场景摘要、遥测、提案、Growth Tree 和处理候选写入活动分支；根目录 `world.json` 只保留项目级元数据。导出逻辑仍遵守现有 World Pack 安全筛选，不把 debug、密钥或隐藏运行数据当作 canon。
