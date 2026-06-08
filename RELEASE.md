# World Tree Desktop v2.2.0 — 发布检查清单

## 发布前

- [ ] `node scripts/audit.mjs` → 0 错误
- [ ] `node scripts/test.mjs` → 全部通过
- [ ] `node scripts/interface-audit.mjs` → 全部通过
- [ ] `npm run preflight` → 三项全过
- [ ] 版本号一致：`package.json` / `README.md` / `CHANGELOG.md` / `app-manifest.json`
- [ ] CHANGELOG.md 已记录本次变更

## 核心文件清单

| 层 | 文件 | 说明 |
|---|------|------|
| 入口 | `server.js` | Node.js HTTP 服务器（所有 REST API） |
| UI | `world-tree-console.html` | 唯一 Web UI（13 标签页） |
| 适配器 | `src/adapters/llm.js` | 三角色 LLM 调用 + 双段式管线 |
| 引擎 | `src/core/world-engine.js` | 引擎入口 + 模式 Prompt 构建 |
| 引擎 | `src/core/engine/` | director/guardian/lifecycle/context-engine 等 37 模块 |
| 数据 | `src/core/data/` | 世界书/角色卡/炼金台/邻近环等 19 模块 |
| 脚本 | `scripts/audit.mjs` | 项目审计（版本/路径/目录） |
| 脚本 | `scripts/test.mjs` | 集成测试（75 项） |
| 脚本 | `scripts/interface-audit.mjs` | 接口联动审计（47 项） |

### 新增文件（v2.2.0）

```
src/core/data/skill-generator.js    VC-3 人格提炼引擎
src/core/data/skill-parser.js       SKILL.md → JSON 解析桥
```

### 角色卡目录（炼金台产出）

```
data/engine/characters/{name}/
├── card.json              ← parseCharacterCard() 直接消费（VC-3 人格提炼输出）
└── runtime/               ← 对话持久化
```

## 版本历史

| 版本 | 日期 | 里程碑 |
|------|------|--------|
| v2.2.0 | 2026-06-08 | 炼金台 → 角色卡生成管线 + VC-3 人格提炼 + 角色卡双来源 |
| v2.1.0 | 2026-06-08 | 全链路持久化 + 炼金台集成 + 接口联动审计 |
| v2.0   | 2026-06-08 | 重构为纯 Web 应用（去 Electron） |
| v1.0.1 | 2026-06-07 | 便携数据根与可用性修复 |
| v1.0.0 | 2026-06-06 | 初始发布：内容系统 + UI 终端 |
