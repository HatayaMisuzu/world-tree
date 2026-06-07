# World Tree Desktop — 发布检查清单

## 发布前

- [ ] `node scripts/audit.mjs` → 0 错误
- [ ] `node scripts/test.mjs` → 全部通过
- [ ] 版本号一致：`package.json` / `app-manifest.json` / `README.md` / `CHANGELOG.md`
- [ ] CHANGELOG.md 已记录本次变更
- [ ] `npm run preflight` 全部通过

## 核心文件清单

| 层 | 文件 | 说明 |
|---|------|------|
| 入口 | `src/main.cjs` | Electron 主进程 + IPC |
| 桥接 | `src/preload.cjs` | contextBridge API |
| 适配器 | `src/adapters/llm.js` | LLM 调用 + 双段式管线 |
| 引擎 | `src/core/world-engine.js` | 模式 Prompt 构建 + Guardian 校验包 |
| 引擎 | `src/core/engine/guardian.js` | M1 守门人 + JS 校验 |
| 引擎 | `src/core/engine/guardian-llm.js` | LLM 事实注入 + 自动修正 |
| 引擎 | `src/core/engine/global-memory.js` | 全局记忆 v2（_why+溯源） |
| 引擎 | `src/core/engine/health-check.js` | 世界健康检查 |
| 引擎 | `src/core/engine/overlay-store.js` | Overlay 写入 + Pending 队列 |
| 引擎 | `src/core/engine/lifecycle.js` | prepareTurn / completeTurn |
| 引擎 | `src/core/engine/director.js` | Director 层（情绪/事件/缓存） |
| 数据 | `src/core/data/` | 角色卡/规则/预测/场景/邻近 |
| 脚本 | `scripts/audit.mjs` | 项目审计 |
| 脚本 | `scripts/test.mjs` | 集成测试（54 项） |

## 版本历史

| 版本 | 日期 | 里程碑 |
|------|------|--------|
| v0.6.9 | 2026-06-05 | 分层风动画主页 |
| v0.7.4 | 2026-06-05 | UI 重做（Codex 主题） |
| v0.7.4.1 | 2026-06-05 | 数据归家 |
| v0.7.5 | 2026-06-05 | 审计脚本 |
| v0.8.0 | 2026-06-05 | 健康检查 + 采纳机制 |
| v0.8.5 | 2026-06-05 | Guardian 事实注入 + 自动修正 |
| v0.9.0 | 2026-06-05 | 记忆可解释 |
| v0.9.5 | 2026-06-05 | 多模型分工 |
| v1.0.0 | 2026-06-05 | 测试 + 发布标准化 |
