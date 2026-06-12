# Codex Interface Notes — World Tree

> v0.7.4.1+ 起，UI 设计和图片资产由 Codex 处理。
> 本文档记录引擎侧给 Codex 暴露的接口约束和注释约定。

## 路径约定

所有运行时数据统一在项目 `data/` 目录下：

```
<PROJECT_ROOT>/data/
├── engine/          ← overlay / worlds / global-memory / simulate
│   ├── runs/        ← 运行数据（按 dataMode 分目录）
│   ├── worlds/      ← Minecraft 式世界存档
│   └── global-memory/ ← 全局记忆快照
├── modules/         ← 用户加载的世界书模组
└── profiles/        ← 子类型配置
```

## IPC 通道给 Codex

Codex 可以通过 preload.cjs 暴露的 API 调用这些通道：

| 通道 | 用途 |
|---|---|
| `data:readRoot` | 读取数据根目录结构（默认 `data/`） |
| `overlay:read` | 读取 overlay 文件内容 |
| `overlay:listAudit` | 列出审计日志 |
| `engine:manifest` | 获取引擎模块清单 |
| `config:get` | 获取当前配置 |

## Codex 不要动的区域

- `src/core/` — 引擎核心逻辑
- `src/adapters/llm.js` — LLM 调用适配器
- `src/main.cjs` — Electron 主进程
- `defaults/engine-profile/` — 引擎知识卡
- `defaults/engine-profile/` — 引擎模块配置

## Codex 可以动的区域

- `src/ui/` — 所有 UI 代码（renderer.js / views.js / index.html / styles.css / theme-tokens.css / world-tree-theme.css）
- 图片资产 — `src/ui/` 下的 PNG/SVG 文件
- `defaults/world-profiles/` — 世界书子类型配置（classic.json 等）
- `personas/` — 人格文件
